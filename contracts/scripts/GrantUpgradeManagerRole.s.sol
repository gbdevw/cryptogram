// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AccessManagerUpgradeable} from "@openzeppelin/contracts-upgradeable/access/manager/AccessManagerUpgradeable.sol";

/**
 * @title GrantUpgradeManagerRole
 * @notice Foundry script to grant UPGRADE_MANAGER_ROLE to an address
 * @dev Requires the caller to have admin rights in AccessManager
 */
contract GrantUpgradeManagerRole is Script {
    /// @notice Role ID for UPGRADE_MANAGER_ROLE
    uint64 public constant UPGRADE_MANAGER_ROLE = 1;

    /**
     * @notice Grant UPGRADE_MANAGER_ROLE to a target address
     * @dev Uses environment variables:
     *      - PRIVATE_KEY: Private key of an admin
     *      - ACCESS_MANAGER: Address of the AccessManager contract
     *      - TARGET_ADDRESS: Address to grant the role to
     *      - EXECUTION_DELAY: Delay in seconds before the role can be used (optional, default 0)
     */
    function run() external {
        // Retrieve environment variables
        uint256 adminPrivateKey = vm.envUint("PRIVATE_KEY");
        address accessManager = vm.envAddress("ACCESS_MANAGER");
        address targetAddress = vm.envAddress("TARGET_ADDRESS");
        uint32 executionDelay = uint32(vm.envOr("EXECUTION_DELAY", uint256(0)));

        // Start broadcasting transactions
        vm.startBroadcast(adminPrivateKey);

        AccessManagerUpgradeable manager = AccessManagerUpgradeable(accessManager);
        
        // Grant the role
        manager.grantRole(UPGRADE_MANAGER_ROLE, targetAddress, executionDelay);
        
        console2.log("UPGRADE_MANAGER_ROLE granted to:", targetAddress);
        console2.log("Execution delay:", executionDelay, "seconds");

        // Stop broadcasting transactions
        vm.stopBroadcast();
    }
}
