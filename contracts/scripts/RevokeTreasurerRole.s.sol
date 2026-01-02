// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {AccessManagerUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/access/manager/AccessManagerUpgradeable.sol";

/**
 * @title RevokeTreasurerRole
 * @notice Foundry script to revoke TREASURER_ROLE from an address
 * @dev Requires the caller to have admin rights in AccessManager
 */
contract RevokeTreasurerRole is Script {
    /// @notice Role ID for TREASURER_ROLE
    uint64 public constant TREASURER_ROLE = 2;

    /**
     * @notice Revoke TREASURER_ROLE from a target address
     * @dev Uses environment variables:
     *      - PRIVATE_KEY: Private key of an admin
     *      - ACCESS_MANAGER: Address of the AccessManager contract
     *      - TARGET_ADDRESS: Address to revoke the role from
     */
    function run() external {
        // Retrieve environment variables
        uint256 adminPrivateKey = vm.envUint("PRIVATE_KEY");
        address accessManager = vm.envAddress("ACCESS_MANAGER");
        address targetAddress = vm.envAddress("TARGET_ADDRESS");

        // Start broadcasting transactions
        vm.startBroadcast(adminPrivateKey);

        AccessManagerUpgradeable manager = AccessManagerUpgradeable(accessManager);
        
        // Revoke the role
        manager.revokeRole(TREASURER_ROLE, targetAddress);
        
        console2.log("TREASURER_ROLE revoked from:", targetAddress);

        // Stop broadcasting transactions
        vm.stopBroadcast();
    }
}
