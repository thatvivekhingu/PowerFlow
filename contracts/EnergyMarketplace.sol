// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GRIDMIND Energy Marketplace
 * @notice Decentralized P2P Renewable Energy Trading & DISCOM Grid Settlement Contract
 * @dev Implements energy listings, buyer matching, DISCOM grid approval, and escrow settlement.
 */
contract EnergyMarketplace {
    address public immutable discomOperator;
    uint256 public constant DISCOM_WHEELING_FEE_BPS = 20; // 0.2% wheeling & grid charge
    uint256 public constant PLATFORM_FEE_BPS = 5;         // 0.05% platform facilitation

    enum TradeStatus { Created, GridApproved, Settled, Cancelled }

    struct Listing {
        uint256 listingId;
        address seller;
        string feederId;
        uint256 quantityKwh;   // Scaled by 1e18 (wei-equivalent)
        uint256 pricePerKwh;   // In wei or fiat currency smallest unit (e.g., paise)
        bool active;
        uint256 createdAt;
    }

    struct Trade {
        uint256 tradeId;
        uint256 listingId;
        address seller;
        address buyer;
        string feederId;
        uint256 quantityKwh;
        uint256 clearingPrice;
        uint256 grossAmount;
        uint256 discomFee;
        TradeStatus status;
        bytes32 auditHash;
        string discomInvoiceRef;
        uint256 settledAt;
    }

    uint256 private _listingIdCounter;
    uint256 private _tradeIdCounter;

    mapping(uint256 => Listing) public listings;
    mapping(uint256 => Trade) public trades;

    event EnergyListed(
        uint256 indexed listingId,
        address indexed seller,
        string feederId,
        uint256 quantityKwh,
        uint256 pricePerKwh
    );

    event TradeInitiated(
        uint256 indexed tradeId,
        uint256 indexed listingId,
        address indexed buyer,
        address seller,
        uint256 quantityKwh,
        uint256 clearingPrice
    );

    event GridApproved(
        uint256 indexed tradeId,
        string feederId,
        uint256 headroomKw,
        address approver
    );

    event TradeSettled(
        uint256 indexed tradeId,
        bytes32 auditHash,
        string discomInvoiceRef,
        uint256 grossAmount,
        uint256 discomFee,
        uint256 sellerCredit,
        uint256 settledAt
    );

    modifier onlyDiscom() {
        require(msg.sender == discomOperator, "GRIDMIND: Only DISCOM operator authorized");
        _;
    }

    constructor() {
        discomOperator = msg.sender;
    }

    /**
     * @notice Prosumers list surplus solar energy
     */
    function listEnergy(
        string calldata feederId,
        uint256 quantityKwh,
        uint256 pricePerKwh
    ) external returns (uint256) {
        require(quantityKwh > 0, "Quantity must be > 0");
        require(pricePerKwh > 0, "Price must be > 0");

        _listingIdCounter++;
        uint256 id = _listingIdCounter;

        listings[id] = Listing({
            listingId: id,
            seller: msg.sender,
            feederId: feederId,
            quantityKwh: quantityKwh,
            pricePerKwh: pricePerKwh,
            active: true,
            createdAt: block.timestamp
        });

        emit EnergyListed(id, msg.sender, feederId, quantityKwh, pricePerKwh);
        return id;
    }

    /**
     * @notice Buyer initiates purchase from active solar listing
     */
    function buyEnergy(
        uint256 listingId,
        uint256 requestedKwh
    ) external returns (uint256) {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing is not active");
        require(requestedKwh > 0 && requestedKwh <= listing.quantityKwh, "Invalid quantity");

        listing.quantityKwh -= requestedKwh;
        if (listing.quantityKwh == 0) {
            listing.active = false;
        }

        _tradeIdCounter++;
        uint256 tradeId = _tradeIdCounter;

        uint256 gross = (requestedKwh * listing.pricePerKwh) / 1e18;
        uint256 discomFee = (gross * DISCOM_WHEELING_FEE_BPS) / 10000;

        trades[tradeId] = Trade({
            tradeId: tradeId,
            listingId: listingId,
            seller: listing.seller,
            buyer: msg.sender,
            feederId: listing.feederId,
            quantityKwh: requestedKwh,
            clearingPrice: listing.pricePerKwh,
            grossAmount: gross,
            discomFee: discomFee,
            status: TradeStatus.Created,
            auditHash: bytes32(0),
            discomInvoiceRef: "",
            settledAt: 0
        });

        emit TradeInitiated(tradeId, listingId, msg.sender, listing.seller, requestedKwh, listing.pricePerKwh);
        return tradeId;
    }

    /**
     * @notice DISCOM grid operator approves transmission after verifying headroom
     */
    function approveGridClearance(
        uint256 tradeId,
        uint256 headroomKw
    ) external onlyDiscom {
        Trade storage trade = trades[tradeId];
        require(trade.status == TradeStatus.Created, "Trade already processed");
        require(headroomKw >= 10, "Transformer headroom insufficient");

        trade.status = TradeStatus.GridApproved;
        emit GridApproved(tradeId, trade.feederId, headroomKw, msg.sender);
    }

    /**
     * @notice DISCOM operator finalizes settlement, writes audit hash and invoice ref
     */
    function settleTrade(
        uint256 tradeId,
        string calldata discomInvoiceRef
    ) external onlyDiscom {
        Trade storage trade = trades[tradeId];
        require(trade.status == TradeStatus.GridApproved, "Grid clearance required before settlement");

        bytes32 auditHash = keccak256(
            abi.encodePacked(
                tradeId,
                trade.seller,
                trade.buyer,
                trade.quantityKwh,
                trade.clearingPrice,
                discomInvoiceRef,
                block.timestamp
            )
        );

        trade.status = TradeStatus.Settled;
        trade.auditHash = auditHash;
        trade.discomInvoiceRef = discomInvoiceRef;
        trade.settledAt = block.timestamp;

        uint256 sellerCredit = trade.grossAmount - trade.discomFee;

        emit TradeSettled(
            tradeId,
            auditHash,
            discomInvoiceRef,
            trade.grossAmount,
            trade.discomFee,
            sellerCredit,
            block.timestamp
        );
    }

    function getTrade(uint256 tradeId) external view returns (Trade memory) {
        return trades[tradeId];
    }
}
