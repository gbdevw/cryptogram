// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import "./IFlatFee.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/**
 * @title FlatFee
 * @author degengineering.eth
 * @notice This contract provides basic fee management functionalities restricted to the owner of the contract (see
 * OpenZeppelin's OwnableUpgradeable) and a collectFee modifier which can be used by payable functions to require and
 * collect a flat service fee.
 */
abstract contract FlatFee is IFlatFee, Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    /*****************************************************************************************************************/
    /* CONTRACT STORAGE                                                                                              */
    /*****************************************************************************************************************/

    /// @custom:storage-location erc7201:openzeppelin.storage.FlatFee
    struct FlatFeeStorage {


        /**
         * @notice The requested fee in wei.
         */
        uint256 _requestedFee;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.FlatFee")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant FLATFEE_STORAGE_LOCATION =
        0x060494ace66486b9030a50a0eec9dbc9490088260059ffa4002babe907b7a400;

    /**
     * @notice Returns the storage slot for the FlatFeeStorage.
     * @return $ The storage slot for the FlatFeeStorage.
     */
    function _getFlatFeeStorage() private pure returns (FlatFeeStorage storage $) {
        assembly {
            $.slot := FLATFEE_STORAGE_LOCATION
        }
    }

    /*****************************************************************************************************************/
    /* INITIALIZERS                                                                                                  */
    /*****************************************************************************************************************/

    /**
     * @notice Initializes the contract and its parents.
     * @param fee The initial requested fee to be set.
     */
    function __FlatFee_initialize(uint256 fee) internal onlyInitializing {
        __Ownable_init(_msgSender());
        __ReentrancyGuard_init();
        __FlatFee_initialize_unchained(fee);
    }

    /**
     * @notice Initializes the contract and set the requested fee to the provided fee amount.
     * @param fee The initial requested fee to be set.
     */
    function __FlatFee_initialize_unchained(uint256 fee) internal onlyInitializing {
        _updateFee(fee);
    }

    /*****************************************************************************************************************/
    /* MODIFIERS                                                                                                     */
    /*****************************************************************************************************************/

    /**
     * @notice Modifier to collect a service fee for contract execution and return excess of funds. The fee remains in
     * the contract and is not transferred to the owner until withdrawn.
     *
     * @dev This modifier ensures a sufficient service fee is provided by the sender before executing the contract
     * logic. The excess amount is refunded to the sender after the execution of the contract logic.
     */
    modifier collectFee() {
        // Check a sufficient fee is provided
        FlatFeeStorage storage $ = _getFlatFeeStorage();
        //console.log("Weis included in msg.value:", msg.value);
        //console.log("Requested fee:", _requestedFee);
        if (msg.value < $._requestedFee) {
            revert FeeRequired(msg.value, $._requestedFee);
        }
        // Execute contract logic
        _;
        // Refund any excess directly to the sender
        if (msg.value > $._requestedFee) {
            (bool success,) = payable(msg.sender).call{value: msg.value - $._requestedFee}("");
            require(success, "Refund failed");
        }
    }

    /*****************************************************************************************************************/
    /* PUBLIC FUNCTIONS                                                                                              */
    /*****************************************************************************************************************/

    /**
     * @inheritdoc IFlatFee
     */
    function updateRequestedFee(uint256 newFee) external override onlyOwner {
        // Update the requested fee and emit a RequestedFeeUpdated event
        uint256 oldFee = _updateFee(newFee);
        emit RequestedFeeUpdated(oldFee, newFee);
    }

    /**
     * @inheritdoc IFlatFee
     */
    function requestedFee() external view override returns (uint256) {
        FlatFeeStorage storage $ = _getFlatFeeStorage();
        return $._requestedFee;
    }

    /**
     * @inheritdoc IFlatFee
     */
    function withdrawFees() external onlyOwner {
        // Check if there are fees to withdraw
        uint256 balance = address(this).balance;
        if (balance == 0) revert NoFeesToWithdraw();
        // Withdraw the fees
        (bool ok,) = payable(owner()).call{value: balance}("");
        if (!ok) revert FeeWithdrawalFailed();
        // Emit a FeesWithdrawn event
        emit FeesWithdrawn(owner(), balance);
    }

    receive() external payable {
        revert NoDirectPaymentsAllowed();
    }

    /*****************************************************************************************************************/
    /* INTERNAL FUNCTIONS                                                                                            */
    /*****************************************************************************************************************/

    /**
     * @notice Internal function to update the fee and return the fee that was previously set.
     * @param newFee The new fee to be set. Can be 0 if the fee is to be removed.
     * @return The fee that was previously set.
     */
    function _updateFee(uint256 newFee) internal returns (uint256) {
        FlatFeeStorage storage $ = _getFlatFeeStorage();
        uint256 oldFee = $._requestedFee;
        $._requestedFee = newFee;
        return oldFee;
    }
}
