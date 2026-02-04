// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {DeploymentHelper} from "scripts/lib/DeploymentHelper.sol";
import {RoleManagementHelper} from "scripts/lib/RoleManagementHelper.sol";
import {AccessManagerUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/access/manager/AccessManagerUpgradeable.sol";
import {Web3PGP} from "src/Web3PGP.sol";
import {Web3Doc} from "src/Web3Doc.sol";

/**
 * @title FullDeploymentFlowTest
 * @notice Integration tests for complete deployment flow
 */
contract FullDeploymentFlowTest is Test {
    using DeploymentHelper for *;
    using RoleManagementHelper for *;

    /*****************************************************************************************************************/
    /* STATE VARIABLES                                                                                               */
    /*****************************************************************************************************************/

    address internal deployer = address(0x1111);
    address internal upgradeManager = address(0x2222);
    address internal feeManager = address(0x3333);
    address internal fundsManager = address(0x4444);
    uint256 internal fee = 1 ether;

    /*****************************************************************************************************************/
    /* SETUP                                                                                                         */
    /*****************************************************************************************************************/

    function setUp() public {}

    /*****************************************************************************************************************/
    /* FULL DEPLOYMENT FLOW TESTS                                                                                    */
    /*****************************************************************************************************************/

    function test_FullDeploymentFlow_Success() public {
        // 1. Deploy AccessManager
        DeploymentHelper.DeploymentResult memory amResult = 
            DeploymentHelper.deployAccessManager(deployer);
        AccessManagerUpgradeable(amResult.proxy);

        // 2. Deploy Web3PGP
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(fee, amResult.proxy);

        // 3. Deploy Web3Doc
        DeploymentHelper.DeploymentResult memory docResult = 
            DeploymentHelper.deployWeb3Doc(fee, amResult.proxy, pgpResult.proxy);

        // 4-6. Configure roles and grant to users (as deployer/admin)
        vm.startPrank(deployer);
        
        // Configure roles for Web3PGP
        RoleManagementHelper.configureUpgradeManagerRole(amResult.proxy, pgpResult.proxy);
        RoleManagementHelper.configureFeeManagerRole(amResult.proxy, pgpResult.proxy);
        RoleManagementHelper.configureFundsManagerRole(amResult.proxy, pgpResult.proxy);

        // Configure roles for Web3Doc
        RoleManagementHelper.configureUpgradeManagerRole(amResult.proxy, docResult.proxy);
        RoleManagementHelper.configureFeeManagerRole(amResult.proxy, docResult.proxy);
        RoleManagementHelper.configureFundsManagerRole(amResult.proxy, docResult.proxy);

        // Grant roles to users
        RoleManagementHelper.grantUpgradeManagerRole(amResult.proxy, upgradeManager, 0);
        RoleManagementHelper.grantFeeManagerRole(amResult.proxy, feeManager, 0);
        RoleManagementHelper.grantFundsManagerRole(amResult.proxy, fundsManager, 0);
        
        vm.stopPrank();

        // Verify all is configured
        assertTrue(RoleManagementHelper.hasRole(amResult.proxy, RoleManagementHelper.UPGRADE_MANAGER_ROLE, upgradeManager));
        assertTrue(RoleManagementHelper.hasRole(amResult.proxy, RoleManagementHelper.FEE_MANAGER_ROLE, feeManager));
        assertTrue(RoleManagementHelper.hasRole(amResult.proxy, RoleManagementHelper.FUNDS_MANAGER_ROLE, fundsManager));
    }

    function test_FullDeploymentFlow_VerifyAccessManager() public {
        DeploymentHelper.DeploymentResult memory amResult = 
            DeploymentHelper.deployAccessManager(deployer);

        // Verify AccessManager is initialized and admin is set
        (bool hasRole,) = AccessManagerUpgradeable(amResult.proxy).hasRole(0, deployer);
        assertTrue(hasRole, "Deployer should be admin");

        // Verify proxy code exists
        uint256 codeSize;
        address proxyAddr = amResult.proxy;
        assembly {
            codeSize := extcodesize(proxyAddr)
        }
        assertGt(codeSize, 0, "Proxy should have code");
    }

    function test_FullDeploymentFlow_VerifyWeb3PGP() public {
        DeploymentHelper.DeploymentResult memory amResult = 
            DeploymentHelper.deployAccessManager(deployer);
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(fee, amResult.proxy);

        Web3PGP pgp = Web3PGP(payable(pgpResult.proxy));

        // Verify Web3PGP is initialized
        assertEq(pgp.requestedFee(), fee);

        // Verify proxy code exists
        uint256 codeSize;
        address proxyAddr = pgpResult.proxy;
        assembly {
            codeSize := extcodesize(proxyAddr)
        }
        assertGt(codeSize, 0, "Proxy should have code");
    }

    function test_FullDeploymentFlow_VerifyWeb3Doc() public {
        DeploymentHelper.DeploymentResult memory amResult = 
            DeploymentHelper.deployAccessManager(deployer);
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(fee, amResult.proxy);
        DeploymentHelper.DeploymentResult memory docResult = 
            DeploymentHelper.deployWeb3Doc(fee, amResult.proxy, pgpResult.proxy);

        Web3Doc doc = Web3Doc(payable(docResult.proxy));

        // Verify Web3Doc is initialized
        assertEq(doc.requestedFee(), fee);
        assertEq(doc.getWeb3PGPAddress(), pgpResult.proxy);

        // Verify proxy code exists
        uint256 codeSize;
        address proxyAddr = docResult.proxy;
        assembly {
            codeSize := extcodesize(proxyAddr)
        }
        assertGt(codeSize, 0, "Proxy should have code");
    }

    function test_FullDeploymentFlow_RoleConfiguration() public {
        DeploymentHelper.DeploymentResult memory amResult = 
            DeploymentHelper.deployAccessManager(deployer);
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(fee, amResult.proxy);

        // Configure roles (as deployer/admin)
        vm.startPrank(deployer);
        RoleManagementHelper.configureUpgradeManagerRole(amResult.proxy, pgpResult.proxy);
        RoleManagementHelper.configureFeeManagerRole(amResult.proxy, pgpResult.proxy);
        RoleManagementHelper.configureFundsManagerRole(amResult.proxy, pgpResult.proxy);
        vm.stopPrank();

        // Verify configuration
        assertTrue(
            RoleManagementHelper.isUpgradeManagerRoleConfigured(amResult.proxy, pgpResult.proxy)
        );
        assertTrue(
            RoleManagementHelper.isFeeManagerRoleConfigured(amResult.proxy, pgpResult.proxy)
        );
        assertTrue(
            RoleManagementHelper.isFundsManagerRoleConfigured(amResult.proxy, pgpResult.proxy)
        );
    }

    function test_FullDeploymentFlow_MultipleUsersWithRoles() public {
        DeploymentHelper.DeploymentResult memory amResult = 
            DeploymentHelper.deployAccessManager(deployer);

        // Create multiple users with different roles
        address admin1 = address(0x5555);
        address admin2 = address(0x6666);
        address upgrader1 = address(0x7777);
        address upgrader2 = address(0x8888);
        address feeManager1 = address(0x9999);
        address fundsManager1 = address(0xAAAA);

        // Grant roles (as deployer/admin)
        vm.startPrank(deployer);
        RoleManagementHelper.grantAdminRole(amResult.proxy, admin1);
        RoleManagementHelper.grantAdminRole(amResult.proxy, admin2);
        RoleManagementHelper.grantUpgradeManagerRole(amResult.proxy, upgrader1, 0);
        RoleManagementHelper.grantUpgradeManagerRole(amResult.proxy, upgrader2, 0);
        RoleManagementHelper.grantFeeManagerRole(amResult.proxy, feeManager1, 0);
        RoleManagementHelper.grantFundsManagerRole(amResult.proxy, fundsManager1, 0);

        // Verify all roles are assigned
        assertTrue(RoleManagementHelper.hasRole(amResult.proxy, RoleManagementHelper.ADMIN_ROLE, admin1));
        assertTrue(RoleManagementHelper.hasRole(amResult.proxy, RoleManagementHelper.ADMIN_ROLE, admin2));
        assertTrue(RoleManagementHelper.hasRole(amResult.proxy, RoleManagementHelper.UPGRADE_MANAGER_ROLE, upgrader1));
        assertTrue(RoleManagementHelper.hasRole(amResult.proxy, RoleManagementHelper.UPGRADE_MANAGER_ROLE, upgrader2));
        assertTrue(RoleManagementHelper.hasRole(amResult.proxy, RoleManagementHelper.FEE_MANAGER_ROLE, feeManager1));
        assertTrue(RoleManagementHelper.hasRole(amResult.proxy, RoleManagementHelper.FUNDS_MANAGER_ROLE, fundsManager1));

        // Revoke one admin role
        RoleManagementHelper.revokeAdminRole(amResult.proxy, admin2);
        assertFalse(RoleManagementHelper.hasRole(amResult.proxy, RoleManagementHelper.ADMIN_ROLE, admin2));

        // Verify other roles still exist
        assertTrue(RoleManagementHelper.hasRole(amResult.proxy, RoleManagementHelper.ADMIN_ROLE, admin1));
        assertTrue(RoleManagementHelper.hasRole(amResult.proxy, RoleManagementHelper.UPGRADE_MANAGER_ROLE, upgrader1));
        
        vm.stopPrank();
    }

    /*****************************************************************************************************************/
    /* CONTRACT INTERACTION TESTS                                                                                    */
    /*****************************************************************************************************************/

    function test_Web3PGP_CanCallFunctions() public {
        DeploymentHelper.DeploymentResult memory amResult = 
            DeploymentHelper.deployAccessManager(deployer);
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(fee, amResult.proxy);

        Web3PGP pgp = Web3PGP(payable(pgpResult.proxy));

        // Verify we can call getters
        assertEq(pgp.requestedFee(), fee);
    }

    function test_Web3Doc_CanCallFunctions() public {
        DeploymentHelper.DeploymentResult memory amResult = 
            DeploymentHelper.deployAccessManager(deployer);
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(fee, amResult.proxy);
        DeploymentHelper.DeploymentResult memory docResult = 
            DeploymentHelper.deployWeb3Doc(fee, amResult.proxy, pgpResult.proxy);

        Web3Doc doc = Web3Doc(payable(docResult.proxy));

        // Verify we can call getters
        assertEq(doc.requestedFee(), fee);
        assertEq(doc.getWeb3PGPAddress(), pgpResult.proxy);
    }

    /*****************************************************************************************************************/
    /* STATE ISOLATION TESTS                                                                                         */
    /*****************************************************************************************************************/

    function test_MultipleDeployments_AreIndependent() public {
        // Deploy first set
        DeploymentHelper.DeploymentResult memory am1 = 
            DeploymentHelper.deployAccessManager(deployer);
        DeploymentHelper.DeploymentResult memory pgp1 = 
            DeploymentHelper.deployWeb3PGP(fee, am1.proxy);

        // Deploy second set
        DeploymentHelper.DeploymentResult memory am2 = 
            DeploymentHelper.deployAccessManager(deployer);
        DeploymentHelper.DeploymentResult memory pgp2 = 
            DeploymentHelper.deployWeb3PGP(fee, am2.proxy);

        // Verify they are different instances
        assertNotEq(am1.proxy, am2.proxy);
        assertNotEq(pgp1.proxy, pgp2.proxy);
    }
}
