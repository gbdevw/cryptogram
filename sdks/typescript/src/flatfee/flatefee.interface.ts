import { Address, TransactionReceipt } from 'viem';
import { RequestedFeeUpdatedLog, FeesWithdrawnLog } from './types/types';

/**
 * Interface for flat fee management operations.
 */
export interface IFlatFee {

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS                                                                                               */
    /*****************************************************************************************************************/

    /**
     * Updates the requested service fee.
     * @dev This function should be restricted to authorized users.
     * @param newFee The new requested fee to be set.
     */
    updateRequestedFee(newFee: bigint): Promise<TransactionReceipt>;

    /**
     * Withdraws the full contract balance to the specified address.
     * @param to The address to which the fees are withdrawn.
     * @dev This function should be restricted to authorized users.
     */
    withdrawFees(to: Address): Promise<TransactionReceipt>;

    /*****************************************************************************************************************/
    /* READ FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * Indicate the fee requested by the smart contract to perform its operations.
     * @returns The requested fee in wei.
     */
    requestedFee(): Promise<bigint>;

    /*****************************************************************************************************************/
    /* LOG SEARCH FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    /**
     * Searches for RequestedFeeUpdated events emitted by the smart contract.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of RequestedFeeUpdatedLog matching the provided filters.
     */
    searchRequestedFeeUpdatedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RequestedFeeUpdatedLog[]>;

    /**
     * Searches for FeesWithdrawn events emitted by the smart contract.
     * 
     * @param recipients Filter by recipient addresses.
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of FeesWithdrawnLog matching the provided filters.
     */
    searchFeesWithdrawnLogs(
        recipients?: Address[],
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<FeesWithdrawnLog[]>;

    /**
     * Extracts FeesWithdrawnLog entries from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of FeesWithdrawnLog extracted from the receipt.
     */
    extractFeesWithdrawnLog(receipt: TransactionReceipt): Promise<FeesWithdrawnLog[]>;

    /**
     * Extracts RequestedFeeUpdatedLog entries from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of RequestedFeeUpdatedLog extracted from the receipt.
     */
    extractRequestedFeeUpdatedLog(receipt: TransactionReceipt): Promise<RequestedFeeUpdatedLog[]>;
}