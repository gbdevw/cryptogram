import { Address, TransactionReceipt } from 'viem';
import {
    OperationCanceledLog,
    OperationExecutedLog,
    OperationScheduledLog,
    RoleAdminChangedLog,
    RoleGrantDelayChangedLog,
    RoleGrantedLog,
    RoleGuardianChangedLog,
    RoleLabelLog,
    RoleRevokedLog,
    TargetAdminDelayUpdatedLog,
    TargetClosedLog,
    TargetFunctionRoleUpdatedLog
} from './types/types';

/**
 * Interface for AccessManager contract operations.
 * 
 * This interface provides methods to interact with OpenZeppelin's AccessManager contract
 * for role-based access control and scheduled operations.
 */
export interface IAccessManager {

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS - ROLE MANAGEMENT                                                                             */
    /*****************************************************************************************************************/

    /**
     * Grants a role to an account with an optional execution delay.
     * 
     * @param roleId The role identifier.
     * @param account The account to grant the role to.
     * @param executionDelay The delay before the role becomes active.
     * @returns The transaction receipt.
     */
    grantRole(roleId: bigint, account: Address, executionDelay: number): Promise<TransactionReceipt>;

    /**
     * Revokes a role from an account.
     * 
     * @param roleId The role identifier.
     * @param account The account to revoke the role from.
     * @returns The transaction receipt.
     */
    revokeRole(roleId: bigint, account: Address): Promise<TransactionReceipt>;

    /**
     * Renounces a role (can only be called by the role holder).
     * 
     * @param roleId The role identifier.
     * @param callerConfirmation The caller's address for confirmation.
     * @returns The transaction receipt.
     */
    renounceRole(roleId: bigint, callerConfirmation: Address): Promise<TransactionReceipt>;

    /**
     * Sets the admin role for a given role.
     * 
     * @param roleId The role identifier.
     * @param admin The admin role identifier.
     * @returns The transaction receipt.
     */
    setRoleAdmin(roleId: bigint, admin: bigint): Promise<TransactionReceipt>;

    /**
     * Sets the guardian role for a given role.
     * 
     * @param roleId The role identifier.
     * @param guardian The guardian role identifier.
     * @returns The transaction receipt.
     */
    setRoleGuardian(roleId: bigint, guardian: bigint): Promise<TransactionReceipt>;

    /**
     * Sets the grant delay for a role.
     * 
     * @param roleId The role identifier.
     * @param newDelay The new delay in seconds.
     * @returns The transaction receipt.
     */
    setGrantDelay(roleId: bigint, newDelay: number): Promise<TransactionReceipt>;

    /**
     * Labels a role with a human-readable name.
     * 
     * @param roleId The role identifier.
     * @param label The label for the role.
     * @returns The transaction receipt.
     */
    labelRole(roleId: bigint, label: string): Promise<TransactionReceipt>;

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS - TARGET MANAGEMENT                                                                           */
    /*****************************************************************************************************************/

    /**
     * Sets the required role for calling specific functions on a target contract.
     * 
     * @param target The target contract address.
     * @param selectors Array of function selectors.
     * @param roleId The role required to call these functions.
     * @returns The transaction receipt.
     */
    setTargetFunctionRole(target: Address, selectors: `0x${string}`[], roleId: bigint): Promise<TransactionReceipt>;

    /**
     * Sets the admin delay for a target contract.
     * 
     * @param target The target contract address.
     * @param newDelay The new delay in seconds.
     * @returns The transaction receipt.
     */
    setTargetAdminDelay(target: Address, newDelay: number): Promise<TransactionReceipt>;

    /**
     * Closes or reopens a target contract.
     * 
     * @param target The target contract address.
     * @param closed True to close, false to reopen.
     * @returns The transaction receipt.
     */
    setTargetClosed(target: Address, closed: boolean): Promise<TransactionReceipt>;

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS - OPERATION MANAGEMENT                                                                        */
    /*****************************************************************************************************************/

    /**
     * Schedules an operation for later execution.
     * 
     * @param target The target contract address.
     * @param data The calldata for the operation.
     * @param when The timestamp when the operation can be executed.
     * @returns The transaction receipt.
     */
    schedule(target: Address, data: `0x${string}`, when: bigint): Promise<TransactionReceipt>;

    /**
     * Executes a scheduled operation.
     * 
     * @param target The target contract address.
     * @param data The calldata for the operation.
     * @returns The transaction receipt.
     */
    execute(target: Address, data: `0x${string}`): Promise<TransactionReceipt>;

    /**
     * Cancels a scheduled operation.
     * 
     * @param caller The address that scheduled the operation.
     * @param target The target contract address.
     * @param data The calldata for the operation.
     * @returns The transaction receipt.
     */
    cancel(caller: Address, target: Address, data: `0x${string}`): Promise<TransactionReceipt>;

