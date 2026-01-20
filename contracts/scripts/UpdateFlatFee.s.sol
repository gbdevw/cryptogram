// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "lib/forge-std/src/Script.sol";
import {console2} from "lib/forge-std/src/console2.sol";
import {IFlatFee} from "src/IFlatFee.sol";
import {ScriptHelpers} from "scripts/lib/ScriptHelpers.sol";

/**
 * @title UpdateFlatFee
 * @notice Foundry script to update the flat fee of a contract implementing IFlatFee
 * @dev Updates the requested fee by calling updateRequestedFee on the target contract
 * @custom:usage forge script scripts/UpdateFlatFee.s.sol --rpc-url <RPC_URL> --broadcast
 */
contract UpdateFlatFee is Script {
    using ScriptHelpers for *;

    /**
     * @notice Main update function
     * @dev Uses environment variables for private key, contract address, and fee amount
     * @return The updated fee value
     */
    function run() external returns (uint256) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        uint256 newFee = updateFlatFee();

        vm.stopBroadcast();

        return newFee;
    }

    /**
     * @notice Update the flat fee of the target contract
     * @dev This function contains the testable business logic
     * @return The new fee value
     */
    function updateFlatFee() public returns (uint256) {
        address contractAddress = vm.envAddress("CONTRACT_ADDRESS");
        uint256 feeInWeis = vm.envUint("FEES_IN_WEIS");

        ScriptHelpers.requireNonZero(contractAddress, "CONTRACT_ADDRESS");
        ScriptHelpers.requireNonZeroUint256(feeInWeis, "FEES_IN_WEIS");

        IFlatFee flatFeeContract = IFlatFee(contractAddress);

        console2.log("Current fee:", flatFeeContract.requestedFee());
        console2.log("Updating fee to:", feeInWeis);

        flatFeeContract.updateRequestedFee(feeInWeis);

        console2.log("Fee updated successfully");
        console2.log("New fee:", flatFeeContract.requestedFee());

        return feeInWeis;
    }
}
