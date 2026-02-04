// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "lib/forge-std/src/Test.sol";
import {RoleManagementHelper} from "scripts/lib/RoleManagementHelper.sol";
import {DeploymentHelper} from "scripts/lib/DeploymentHelper.sol";
import {AccessManagerUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/access/manager/AccessManagerUpgradeable.sol";
import {UUPSUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {FlatFee} from "src/FlatFee.sol";

/**
 * @title RoleManagementHelperTest
 * @notice Tests for RoleManagementHelper library
 */
contract RoleManagementHelperTest is Test {
    using RoleManagementHelper for *;
    using DeploymentHelper for *;

    /*****************************************************************************************************************/
    /* STATE VARIABLES                                                                                               */
    /*****************************************************************************************************************/

    address internal admin = address(0x1111);
    address internal targetUser = address(0x2222);
    address internal otherUser = address(0x3333);
    AccessManagerUpgradeable internal accessManager;
    DeploymentHelper.DeploymentResult internal amResult;

    /*****************************************************************************************************************/
    /* SETUP                                                                                                         */
    /*****************************************************************************************************************/

    function setUp() public {
        // Deploy AccessManager
        amResult = DeploymentHelper.deployAccessManager(admin);
        accessManager = AccessManagerUpgradeable(amResult.proxy);
    }

    /*****************************************************************************************************************/
    /* GRANT ROLE TESTS                                                                                              */
    /*****************************************************************************************************************/

    function test_grantAdminRole_Success() public {
        vm.startPrank(admin);
        RoleManagementHelper.grantAdminRole(address(accessManager), targetUser);
        vm.stopPrank();

        (bool hasRole,) = accessManager.hasRole(RoleManagementHelper.ADMIN_ROLE, targetUser);
        assertTrue(hasRole, "Target user should have ADMIN_ROLE");
    }

    function test_grantUpgradeManagerRole_Success() public {
        uint32 delay = 0;
        vm.startPrank(admin);
        RoleManagementHelper.grantUpgradeManagerRole(
            address(accessManager),
            targetUser,
            delay
        );
        vm.stopPrank();

        (bool hasRole,) = accessManager.hasRole(
            RoleManagementHelper.UPGRADE_MANAGER_ROLE,
            targetUser
        );
        assertTrue(hasRole, "Target user should have UPGRADE_MANAGER_ROLE");
    }

    function test_grantUpgradeManagerRole_WithDelay() public {
        uint32 delay = 86400; // 1 day
        vm.startPrank(admin);
        RoleManagementHelper.grantUpgradeManagerRole(
            address(accessManager),
            targetUser,
            delay
        );
        vm.stopPrank();

        (bool hasRole,) = accessManager.hasRole(
            RoleManagementHelper.UPGRADE_MANAGER_ROLE,
            targetUser
        );
        assertTrue(hasRole, "Target user should have UPGRADE_MANAGER_ROLE");
    }

    function test_grantFeeManagerRole_Success() public {
        uint32 delay = 0;
        vm.startPrank(admin);
        RoleManagementHelper.grantFeeManagerRole(
            address(accessManager),
            targetUser,
            delay
        );
        vm.stopPrank();

        (bool hasRole,) = accessManager.hasRole(
            RoleManagementHelper.FEE_MANAGER_ROLE,
            targetUser
        );
        assertTrue(hasRole, "Target user should have FEE_MANAGER_ROLE");
    }

    function test_grantFundsManagerRole_Success() public {
        uint32 delay = 0;
        vm.startPrank(admin);
        RoleManagementHelper.grantFundsManagerRole(
            address(accessManager),
            targetUser,
            delay
        );
        vm.stopPrank();

        (bool hasRole,) = accessManager.hasRole(
            RoleManagementHelper.FUNDS_MANAGER_ROLE,
            targetUser
        );
        assertTrue(hasRole, "Target user should have FUNDS_MANAGER_ROLE");
    }

    /*****************************************************************************************************************/
    /* REVOKE ROLE TESTS                                                                                             */
    /*****************************************************************************************************************/

    function test_revokeAdminRole_Success() public {
        // First grant the role
        vm.startPrank(admin);
        RoleManagementHelper.grantAdminRole(address(accessManager), targetUser);
        vm.stopPrank();
        (bool hasRoleBefore,) = accessManager.hasRole(RoleManagementHelper.ADMIN_ROLE, targetUser);
        assertTrue(hasRoleBefore, "User should have role before revoke");

        // Then revoke it
        vm.startPrank(admin);
        RoleManagementHelper.revokeAdminRole(address(accessManager), targetUser);
        vm.stopPrank();
        (bool hasRoleAfter,) = accessManager.hasRole(RoleManagementHelper.ADMIN_ROLE, targetUser);
        assertFalse(hasRoleAfter, "User should not have role after revoke");
    }

    function test_revokeUpgradeManagerRole_Success() public {
        // Grant role
        vm.startPrank(admin);
        RoleManagementHelper.grantUpgradeManagerRole(
            address(accessManager),
            targetUser,
            0
        );

        // Revoke role
        RoleManagementHelper.revokeUpgradeManagerRole(address(accessManager), targetUser);
        vm.stopPrank();
        (bool hasRole,) = accessManager.hasRole(
            RoleManagementHelper.UPGRADE_MANAGER_ROLE,
            targetUser
        );
        assertFalse(hasRole, "User should not have role after revoke");
    }

    function test_revokeFeeManagerRole_Success() public {
        // Grant role
        vm.startPrank(admin);
        RoleManagementHelper.grantFeeManagerRole(address(accessManager), targetUser, 0);

        // Revoke role
        RoleManagementHelper.revokeFeeManagerRole(address(accessManager), targetUser);
        vm.stopPrank();
        (bool hasRole,) = accessManager.hasRole(
            RoleManagementHelper.FEE_MANAGER_ROLE,
            targetUser
        );
        assertFalse(hasRole, "User should not have role after revoke");
    }

    function test_revokeFundsManagerRole_Success() public {
        // Grant role
        vm.startPrank(admin);
        RoleManagementHelper.grantFundsManagerRole(address(accessManager), targetUser, 0);

        // Revoke role
        RoleManagementHelper.revokeFundsManagerRole(address(accessManager), targetUser);
        vm.stopPrank();
        (bool hasRole,) = accessManager.hasRole(
            RoleManagementHelper.FUNDS_MANAGER_ROLE,
            targetUser
        );
        assertFalse(hasRole, "User should not have role after revoke");
    }

    /*****************************************************************************************************************/
    /* ROLE CONFIGURATION TESTS                                                                                      */
    /*****************************************************************************************************************/

    function test_configureUpgradeManagerRole_Success() public {
        // Deploy a Web3PGP proxy for testing
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(1 ether, address(accessManager));

        // Configure the role
        vm.startPrank(admin);
        RoleManagementHelper.configureUpgradeManagerRole(
            address(accessManager),
            pgpResult.proxy
        );
        vm.stopPrank();

        // Verify the role is configured
        uint64 assignedRole = RoleManagementHelper.getFunctionRole(
            address(accessManager),
            pgpResult.proxy,
            UUPSUpgradeable.upgradeToAndCall.selector
        );
        assertEq(assignedRole, RoleManagementHelper.UPGRADE_MANAGER_ROLE);
    }

    function test_configureFeeManagerRole_Success() public {
        // Deploy a Web3PGP proxy for testing
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(1 ether, address(accessManager));

        // Configure the role
        vm.startPrank(admin);
        RoleManagementHelper.configureFeeManagerRole(
            address(accessManager),
            pgpResult.proxy
        );
        vm.stopPrank();

        // Verify selector is assigned
        uint64 updateFeeRole = RoleManagementHelper.getFunctionRole(
            address(accessManager),
            pgpResult.proxy,
            FlatFee.updateRequestedFee.selector
        );

        assertEq(updateFeeRole, RoleManagementHelper.FEE_MANAGER_ROLE);
    }

    function test_configureFundsManagerRole_Success() public {
        // Deploy a Web3PGP proxy for testing
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(1 ether, address(accessManager));

        // Configure the role
        vm.startPrank(admin);
        RoleManagementHelper.configureFundsManagerRole(
            address(accessManager),
            pgpResult.proxy
        );
        vm.stopPrank();

        // Verify selector is assigned
        uint64 withdrawFeesRole = RoleManagementHelper.getFunctionRole(
            address(accessManager),
            pgpResult.proxy,
            FlatFee.withdrawFees.selector
        );

        assertEq(withdrawFeesRole, RoleManagementHelper.FUNDS_MANAGER_ROLE);
    }

    /*****************************************************************************************************************/
    /* VALIDATION TESTS                                                                                              */
    /*****************************************************************************************************************/

    function test_hasRole_True() public {
        vm.startPrank(admin);
        RoleManagementHelper.grantAdminRole(address(accessManager), targetUser);
        vm.stopPrank();

        bool result = RoleManagementHelper.hasRole(
            address(accessManager),
            RoleManagementHelper.ADMIN_ROLE,
            targetUser
        );
        assertTrue(result, "User should have role");
    }

    function test_hasRole_False() view public {
        bool result = RoleManagementHelper.hasRole(
            address(accessManager),
            RoleManagementHelper.ADMIN_ROLE,
            otherUser
        );
        assertFalse(result, "User should not have role");
    }

    function test_getFunctionRole_WithAssignedRole() public {
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(1 ether, address(accessManager));

        vm.startPrank(admin);
        RoleManagementHelper.configureUpgradeManagerRole(
            address(accessManager),
            pgpResult.proxy
        );
        vm.stopPrank();

        uint64 role = RoleManagementHelper.getFunctionRole(
            address(accessManager),
            pgpResult.proxy,
            UUPSUpgradeable.upgradeToAndCall.selector
        );

        assertEq(role, RoleManagementHelper.UPGRADE_MANAGER_ROLE);
    }

    function test_isUpgradeManagerRoleConfigured_True() public {
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(1 ether, address(accessManager));

        vm.startPrank(admin);
        RoleManagementHelper.configureUpgradeManagerRole(
            address(accessManager),
            pgpResult.proxy
        );
        vm.stopPrank();

        bool isConfigured = RoleManagementHelper.isUpgradeManagerRoleConfigured(
            address(accessManager),
            pgpResult.proxy
        );
        assertTrue(isConfigured, "Role should be configured");
    }

    function test_isUpgradeManagerRoleConfigured_False() public {
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(1 ether, address(accessManager));

        bool isConfigured = RoleManagementHelper.isUpgradeManagerRoleConfigured(
            address(accessManager),
            pgpResult.proxy
        );
        assertFalse(isConfigured, "Role should not be configured");
    }

    function test_isFeeManagerRoleConfigured_True() public {
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(1 ether, address(accessManager));

        vm.startPrank(admin);
        RoleManagementHelper.configureFeeManagerRole(
            address(accessManager),
            pgpResult.proxy
        );
        vm.stopPrank();

        bool isConfigured = RoleManagementHelper.isFeeManagerRoleConfigured(
            address(accessManager),
            pgpResult.proxy
        );
        assertTrue(isConfigured, "Role should be configured");
    }

    function test_isFeeManagerRoleConfigured_False() public {
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(1 ether, address(accessManager));

        bool isConfigured = RoleManagementHelper.isFeeManagerRoleConfigured(
            address(accessManager),
            pgpResult.proxy
        );
        assertFalse(isConfigured, "Role should not be configured");
    }

    function test_isFundsManagerRoleConfigured_True() public {
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(1 ether, address(accessManager));

        vm.startPrank(admin);
        RoleManagementHelper.configureFundsManagerRole(
            address(accessManager),
            pgpResult.proxy
        );
        vm.stopPrank();

        bool isConfigured = RoleManagementHelper.isFundsManagerRoleConfigured(
            address(accessManager),
            pgpResult.proxy
        );
        assertTrue(isConfigured, "Role should be configured");
    }

    function test_isFundsManagerRoleConfigured_False() public {
        DeploymentHelper.DeploymentResult memory pgpResult = 
            DeploymentHelper.deployWeb3PGP(1 ether, address(accessManager));

        bool isConfigured = RoleManagementHelper.isFundsManagerRoleConfigured(
            address(accessManager),
            pgpResult.proxy
        );
        assertFalse(isConfigured, "Role should not be configured");
    }

    /*****************************************************************************************************************/
    /* ROLE CONSTANTS TESTS                                                                                          */
    /*****************************************************************************************************************/

    function test_RoleConstants() public pure {
        assertEq(RoleManagementHelper.ADMIN_ROLE, 0);
        assertEq(RoleManagementHelper.UPGRADE_MANAGER_ROLE, 1);
        assertEq(RoleManagementHelper.FEE_MANAGER_ROLE, 2);
        assertEq(RoleManagementHelper.FUNDS_MANAGER_ROLE, 3);
    }
}
