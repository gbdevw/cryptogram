// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {AccessManagerUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/access/manager/AccessManagerUpgradeable.sol";
import {ERC1967Proxy} from "lib/openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Web3PGP} from "src/Web3PGP.sol";
import {Web3Doc} from "src/Web3Doc.sol";
import {DeploymentHelper} from "scripts/lib/DeploymentHelper.sol";
import {RoleManagementHelper} from "scripts/lib/RoleManagementHelper.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title DeployDexesBundle
 * @notice Deploy and configure all contracts that are part of DEXES: AccessManager + Web3PGP + Web3Doc
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
        address web3docProxy;
    }

    /// @notice Deployment results
    DeploymentAddresses public addresses;

    /**
     * @notice Main deployment function
     * @dev For local testing with Anvil, uses the first provisioned account (index 0)
     *      Environment variables:
     *      - FEE_IN_WEIS: Initial fee (optional, default 0)
     *      - INITIAL_ADMIN: Initial admin address for AccessManager (optional, default deployer)
     * @return accessManagerProxy The AccessManager proxy address to use
     */
    function run() external returns (DeploymentAddresses memory) {

        address deployer = msg.sender;
        
        // OPTIONAL: initial protocol fee requested by Web3PGP and Web3Doc contracts
        uint256 feeInWeis = vm.envOr("FEE_IN_WEIS", uint256(0));

        // OPTIONAL: initial admin address for AccessManager (will be granted all admin roles)
        // If not set, deployer will be the initial admin
        address initialAdmin = vm.envOr("INITIAL_ADMIN", deployer);    

        vm.startBroadcast();

        console2.log("========================================");
        console2.log("Deploying DEXES Bundle");
        console2.log("========================================");
        console2.log("Deployer:", deployer);
        console2.log("Fee:", feeInWeis, "wei");
        console2.log("Initial Admin:", initialAdmin);
        console2.log("");

        // ===== 1. Deploy AccessManager =====
        console2.log("1. Deploying AccessManager...");
        
        addresses.accessManagerProxy = deployAccessManager(deployer);

        console2.log("   Proxy:", addresses.accessManagerProxy);

        // ===== 2. Deploy Web3PGP =====
        console2.log("");
        console2.log("2. Deploying Web3PGP...");
        
        addresses.web3pgpProxy = deployWeb3PGP(feeInWeis, addresses.accessManagerProxy);

        console2.log("   Proxy:", addresses.web3pgpProxy);

        // ===== 3. Deploy Web3Doc =====
        console2.log("");
        console2.log("3. Deploying Web3Doc...");
        
        addresses.web3docProxy = deployWeb3Doc(
            feeInWeis,
            addresses.accessManagerProxy,
            addresses.web3pgpProxy
        );

        console2.log("   Proxy:", addresses.web3docProxy);

        // ===== 4. Configure Roles in AccessManager =====
        console2.log("");
        console2.log("4. Configuring Roles in AccessManager...");

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
            // Grant admin role to initialAdmin if different from deployer
            grantAdminRole(addresses.accessManagerProxy, initialAdmin);
            console2.log("   Granted admin role to Initial Admin:", initialAdmin);
            // Revoke admin role from deployer
            revokeAdminRole(addresses.accessManagerProxy, deployer);
            console2.log("   Revoked admin role from Deployer:", deployer);
        } else {
            console2.log("   Initial Admin is Deployer");
        }

        vm.stopBroadcast();

        // ===== Summary =====
        console2.log("");
        console2.log("========================================");
        console2.log("Deployment Complete!");
        console2.log("========================================");
        console2.log("AccessManager:", addresses.accessManagerProxy);
        console2.log("Web3PGP:", addresses.web3pgpProxy);
        console2.log("Web3Doc:", addresses.web3docProxy);
        console2.log("All contracts initialized and ready for use");
        console2.log("========================================");

        return addresses;
    }

    /**
     * @notice Get all deployment addresses
     * @return The deployment addresses struct
     */
    function getAddresses() external view returns (DeploymentAddresses memory) {
        return addresses;
    }
}
