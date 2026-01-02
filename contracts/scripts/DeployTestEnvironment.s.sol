// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "contracts/lib/forge-std/src/Script.sol";
import {console2} from "contracts/lib/forge-std/src/console2.sol";
import {AccessManagerUpgradeable} from "contracts/lib/openzeppelin/contracts-upgradeable/access/manager/AccessManagerUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {Web3PGP} from "src/Web3PGP.sol";
import {Web3Doc} from "src/Web3Doc.sol";

/**
 * @title DeployTestEnvironment
 * @notice Deploy complete test environment: AccessManager + Web3PGP + Web3Doc
 * @dev This script deploys all contracts needed for integration tests in one go
 *      It follows the same deployment pattern as production scripts
 */
contract DeployTestEnvironment is Script {
    /// @notice Deployed contract addresses
    struct DeploymentAddresses {
        address accessManagerProxy;
        address accessManagerImplementation;
        address web3pgpProxy;
        address web3pgpImplementation;
        address web3docProxy;
        address web3docImplementation;
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

        // ===== 3. Deploy Web3Doc =====
        console2.log("");
        console2.log("3. Deploying Web3Doc...");
        
        // Deploy implementation
        address web3docImpl = address(new Web3Doc());
        console2.log("   Implementation:", web3docImpl);

        // Prepare initialization data - Web3Doc depends on Web3PGP
        bytes memory web3docInitData = abi.encodeWithSelector(
            Web3Doc.initialize.selector,
            feeInWeis,
            address(accessManagerProxy),
            address(web3pgpProxy)
        );
        
        // Deploy proxy with initialization
        ERC1967Proxy web3docProxy = new ERC1967Proxy(web3docImpl, web3docInitData);
        console2.log("   Proxy:", address(web3docProxy));
        
        addresses.web3docProxy = address(web3docProxy);
        addresses.web3docImplementation = web3docImpl;

        // ===== 4. Configure Roles in AccessManager =====
        console2.log("");
        console2.log("4. AccessManager deployed without role configuration");
        console2.log("   (Roles can be configured separately if needed)");

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
