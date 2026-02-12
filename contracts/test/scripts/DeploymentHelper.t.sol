// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {DeploymentHelper} from "scripts/lib/DeploymentHelper.sol";
import {AccessManagerUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/access/manager/AccessManagerUpgradeable.sol";
import {Web3PGP} from "src/Web3PGP.sol";

/**
 * @title DeploymentHelperTest
 * @notice Tests for DeploymentHelper library
 */
contract DeploymentHelperTest is Test {
    using DeploymentHelper for *;

    /*****************************************************************************************************************/
    /* STATE VARIABLES                                                                                               */
    /*****************************************************************************************************************/

    address internal testAdmin = address(0x1111);
    uint256 internal testFee = 1 ether;

    /*****************************************************************************************************************/
    /* SETUP                                                                                                         */
    /*****************************************************************************************************************/

    function setUp() public {}

    /*****************************************************************************************************************/
    /* DEPLOYMENT TESTS                                                                                              */
    /*****************************************************************************************************************/

    function test_deployAccessManager_Success() public {
        DeploymentHelper.DeploymentResult memory result = 
            DeploymentHelper.deployAccessManager(testAdmin);

        assertNotEq(result.implementation, address(0), "Implementation should not be zero");
        assertNotEq(result.proxy, address(0), "Proxy should not be zero");
        assertNotEq(result.implementation, result.proxy, "Implementation and proxy should be different");

        // Verify proxy has code
        uint256 proxyCodeSize;
        assembly {
            proxyCodeSize := extcodesize(mload(add(result, 32)))
        }
        assertGt(proxyCodeSize, 0, "Proxy should have code");
    }

    function test_deployWeb3PGP_Success() public {
        // First deploy AccessManager
        DeploymentHelper.DeploymentResult memory amResult = 
            DeploymentHelper.deployAccessManager(testAdmin);

        // Then deploy Web3PGP
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(testFee, amResult.proxy);

        assertNotEq(pgpResult.implementation, address(0), "Implementation should not be zero");
        assertNotEq(pgpResult.proxy, address(0), "Proxy should not be zero");
        assertNotEq(pgpResult.implementation, pgpResult.proxy, "Implementation and proxy should be different");
    }

    /*****************************************************************************************************************/
    /* PROXY VALIDATION TESTS                                                                                        */
    /*****************************************************************************************************************/

    function test_validateProxy_WithValidProxy() public {
        DeploymentHelper.DeploymentResult memory result = 
            DeploymentHelper.deployAccessManager(testAdmin);

        // Should not revert
        DeploymentHelper.validateProxy(result.proxy);
    }

    /*****************************************************************************************************************/
    /* INITIALIZATION VERIFICATION TESTS                                                                             */
    /*****************************************************************************************************************/

    function test_deployAccessManager_IsInitialized() public {
        DeploymentHelper.DeploymentResult memory result = 
            DeploymentHelper.deployAccessManager(testAdmin);

        AccessManagerUpgradeable manager = AccessManagerUpgradeable(result.proxy);
        
        // Verify the admin is set correctly
        (bool hasRole,) = manager.hasRole(0, testAdmin);
        assertTrue(hasRole, "Test admin should have ADMIN_ROLE");
    }

    function test_deployWeb3PGP_IsInitialized() public {
        DeploymentHelper.DeploymentResult memory amResult = 
            DeploymentHelper.deployAccessManager(testAdmin);
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(testFee, amResult.proxy);

        Web3PGP pgp = Web3PGP(payable(pgpResult.proxy));
        
        // Verify fee is set
        assertEq(pgp.requestedFee(), testFee, "Fee should be set correctly");
    }
}
