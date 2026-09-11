// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title UserRegistry
 * @dev Manages user roles (Prosumer vs Consumer), smart meter mapping, and feeder allocations.
 */
contract UserRegistry is Ownable {

    enum Role { None, Consumer, Prosumer, DiscomOperator }

    struct UserProfile {
        Role role;
        string meterId;
        string feederId;
        bool isActive;
    }

    mapping(address => UserProfile) public users;
    mapping(string => address) public meterToAddress;

    event UserRegistered(address indexed userAddress, Role role, string meterId, string feederId);
    event UserStatusChanged(address indexed userAddress, bool isActive);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function registerUser(
        address _user,
        Role _role,
        string calldata _meterId,
        string calldata _feederId
    ) external onlyOwner {
        require(_role != Role.None, "UserRegistry: invalid role");
        require(meterToAddress[_meterId] == address(0) || meterToAddress[_meterId] == _user, "Meter already registered");

        users[_user] = UserProfile({
            role: _role,
            meterId: _meterId,
            feederId: _feederId,
            isActive: true
        });

        meterToAddress[_meterId] = _user;
        emit UserRegistered(_user, _role, _meterId, _feederId);
    }

    function isProsumer(address _user) external view returns (bool) {
        return users[_user].isActive && users[_user].role == Role.Prosumer;
    }

    function isConsumer(address _user) external view returns (bool) {
        return users[_user].isActive && (users[_user].role == Role.Consumer || users[_user].role == Role.Prosumer);
    }

    function getUserFeeder(address _user) external view returns (string memory) {
        return users[_user].feederId;
    }
}
