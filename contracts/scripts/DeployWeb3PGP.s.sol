// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {UUPSUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {DeploymentHelper} from "scripts/lib/DeploymentHelper.sol";
import {RoleManagementHelper} from "scripts/lib/RoleManagementHelper.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title DeployWeb3PGP
 * @notice Foundry script to deploy Web3PGP with proxy pattern
 * @dev Deploys implementation and proxy, then initializes the Web3PGP contract
 */
contract DeployWeb3PGP is Script {
    using DeploymentHelper for *;
    using RoleManagementHelper for *;
    using ScriptHelpers for *;
    
    /// @notice The deployed implementation address
    address public implementation;

    /// @notice The deployed Web3PGP proxy address
    Web3PGP public web3pgp;

    /**
     * @notice Main deployment function
     * @dev Uses environment variables for private key, access manager, and fee
     * @return The deployed Web3PGP proxy address
     */
    function run() external returns (address) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        address proxyAddress = deployWeb3PGP();

        vm.stopBroadcast();

        return proxyAddress;
    }

    /**
     * @notice Deploy Web3PGP with all configuration
     * @dev This function contains the testable business logic
     * @return The deployed proxy address
     */
    function deployWeb3PGP() public returns (address) {
        // Retrieve environment variables
        address accessManager = vm.envAddress("ACCESS_MANAGER");
        uint256 feeInWeis = vm.envUint("FEE_IN_WEIS");
        
        ScriptHelpers.requireNonZero(accessManager, "ACCESS_MANAGER");
        ScriptHelpers.requireNonZeroUint256(feeInWeis, "FEE_IN_WEIS");

        // Deploy the contract
        DeploymentHelper.DeploymentResult memory result = 
            DeploymentHelper.deployWeb3PGP(feeInWeis, accessManager);

        console2.log("Web3PGP implementation deployed at:", result.implementation);
        console2.log("Web3PGP proxy deployed at:", result.proxy);

        // Configure roles
        _configureRoles(accessManager, result.proxy);

        return result.proxy;
    }

    /**
     * @notice Configure roles for Web3PGP
     * @param accessManager The address of the AccessManager contract
     * @param proxyAddress The address of the Web3PGP proxy
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