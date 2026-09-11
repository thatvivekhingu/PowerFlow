// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./EnergyToken.sol";
import "./UserRegistry.sol";

error Market_OfferNotActive();
error Market_IncorrectPayment();
error Market_OnlyConsumersCanBuy();
error Market_OnlyProsumersCanSell();
error Market_TransferFailed();
error Market_SelfPurchase();

/**
 * @title PowerflowMarket
 * @dev Decentralized P2P energy marketplace with escrow, atomic swaps, and DISCOM wheeling fees.
 */
contract PowerflowMarket is Ownable, ReentrancyGuard {

    struct Offer {
        uint256 id;
        address seller;
        string feederId;
        uint256 amountKwh;
        uint256 pricePerKwhWei;
        bool active;
    }

    EnergyToken public token;
    UserRegistry public registry;
    address public discomTreasury;
    uint256 public discomWheelingFeeBasisPoints = 250; // 2.5% DISCOM wheeling charge

    uint256 public offerCount;
    mapping(uint256 => Offer) public offers;

    event OfferCreated(uint256 indexed id, address indexed seller, string feederId, uint256 amountKwh, uint256 pricePerKwhWei);
    event OfferCancelled(uint256 indexed id, address indexed seller);
    event EnergyTraded(
        uint256 indexed id,
        address indexed seller,
        address indexed buyer,
        uint256 amountKwh,
        uint256 grossPaymentWei,
        uint256 discomFeeWei,
        uint256 netSellerPayoutWei
    );

    constructor(
        address _tokenAddress,
        address _registryAddress,
        address _discomTreasury
    ) Ownable(msg.sender) {
        token = EnergyToken(_tokenAddress);
        registry = UserRegistry(_registryAddress);
        discomTreasury = _discomTreasury;
    }

    function setDiscomWheelingFee(uint256 _basisPoints) external onlyOwner {
        require(_basisPoints <= 1000, "Max fee is 10%");
        discomWheelingFeeBasisPoints = _basisPoints;
    }

    function setDiscomTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        discomTreasury = _treasury;
    }

    function createSellOffer(uint256 _amountKwh, uint256 _pricePerKwhWei) external nonReentrant {
        if (!registry.isProsumer(msg.sender)) {
            revert Market_OnlyProsumersCanSell();
        }

        bool sent = token.transferFrom(msg.sender, address(this), _amountKwh);
        if (!sent) {
            revert Market_TransferFailed();
        }

        string memory feeder = registry.getUserFeeder(msg.sender);
        offerCount++;
        offers[offerCount] = Offer({
            id: offerCount,
            seller: msg.sender,
            feederId: feeder,
            amountKwh: _amountKwh,
            pricePerKwhWei: _pricePerKwhWei,
            active: true
        });

        emit OfferCreated(offerCount, msg.sender, feeder, _amountKwh, _pricePerKwhWei);
    }

    function cancelOffer(uint256 _offerId) external nonReentrant {
        Offer storage offer = offers[_offerId];
        require(offer.active, "Offer not active");
        require(offer.seller == msg.sender, "Not offer owner");

        offer.active = false;
        bool refunded = token.transfer(offer.seller, offer.amountKwh);
        if (!refunded) {
            revert Market_TransferFailed();
        }

        emit OfferCancelled(_offerId, msg.sender);
    }

    function buyEnergy(uint256 _offerId) external payable nonReentrant {
        Offer storage offer = offers[_offerId];

        if (!offer.active) {
            revert Market_OfferNotActive();
        }
        if (msg.sender == offer.seller) {
            revert Market_SelfPurchase();
        }
        if (!registry.isConsumer(msg.sender)) {
            revert Market_OnlyConsumersCanBuy();
        }

        uint256 totalCost = (offer.amountKwh * offer.pricePerKwhWei) / 1e18;
        if (msg.value != totalCost) {
            revert Market_IncorrectPayment();
        }

        offer.active = false;

        // Calculate DISCOM wheeling charge and net seller payout
        uint256 discomFee = (totalCost * discomWheelingFeeBasisPoints) / 10000;
        uint256 sellerPayout = totalCost - discomFee;

        // 1. Transfer Energy Tokens (NRG) to Buyer
        bool sentToken = token.transfer(msg.sender, offer.amountKwh);
        if (!sentToken) {
            revert Market_TransferFailed();
        }

        // 2. Transfer Net ETH to Seller
        (bool sentSeller, ) = offer.seller.call{value: sellerPayout}("");
        if (!sentSeller) {
            revert Market_TransferFailed();
        }

        // 3. Transfer Wheeling Fee to DISCOM Treasury
        if (discomFee > 0 && discomTreasury != address(0)) {
            (bool sentDiscom, ) = discomTreasury.call{value: discomFee}("");
            require(sentDiscom, "DISCOM fee transfer failed");
        }

        emit EnergyTraded(
            _offerId,
            offer.seller,
            msg.sender,
            offer.amountKwh,
            totalCost,
            discomFee,
            sellerPayout
        );
    }
}
