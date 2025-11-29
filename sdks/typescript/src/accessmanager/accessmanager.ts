import { Address, TransactionReceipt, PublicClient, WalletClient, parseEventLogs } from 'viem';
import { IAccessManager } from './accessmanager.interface';
import type {
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
import { AccessManager as AccessManagerABI } from '../abis/AccessManager';
import { getBlockTimestamp } from '../utils/viemutils';

/**
 * Implementation of the AccessManager contract interface.
 * 
 * This class provides low-level bindings to interact with contracts implementing the IAccessManager interface
 * from OpenZeppelin's access management system.
 */
export class AccessManager implements IAccessManager {
    
    // Address of the AccessManager contract
    private _address: Address;
    // Viem public client instance used to read from the blockchain
    private _client: PublicClient;
    // Viem wallet client instance used to sign transactions
    private _walletClient: WalletClient | undefined;

    /**
     * Creates a new AccessManager instance.
     * 
     * @param address The address of the contract implementing IAccessManager.
     * @param client A Viem public client for interacting with the blockchain.
     * @param walletClient Optional Viem wallet client for signing transactions.
     */
    constructor(address: Address, client: PublicClient, walletClient?: WalletClient) {
        this._address = address;
        this._client = client;
        this._walletClient = walletClient;
    }

    /*****************************************************************************************************************/
    /* GETTERS AND SETTERS                                                                                           */
    /*****************************************************************************************************************/

    /**
     * Gets the contract address.
     */
    get address(): Address {
        return this._address;
    }

    /**
     * Sets the contract address.
     */
    set address(value: Address) {
        this._address = value;
    }

    /**
     * Gets the Viem public client.
     */
    get client(): PublicClient {
        return this._client;
    }

    /**
     * Sets the Viem public client.
     */
    set client(client: PublicClient) {
        this._client = client;
    }

    /**
     * Gets the Viem wallet client.
     */
    get walletClient(): WalletClient | undefined {
        return this._walletClient;
    }

    /**
     * Sets the Viem wallet client.
     */
    set walletClient(value: WalletClient | undefined) {
        this._walletClient = value;
    }

    /**
     * Validate that a wallet client is available for write operations.
     * @throws Error if wallet client is not configured
     */
    private ensureWalletClient(): void {
        if (!this._walletClient) {
            throw new Error('WalletClient is required for write operations. Please set walletClient before calling this method.');
        }
    }

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS - ROLE MANAGEMENT                                                                             */
    /*****************************************************************************************************************/

    public async grantRole(roleId: bigint, account: Address, executionDelay: number): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'grantRole',
            args: [roleId, account, executionDelay],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    public async revokeRole(roleId: bigint, account: Address): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'revokeRole',
            args: [roleId, account],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    public async renounceRole(roleId: bigint, callerConfirmation: Address): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'renounceRole',
            args: [roleId, callerConfirmation],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    public async setRoleAdmin(roleId: bigint, admin: bigint): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'setRoleAdmin',
            args: [roleId, admin],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    public async setRoleGuardian(roleId: bigint, guardian: bigint): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'setRoleGuardian',
            args: [roleId, guardian],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    public async setGrantDelay(roleId: bigint, newDelay: number): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'setGrantDelay',
            args: [roleId, newDelay],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    public async labelRole(roleId: bigint, label: string): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'labelRole',
            args: [roleId, label],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS - TARGET MANAGEMENT                                                                           */
    /*****************************************************************************************************************/

    public async setTargetFunctionRole(target: Address, selectors: readonly `0x${string}`[], roleId: bigint): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'setTargetFunctionRole',
            args: [target, selectors, roleId],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    public async setTargetAdminDelay(target: Address, newDelay: number): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'setTargetAdminDelay',
            args: [target, newDelay],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    public async setTargetClosed(target: Address, closed: boolean): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'setTargetClosed',
            args: [target, closed],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS - OPERATION MANAGEMENT                                                                        */
    /*****************************************************************************************************************/

    public async schedule(target: Address, data: `0x${string}`, when: bigint): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'schedule',
            args: [target, data, Number(when)],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    public async execute(target: Address, data: `0x${string}`): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'execute',
            args: [target, data],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    public async cancel(caller: Address, target: Address, data: `0x${string}`): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'cancel',
            args: [caller, target, data],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    public async consumeScheduledOp(caller: Address, data: `0x${string}`): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'consumeScheduledOp',
            args: [caller, data],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    public async updateAuthority(target: Address, newAuthority: Address): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagerABI,
            functionName: 'updateAuthority',
            args: [target, newAuthority],
        });
        const txhash = await this.walletClient!.writeContract(request);
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /*****************************************************************************************************************/
    /* READ FUNCTIONS - ACCESS CONTROL                                                                               */
    /*****************************************************************************************************************/

    public async canCall(caller: Address, target: Address, selector: `0x${string}`): Promise<[boolean, number]> {
        const result = await this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'canCall',
            args: [caller, target, selector],
        }) as unknown as [boolean, bigint];
        return [result[0], Number(result[1])];
    }

    public async expiration(): Promise<number> {
        return this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'expiration',
        }) as Promise<number>;
    }

    public async minSetback(): Promise<number> {
        return this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'minSetback',
        }) as Promise<number>;
    }

    public async isTargetClosed(target: Address): Promise<boolean> {
        return this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'isTargetClosed',
            args: [target],
        }) as Promise<boolean>;
    }

    public async getTargetFunctionRole(target: Address, selector: `0x${string}`): Promise<bigint> {
        return this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'getTargetFunctionRole',
            args: [target, selector],
        }) as Promise<bigint>;
    }

    public async getTargetAdminDelay(target: Address): Promise<number> {
        return this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'getTargetAdminDelay',
            args: [target],
        }) as Promise<number>;
    }

    /*****************************************************************************************************************/
    /* READ FUNCTIONS - ROLE INFORMATION                                                                             */
    /*****************************************************************************************************************/

    public async getRoleAdmin(roleId: bigint): Promise<bigint> {
        return this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'getRoleAdmin',
            args: [roleId],
        }) as Promise<bigint>;
    }

    public async getRoleGuardian(roleId: bigint): Promise<bigint> {
        return this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'getRoleGuardian',
            args: [roleId],
        }) as Promise<bigint>;
    }

    public async getRoleGrantDelay(roleId: bigint): Promise<number> {
        return this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'getRoleGrantDelay',
            args: [roleId],
        }) as Promise<number>;
    }

    public async getAccess(roleId: bigint, account: Address): Promise<[bigint, number, number, bigint]> {
        const result = await this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'getAccess',
            args: [roleId, account],
        }) as unknown as readonly [bigint, bigint, bigint, bigint];
        return [result[0], Number(result[1]), Number(result[2]), result[3]];
    }

    public async hasRole(roleId: bigint, account: Address): Promise<[boolean, number]> {
        const result = await this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'hasRole',
            args: [roleId, account],
        }) as unknown as [boolean, bigint];
        return [result[0], Number(result[1])];
    }

    /*****************************************************************************************************************/
    /* READ FUNCTIONS - OPERATION INFORMATION                                                                        */
    /*****************************************************************************************************************/

    public async hashOperation(caller: Address, target: Address, data: `0x${string}`): Promise<`0x${string}`> {
        return this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'hashOperation',
            args: [caller, target, data],
        }) as Promise<`0x${string}`>;
    }

    public async getSchedule(id: `0x${string}`): Promise<bigint> {
        const result = await this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'getSchedule',
            args: [id],
        }) as unknown as bigint;
        return BigInt(result);
    }

    public async getNonce(id: `0x${string}`): Promise<number> {
        return this.client.readContract({
            address: this.address,
            abi: AccessManagerABI,
            functionName: 'getNonce',
            args: [id],
        }) as Promise<number>;
    }

    /*****************************************************************************************************************/
    /* LOG SEARCH FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    public async searchOperationCanceledLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<OperationCanceledLog[]> {
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagerABI.find(item => item.type === 'event' && item.name === 'OperationCanceled')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            operationId: log.args.operationId,
            nonce: log.args.nonce ? Number(log.args.nonce) : undefined
        })));
    }

    public async searchOperationExecutedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<OperationExecutedLog[]> {
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagerABI.find(item => item.type === 'event' && item.name === 'OperationExecuted')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            operationId: log.args.operationId,
            nonce: log.args.nonce ? Number(log.args.nonce) : undefined
        })));
    }

    public async searchOperationScheduledLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<OperationScheduledLog[]> {
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagerABI.find(item => item.type === 'event' && item.name === 'OperationScheduled')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            operationId: log.args.operationId,
            nonce: log.args.nonce ? Number(log.args.nonce) : undefined,
            schedule: BigInt(log.args.schedule || 0),
            caller: log.args.caller,
            target: log.args.target,
            data: log.args.data
        })));
    }

    public async searchRoleAdminChangedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RoleAdminChangedLog[]> {
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagerABI.find(item => item.type === 'event' && item.name === 'RoleAdminChanged')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            roleId: log.args.roleId,
            admin: log.args.admin
        })));
    }

    public async searchRoleGrantDelayChangedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RoleGrantDelayChangedLog[]> {
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagerABI.find(item => item.type === 'event' && item.name === 'RoleGrantDelayChanged')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            roleId: log.args.roleId,
            delay: log.args.delay ? Number(log.args.delay) : undefined,
            since: BigInt(log.args.since || 0)
        })));
    }

    public async searchRoleGrantedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RoleGrantedLog[]> {
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagerABI.find(item => item.type === 'event' && item.name === 'RoleGranted')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            roleId: log.args.roleId,
            account: log.args.account,
            delay: log.args.delay ? Number(log.args.delay) : undefined,
            since: BigInt(log.args.since || 0),
            newMember: log.args.newMember
        })));
    }

    public async searchRoleGuardianChangedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RoleGuardianChangedLog[]> {
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagerABI.find(item => item.type === 'event' && item.name === 'RoleGuardianChanged')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            roleId: log.args.roleId,
            guardian: log.args.guardian
        })));
    }

    public async searchRoleLabelLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RoleLabelLog[]> {
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagerABI.find(item => item.type === 'event' && item.name === 'RoleLabel')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            roleId: log.args.roleId,
            label: log.args.label
        })));
    }

    public async searchRoleRevokedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RoleRevokedLog[]> {
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagerABI.find(item => item.type === 'event' && item.name === 'RoleRevoked')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            roleId: log.args.roleId,
            account: log.args.account
        })));
    }

    public async searchTargetAdminDelayUpdatedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<TargetAdminDelayUpdatedLog[]> {
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagerABI.find(item => item.type === 'event' && item.name === 'TargetAdminDelayUpdated')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            target: log.args.target,
            delay: log.args.delay ? Number(log.args.delay) : undefined,
            since: BigInt(log.args.since || 0)
        })));
    }

    public async searchTargetClosedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<TargetClosedLog[]> {
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagerABI.find(item => item.type === 'event' && item.name === 'TargetClosed')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            target: log.args.target,
            closed: log.args.closed
        })));
    }

    public async searchTargetFunctionRoleUpdatedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<TargetFunctionRoleUpdatedLog[]> {
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagerABI.find(item => item.type === 'event' && item.name === 'TargetFunctionRoleUpdated')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            target: log.args.target,
            selector: log.args.selector,
            roleId: log.args.roleId
        })));
    }

    /*****************************************************************************************************************/
    /* LOG EXTRACTION FUNCTIONS                                                                                      */
    /*****************************************************************************************************************/

    public async extractOperationCanceledLog(receipt: TransactionReceipt): Promise<OperationCanceledLog[]> {
        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagerABI,
            eventName: 'OperationCanceled'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            operationId: log.args.operationId,
            nonce: log.args.nonce ? Number(log.args.nonce) : undefined
        })));
    }

    public async extractOperationExecutedLog(receipt: TransactionReceipt): Promise<OperationExecutedLog[]> {
        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagerABI,
            eventName: 'OperationExecuted'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            operationId: log.args.operationId,
            nonce: log.args.nonce ? Number(log.args.nonce) : undefined
        })));
    }

    public async extractOperationScheduledLog(receipt: TransactionReceipt): Promise<OperationScheduledLog[]> {
        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagerABI,
            eventName: 'OperationScheduled'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            operationId: log.args.operationId,
            nonce: log.args.nonce ? Number(log.args.nonce) : undefined,
            schedule: BigInt(log.args.schedule || 0),
            caller: log.args.caller,
            target: log.args.target,
            data: log.args.data
        })));
    }

    public async extractRoleAdminChangedLog(receipt: TransactionReceipt): Promise<RoleAdminChangedLog[]> {
        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagerABI,
            eventName: 'RoleAdminChanged'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            roleId: log.args.roleId,
            admin: log.args.admin
        })));
    }

    public async extractRoleGrantDelayChangedLog(receipt: TransactionReceipt): Promise<RoleGrantDelayChangedLog[]> {
        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagerABI,
            eventName: 'RoleGrantDelayChanged'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            roleId: log.args.roleId,
            delay: log.args.delay ? Number(log.args.delay) : undefined,
            since: BigInt(log.args.since || 0)
        })));
    }

    public async extractRoleGrantedLog(receipt: TransactionReceipt): Promise<RoleGrantedLog[]> {
        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagerABI,
            eventName: 'RoleGranted'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            roleId: log.args.roleId,
            account: log.args.account,
            delay: log.args.delay ? Number(log.args.delay) : undefined,
            since: BigInt(log.args.since || 0),
            newMember: log.args.newMember
        })));
    }

    public async extractRoleGuardianChangedLog(receipt: TransactionReceipt): Promise<RoleGuardianChangedLog[]> {
        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagerABI,
            eventName: 'RoleGuardianChanged'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            roleId: log.args.roleId,
            guardian: log.args.guardian
        })));
    }

    public async extractRoleLabelLog(receipt: TransactionReceipt): Promise<RoleLabelLog[]> {
        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagerABI,
            eventName: 'RoleLabel'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            roleId: log.args.roleId,
            label: log.args.label
        })));
    }

    public async extractRoleRevokedLog(receipt: TransactionReceipt): Promise<RoleRevokedLog[]> {
        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagerABI,
            eventName: 'RoleRevoked'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            roleId: log.args.roleId,
            account: log.args.account
        })));
    }

    public async extractTargetAdminDelayUpdatedLog(receipt: TransactionReceipt): Promise<TargetAdminDelayUpdatedLog[]> {
        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagerABI,
            eventName: 'TargetAdminDelayUpdated'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            target: log.args.target,
            delay: log.args.delay ? Number(log.args.delay) : undefined,
            since: BigInt(log.args.since || 0)
        })));
    }

    public async extractTargetClosedLog(receipt: TransactionReceipt): Promise<TargetClosedLog[]> {
        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagerABI,
            eventName: 'TargetClosed'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            target: log.args.target,
            closed: log.args.closed
        })));
    }

    public async extractTargetFunctionRoleUpdatedLog(receipt: TransactionReceipt): Promise<TargetFunctionRoleUpdatedLog[]> {
        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagerABI,
            eventName: 'TargetFunctionRoleUpdated'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            target: log.args.target,
            selector: log.args.selector,
            roleId: log.args.roleId
        })));
    }
}
