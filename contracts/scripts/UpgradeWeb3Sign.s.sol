// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {Web3Sign} from "src/Web3Sign.sol";
import {UUPSUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title UpgradeWeb3Sign
 * @notice Foundry script to upgrade Web3Sign implementation
 * @dev Deploys new implementation and calls upgradeToAndCall on the proxy
 * @custom:usage forge script scripts/UpgradeWeb3Sign.s.sol --rpc-url <RPC_URL> --broadcast
 */
contract UpgradeWeb3Sign is Script {
    using ScriptHelpers for *;

    /**
     * @notice Main upgrade function
     * @dev Uses environment variables for private key and proxy address
     * @return The new implementation address
     */
    function run() external returns (address) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        address newImplementation = upgradeWeb3Sign();

        vm.stopBroadcast();

        return newImplementation;
    }

    /**
     * @notice Upgrade Web3Sign to a new implementation
     * @dev This function contains the testable business logic
     * @return The new implementation address
     */
    function upgradeWeb3Sign() public returns (address) {
        address proxyAddress = vm.envAddress("WEB3SIGN_PROXY");
        ScriptHelpers.requireNonZero(proxyAddress, "WEB3SIGN_PROXY");

        // Deploy new implementation
        Web3Sign newImplementation = new Web3Sign();
        console2.log("Web3Sign new implementation deployed at:", address(newImplementation));

        // Upgrade the proxy to the new implementation
        UUPSUpgradeable(proxyAddress).upgradeToAndCall(address(newImplementation), "");
        console2.log("Web3Sign proxy upgraded to new implementation");

        console2.log("Upgrade completed successfully!");
        console2.log("Proxy address:", proxyAddress);
        console2.log("New implementation address:", address(newImplementation));

        return address(newImplementation);
    }
}
