// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessManagerUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/access/manager/AccessManagerUpgradeable.sol";
import {UUPSUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {FlatFee} from "src/FlatFee.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title RoleManagementHelper
 * @notice Helper library for managing roles in AccessManager
 * @dev Encapsulates role configuration and grant/revoke logic
 */
library RoleManagementHelper {
    /*****************************************************************************************************************/
    /* CONSTANTS                                                                                                     */
    /*****************************************************************************************************************/

    /// @notice Role ID for ADMIN_ROLE (default admin role in AccessManager)
    uint64 public constant ADMIN_ROLE = 0;

    /// @notice Role ID for UPGRADE_MANAGER_ROLE
    uint64 public constant UPGRADE_MANAGER_ROLE = 1;

    /// @notice Role ID for TREASURER_ROLE
    uint64 public constant TREASURER_ROLE = 2;

    /*****************************************************************************************************************/
    /* ERRORS                                                                                                        */
    /*****************************************************************************************************************/

    /// @notice Thrown when role operation validation fails
    error RoleOperationFailed(string reason);

    /// @notice Thrown when a role is not found
    error RoleNotFound(uint64 roleId);

    /*****************************************************************************************************************/
    /* GRANT ROLE FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    /**
     * @notice Grant a role to a target address
     * @param accessManager The address of the AccessManager contract
     * @param roleId The ID of the role to grant
     * @param targetAddress The address to grant the role to
     * @param executionDelay The delay before the role can be used (in seconds)
     */
    function grantRole(
        address accessManager,
        uint64 roleId,
        address targetAddress,
        uint32 executionDelay
    ) internal {
        ScriptHelpers.requireNonZero(accessManager, "accessManager");
        ScriptHelpers.requireNonZero(targetAddress, "targetAddress");

        AccessManagerUpgradeable manager = AccessManagerUpgradeable(accessManager);
        manager.grantRole(roleId, targetAddress, executionDelay);
    }

    /**
     * @notice Grant ADMIN_ROLE to a target address
     * @param accessManager The address of the AccessManager contract
     * @param targetAddress The address to grant the role to
     */
    function grantAdminRole(address accessManager, address targetAddress) internal {
        grantRole(accessManager, ADMIN_ROLE, targetAddress, 0);
    }

    /**
     * @notice Grant UPGRADE_MANAGER_ROLE to a target address
     * @param accessManager The address of the AccessManager contract
     * @param targetAddress The address to grant the role to
     * @param executionDelay The delay before the role can be used (in seconds)
     */
    function grantUpgradeManagerRole(
        address accessManager,
        address targetAddress,
        uint32 executionDelay
    ) internal {
        grantRole(accessManager, UPGRADE_MANAGER_ROLE, targetAddress, executionDelay);
    }

    /**
     * @notice Grant TREASURER_ROLE to a target address
     * @param accessManager The address of the AccessManager contract
     * @param targetAddress The address to grant the role to
     * @param executionDelay The delay before the role can be used (in seconds)
     */
    function grantTreasurerRole(
        address accessManager,
        address targetAddress,
        uint32 executionDelay
    ) internal {
        grantRole(accessManager, TREASURER_ROLE, targetAddress, executionDelay);
    }

    /*****************************************************************************************************************/
    /* REVOKE ROLE FUNCTIONS                                                                                         */
    /*****************************************************************************************************************/

    /**
     * @notice Revoke a role from a target address
     * @param accessManager The address of the AccessManager contract
     * @param roleId The ID of the role to revoke
     * @param targetAddress The address to revoke the role from
     */
    function revokeRole(
        address accessManager,
        uint64 roleId,
        address targetAddress
    ) internal {
        ScriptHelpers.requireNonZero(accessManager, "accessManager");
        ScriptHelpers.requireNonZero(targetAddress, "targetAddress");

        AccessManagerUpgradeable manager = AccessManagerUpgradeable(accessManager);
        manager.revokeRole(roleId, targetAddress);
    }

    /**
     * @notice Revoke ADMIN_ROLE from a target address
     * @param accessManager The address of the AccessManager contract
     * @param targetAddress The address to revoke the role from
     */
    function revokeAdminRole(address accessManager, address targetAddress) internal {
        revokeRole(accessManager, ADMIN_ROLE, targetAddress);
    }

    /**
     * @notice Revoke UPGRADE_MANAGER_ROLE from a target address
     * @param accessManager The address of the AccessManager contract
     * @param targetAddress The address to revoke the role from
     */
    function revokeUpgradeManagerRole(
        address accessManager,
        address targetAddress
    ) internal {
        revokeRole(accessManager, UPGRADE_MANAGER_ROLE, targetAddress);
    }

    /**
     * @notice Revoke TREASURER_ROLE from a target address
     * @param accessManager The address of the AccessManager contract
     * @param targetAddress The address to revoke the role from
     */
    function revokeTreasurerRole(address accessManager, address targetAddress) internal {
        revokeRole(accessManager, TREASURER_ROLE, targetAddress);
    }

    /*****************************************************************************************************************/
    /* ROLE CONFIGURATION FUNCTIONS                                                                                  */
    /*****************************************************************************************************************/

    /**
     * @notice Configure a role with a label and assign it to target functions
     * @param accessManager The address of the AccessManager contract
     * @param roleId The ID of the role to configure
     * @param roleName The human-readable name for the role
     * @param targetAddress The address of the contract containing the functions
     * @param functionSelectors The function selectors to assign to the role
     */
    function configureRole(
        address accessManager,
        uint64 roleId,
        string memory roleName,
        address targetAddress,
        bytes4[] memory functionSelectors
    ) internal {
        ScriptHelpers.requireNonZero(accessManager, "accessManager");
        ScriptHelpers.requireNonZero(targetAddress, "targetAddress");

        AccessManagerUpgradeable manager = AccessManagerUpgradeable(accessManager);

        // Label the role
        manager.labelRole(roleId, roleName);

        // Assign the role to functions
        manager.setTargetFunctionRole(targetAddress, functionSelectors, roleId);
    }

    /**
     * @notice Configure UPGRADE_MANAGER_ROLE for a proxy contract
     * @param accessManager The address of the AccessManager contract
     * @param proxyAddress The address of the proxy contract to allow upgrades on
     */
    function configureUpgradeManagerRole(
        address accessManager,
        address proxyAddress
    ) internal {
        bytes4[] memory upgradeSelectors = new bytes4[](1);
        upgradeSelectors[0] = UUPSUpgradeable.upgradeToAndCall.selector;

        configureRole(
            accessManager,
            UPGRADE_MANAGER_ROLE,
            "UPGRADE_MANAGER",
            proxyAddress,
            upgradeSelectors
        );
    }

    /**
     * @notice Configure TREASURER_ROLE for a contract
     * @param accessManager The address of the AccessManager contract
     * @param contractAddress The address of the contract with fee management functions
     */
    function configureTreasurerRole(
        address accessManager,
        address contractAddress
    ) internal {
        bytes4[] memory treasurerSelectors = new bytes4[](2);
        treasurerSelectors[0] = FlatFee.updateRequestedFee.selector;
        treasurerSelectors[1] = FlatFee.withdrawFees.selector;

        configureRole(
            accessManager,
            TREASURER_ROLE,
            "TREASURER",
            contractAddress,
            treasurerSelectors
        );
    }

    /*****************************************************************************************************************/
    /* VALIDATION FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    /**
     * @notice Verify that a role has been granted to an address
     * @param accessManager The address of the AccessManager contract
     * @param roleId The ID of the role to check
     * @param targetAddress The address to check
     * @return True if the role has been granted, false otherwise
     */
    function hasRole(
        address accessManager,
        uint64 roleId,
        address targetAddress
    ) internal view returns (bool) {
        AccessManagerUpgradeable manager = AccessManagerUpgradeable(accessManager);
        (bool granted,) = manager.hasRole(roleId, targetAddress);
        return granted;
    }

    /**
     * @notice Verify that a target function has a role assigned
     * @param accessManager The address of the AccessManager contract
     * @param targetAddress The address of the contract
     * @param functionSelector The function selector
     * @return The role ID assigned to the function, or 0 if none
     */
    function getFunctionRole(
        address accessManager,
        address targetAddress,
        bytes4 functionSelector
    ) internal view returns (uint64) {
        AccessManagerUpgradeable manager = AccessManagerUpgradeable(accessManager);
        return manager.getTargetFunctionRole(targetAddress, functionSelector);
    }

    /**
     * @notice Verify that UPGRADE_MANAGER_ROLE is properly configured
     * @param accessManager The address of the AccessManager contract
     * @param proxyAddress The address of the proxy to check
     * @return True if the role is configured correctly
     */
    function isUpgradeManagerRoleConfigured(
        address accessManager,
        address proxyAddress
    ) internal view returns (bool) {
        uint64 assignedRole = getFunctionRole(
            accessManager,
            proxyAddress,
            UUPSUpgradeable.upgradeToAndCall.selector
        );
        return assignedRole == UPGRADE_MANAGER_ROLE;
    }

    /**
     * @notice Verify that TREASURER_ROLE is properly configured
     * @param accessManager The address of the AccessManager contract
     * @param contractAddress The address of the contract to check
     * @return True if the role is configured correctly
     */
    function isTreasurerRoleConfigured(
        address accessManager,
        address contractAddress
    ) internal view returns (bool) {
        uint64 updateFeeRole = getFunctionRole(
            accessManager,
            contractAddress,
            FlatFee.updateRequestedFee.selector
        );
        uint64 withdrawFeesRole = getFunctionRole(
            accessManager,
            contractAddress,
            FlatFee.withdrawFees.selector
        );
        return updateFeeRole == TREASURER_ROLE && withdrawFeesRole == TREASURER_ROLE;
    }
}
