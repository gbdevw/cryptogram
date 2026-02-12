// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {DeploymentHelper} from "scripts/lib/DeploymentHelper.sol";
import {RoleManagementHelper} from "scripts/lib/RoleManagementHelper.sol";
import {AccessManagerUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/access/manager/AccessManagerUpgradeable.sol";
import {UUPSUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Web3PGP} from "src/Web3PGP.sol";
import {Web3Sign} from "src/Web3Sign.sol";

/**
 * @title UpgradeHelperTest
 * @notice Tests for UUPS upgrade functionality
 */
contract UpgradeHelperTest is Test {
    using DeploymentHelper for *;
    using RoleManagementHelper for *;

    /*****************************************************************************************************************/
    /* STATE VARIABLES                                                                                               */
    /*****************************************************************************************************************/

    address internal deployer = address(0x1111);
    address internal upgradeManager = address(0x2222);
    uint256 internal fee = 1 ether;
    DeploymentHelper.DeploymentResult internal amResult;
    DeploymentHelper.DeploymentResult internal pgpResult;
    DeploymentHelper.DeploymentResult internal docResult;

    /*****************************************************************************************************************/
    /* SETUP                                                                                                         */
    /*****************************************************************************************************************/

    function setUp() public {
        // Deploy AccessManager
        amResult = DeploymentHelper.deployAccessManager(deployer);

        // Deploy Web3PGP
        pgpResult = DeploymentHelper.deployWeb3PGP(fee, amResult.proxy);

        // Deploy Web3Sign
        docResult = DeploymentHelper.deployWeb3Sign(fee, amResult.proxy, pgpResult.proxy);

        // Configure upgrade manager role
        vm.startPrank(deployer);
        RoleManagementHelper.configureUpgradeManagerRole(amResult.proxy, pgpResult.proxy);
        RoleManagementHelper.configureUpgradeManagerRole(amResult.proxy, docResult.proxy);
        RoleManagementHelper.grantUpgradeManagerRole(amResult.proxy, upgradeManager, 0);
        vm.stopPrank();
    }

    /*****************************************************************************************************************/
    /* WEB3PGP UPGRADE TESTS                                                                                         */
    /*****************************************************************************************************************/

    function test_upgradeWeb3PGP_Success() public {
        // Get original implementation
        address originalImplementation = pgpResult.implementation;
        Web3PGP proxyAsWeb3PGP = Web3PGP(payable(pgpResult.proxy));

        // Verify original state is accessible
        uint256 originalFee = proxyAsWeb3PGP.requestedFee();
        assertEq(originalFee, fee, "Original fee should be accessible");

        // Deploy new implementation
        Web3PGP newImplementation = new Web3PGP();

        // Upgrade as upgrade manager
        vm.prank(upgradeManager);
        UUPSUpgradeable(pgpResult.proxy).upgradeToAndCall(address(newImplementation), "");

        // Verify upgrade was successful
        assertNotEq(address(newImplementation), originalImplementation, "New implementation should be different");

        // Verify state is preserved
        uint256 newFee = proxyAsWeb3PGP.requestedFee();
        assertEq(newFee, originalFee, "Fee should be preserved after upgrade");

        // Verify proxy still has code
        uint256 codeSize;
        address proxyAddr = pgpResult.proxy;
        assembly {
            codeSize := extcodesize(proxyAddr)
        }
        assertGt(codeSize, 0, "Proxy should still have code after upgrade");
    }

    function test_upgradeWeb3PGP_UnauthorizedCaller() public {
        // Try to upgrade as non-upgrade manager
        Web3PGP newImplementation = new Web3PGP();
        
        vm.prank(address(0x9999)); // Unauthorized address
        vm.expectRevert();
        UUPSUpgradeable(pgpResult.proxy).upgradeToAndCall(address(newImplementation), "");
    }

    function test_upgradeWeb3PGP_PreservesAccessManager() public {
        // Get original AccessManager reference
        Web3PGP(payable(pgpResult.proxy));
        
        // Deploy new implementation
        Web3PGP newImplementation = new Web3PGP();

        // Upgrade
        vm.prank(upgradeManager);
        UUPSUpgradeable(pgpResult.proxy).upgradeToAndCall(address(newImplementation), "");

        // Verify AccessManager reference is still valid
        AccessManagerUpgradeable am = AccessManagerUpgradeable(amResult.proxy);
        (bool hasRole,) = am.hasRole(RoleManagementHelper.UPGRADE_MANAGER_ROLE, upgradeManager);
        assertTrue(hasRole, "AccessManager role should still be valid");
    }

    function test_upgradeWeb3PGP_MultipleUpgrades() public {
        // First upgrade
        Web3PGP implementation1 = new Web3PGP();
        vm.prank(upgradeManager);
        UUPSUpgradeable(pgpResult.proxy).upgradeToAndCall(address(implementation1), "");

        // Second upgrade
        Web3PGP implementation2 = new Web3PGP();
        vm.prank(upgradeManager);
        UUPSUpgradeable(pgpResult.proxy).upgradeToAndCall(address(implementation2), "");

        // Both upgrades should succeed
        // Verify state is still accessible
        Web3PGP proxyAsWeb3PGP = Web3PGP(payable(pgpResult.proxy));
        assertEq(proxyAsWeb3PGP.requestedFee(), fee, "Fee should be preserved after multiple upgrades");
    }

    /*****************************************************************************************************************/
    /* Web3Sign UPGRADE TESTS                                                                                         */
    /*****************************************************************************************************************/

    function test_upgradeWeb3Sign_Success() public {
        // Get original implementation
        address originalImplementation = docResult.implementation;
        Web3Sign proxyAsWeb3Sign = Web3Sign(payable(docResult.proxy));

        // Verify original state is accessible
        uint256 originalFee = proxyAsWeb3Sign.requestedFee();
        address originalPgpAddress = proxyAsWeb3Sign.getWeb3PGPAddress();
        assertEq(originalFee, fee, "Original fee should be accessible");
        assertEq(originalPgpAddress, pgpResult.proxy, "Original Web3PGP address should be accessible");

        // Deploy new implementation
        Web3Sign newImplementation = new Web3Sign();

        // Upgrade as upgrade manager
        vm.prank(upgradeManager);
        UUPSUpgradeable(docResult.proxy).upgradeToAndCall(address(newImplementation), "");

        // Verify upgrade was successful
        assertNotEq(address(newImplementation), originalImplementation, "New implementation should be different");

        // Verify state is preserved
        uint256 newFee = proxyAsWeb3Sign.requestedFee();
        address newPgpAddress = proxyAsWeb3Sign.getWeb3PGPAddress();
        assertEq(newFee, originalFee, "Fee should be preserved after upgrade");
        assertEq(newPgpAddress, originalPgpAddress, "Web3PGP address should be preserved after upgrade");
    }

    function test_upgradeWeb3Sign_UnauthorizedCaller() public {
        // Try to upgrade as non-upgrade manager
        Web3Sign newImplementation = new Web3Sign();
        
        vm.prank(address(0x9999)); // Unauthorized address
        vm.expectRevert();
        UUPSUpgradeable(docResult.proxy).upgradeToAndCall(address(newImplementation), "");
    }

    function test_upgradeWeb3Sign_PreservesWeb3PGPLink() public {
        // Get original Web3PGP address
        Web3Sign proxyAsWeb3Sign = Web3Sign(payable(docResult.proxy));
        address originalPgpAddress = proxyAsWeb3Sign.getWeb3PGPAddress();
        
        // Deploy new implementation
        Web3Sign newImplementation = new Web3Sign();

        // Upgrade
        vm.prank(upgradeManager);
        UUPSUpgradeable(docResult.proxy).upgradeToAndCall(address(newImplementation), "");

        // Verify Web3PGP link is preserved
        address newPgpAddress = proxyAsWeb3Sign.getWeb3PGPAddress();
        assertEq(newPgpAddress, originalPgpAddress, "Web3PGP address should be preserved");
        assertEq(newPgpAddress, pgpResult.proxy, "Web3PGP address should still be correct");
    }

    function test_upgradeWeb3Sign_MultipleUpgrades() public {
        // First upgrade
        Web3Sign implementation1 = new Web3Sign();
        vm.prank(upgradeManager);
        UUPSUpgradeable(docResult.proxy).upgradeToAndCall(address(implementation1), "");

        // Second upgrade
        Web3Sign implementation2 = new Web3Sign();
        vm.prank(upgradeManager);
        UUPSUpgradeable(docResult.proxy).upgradeToAndCall(address(implementation2), "");

        // Both upgrades should succeed
        // Verify state is still accessible
        Web3Sign proxyAsWeb3Sign = Web3Sign(payable(docResult.proxy));
        assertEq(proxyAsWeb3Sign.requestedFee(), fee, "Fee should be preserved after multiple upgrades");
        assertEq(proxyAsWeb3Sign.getWeb3PGPAddress(), pgpResult.proxy, "Web3PGP address should be preserved");
    }

    /*****************************************************************************************************************/
    /* CONCURRENT UPGRADE TESTS                                                                                      */
    /*****************************************************************************************************************/

    function test_upgradeWeb3PGP_AndWeb3Sign_Independently() public {
        // Deploy new implementations
        Web3PGP newPgpImplementation = new Web3PGP();
        Web3Sign newDocImplementation = new Web3Sign();

        // Upgrade Web3PGP
        vm.prank(upgradeManager);
        UUPSUpgradeable(pgpResult.proxy).upgradeToAndCall(address(newPgpImplementation), "");

        // Upgrade Web3Sign
        vm.prank(upgradeManager);
        UUPSUpgradeable(docResult.proxy).upgradeToAndCall(address(newDocImplementation), "");

        // Verify both upgrades were successful
        Web3PGP proxyAsWeb3PGP = Web3PGP(payable(pgpResult.proxy));
        Web3Sign proxyAsWeb3Sign = Web3Sign(payable(docResult.proxy));

        assertEq(proxyAsWeb3PGP.requestedFee(), fee, "Web3PGP fee preserved");
        assertEq(proxyAsWeb3Sign.requestedFee(), fee, "Web3Sign fee preserved");
        assertEq(proxyAsWeb3Sign.getWeb3PGPAddress(), pgpResult.proxy, "Web3Sign link to Web3PGP preserved");
    }

    /*****************************************************************************************************************/
    /* PROXY INTEGRITY TESTS                                                                                         */
    /*****************************************************************************************************************/

    function test_upgradeDoesNotChangeProxyAddress() public {
        address originalProxyAddress = pgpResult.proxy;

        // Deploy and upgrade
        Web3PGP newImplementation = new Web3PGP();
        vm.prank(upgradeManager);
        UUPSUpgradeable(pgpResult.proxy).upgradeToAndCall(address(newImplementation), "");

        // Proxy address should remain the same
        assertEq(pgpResult.proxy, originalProxyAddress, "Proxy address should not change");
    }

    function test_upgradePreservesProxyCode() public {
        // Get original code size
        uint256 originalCodeSize;
        address proxyAddr = pgpResult.proxy;
        assembly {
            originalCodeSize := extcodesize(proxyAddr)
        }
        assertGt(originalCodeSize, 0, "Original proxy should have code");

        // Upgrade
        Web3PGP newImplementation = new Web3PGP();
        vm.prank(upgradeManager);
        UUPSUpgradeable(pgpResult.proxy).upgradeToAndCall(address(newImplementation), "");

        // Code size should be unchanged
        uint256 newCodeSize;
        assembly {
            newCodeSize := extcodesize(proxyAddr)
        }
        assertEq(newCodeSize, originalCodeSize, "Proxy code size should not change");
    }
}
