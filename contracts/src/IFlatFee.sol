// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

/**
 * @title IFlatFee
 * @author degengineering.eth
 * @notice Interface for contract which is meant to collect a flat fee for payable operations. The interface provides
 * methods for fee management and withdrawal. The same fee is applied to all operations (no tiering).
 */
interface IFlatFee {
    /*****************************************************************************************************************/
    /* CUSTOM ERRORS                                                                                                 */
    /*****************************************************************************************************************/

    /**
     * @notice Error emitted when a fee is required but not provided.
     * @param provided The amount of fee provided.
     * @param required The amount of fee required.
     */
    error FeeRequired(uint256 provided, uint256 required);

    /**
     * @notice Error emitted when a withdraw fails because there are no fees to withdraw.
     */
    error NoFeesToWithdraw();

    /**
     * @notice Error emitted when the transfer of the fees fails.
     */
    error FeeWithdrawalFailed();

    /**
     * @notice Error emitted when a direct payment to the smart contract is attempted.
     */
    error NoDirectPaymentsAllowed();

    /*****************************************************************************************************************/
    /* EVENTS                                                                                                        */
    /*****************************************************************************************************************/

    /**
     * @notice Emitted when the fee is updated.
     * @param oldFee The old fee.
     * @param newFee The new fee.
     */
    event RequestedFeeUpdated(uint256 oldFee, uint256 newFee);

    /**
     * @notice Emitted when the fees are withdrawn.
     * @param to The address to which the fees are withdrawn.
     * @param amount The amount withdrawn.
     */
    event FeesWithdrawn(address indexed to, uint256 amount);

    /*****************************************************************************************************************/
    /* FEES MANAGEMENT                                                                                               */
    /*****************************************************************************************************************/

    /**
     * @notice Updates the requested service fee.
     * @dev This function should be restricted to authorized users.
     * @param newFee The new requested fee to be set.
     */
    function updateRequestedFee(uint256 newFee) external;

    /**
     * @notice Indicate the fee requested by the smart contract to perform its operations.
     * @return The requested fee in wei.
     */
    function requestedFee() external view returns (uint256);

    /**
     * @notice Withdraws the full contract balance to the owner.
     * @dev This function should be restricted to authorized users.
     */
    function withdrawFees() external;
}
