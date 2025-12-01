// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {Web3PGP} from "src/Web3PGP.sol";
import {FlatFee} from "src/FlatFee.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {AccessManagerUpgradeable} from "@openzeppelin/contracts-upgradeable/access/manager/AccessManagerUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title DeployWeb3PGP
 * @notice Foundry script to deploy Web3PGP with proxy pattern
 * @dev Deploys implementation and proxy, then initializes the Web3PGP contract
 */
contract DeployWeb3PGP is Script {
    /// @notice Role IDs
    uint64 public constant UPGRADE_MANAGER_ROLE = 1;
    uint64 public constant TREASURER_ROLE = 2;
    
    /// @notice The deployed implementation address
    address public implementation;

    /// @notice The deployed Web3PGP proxy address
    Web3PGP public web3pgp;

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
        uint256 feeInWeis = vm.envUint("FEE_IN_WEIS");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        implementation = address(new Web3PGP());
        console2.log("Web3PGP implementation deployed at:", implementation);

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            Web3PGP.initialize.selector,
            feeInWeis,
            accessManager
        );
        
        // Deploy proxy with initialization data
        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);
        web3pgp = Web3PGP(payable(address(proxy)));
        console2.log("Web3PGP proxy deployed at:", address(proxy));

        // Configure UPGRADE_MANAGER_ROLE in AccessManager
        AccessManagerUpgradeable manager = AccessManagerUpgradeable(accessManager);
        address deployer = vm.addr(deployerPrivateKey);
        
        // ========== UPGRADE_MANAGER_ROLE ==========
        
        // 1. Label the role
        manager.labelRole(UPGRADE_MANAGER_ROLE, "UPGRADE_MANAGER");
        console2.log("UPGRADE_MANAGER_ROLE labeled");
        
        // 2. Grant the role to deployer (0 = no execution delay)
        manager.grantRole(UPGRADE_MANAGER_ROLE, deployer, 0);
        console2.log("UPGRADE_MANAGER_ROLE granted to deployer:", deployer);
        
        // 3. Assign the role to upgradeToAndCall function
        bytes4[] memory upgradeSelectors = new bytes4[](1);
        upgradeSelectors[0] = UUPSUpgradeable.upgradeToAndCall.selector;
        
        manager.setTargetFunctionRole(address(proxy), upgradeSelectors, UPGRADE_MANAGER_ROLE);
        console2.log("UPGRADE_MANAGER_ROLE assigned to upgradeToAndCall function");
        
        // ========== TREASURER_ROLE ==========
        
        // 1. Label the role
        manager.labelRole(TREASURER_ROLE, "TREASURER");
        console2.log("TREASURER_ROLE labeled");
        
        // 2. Grant the role to deployer (0 = no execution delay)
        manager.grantRole(TREASURER_ROLE, deployer, 0);
        console2.log("TREASURER_ROLE granted to deployer:", deployer);
        
        // 3. Assign the role to fee management functions
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