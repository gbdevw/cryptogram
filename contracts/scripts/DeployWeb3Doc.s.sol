// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Web3Doc} from "src/Web3Doc.sol";
import {FlatFee} from "src/FlatFee.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AccessManagerUpgradeable} from "@openzeppelin/contracts-upgradeable/access/manager/AccessManagerUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title DeployWeb3Doc
 * @notice Foundry script to deploy Web3Doc with proxy pattern
 * @dev Deploys implementation and proxy, then initializes the Web3Doc contract
 */
contract DeployWeb3Doc is Script {
    /// @notice Role IDs
    uint64 public constant UPGRADE_MANAGER_ROLE = 1;
    uint64 public constant TREASURER_ROLE = 2;
    
    /// @notice The deployed implementation address
    address public implementation;

    /// @notice The deployed Web3Doc proxy address
    Web3Doc public web3doc;

    /**
     * @notice Main deployment function
     * @dev Uses environment variables to provide the private key, the access manager proxy contract address and the
     * fee requested by the contract in weis.
     * @return The deployed Web3PGP proxy address
     */
    function run() external returns (address) {
        // Retrieve environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address accessManager = vm.envAddress("ACCESS_MANAGER");
        address web3pgp = vm.envAddress("WEB3PGP");
        uint256 feeInWeis = vm.envUint("FEE_IN_WEIS");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        implementation = address(new Web3Doc());
        console2.log("Web3Doc implementation deployed at:", implementation);

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            Web3Doc.initialize.selector,
            feeInWeis,
            accessManager,
            web3pgp
        );
        
        // Deploy proxy with initialization data
        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);
        web3doc = Web3Doc(payable(address(proxy)));
        console2.log("Web3Doc proxy deployed at:", address(proxy));

        // Configure UPGRADE_MANAGER_ROLE in AccessManager
        AccessManagerUpgradeable manager = AccessManagerUpgradeable(accessManager);
        
        // ========== UPGRADE_MANAGER_ROLE ==========
        
        // Assign the role to upgradeToAndCall function
        bytes4[] memory upgradeSelectors = new bytes4[](1);
        upgradeSelectors[0] = UUPSUpgradeable.upgradeToAndCall.selector;
        
        manager.setTargetFunctionRole(address(proxy), upgradeSelectors, UPGRADE_MANAGER_ROLE);
        console2.log("UPGRADE_MANAGER_ROLE assigned to upgradeToAndCall function");
        
        // ========== TREASURER_ROLE ==========
        
        // Assign the role to fee management functions
        bytes4[] memory treasurerSelectors = new bytes4[](2);
        treasurerSelectors[0] = FlatFee.updateRequestedFee.selector;
        treasurerSelectors[1] = FlatFee.withdrawFees.selector;
        
        manager.setTargetFunctionRole(address(proxy), treasurerSelectors, TREASURER_ROLE);
        console2.log("TREASURER_ROLE assigned to updateRequestedFee and withdrawFees functions");

        // Stop broadcasting transactions
        vm.stopBroadcast();

        return address(proxy);
    }
}