// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {RoleManagementHelper} from "scripts/lib/RoleManagementHelper.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title GrantFundsManagerRole
 * @notice Foundry script to grant FUNDS_MANAGER_ROLE to an address
 * @dev Requires the caller to have admin rights in AccessManager
 */
contract GrantFundsManagerRole is Script {
    using RoleManagementHelper for *;
    using ScriptHelpers for *;

    /**
     * @notice Grant FUNDS_MANAGER_ROLE to a target address
     * @dev Uses environment variables:
     *      - PRIVATE_KEY: Private key of an admin
     *      - ACCESS_MANAGER: Address of the AccessManager contract
     *      - TARGET_ADDRESS: Address to grant the role to
     *      - EXECUTION_DELAY: Delay in seconds before the role can be used (optional, default 0)
     */
    function run() external {
        uint256 adminPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(adminPrivateKey);

        grantFundsManagerRole();

        vm.stopBroadcast();
    }

    /**
     * @notice Grant FUNDS_MANAGER_ROLE to target address
     * @dev This function contains the testable business logic
     */
    function grantFundsManagerRole() public {
        address accessManager = vm.envAddress("ACCESS_MANAGER");
        address targetAddress = vm.envAddress("TARGET_ADDRESS");
        uint32 executionDelay = uint32(vm.envOr("EXECUTION_DELAY", uint256(0)));

        ScriptHelpers.requireNonZero(accessManager, "ACCESS_MANAGER");
        ScriptHelpers.requireNonZero(targetAddress, "TARGET_ADDRESS");

        RoleManagementHelper.grantFundsManagerRole(
            accessManager,
            targetAddress,
            executionDelay
        );

        console2.log("FUNDS_MANAGER_ROLE granted to:", targetAddress);
        console2.log("Execution delay:", executionDelay, "seconds");
    }
}
