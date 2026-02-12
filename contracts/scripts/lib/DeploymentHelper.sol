// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1967Proxy} from "lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AccessManagerUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/access/manager/AccessManagerUpgradeable.sol";
import {Web3PGP} from "src/Web3PGP.sol";
import {Web3Sign} from "src/Web3Sign.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title DeploymentHelper
 * @notice Helper library for deploying contracts with UUPS proxy pattern
 * @dev Encapsulates all deployment logic for testing and reuse
 */
library DeploymentHelper {
    /*****************************************************************************************************************/
    /* TYPES                                                                                                         */
    /*****************************************************************************************************************/

    /**
     * @notice Result of a deployment operation
     * @param implementation The address of the deployed implementation contract
     * @param proxy The address of the deployed proxy contract
     */
    struct DeploymentResult {
        address implementation;
        address proxy;
    }

    /*****************************************************************************************************************/
    /* ERRORS                                                                                                        */
    /*****************************************************************************************************************/

    /// @notice Thrown when deployment validation fails
    error DeploymentValidationFailed(string reason);

    /*****************************************************************************************************************/
    /* DEPLOYMENT FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    /**
     * @notice Deploy a generic UUPS proxy with initialization data
     * @param implementation The address of the implementation contract to proxy
     * @param initData The encoded initialization function data
     * @return result The deployment result containing implementation and proxy addresses
     */
    function deployProxy(
        address implementation,
        bytes memory initData
    ) internal returns (DeploymentResult memory result) {
        ScriptHelpers.requireNonZero(implementation, "implementation");

        // Deploy proxy with initialization data
        ERC1967Proxy proxyContract = new ERC1967Proxy(implementation, initData);
        
        result.implementation = implementation;
        result.proxy = address(proxyContract);
        
        return result;
    }

    /**
     * @notice Deploy AccessManagerUpgradeable with initialization
     * @param initialAdmin The initial admin address for the AccessManager
     * @return result The deployment result
     */
    function deployAccessManager(address initialAdmin)
        internal
        returns (DeploymentResult memory result)
    {
        ScriptHelpers.requireNonZero(initialAdmin, "initialAdmin");

        // Deploy implementation
        AccessManagerUpgradeable implementation = new AccessManagerUpgradeable();

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            AccessManagerUpgradeable.initialize.selector,
            initialAdmin
        );

        // Deploy proxy
        result = deployProxy(address(implementation), initData);
        
        return result;
    }

    /**
     * @notice Deploy Web3PGP contract with initialization
     * @param fee The service fee in weis
     * @param accessManager The address of the AccessManager contract
     * @return result The deployment result
     */
    function deployWeb3PGP(uint256 fee, address accessManager)
        internal
        returns (DeploymentResult memory result)
    {
        ScriptHelpers.requireNonZero(accessManager, "accessManager");

        // Deploy implementation
        Web3PGP implementation = new Web3PGP();

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            Web3PGP.initialize.selector,
            fee,
            accessManager
        );

        // Deploy proxy
        result = deployProxy(address(implementation), initData);
        
        return result;
    }

    /**
     * @notice Deploy Web3Sign contract with initialization
     * @param fee The service fee in weis
     * @param accessManager The address of the AccessManager contract
     * @param web3pgp The address of the Web3PGP contract
     * @return result The deployment result
     */
    function deployWeb3Sign(
        uint256 fee,
        address accessManager,
        address web3pgp
    ) internal returns (DeploymentResult memory result) {
        ScriptHelpers.requireNonZero(accessManager, "accessManager");
        ScriptHelpers.requireNonZero(web3pgp, "web3pgp");

        // Deploy implementation
        Web3Sign implementation = new Web3Sign();

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            Web3Sign.initialize.selector,
            fee,
            accessManager,
            web3pgp
        );

        // Deploy proxy
        result = deployProxy(address(implementation), initData);
        
        return result;
    }

    /*****************************************************************************************************************/
    /* VALIDATION FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    /**
     * @notice Validate that a proxy is properly initialized
     * @param proxyAddress The address of the proxy to validate
     * @dev Checks that the proxy contains implementation code
     */
    function validateProxy(address proxyAddress) internal view {
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(proxyAddress)
        }
        if (codeSize == 0) {
            revert DeploymentValidationFailed("Proxy has no code");
        }
    }

    /**
     * @notice Validate that an AccessManager proxy is correctly initialized
     * @param proxyAddress The address of the AccessManager proxy
     */
    function validateAccessManagerProxy(address proxyAddress) internal view {
        validateProxy(proxyAddress);
        
        AccessManagerUpgradeable manager = AccessManagerUpgradeable(proxyAddress);
        
        // Check that the manager has proper role configuration
        // The manager should have the admin role (role 0)
        uint64 adminRole = manager.getRoleAdmin(0);
        if (adminRole == 0) {
            revert DeploymentValidationFailed("AccessManager not properly initialized");
        }
    }
}
