// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {RoleManagementHelper} from "scripts/lib/RoleManagementHelper.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title RevokeTreasurerRole
 * @notice Foundry script to revoke TREASURER_ROLE from an address
 * @dev Requires the caller to have admin rights in AccessManager
 */
contract RevokeTreasurerRole is Script {
    using RoleManagementHelper for *;
    using ScriptHelpers for *;

    /**
     * @notice Revoke TREASURER_ROLE from a target address
     * @dev Uses environment variables:
     *      - PRIVATE_KEY: Private key of an admin
     *      - ACCESS_MANAGER: Address of the AccessManager contract
     *      - TARGET_ADDRESS: Address to revoke the role from
     */
    function run() external {
        uint256 adminPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(adminPrivateKey);

        revokeTreasurerRole();

        vm.stopBroadcast();
    }

    /**
     * @notice Revoke TREASURER_ROLE from target address
     * @dev This function contains the testable business logic
     */
    function revokeTreasurerRole() public {
        address accessManager = vm.envAddress("ACCESS_MANAGER");
        address targetAddress = vm.envAddress("TARGET_ADDRESS");

        ScriptHelpers.requireNonZero(accessManager, "ACCESS_MANAGER");
        ScriptHelpers.requireNonZero(targetAddress, "TARGET_ADDRESS");

        RoleManagementHelper.revokeTreasurerRole(accessManager, targetAddress);

        console2.log("TREASURER_ROLE revoked from:", targetAddress);
    }
}}
