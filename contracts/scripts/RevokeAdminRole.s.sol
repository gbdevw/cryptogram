// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AccessManagerUpgradeable} from "@openzeppelin/contracts-upgradeable/access/manager/AccessManagerUpgradeable.sol";

/**
 * @title RevokeAdminRole
 * @notice Foundry script to revoke ADMIN_ROLE from an address
 * @dev Requires the caller to have admin rights in AccessManager
 *      WARNING: Be careful not to revoke admin from all addresses, or the contract becomes unmanageable
 */
contract RevokeAdminRole is Script {
    /// @notice Role ID for ADMIN_ROLE (default admin role in AccessManager)
    uint64 public constant ADMIN_ROLE = 0;

    /**
     * @notice Revoke ADMIN_ROLE from a target address
     * @dev Uses environment variables:
     *      - PRIVATE_KEY: Private key of an existing admin
     *      - ACCESS_MANAGER: Address of the AccessManager contract
     *      - TARGET_ADDRESS: Address to revoke the admin role from
     */
    function run() external {
        // Retrieve environment variables
        uint256 adminPrivateKey = vm.envUint("PRIVATE_KEY");
        address accessManager = vm.envAddress("ACCESS_MANAGER");
        address targetAddress = vm.envAddress("TARGET_ADDRESS");

        // Start broadcasting transactions
        vm.startBroadcast(adminPrivateKey);

        AccessManagerUpgradeable manager = AccessManagerUpgradeable(accessManager);
        
        // Revoke the admin role
        manager.revokeRole(ADMIN_ROLE, targetAddress);
        
        console2.log("ADMIN_ROLE revoked from:", targetAddress);
        console2.log("WARNING: Ensure at least one admin remains to manage AccessManager");

        // Stop broadcasting transactions
        vm.stopBroadcast();
    }
}
