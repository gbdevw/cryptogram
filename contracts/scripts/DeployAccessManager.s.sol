// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {AccessManagerUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/access/manager/AccessManagerUpgradeable.sol";
import {DeploymentHelper} from "scripts/lib/DeploymentHelper.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title DeployAccessManager
 * @notice Foundry script to deploy AccessManagerUpgradeable with proxy pattern
 * @dev Deploys implementation and proxy, then initializes the AccessManager
 */
contract DeployAccessManager is Script {
    using DeploymentHelper for *;
    using ScriptHelpers for *;

    /**
     * @notice Main deployment function
     * @dev Uses environment variables for private key and initial admin
     * @return The deployed AccessManager proxy address
     */
    function run() external returns (address) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        address proxyAddress = deployAccessManager();
        
        vm.stopBroadcast();

        return proxyAddress;
    }

    /**
     * @notice Deploy AccessManager with all configuration
     * @dev This function contains the testable business logic
     * @return The deployed proxy address
     */
    function deployAccessManager() public returns (address) {
        address initialAdmin = vm.envAddress("INITIAL_ADMIN");
        ScriptHelpers.requireNonZero(initialAdmin, "INITIAL_ADMIN");
        
        DeploymentHelper.DeploymentResult memory result = 
            DeploymentHelper.deployAccessManager(initialAdmin);

        console2.log("AccessManager implementation deployed at:", result.implementation);
        console2.log("AccessManager proxy deployed at:", result.proxy);
        console2.log("Initial admin:", initialAdmin);

        return result.proxy;
    }
}