// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {RoleManagementHelper} from "scripts/lib/RoleManagementHelper.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title GrantAdminRole
 * @notice Foundry script to grant ADMIN_ROLE to an address
 * @dev Requires the caller to have admin rights in AccessManager
 *      ADMIN_ROLE (role ID 0) is the default admin role that can manage other roles
 */
contract GrantAdminRole is Script {
    using RoleManagementHelper for *;
    using ScriptHelpers for *;

    /**
     * @notice Grant ADMIN_ROLE to a target address
     * @dev Uses environment variables:
     *      - PRIVATE_KEY: Private key of an existing admin
     *      - ACCESS_MANAGER: Address of the AccessManager contract
     *      - TARGET_ADDRESS: Address to grant the admin role to
     *      - EXECUTION_DELAY: Delay in seconds before the role can be used (optional, default 0)
     */
    function run() external {
        uint256 adminPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(adminPrivateKey);

        grantAdminRole();

        vm.stopBroadcast();
    }

    /**
     * @notice Grant ADMIN_ROLE to target address
     * @dev This function contains the testable business logic
     */
    function grantAdminRole() public {
        address accessManager = vm.envAddress("ACCESS_MANAGER");
        address targetAddress = vm.envAddress("TARGET_ADDRESS");
        uint32 executionDelay = uint32(vm.envOr("EXECUTION_DELAY", uint256(0)));

        ScriptHelpers.requireNonZero(accessManager, "ACCESS_MANAGER");
        ScriptHelpers.requireNonZero(targetAddress, "TARGET_ADDRESS");

        RoleManagementHelper.grantRole(
            accessManager,
            RoleManagementHelper.ADMIN_ROLE(),
            targetAddress,
            executionDelay
        );

        console2.log("ADMIN_ROLE granted to:", targetAddress);
        console2.log("Execution delay:", executionDelay, "seconds");
        console2.log("WARNING: This address can now manage all roles in AccessManager");
    }
}}
