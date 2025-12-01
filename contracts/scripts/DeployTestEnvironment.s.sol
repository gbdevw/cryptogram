// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AccessManagerUpgradeable} from "@openzeppelin/contracts-upgradeable/access/manager/AccessManagerUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Web3PGP} from "src/Web3PGP.sol";
import {FlatFee} from "src/FlatFee.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title DeployTestEnvironment
 * @notice Deploy complete test environment: AccessManager + Web3PGP
 * @dev This script deploys all contracts needed for integration tests in one go
 *      It follows the same deployment pattern as production scripts
 */
contract DeployTestEnvironment is Script {
    /// @notice Role IDs
    uint64 public constant UPGRADE_MANAGER_ROLE = 1;
    uint64 public constant TREASURER_ROLE = 2;

    /// @notice Deployed contract addresses
    struct DeploymentAddresses {
        address accessManagerProxy;
        address accessManagerImplementation;
        address web3pgpProxy;
        address web3pgpImplementation;
    }

    /// @notice Deployment results
    DeploymentAddresses public addresses;

    /**
     * @notice Main deployment function for test environment
     * @dev For local testing with Anvil, uses the first provisioned account (index 0)
     *      Environment variables:
     *      - FEE_IN_WEIS: Initial fee (optional, default 0)
     * @return accessManagerProxy The AccessManager proxy address to use
     */
    function run() external returns (address) {
        // For Anvil testing, we use tx.origin (caller) which is the first provisioned account
        // No need to pass PRIVATE_KEY when using Anvil's built-in accounts
        uint256 feeInWeis = vm.envOr("FEE_IN_WEIS", uint256(0));
        
        address deployer = msg.sender;

        vm.startBroadcast();

        console2.log("========================================");
        console2.log("Deploying Test Environment");
        console2.log("========================================");
        console2.log("Deployer:", deployer);
        console2.log("Fee:", feeInWeis, "wei");
        console2.log("");

        // ===== 1. Deploy AccessManager =====
        console2.log("1. Deploying AccessManager...");
        
        // Deploy implementation
        address accessManagerImpl = address(new AccessManagerUpgradeable());
        console2.log("   Implementation:", accessManagerImpl);

        // Prepare initialization data
        bytes memory accessManagerInitData = abi.encodeWithSelector(
            AccessManagerUpgradeable.initialize.selector,
            deployer
        );
        
        // Deploy proxy with initialization
        ERC1967Proxy accessManagerProxy = new ERC1967Proxy(accessManagerImpl, accessManagerInitData);
        console2.log("   Proxy:", address(accessManagerProxy));
        
        addresses.accessManagerProxy = address(accessManagerProxy);
        addresses.accessManagerImplementation = accessManagerImpl;

        // ===== 2. Deploy Web3PGP =====
        console2.log("");
        console2.log("2. Deploying Web3PGP...");
        
        // Deploy implementation
        address web3pgpImpl = address(new Web3PGP());
        console2.log("   Implementation:", web3pgpImpl);

        // Prepare initialization data
        bytes memory web3pgpInitData = abi.encodeWithSelector(
            Web3PGP.initialize.selector,
            feeInWeis,
            address(accessManagerProxy)
        );
        
        // Deploy proxy with initialization
        ERC1967Proxy web3pgpProxy = new ERC1967Proxy(web3pgpImpl, web3pgpInitData);
        console2.log("   Proxy:", address(web3pgpProxy));
        
        addresses.web3pgpProxy = address(web3pgpProxy);
        addresses.web3pgpImplementation = web3pgpImpl;

        // ===== 3. Configure Roles in AccessManager =====
        console2.log("");
        console2.log("3. Configuring roles in AccessManager...");
        
        AccessManagerUpgradeable manager = AccessManagerUpgradeable(address(accessManagerProxy));
        
        // Configure UPGRADE_MANAGER_ROLE
        console2.log("   - UPGRADE_MANAGER_ROLE (1)");
        manager.labelRole(UPGRADE_MANAGER_ROLE, "UPGRADE_MANAGER");
        manager.grantRole(UPGRADE_MANAGER_ROLE, deployer, 0);
        
        bytes4[] memory upgradeSelectors = new bytes4[](1);
        upgradeSelectors[0] = UUPSUpgradeable.upgradeToAndCall.selector;
        manager.setTargetFunctionRole(address(web3pgpProxy), upgradeSelectors, UPGRADE_MANAGER_ROLE);
        console2.log("     Granted to deployer, assigned to upgradeToAndCall()");
        
        // Configure TREASURER_ROLE
        console2.log("   - TREASURER_ROLE (2)");
        manager.labelRole(TREASURER_ROLE, "TREASURER");
        manager.grantRole(TREASURER_ROLE, deployer, 0);
        
        bytes4[] memory treasurerSelectors = new bytes4[](2);
        treasurerSelectors[0] = FlatFee.updateRequestedFee.selector;
        treasurerSelectors[1] = FlatFee.withdrawFees.selector;
        manager.setTargetFunctionRole(address(web3pgpProxy), treasurerSelectors, TREASURER_ROLE);
        console2.log("     Granted to deployer, assigned to fee management functions");

        vm.stopBroadcast();

        // ===== Summary =====
        console2.log("");
        console2.log("========================================");
        console2.log("Deployment Complete!");
        console2.log("========================================");
        console2.log("AccessManager:", addresses.accessManagerProxy);
        console2.log("Web3PGP:", addresses.web3pgpProxy);
        console2.log("Deployer has ADMIN_ROLE(0), UPGRADE_MANAGER_ROLE(1), TREASURER_ROLE(2)");
        console2.log("========================================");

        return addresses.accessManagerProxy;
    }

    /**
     * @notice Get all deployment addresses
     * @return The deployment addresses struct
     */
    function getAddresses() external view returns (DeploymentAddresses memory) {
        return addresses;
    }
}
