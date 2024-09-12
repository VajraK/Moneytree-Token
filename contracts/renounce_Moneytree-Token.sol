// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract RenounceMoneytreeToken is ERC20, Ownable {
    constructor(
        uint256 initialSupply
    ) ERC20("RenounceMoneytreeToken", "RMT") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    // Now Ownable functions like renounceOwnership() are available.
}
