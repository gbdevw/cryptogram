// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {UUPSUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {DeploymentHelper} from "scripts/lib/DeploymentHelper.sol";
import {RoleManagementHelper} from "scripts/lib/RoleManagementHelper.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title DeployWeb3Sign
 * @notice Foundry script to deploy Web3Sign with proxy pattern
 * @dev Deploys implementation and proxy, then initializes the Web3Sign contract
 */
contract DeployWeb3Sign is Script {
    using DeploymentHelper for *;
    using RoleManagementHelper for *;
    using ScriptHelpers for *;
    
    /**
     * @notice Main deployment function
     * @dev Uses environment variables for private key, access manager, web3pgp, and fee
     * @return The deployed Web3Sign proxy address
     */
    function run() external returns (address) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        address proxyAddress = deployWeb3Sign();

        vm.stopBroadcast();

        return proxyAddress;
    }

    /**
     * @notice Deploy Web3Sign with all configuration
     * @dev This function contains the testable business logic
     * @return The deployed proxy address
     */
    function deployWeb3Sign() public returns (address) {
        // Retrieve environment variables
        address accessManager = vm.envAddress("ACCESS_MANAGER");
        address web3pgp = vm.envAddress("WEB3PGP");
        uint256 feeInWeis = vm.envUint("FEE_IN_WEIS");
        
        ScriptHelpers.requireNonZero(accessManager, "ACCESS_MANAGER");
        ScriptHelpers.requireNonZero(web3pgp, "WEB3PGP");
        ScriptHelpers.requireNonZeroUint256(feeInWeis, "FEE_IN_WEIS");

        // Deploy the contract
        DeploymentHelper.DeploymentResult memory result = 
            DeploymentHelper.deployWeb3Sign(feeInWeis, accessManager, web3pgp);

        console2.log("Web3Sign implementation deployed at:", result.implementation);
        console2.log("Web3Sign proxy deployed at:", result.proxy);

        // Configure roles
        _configureRoles(accessManager, result.proxy);

        return result.proxy;
    }

    /**
     * @notice Configure roles for Web3Sign
     * @param accessManager The address of the AccessManager contract
     * @param proxyAddress The address of the Web3Sign proxy
     */
    function _configureRoles(address accessManager, address proxyAddress) internal {
        // Configure UPGRADE_MANAGER_ROLE
        RoleManagementHelper.configureUpgradeManagerRole(accessManager, proxyAddress);
        console2.log("UPGRADE_MANAGER_ROLE configured");

        // Configure TREASURER_ROLE
        RoleManagementHelper.configureTreasurerRole(accessManager, proxyAddress);
        console2.log("TREASURER_ROLE configured");
    }
}
