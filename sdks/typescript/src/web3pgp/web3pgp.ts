import { Web3PGP as Web3PGPABI }  from '../abis/Web3PGP';
import { toBytes32 } from '../utils/0xstr';
import { Address, PublicClient, TransactionReceipt, WalletClient } from 'viem';
import { IWeb3PGP } from './web3pgp.interface';
import { KeyRegisteredLog, SubkeyAddedLog, KeyRevokedLog } from './types/types';

export class Web3PGP implements IWeb3PGP {

    static readonly abi = Web3PGPABI;

    // Address of the Web3PGP contract
    public readonly address: `0x${string}`;
    // Viem public client instance used to read from the blockchain
    private _client: PublicClient;
    // Viem wallet client instance used to sign transaction
    private _walletClient: WalletClient | undefined;
    
    constructor(address: `0x${string}`, client: PublicClient, walletClient?: WalletClient) {
        this.address = address;
        this._client = client;
        this._walletClient = walletClient;
    }

    public get client(): PublicClient {
        return this._client;
    }

    public set client(value: PublicClient) {
        this._client = value;
    }

    public get walletClient(): WalletClient | undefined {
        return this._walletClient;
    }

    public set walletClient(value: WalletClient | undefined) {
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
    /* READ FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * Check if a given fingerprint has been used to register a key in the contract.
     * @param fingerprint The fingerprint of the key to check.
     * @return True if the fingerprint has been used to register a key in the contract, false otherwise.
     */
    public exists(fingerprint: `0x${string}`): Promise<boolean> {
        return this.client.readContract({
            address: this.address,
            abi: Web3PGPABI,
            functionName: 'exists',
            args: [toBytes32(fingerprint)],
        });
    }

    /**
     * Check if a given fingerprint corresponds to a key registered as a subkey in the contract.
     * @param fingerprint The fingerprint of the key to check.
     * @return True if the key is a subkey, false otherwise.
     */
    public isSubKey(fingerprint: `0x${string}`): Promise<boolean> {
        return this.client.readContract({
            address: this.address,
            abi: Web3PGPABI,
            functionName: 'isSubKey',
            args: [toBytes32(fingerprint)],
        });
    }

    /**
     * Get the fingerprint of the parent key for a given subkey.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @return The fingerprint of the parent key or zero bytes if there is no parent.
     */
    public parentOf(subkeyFingerprint: `0x${string}`): Promise<`0x${string}`> {
        return this.client.readContract({
            address: this.address,
            abi: Web3PGPABI,
            functionName: 'parentOf',
            args: [toBytes32(subkeyFingerprint)],
        });
    }

    /**
     * Get the block number when a key was published.
     * @param fingerprint The fingerprint of the key to check.
     * @return The block number when the key was published, or 0 if not published.
     */
    public getKeyPublicationBlock(fingerprint: `0x${string}`): Promise<bigint> {
        return this.client.readContract({
            address: this.address,
            abi: Web3PGPABI,
            functionName: 'getKeyPublicationBlock',
            args: [toBytes32(fingerprint)],
        });
    }

    /**
     * Get the block numbers when multiple keys were published.
     * @param fingerprints The fingerprints of the keys to check.
     * @return An array of block numbers corresponding to each fingerprint in the order they were provided.
     */
    public getKeyPublicationBlockBatch(fingerprints: `0x${string}`[]): Promise<bigint[]> {
        return this.client.readContract({
            address: this.address,
            abi: Web3PGPABI,
            functionName: 'getKeyPublicationBlock',
            args: [fingerprints.map(fp => toBytes32(fp))],
        }) as Promise<bigint[]>;
    }

    /**
     * List the block numbers when revocation certificates were published for the given fingerprint.
     * @param fingerprint The fingerprint of the key to check.
     * @param start The starting index in the list of revocations.
     * @param limit The maximum number of results to return.
     * @return An array of block numbers when revocation certificates were published.
     */
    public listRevocations(fingerprint: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]> {
        return this.client.readContract({
            address: this.address,
            abi: Web3PGPABI,
            functionName: 'listRevocations',
            args: [toBytes32(fingerprint), start, limit],
        }) as Promise<bigint[]>;
    }

    /**
     * List the fingerprints of subkeys registered under a given parent key.
     * @param parentKeyFingerprint The fingerprint of the parent key to check.
     * @param start The starting index in the list of subkeys.
     * @param limit The maximum number of results to return.
     * @return An array of subkey fingerprints.
     */
    public listSubkeys(parentKeyFingerprint: `0x${string}`, start: bigint, limit: bigint): Promise<`0x${string}`[]> {
        return this.client.readContract({
            address: this.address,
            abi: Web3PGPABI,
            functionName: 'listSubkeys',
            args: [toBytes32(parentKeyFingerprint), start, limit],
        }) as Promise<`0x${string}`[]>;
    }

    /**
     * Get the requested fee for payable operations.
     * @return The requested fee in wei.
     */
    public requestedFee(): Promise<bigint> {
        return this.client.readContract({
            address: this.address,
            abi: Web3PGPABI,
            functionName: 'requestedFee',
        });
    }

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS (PAYABLE)                                                                                     */
    /*****************************************************************************************************************/

    /**
     * Register a new primary public key and its optional subkeys.
     * @param primaryKeyFingerprint The declared fingerprint of the primary public key.
     * @param subkeyFingerprints Optional array of declared fingerprints of the subkeys attached to the primary key.
     * @param openPGPMsg A binary OpenPGP message containing the primary key, binding signature, metadata, and subkeys.
     * @return Transaction receipt after registration.
     */
    public async register(
        primaryKeyFingerprint: `0x${string}`,
        subkeyFingerprints: `0x${string}`[],
        openPGPMsg: `0x${string}`
    ): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the required fee for registration
        const fee = await this.requestedFee();
        // Simulate the contract call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'register',
            args: [
                toBytes32(primaryKeyFingerprint),
                subkeyFingerprints.map(fp => toBytes32(fp)),
                openPGPMsg
            ],
            value: fee
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Add a new subkey to an already registered primary key.
     * @param primaryKeyFingerprint The fingerprint of the primary key to which to attach the subkey.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @param openPGPMsg A binary OpenPGP message containing the subkey and its key binding signatures.
     * @return Transaction receipt after adding the subkey.
     */
    public async addSubkey(
        primaryKeyFingerprint: `0x${string}`,
        subkeyFingerprint: `0x${string}`,
        openPGPMsg: `0x${string}`
    ): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the required fee for adding a subkey
        const fee = await this.requestedFee();
        // Simulate the contract call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'addSubkey',
            args: [
                toBytes32(primaryKeyFingerprint),
                toBytes32(subkeyFingerprint),
                openPGPMsg
            ],
            value: fee
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Publish a key revocation certificate for a target public key.
     * @param fingerprint The fingerprint of the key to be revoked.
     * @param revocationCertificate The binary OpenPGP message containing the key revocation certificate.
     * @return Transaction receipt after publishing the revocation.
     */
    public async revoke(fingerprint: `0x${string}`, revocationCertificate: `0x${string}`): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the required fee for revocation
        const fee = await this.requestedFee();
        // Simulate the contract call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'revoke',
            args: [
                toBytes32(fingerprint),
                revocationCertificate
            ],
            value: fee
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS (RESTRICTED - ACCESS CONTROLLED)                                                             */
    /*****************************************************************************************************************/

    /**
     * Update the requested service fee.
     * @param newFee The new requested fee to be set in wei.
     * @return Transaction receipt after updating the fee.
     */
    public async updateRequestedFee(newFee: bigint): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Simulate the contract call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'updateRequestedFee',
            args: [newFee],
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Withdraw the full contract balance to the specified address.
     * @param to The address to which the fees are withdrawn.
     * @return Transaction receipt after withdrawing fees.
     */
    public async withdrawFees(to: Address): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Simulate the contract call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'withdrawFees',
            args: [to],
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /*****************************************************************************************************************/
    /* INITIALIZATION & UPGRADE FUNCTIONS                                                                            */
    /*****************************************************************************************************************/

    /**
     * Initialize the contract with fee and access manager settings.
     * @param fee The service fee required to execute payable functions, expressed in wei.
     * @param manager The address of the AccessManager contract that manages access control for this contract.
     * @return Transaction receipt after initialization.
     */
    public async initialize(fee: bigint, manager: Address): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Simulate the contract call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'initialize',
            args: [fee, manager],
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Reinitialize the contract after an upgrade.
     * @return Transaction receipt after reinitialization.
     */
    public async initializeUpgrade(): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Simulate the contract call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'initializeUpgrade',
            args: [],
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Upgrade the contract to a new implementation and optionally call a function.
     * @param newImplementation The address of the new implementation contract.
     * @param data The calldata to execute on the new implementation (can be empty bytes).
     * @return Transaction receipt after upgrade.
     */
    public async upgradeToAndCall(newImplementation: Address, data: `0x${string}`): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Simulate the contract call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'upgradeToAndCall',
            args: [newImplementation, data],
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /*****************************************************************************************************************/
    /* LOGS FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * Get the log of a key registration event using the provided primary key fingerprint and block number.
     *
     * @param primaryKeyFingerprint The fingerprint of the primary key to retrieve the log for.
     * @param blockNumber The block number where the event was emitted.
     * @throws Error if the event log cannot be found.
     * @return The KeyRegisteredLog object containing event details.
     */
    public async getKeyRegisteredLog(primaryKeyFingerprint: `0x${string}`, blockNumber: bigint): Promise<KeyRegisteredLog> {
        const logs = await this.searchKeyRegisteredLogs(primaryKeyFingerprint, blockNumber, blockNumber);
        if (logs.length === 0 || !logs[0]) {
            throw new Error(`KeyRegistered event log not found for primaryKeyFingerprint ${primaryKeyFingerprint} at block ${blockNumber}`);
        }
        return logs[0];
    }

    /**
     * Search for KeyRegistered event logs.
     *
     * @param primaryKeyFingerprint The fingerprint(s) of the primary key to search logs for. Default to all keys.
     * @param fromBlock The starting block number of the search range. 0 is used by default.
     * @param toBlock The ending block number of the search range. The latest block is used by default.
     * @return An array of KeyRegisteredLog objects matching the search criteria.
     */
    public async searchKeyRegisteredLogs(primaryKeyFingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: bigint, toBlock?: bigint): Promise<KeyRegisteredLog[]> {
        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        // Build args only if primaryKeyFingerprint is provided
        const args = primaryKeyFingerprint !== undefined ? {
            primaryKeyFingerprint: Array.isArray(primaryKeyFingerprint) ? primaryKeyFingerprint.map(toBytes32) : toBytes32(primaryKeyFingerprint)
        } : undefined;

        const logs = await this.client.getLogs({
            address: this.address,
            event: Web3PGPABI.find(item => item.type === 'event' && item.name === 'KeyRegistered')!,
            fromBlock: from,
            toBlock: to,
            ...(args !== undefined && { args })
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockDate: await this.getBlockTimestamp(log.blockNumber),
            transactionHash: log.transactionHash,
            primaryKeyFingerprint: log.args.primaryKeyFingerprint,
            subkeyFingerprints: log.args.subkeyFingerprints,
            openPGPMsg: log.args.openPGPMsg
        })));
    }

    /**
     * Get the log of a subkey addition event using the provided primary key fingerprint, subkey fingerprint, and block number.
     * @param primaryKeyFingerprint The fingerprint of the primary key.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @param blockNumber The block number where the event was emitted.
     * @throws Error if the event log cannot be found.
     * @return The SubkeyAddedLog object containing event details.
     */
    public async getSubkeyAddedLog(primaryKeyFingerprint: `0x${string}`, subkeyFingerprint: `0x${string}`, blockNumber: bigint): Promise<SubkeyAddedLog> {
        const logs = await this.searchSubkeyAddedLogs(primaryKeyFingerprint, subkeyFingerprint, blockNumber, blockNumber);
        if (logs.length === 0 || !logs[0]) {
            throw new Error(`SubkeyAdded event log not found for primaryKeyFingerprint ${primaryKeyFingerprint}, subkeyFingerprint ${subkeyFingerprint} at block ${blockNumber}`);
        }
        return logs[0];
    }

    /**
     * Search for SubkeyAdded event logs.
     * @param primaryKeyFingerprint The fingerprint(s) of the primary key to search logs for. Default to all keys.
     * @param subkeyFingerprint The fingerprint(s) of the subkey to search logs for. Default to all subkeys.
     * @param fromBlock The starting block number of the search range. 0 is used by default.
     * @param toBlock The ending block number of the search range. The latest block is used by default.
     * @return An array of SubkeyAddedLog objects matching the search criteria.
     */
    public async searchSubkeyAddedLogs(primaryKeyFingerprint?: `0x${string}` | `0x${string}`[], subkeyFingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: bigint, toBlock?: bigint): Promise<SubkeyAddedLog[]> {
        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        // Build args object, including only defined properties
        let args: any = undefined;
        if (primaryKeyFingerprint !== undefined || subkeyFingerprint !== undefined) {
            args = {};
            if (primaryKeyFingerprint !== undefined) {
                args.primaryKeyFingerprint = Array.isArray(primaryKeyFingerprint) ? primaryKeyFingerprint.map(toBytes32) : toBytes32(primaryKeyFingerprint);
            }
            if (subkeyFingerprint !== undefined) {
                args.subkeyFingerprint = Array.isArray(subkeyFingerprint) ? subkeyFingerprint.map(toBytes32) : toBytes32(subkeyFingerprint);
            }
        }

        const logs = await this.client.getLogs({
            address: this.address,
            event: Web3PGPABI.find(item => item.type === 'event' && item.name === 'SubkeyAdded')!,
            fromBlock: from,
            toBlock: to,
            ...(args !== undefined && { args })
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockDate: await this.getBlockTimestamp(log.blockNumber),
            transactionHash: log.transactionHash,
            primaryKeyFingerprint: log.args.primaryKeyFingerprint,
            subkeyFingerprint: log.args.subkeyFingerprint,
            openPGPMsg: log.args.openPGPMsg
        })));
    }

    /**
     * Get the log of a key revocation event using the provided fingerprint and block number.
     * @param fingerprint The fingerprint of the key to retrieve the log for.
     * @param blockNumber The block number where the event was emitted.
     * @throws Error if the event log cannot be found.
     * @return The KeyRevokedLog object containing event details.
     */
    public async getKeyRevokedLog(fingerprint: `0x${string}`, blockNumber: bigint): Promise<KeyRevokedLog> {
        const logs = await this.searchKeyRevokedLogs(fingerprint, blockNumber, blockNumber);
        if (logs.length === 0 || !logs[0]) {
            throw new Error(`KeyRevoked event log not found for fingerprint ${fingerprint} at block ${blockNumber}`);
        }
        return logs[0];
    }

    /**
     * Search for KeyRevoked event logs.
     * @param fingerprint The fingerprint(s) of the key to search logs for. Default to all keys.
     * @param fromBlock The starting block number of the search range. 0 is used by default.
     * @param toBlock The ending block number of the search range. The latest block is used by default.
     * @return An array of KeyRevokedLog objects matching the search criteria.
     */
    public async searchKeyRevokedLogs(fingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: bigint, toBlock?: bigint): Promise<KeyRevokedLog[]> {
        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        // Build args only if fingerprint is provided
        const args = fingerprint !== undefined ? {
            fingerprint: Array.isArray(fingerprint) ? fingerprint.map(toBytes32) : toBytes32(fingerprint)
        } : undefined;

        const logs = await this.client.getLogs({
            address: this.address,
            event: Web3PGPABI.find(item => item.type === 'event' && item.name === 'KeyRevoked')!,
            fromBlock: from,
            toBlock: to,
            ...(args !== undefined && { args })
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockDate: await this.getBlockTimestamp(log.blockNumber),
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            revocationCertificate: log.args.revocationCertificate
        })));
    }

    /*****************************************************************************************************************/
    /* UTILITY FUNCTIONS                                                                                             */
    /*****************************************************************************************************************/

    /**
     * Get the timestamp of a specific block.
     * @param block The block to get the timestamp for (block number or block hash).
     * @return The Date object representing the block timestamp.
     */
    public async getBlockTimestamp(block: bigint | `0x${string}`): Promise<Date> {
        if (typeof block === 'bigint') {
            const b = await this.client.getBlock({ blockNumber: block });
            return new Date(Number(b.timestamp) * 1000);
        } else {
            const b = await this.client.getBlock({ blockHash: block });
            return new Date(Number(b.timestamp) * 1000);
        }
    }
}