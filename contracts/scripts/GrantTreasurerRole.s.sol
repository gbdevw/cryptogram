// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {AccessManagerUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/access/manager/AccessManagerUpgradeable.sol";

/**
 * @title GrantTreasurerRole
 * @notice Foundry script to grant TREASURER_ROLE to an address
 * @dev Requires the caller to have admin rights in AccessManager
 */
contract GrantTreasurerRole is Script {
    /// @notice Role ID for TREASURER_ROLE
    uint64 public constant TREASURER_ROLE = 2;

    /**
     * @notice Grant TREASURER_ROLE to a target address
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
        manager.grantRole(TREASURER_ROLE, targetAddress, executionDelay);
        
        console2.log("TREASURER_ROLE granted to:", targetAddress);
        console2.log("Execution delay:", executionDelay, "seconds");

        // Stop broadcasting transactions
        vm.stopBroadcast();
    }
}
