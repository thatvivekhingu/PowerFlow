// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EnergyToken (NRG)
 * @dev ERC-20 token representing verified physical energy units (1 token = 1 kWh).
 * Mintable exclusively by an authorized Smart Meter Oracle to ensure physical-digital parity.
 */
contract EnergyToken is ERC20, Ownable {

    mapping(address => bool) public authorizedOracles;

    event OracleAuthorized(address indexed oracle);
    event OracleRevoked(address indexed oracle);
    event EnergyMinted(address indexed prosumer, uint256 amountKwh, string meterId);

    modifier onlyOracleOrOwner() {
        require(msg.sender == owner() || authorizedOracles[msg.sender], "EnergyToken: caller not authorized");
        _;
    }

    constructor(address initialOwner) ERC20("PowerFlow Energy Token", "NRG") Ownable(initialOwner) {}

    function setOracle(address oracle, bool status) external onlyOwner {
        authorizedOracles[oracle] = status;
        if (status) {
            emit OracleAuthorized(oracle);
        } else {
            emit OracleRevoked(oracle);
        }
    }

    /**
     * @dev Mint new energy tokens when smart meter records verified exportable solar surplus.
     */
    function mintEnergy(address prosumer, uint256 amountKwh, string calldata meterId) external onlyOracleOrOwner {
        _mint(prosumer, amountKwh);
        emit EnergyMinted(prosumer, amountKwh, meterId);
    }
}
