// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {Web3PGP} from "src/Web3PGP.sol";
import {UUPSUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title UpgradeWeb3PGP
 * @notice Foundry script to upgrade Web3PGP implementation
 * @dev Deploys new implementation and calls upgradeToAndCall on the proxy
 * @custom:usage forge script scripts/UpgradeWeb3PGP.s.sol --rpc-url <RPC_URL> --broadcast
 */
contract UpgradeWeb3PGP is Script {
    using ScriptHelpers for *;

    /**
     * @notice Main upgrade function
     * @dev Uses environment variables for private key and proxy address
     * @return The new implementation address
     */
    function run() external returns (address) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        address newImplementation = upgradeWeb3PGP();

        vm.stopBroadcast();

        return newImplementation;
    }

    /**
     * @notice Upgrade Web3PGP to a new implementation
     * @dev This function contains the testable business logic
     * @return The new implementation address
     */
    function upgradeWeb3PGP() public returns (address) {
        address proxyAddress = vm.envAddress("WEB3PGP_PROXY");
        ScriptHelpers.requireNonZero(proxyAddress, "WEB3PGP_PROXY");

        // Deploy new implementation
        Web3PGP newImplementation = new Web3PGP();
        console2.log("Web3PGP new implementation deployed at:", address(newImplementation));

        // Upgrade the proxy to the new implementation
        UUPSUpgradeable(proxyAddress).upgradeToAndCall(address(newImplementation), "");
        console2.log("Web3PGP proxy upgraded to new implementation");

        console2.log("Upgrade completed successfully!");
        console2.log("Proxy address:", proxyAddress);
        console2.log("New implementation address:", address(newImplementation));

        return address(newImplementation);
    }
}
