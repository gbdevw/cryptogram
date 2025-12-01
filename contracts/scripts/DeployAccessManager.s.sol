// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AccessManagerUpgradeable} from "@openzeppelin/contracts-upgradeable/access/manager/AccessManagerUpgradeable.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title DeployAccessManager
 * @notice Foundry script to deploy AccessManagerUpgradeable with proxy pattern
 * @dev Deploys implementation and proxy, then initializes the AccessManager
 */
contract DeployAccessManager is Script {

    /// @notice The deployed AccessManager proxy address
    AccessManagerUpgradeable public accessManager;
    
    /// @notice The deployed implementation address
    address public implementation;

    /**
     * @notice Main deployment function
     * @dev Uses environment variables for private key and initial admin
     * @return The deployed AccessManager proxy address
     */
    function run() external returns (address) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address initialAdmin = vm.envAddress("INITIAL_ADMIN");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy implementation
        implementation = address(new AccessManagerUpgradeable());
        console2.log("AccessManager implementation deployed at:", implementation);

        // Prepare initialization data
        bytes memory initData = abi.encodeWithSelector(
            AccessManagerUpgradeable.initialize.selector,
            initialAdmin
        );

        // Deploy proxy
        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);
        console2.log("AccessManager proxy deployed at:", address(proxy));

        accessManager = AccessManagerUpgradeable(address(proxy));

        vm.stopBroadcast();

        console2.log("Initial admin:", initialAdmin);
        
        return address(accessManager);
    }
}