    /**
     * Consumes a scheduled operation (internal use by AccessManaged contracts).
     * 
     * @param caller The caller address.
     * @param data The calldata.
     * @returns The transaction receipt.
     */
    consumeScheduledOp(caller: Address, data: `0x${string}`): Promise<TransactionReceipt>;

    /**
     * Updates the authority for a target contract.
     * 
     * @param target The target contract address.
     * @param newAuthority The new authority address.
     * @returns The transaction receipt.
     */
    updateAuthority(target: Address, newAuthority: Address): Promise<TransactionReceipt>;

    /*****************************************************************************************************************/
    /* READ FUNCTIONS - ACCESS CONTROL                                                                               */
    /*****************************************************************************************************************/

    /**
     * Checks if a caller can call a specific function on a target.
     * 
     * @param caller The caller address.
     * @param target The target contract address.
     * @param selector The function selector.
     * @returns A tuple [allowed, delay] indicating if the call is allowed and any execution delay.
     */
    canCall(caller: Address, target: Address, selector: `0x${string}`): Promise<[boolean, number]>;

    /**
     * Returns the expiration time for scheduled operations.
     * 
     * @returns The expiration time in seconds.
     */
    expiration(): Promise<number>;

    /**
     * Returns the minimum setback time.
     * 
     * @returns The minimum setback in seconds.
     */
    minSetback(): Promise<number>;

    /**
     * Checks if a target is closed.
     * 
     * @param target The target contract address.
     * @returns True if the target is closed.
     */
    isTargetClosed(target: Address): Promise<boolean>;

    /**
     * Gets the role required to call a specific function on a target.
     * 
     * @param target The target contract address.
     * @param selector The function selector.
     * @returns The role identifier.
     */
    getTargetFunctionRole(target: Address, selector: `0x${string}`): Promise<bigint>;

    /**
     * Gets the admin delay for a target.
     * 
     * @param target The target contract address.
     * @returns The admin delay in seconds.
     */
    getTargetAdminDelay(target: Address): Promise<number>;

    /*****************************************************************************************************************/
    /* READ FUNCTIONS - ROLE INFORMATION                                                                             */
    /*****************************************************************************************************************/

    /**
     * Gets the admin role for a given role.
     * 
     * @param roleId The role identifier.
     * @returns The admin role identifier.
     */
    getRoleAdmin(roleId: bigint): Promise<bigint>;

    /**
     * Gets the guardian role for a given role.
     * 
     * @param roleId The role identifier.
     * @returns The guardian role identifier.
     */
    getRoleGuardian(roleId: bigint): Promise<bigint>;

    /**
     * Gets the grant delay for a role.
     * 
     * @param roleId The role identifier.
     * @returns The grant delay in seconds.
     */
    getRoleGrantDelay(roleId: bigint): Promise<number>;

    /**
     * Gets access information for an account and role.
     * 
     * @param roleId The role identifier.
     * @param account The account address.
     * @returns Access information including since, currentDelay, pendingDelay, and effect timestamps.
     */
    getAccess(roleId: bigint, account: Address): Promise<[bigint, number, number, bigint]>;

    /**
     * Checks if an account has a role.
     * 
     * @param roleId The role identifier.
     * @param account The account address.
     * @returns A tuple [isMember, executionDelay] indicating membership and execution delay.
     */
    hasRole(roleId: bigint, account: Address): Promise<[boolean, number]>;

    /*****************************************************************************************************************/
    /* READ FUNCTIONS - OPERATION INFORMATION                                                                        */
    /*****************************************************************************************************************/

    /**
     * Computes the operation hash.
     * 
     * @param caller The caller address.
     * @param target The target contract address.
     * @param data The calldata.
     * @returns The operation hash.
     */
    hashOperation(caller: Address, target: Address, data: `0x${string}`): Promise<`0x${string}`>;

    /**
     * Gets the schedule for an operation.
     * 
     * @param id The operation identifier.
     * @returns The schedule timestamp.
     */
    getSchedule(id: `0x${string}`): Promise<bigint>;

    /**
     * Gets the nonce for an operation.
     * 
     * @param id The operation identifier.
     * @returns The nonce.
     */
    getNonce(id: `0x${string}`): Promise<number>;

    /*****************************************************************************************************************/
    /* LOG SEARCH FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    /**
     * Searches for OperationCanceled events.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of OperationCanceledLog matching the provided filters.
     */
    searchOperationCanceledLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<OperationCanceledLog[]>;

    /**
     * Searches for OperationExecuted events.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of OperationExecutedLog matching the provided filters.
     */
    searchOperationExecutedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<OperationExecutedLog[]>;

