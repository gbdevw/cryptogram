// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {AccessManagerUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/access/manager/AccessManagerUpgradeable.sol";
import {ERC1967Proxy} from "lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Web3PGP} from "src/Web3PGP.sol";
import {Web3Sign} from "src/Web3Sign.sol";
import {DeploymentHelper} from "scripts/lib/DeploymentHelper.sol";
import {RoleManagementHelper} from "scripts/lib/RoleManagementHelper.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title DeployDexesBundle
 * @notice Deploy and configure all contracts that are part of DEXES: AccessManager + Web3PGP + Web3Sign
 * @dev This script deploys and configure all contracts that are part of DEXES in one go
 */
contract DeployDexesBundle is Script {
    using DeploymentHelper for *;
    using RoleManagementHelper for *;
    using ScriptHelpers for *;

    /// @notice Deployed contract addresses
    struct DeploymentAddresses {
        address accessManagerProxy;
        address web3pgpProxy;
        address web3signProxy;
    }

    /// @notice Deployment results
    DeploymentAddresses public addresses;

    /**
     * @notice Main deployment function
     * @dev For local testing with Anvil, uses the first provisioned account (index 0)
     *      Environment variables:
     *      - FEE_IN_WEIS: Initial fee (optional, default 0)
     *      - INITIAL_ADMIN: Initial admin address for AccessManager (optional, default deployer)
     * @return The deployment addresses struct
     */
    function run() external returns (DeploymentAddresses memory) {
        address deployer = msg.sender;
        uint256 feeInWeis = vm.envOr("FEE_IN_WEIS", uint256(0));
        address initialAdmin = vm.envOr("INITIAL_ADMIN", deployer);

        vm.startBroadcast();

        console2.log("========================================");
        console2.log("Deploying DEXES Bundle");
        console2.log("========================================");
        console2.log("Deployer:", deployer);
        console2.log("Fee:", feeInWeis, "wei");
        console2.log("Initial Admin:", initialAdmin);
        console2.log("");

        deployDexesBundle(deployer, feeInWeis, initialAdmin);

        vm.stopBroadcast();

        // ===== Summary =====
        console2.log("");
        console2.log("========================================");
        console2.log("Deployment Complete!");
        console2.log("========================================");
        console2.log("AccessManager:", addresses.accessManagerProxy);
        console2.log("Web3PGP:", addresses.web3pgpProxy);
        console2.log("Web3Sign:", addresses.web3signProxy);
        console2.log("All contracts initialized and ready for use");
        console2.log("========================================");

        return addresses;
    }

    /**
     * @notice Testable function that handles the entire DEXES bundle deployment
     * @param deployer The deployer address
     * @param feeInWeis The protocol fee in wei
     * @param initialAdmin The initial admin address
     */
    function deployDexesBundle(
        address deployer,
        uint256 feeInWeis,
        address initialAdmin
    ) public {
        // ===== 1. Deploy AccessManager =====
        console2.log("1. Deploying AccessManager...");
        addresses.accessManagerProxy = deployAccessManager(deployer);
        console2.log("   Proxy:", addresses.accessManagerProxy);

        // ===== 2. Deploy Web3PGP =====
        console2.log("");
        console2.log("2. Deploying Web3PGP...");
        addresses.web3pgpProxy = deployWeb3PGP(feeInWeis, addresses.accessManagerProxy);
        console2.log("   Proxy:", addresses.web3pgpProxy);

        // ===== 3. Deploy Web3Sign =====
        console2.log("");
        console2.log("3. Deploying Web3Sign...");
        addresses.web3signProxy = deployWeb3Sign(
            feeInWeis,
            addresses.accessManagerProxy,
            addresses.web3pgpProxy
        );
        console2.log("   Proxy:", addresses.web3signProxy);

        // ===== 4. Configure Roles in AccessManager =====
        console2.log("");
        console2.log("4. Configuring Roles in AccessManager...");
        configureRoles(deployer, initialAdmin);
    }

    /**
     * @notice Configure roles in AccessManager
     * @param deployer The deployer address
     * @param initialAdmin The initial admin address
     */
    function configureRoles(address deployer, address initialAdmin) public {
        // Grant UPGRADE_MANAGER_ROLE to Initial Admin
        grantUpgradeManagerRole(addresses.accessManagerProxy, initialAdmin, 0);
        console2.log("   Granted UPGRADE_MANAGER_ROLE to Initial Admin:", initialAdmin);

        // Grant FEE_MANAGER_ROLE to Initial Admin
        grantFeeManagerRole(addresses.accessManagerProxy, initialAdmin, 0);
        console2.log("   Granted FEE_MANAGER_ROLE to Initial Admin:", initialAdmin);

        // Grant FUNDS_MANAGER_ROLE to Initial Admin
        grantFundsManagerRole(addresses.accessManagerProxy, initialAdmin, 0);
        console2.log("   Granted FUNDS_MANAGER_ROLE to Initial Admin:", initialAdmin);

        // Grant ADMIN_ROLE to Initial Admin if different from Deployer and revoke from Deployer
        if (initialAdmin != deployer) {
            grantAdminRole(addresses.accessManagerProxy, initialAdmin);
            console2.log("   Granted admin role to Initial Admin:", initialAdmin);
            revokeAdminRole(addresses.accessManagerProxy, deployer);
            console2.log("   Revoked admin role from Deployer:", deployer);
        } else {
            console2.log("   Initial Admin is Deployer");
        }
    }

    /**
     * @notice Get all deployment addresses
     * @return The deployment addresses struct
     */
    function getAddresses() external view returns (DeploymentAddresses memory) {
        return addresses;
    }

    /*****************************************************************************************************************/
    /* INTERNAL HELPER FUNCTIONS                                                                                     */
    /*****************************************************************************************************************/

    /**
     * @notice Internal wrapper to deploy AccessManager
     * @param initialAdmin The initial admin address
     * @return The proxy address of the deployed AccessManager
     */
    function deployAccessManager(address initialAdmin) internal returns (address) {
        DeploymentHelper.DeploymentResult memory result = 
            DeploymentHelper.deployAccessManager(initialAdmin);
        return result.proxy;
    }

    /**
     * @notice Internal wrapper to deploy Web3PGP
     * @param fee The service fee in weis
     * @param accessManager The AccessManager proxy address
     * @return The proxy address of the deployed Web3PGP
     */
    function deployWeb3PGP(uint256 fee, address accessManager) internal returns (address) {
        DeploymentHelper.DeploymentResult memory result = 
            DeploymentHelper.deployWeb3PGP(fee, accessManager);
        return result.proxy;
    }

    /**
     * @notice Internal wrapper to deploy Web3Sign
     * @param fee The service fee in weis
     * @param accessManager The AccessManager proxy address
     * @param web3pgp The Web3PGP proxy address
     * @return The proxy address of the deployed Web3Sign
     */
    function deployWeb3Sign(
        uint256 fee,
        address accessManager,
        address web3pgp
    ) internal returns (address) {
        DeploymentHelper.DeploymentResult memory result = 
            DeploymentHelper.deployWeb3Sign(fee, accessManager, web3pgp);
        return result.proxy;
    }

    /**
     * @notice Internal wrapper to grant UPGRADE_MANAGER_ROLE
     * @param accessManager The AccessManager proxy address
     * @param targetAddress The address to grant the role to
     * @param executionDelay The execution delay in seconds
     */
    function grantUpgradeManagerRole(
        address accessManager,
        address targetAddress,
        uint32 executionDelay
    ) internal {
        RoleManagementHelper.grantUpgradeManagerRole(accessManager, targetAddress, executionDelay);
    }

    /**
     * @notice Internal wrapper to grant FEE_MANAGER_ROLE
     * @param accessManager The AccessManager proxy address
     * @param targetAddress The address to grant the role to
     * @param executionDelay The execution delay in seconds
     */
    function grantFeeManagerRole(
        address accessManager,
        address targetAddress,
        uint32 executionDelay
    ) internal {
        RoleManagementHelper.grantFeeManagerRole(accessManager, targetAddress, executionDelay);
    }

    /**
     * @notice Internal wrapper to grant FUNDS_MANAGER_ROLE
     * @param accessManager The AccessManager proxy address
     * @param targetAddress The address to grant the role to
     * @param executionDelay The execution delay in seconds
     */
    function grantFundsManagerRole(
        address accessManager,
        address targetAddress,
        uint32 executionDelay
    ) internal {
        RoleManagementHelper.grantFundsManagerRole(accessManager, targetAddress, executionDelay);
    }

    /**
     * @notice Internal wrapper to grant ADMIN_ROLE
     * @param accessManager The AccessManager proxy address
     * @param targetAddress The address to grant the role to
     */
    function grantAdminRole(address accessManager, address targetAddress) internal {
        RoleManagementHelper.grantAdminRole(accessManager, targetAddress);
    }

    /**
     * @notice Internal wrapper to revoke ADMIN_ROLE
     * @param accessManager The AccessManager proxy address
     * @param targetAddress The address to revoke the role from
     */
    function revokeAdminRole(address accessManager, address targetAddress) internal {
        RoleManagementHelper.revokeAdminRole(accessManager, targetAddress);
    }
}
