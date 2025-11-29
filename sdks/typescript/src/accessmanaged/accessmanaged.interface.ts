import { Address, TransactionReceipt } from 'viem';
import { AuthorityUpdatedLog } from './types/types';

/**
 * Interface for access management operations.
 * 
 * This interface provides methods to interact with contracts that implement
 * OpenZeppelin's AccessManaged pattern for role-based access control.
 */
export interface IAccessManaged {

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS                                                                                               */
    /*****************************************************************************************************************/

    /**
     * Updates the authority address that controls access to restricted functions.
     * 
     * @dev This function can only be called by the current authority.
     * @param newAuthority The address of the new authority contract.
     * @returns The transaction receipt of the update operation.
     */
    setAuthority(newAuthority: Address): Promise<TransactionReceipt>;

    /*****************************************************************************************************************/
    /* READ FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * Returns the address of the current authority contract.
     * 
     * @returns The address of the authority contract that controls access permissions.
     */
    authority(): Promise<Address>;

    /**
     * Indicates if the contract is currently consuming a scheduled operation.
     * 
     * @returns The function selector if consuming a scheduled op, or 0x00000000 otherwise.
     */
    isConsumingScheduledOp(): Promise<string>;

    /*****************************************************************************************************************/
    /* LOG SEARCH FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    /**
     * Searches for AuthorityUpdated events emitted by the smart contract.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of AuthorityUpdatedLog matching the provided filters.
     */
    searchAuthorityUpdatedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<AuthorityUpdatedLog[]>;

    /**
     * Extracts AuthorityUpdatedLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of AuthorityUpdatedLog extracted from the receipt.
     */
    extractAuthorityUpdatedLog(receipt: TransactionReceipt): Promise<AuthorityUpdatedLog[]>;
}
