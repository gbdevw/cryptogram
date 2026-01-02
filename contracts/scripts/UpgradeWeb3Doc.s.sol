// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {Web3Doc} from "src/Web3Doc.sol";
import {UUPSUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title UpgradeWeb3Doc
 * @notice Foundry script to upgrade Web3Doc implementation
 * @dev Deploys new implementation and calls upgradeToAndCall on the proxy
 * @custom:usage forge script scripts/UpgradeWeb3Doc.s.sol --rpc-url <RPC_URL> --broadcast
 */
contract UpgradeWeb3Doc is Script {
    /// @notice The Web3Doc proxy address to upgrade
    address public proxyAddress;

    /// @notice The new implementation address
    address public newImplementation;

    /**
     * @notice Main upgrade function
     * @dev Uses environment variables for private key and proxy address
     * @return The new implementation address
     */
    function run() external returns (address) {
        // Retrieve environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        proxyAddress = vm.envAddress("WEB3DOC_PROXY");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        newImplementation = address(new Web3Doc());
        console2.log("Web3Doc new implementation deployed at:", newImplementation);

        // Upgrade the proxy to the new implementation
        // No additional initialization data needed for this upgrade
        UUPSUpgradeable(proxyAddress).upgradeToAndCall(newImplementation, "");
        console2.log("Web3Doc proxy upgraded to new implementation");

        // Stop broadcasting transactions
        vm.stopBroadcast();

        console2.log("Upgrade completed successfully!");
        console2.log("Proxy address:", proxyAddress);
        console2.log("New implementation address:", newImplementation);

        return newImplementation;
    }
}