    /**
     * Searches for OperationScheduled events.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of OperationScheduledLog matching the provided filters.
     */
    searchOperationScheduledLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<OperationScheduledLog[]>;

    /**
     * Searches for RoleAdminChanged events.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of RoleAdminChangedLog matching the provided filters.
     */
    searchRoleAdminChangedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RoleAdminChangedLog[]>;

    /**
     * Searches for RoleGrantDelayChanged events.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of RoleGrantDelayChangedLog matching the provided filters.
     */
    searchRoleGrantDelayChangedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RoleGrantDelayChangedLog[]>;

    /**
     * Searches for RoleGranted events.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of RoleGrantedLog matching the provided filters.
     */
    searchRoleGrantedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RoleGrantedLog[]>;

    /**
     * Searches for RoleGuardianChanged events.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of RoleGuardianChangedLog matching the provided filters.
     */
    searchRoleGuardianChangedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RoleGuardianChangedLog[]>;

    /**
     * Searches for RoleLabel events.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of RoleLabelLog matching the provided filters.
     */
    searchRoleLabelLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RoleLabelLog[]>;

    /**
     * Searches for RoleRevoked events.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of RoleRevokedLog matching the provided filters.
     */
    searchRoleRevokedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RoleRevokedLog[]>;

    /**
     * Searches for TargetAdminDelayUpdated events.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of TargetAdminDelayUpdatedLog matching the provided filters.
     */
    searchTargetAdminDelayUpdatedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<TargetAdminDelayUpdatedLog[]>;

    /**
     * Searches for TargetClosed events.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of TargetClosedLog matching the provided filters.
     */
    searchTargetClosedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<TargetClosedLog[]>;

    /**
     * Searches for TargetFunctionRoleUpdated events.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of TargetFunctionRoleUpdatedLog matching the provided filters.
     */
    searchTargetFunctionRoleUpdatedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<TargetFunctionRoleUpdatedLog[]>;

    /**
     * Extracts OperationCanceledLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of OperationCanceledLog extracted from the receipt.
     */
    extractOperationCanceledLog(receipt: TransactionReceipt): Promise<OperationCanceledLog[]>;

    /**
     * Extracts OperationExecutedLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of OperationExecutedLog extracted from the receipt.
     */
    extractOperationExecutedLog(receipt: TransactionReceipt): Promise<OperationExecutedLog[]>;

    /**
     * Extracts OperationScheduledLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of OperationScheduledLog extracted from the receipt.
     */
    extractOperationScheduledLog(receipt: TransactionReceipt): Promise<OperationScheduledLog[]>;

    /**
     * Extracts RoleAdminChangedLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of RoleAdminChangedLog extracted from the receipt.
     */
    extractRoleAdminChangedLog(receipt: TransactionReceipt): Promise<RoleAdminChangedLog[]>;

    /**
     * Extracts RoleGrantDelayChangedLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of RoleGrantDelayChangedLog extracted from the receipt.
     */
    extractRoleGrantDelayChangedLog(receipt: TransactionReceipt): Promise<RoleGrantDelayChangedLog[]>;

    /**
     * Extracts RoleGrantedLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of RoleGrantedLog extracted from the receipt.
     */
    extractRoleGrantedLog(receipt: TransactionReceipt): Promise<RoleGrantedLog[]>;

    /**
     * Extracts RoleGuardianChangedLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of RoleGuardianChangedLog extracted from the receipt.
     */
    extractRoleGuardianChangedLog(receipt: TransactionReceipt): Promise<RoleGuardianChangedLog[]>;

    /**
     * Extracts RoleLabelLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of RoleLabelLog extracted from the receipt.
     */
    extractRoleLabelLog(receipt: TransactionReceipt): Promise<RoleLabelLog[]>;

    /**
     * Extracts RoleRevokedLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of RoleRevokedLog extracted from the receipt.
     */
    extractRoleRevokedLog(receipt: TransactionReceipt): Promise<RoleRevokedLog[]>;

    /**
     * Extracts TargetAdminDelayUpdatedLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of TargetAdminDelayUpdatedLog extracted from the receipt.
     */
    extractTargetAdminDelayUpdatedLog(receipt: TransactionReceipt): Promise<TargetAdminDelayUpdatedLog[]>;

    /**
     * Extracts TargetClosedLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of TargetClosedLog extracted from the receipt.
     */
    extractTargetClosedLog(receipt: TransactionReceipt): Promise<TargetClosedLog[]>;

    /**
     * Extracts TargetFunctionRoleUpdatedLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of TargetFunctionRoleUpdatedLog extracted from the receipt.
     */
    extractTargetFunctionRoleUpdatedLog(receipt: TransactionReceipt): Promise<TargetFunctionRoleUpdatedLog[]>;
}
