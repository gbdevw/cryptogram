// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {AccessManagerUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/access/manager/AccessManagerUpgradeable.sol";

/**
 * @title GrantAdminRole
 * @notice Foundry script to grant ADMIN_ROLE to an address
 * @dev Requires the caller to have admin rights in AccessManager
 *      ADMIN_ROLE (role ID 0) is the default admin role that can manage other roles
 */
contract GrantAdminRole is Script {
    /// @notice Role ID for ADMIN_ROLE (default admin role in AccessManager)
    uint64 public constant ADMIN_ROLE = 0;

    /**
     * @notice Grant ADMIN_ROLE to a target address
     * @dev Uses environment variables:
     *      - PRIVATE_KEY: Private key of an existing admin
     *      - ACCESS_MANAGER: Address of the AccessManager contract
     *      - TARGET_ADDRESS: Address to grant the admin role to
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
        
        // Grant the admin role
        manager.grantRole(ADMIN_ROLE, targetAddress, executionDelay);
        
        console2.log("ADMIN_ROLE granted to:", targetAddress);
        console2.log("Execution delay:", executionDelay, "seconds");
        console2.log("WARNING: This address can now manage all roles in AccessManager");

        // Stop broadcasting transactions
        vm.stopBroadcast();
    }
}
