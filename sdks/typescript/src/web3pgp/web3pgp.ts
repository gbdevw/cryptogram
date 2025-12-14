import { Web3PGP as Web3PGPABI }  from '../abis/Web3PGP';
import { toBytes32 } from '../utils/0xstr';
import { Address, BlockTag, PublicClient, TransactionReceipt, WalletClient, parseEventLogs } from 'viem';
import { IWeb3PGP } from './web3pgp.interface';
import { KeyRegisteredLog, SubkeyAddedLog, KeyRevokedLog } from './types/types';
import { FlatFee } from '../flatfee/flatefee';
import { getBlockTimestamp } from '../utils/viemutils';

export class Web3PGP extends FlatFee implements IWeb3PGP {

    static readonly abi = Web3PGPABI;

    // Pre-computed event definitions for efficient log queries
    private static readonly KEY_REGISTERED_EVENT = Web3PGPABI.find(item => item.type === 'event' && item.name === 'KeyRegistered')!;
    private static readonly SUBKEY_ADDED_EVENT = Web3PGPABI.find(item => item.type === 'event' && item.name === 'SubkeyAdded')!;
    private static readonly KEY_REVOKED_EVENT = Web3PGPABI.find(item => item.type === 'event' && item.name === 'KeyRevoked')!;

    constructor(address: `0x${string}`, client: PublicClient, walletClient?: WalletClient) {
        super(address, client, walletClient);
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
        if (logs.length === 1) return logs[0]!;
        if (logs.length === 0) throw new Error(`KeyRegistered event log not found for primaryKeyFingerprint ${primaryKeyFingerprint} at block ${blockNumber}`);
        throw new Error(`Multiple KeyRegistered logs found for primaryKeyFingerprint ${primaryKeyFingerprint} at block ${blockNumber}`);
    }

    /**
     * Search for KeyRegistered event logs.
     *
     * @param primaryKeyFingerprint The fingerprint(s) of the primary key to search logs for. Default to all keys.
     * @param fromBlock The starting block number of the search range. 'earliest' is used by default. 'pending' is not allowed.
     * @param toBlock The ending block number of the search range. 'latest' is used by default. 'pending' is not allowed.
     * @return An array of KeyRegisteredLog objects matching the search criteria.
     */
    public async searchKeyRegisteredLogs(primaryKeyFingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<KeyRegisteredLog[]> {
        
        // Reject pending block tags for fromBlock/toBlock
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        // Build args only if primaryKeyFingerprint is provided
        const args = primaryKeyFingerprint !== undefined ? {
            primaryKeyFingerprint: Array.isArray(primaryKeyFingerprint) ? primaryKeyFingerprint.map(toBytes32) : toBytes32(primaryKeyFingerprint)
        } : undefined;

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3PGP.KEY_REGISTERED_EVENT,
            fromBlock: from,
            toBlock: to,
            ...(args !== undefined && { args })
        });
        
        // Batch fetch timestamps for unique block numbers
        const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber))];
        const blockTimestamps = new Map(
            await Promise.all(uniqueBlocks.map(async bn => 
                [bn, await getBlockTimestamp(this.client, bn)] as [bigint, Date]
            ))
        );

        return logs.map(log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            transactionHash: log.transactionHash,
            primaryKeyFingerprint: log.args.primaryKeyFingerprint,
            subkeyFingerprints: log.args.subkeyFingerprints,
            openPGPMsg: log.args.openPGPMsg
        }));
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
        if (logs.length === 1) return logs[0]!;
        if (logs.length === 0) throw new Error(`SubkeyAdded event log not found for primaryKeyFingerprint ${primaryKeyFingerprint}, subkeyFingerprint ${subkeyFingerprint} at block ${blockNumber}`);
        throw new Error(`Multiple SubkeyAdded logs found for primaryKeyFingerprint ${primaryKeyFingerprint}, subkeyFingerprint ${subkeyFingerprint} at block ${blockNumber}`);
    }

    /**
     * Search for SubkeyAdded event logs.
     * @param primaryKeyFingerprint The fingerprint(s) of the primary key to search logs for. Default to all keys.
     * @param subkeyFingerprint The fingerprint(s) of the subkey to search logs for. Default to all subkeys.
     * @param fromBlock The starting block number of the search range. 'earliest' is used by default. 'pending' is not allowed.
     * @param toBlock The ending block number of the search range. 'latest' is used by default. 'pending' is not allowed.
     * @return An array of SubkeyAddedLog objects matching the search criteria.
     */
    public async searchSubkeyAddedLogs(primaryKeyFingerprint?: `0x${string}` | `0x${string}`[], subkeyFingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<SubkeyAddedLog[]> {
        
        /// Reject pending block tags for fromBlock/toBlock
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

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
            strict: true,
            address: this.address,
            event: Web3PGP.SUBKEY_ADDED_EVENT,
            fromBlock: from,
            toBlock: to,
            ...(args !== undefined && { args })
        });
        
        // Batch fetch timestamps for unique block numbers
        const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber))];
        const blockTimestamps = new Map(
            await Promise.all(uniqueBlocks.map(async bn => 
                [bn, await getBlockTimestamp(this.client, bn)] as [bigint, Date]
            ))
        );

        return logs.map(log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            transactionHash: log.transactionHash,
            primaryKeyFingerprint: log.args.primaryKeyFingerprint,
            subkeyFingerprint: log.args.subkeyFingerprint,
            openPGPMsg: log.args.openPGPMsg
        }));
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
        if (logs.length === 1) return logs[0]!;
        if (logs.length === 0) throw new Error(`KeyRevoked event log not found for fingerprint ${fingerprint} at block ${blockNumber}`);
        throw new Error(`Multiple KeyRevoked logs found for fingerprint ${fingerprint} at block ${blockNumber}`);
    }

    /**
     * Search for KeyRevoked event logs.
     * @param fingerprint The fingerprint(s) of the key to search logs for. Default to all keys.
     * @param fromBlock The starting block number of the search range. 'earliest' is used by default. 'pending' is not allowed.
     * @param toBlock The ending block number of the search range. 'latest' is used by default. 'pending' is not allowed.
     * @return An array of KeyRevokedLog objects matching the search criteria.
     */
    public async searchKeyRevokedLogs(fingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<KeyRevokedLog[]> {
        /// Reject pending block tags for fromBlock/toBlock
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        // Use default values: fromBlock = earliest, toBlock = latest 
        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        // Build args only if fingerprint is provided
        const args = fingerprint !== undefined ? {
            fingerprint: Array.isArray(fingerprint) ? fingerprint.map(toBytes32) : toBytes32(fingerprint)
        } : undefined;

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3PGP.KEY_REVOKED_EVENT,
            fromBlock: from,
            toBlock: to,
            ...(args !== undefined && { args })
        });
        
        // Batch fetch timestamps for unique block numbers
        const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber))];
        const blockTimestamps = new Map(
            await Promise.all(uniqueBlocks.map(async bn => 
                [bn, await getBlockTimestamp(this.client, bn)] as [bigint, Date]
            ))
        );

        return logs.map(log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            revocationCertificate: log.args.revocationCertificate
        }));
    }

    /**
     * Synchronize key-related (KeyRegistered, SubkeyAdded, KeyRevoked) events from the blockchain within the specified
     * block range.
     * 
     * @param fromBlock Starting block number (inclusive). 'earliest' block is used if not provided. 'pending' is not allowed.
     * @param toBlock Ending block number (inclusive). 'latest' block is used if not provided. 'pending' is not allowed.
     * @return An array of key-related event logs (KeyRegisteredLog, SubkeyAddedLog, KeyRevokedLog).
     */
    public async searchKeyEvents(fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<KeyRegisteredLog | SubkeyAddedLog | KeyRevokedLog[]> {
        
        // Reject pending block tags for fromBlock/toBlock
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }
        
        // Use default values: fromBlock = earliest, toBlock = latest
        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        const logs = await this.client.getLogs({
            address: this.address,
            fromBlock: from,
            toBlock: to,
            events: [
                Web3PGP.KEY_REGISTERED_EVENT,
                Web3PGP.SUBKEY_ADDED_EVENT,
                Web3PGP.KEY_REVOKED_EVENT
            ],
            strict: true
        })

        // Batch fetch timestamps for unique block numbers
        const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber))];
        const blockTimestamps = new Map(
            await Promise.all(uniqueBlocks.map(async bn => 
                [bn, await getBlockTimestamp(this.client, bn)] as [bigint, Date]
            ))
        );

        return logs.map(log => {
            const baseLog = {
                blockNumber: log.blockNumber,
                blockHash: log.blockHash,
                blockTimestamp: blockTimestamps.get(log.blockNumber)!,
                transactionHash: log.transactionHash
            };

            switch (log.eventName) {
                case 'KeyRegistered':
                    return {
                        ...baseLog,
                        primaryKeyFingerprint: log.args.primaryKeyFingerprint,
                        subkeyFingerprints: log.args.subkeyFingerprints,
                        openPGPMsg: log.args.openPGPMsg
                    } as KeyRegisteredLog;
                case 'SubkeyAdded':
                    return {
                        ...baseLog,
                        primaryKeyFingerprint: log.args.primaryKeyFingerprint,
                        subkeyFingerprint: log.args.subkeyFingerprint,
                        openPGPMsg: log.args.openPGPMsg
                    } as SubkeyAddedLog;
                case 'KeyRevoked':
                    return {
                        ...baseLog,
                        fingerprint: log.args.fingerprint,
                        revocationCertificate: log.args.revocationCertificate
                    } as KeyRevokedLog;
            }
        });
    }

    /**
     * Extract KeyRegistered event logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns An array of KeyRegisteredLog objects extracted from the receipt.
     */
    extractKeyRegisteredLog(receipt: TransactionReceipt): Promise<KeyRegisteredLog[]> {
        let parsedLogs = parseEventLogs({
            abi: Web3PGPABI,
            eventName: 'KeyRegistered',
            logs: receipt.logs
        });

        return Promise.all(parsedLogs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            primaryKeyFingerprint: log.args.primaryKeyFingerprint,
            subkeyFingerprints: log.args.subkeyFingerprints,
            openPGPMsg: log.args.openPGPMsg
        })));
    }

    /**
     * Extract SubkeyAdded event logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns An array of SubkeyAddedLog objects extracted from the receipt.
     */
    extractSubkeyAddedLog(receipt: TransactionReceipt): Promise<SubkeyAddedLog[]> {
        let parsedLogs = parseEventLogs({
            abi: Web3PGPABI,
            eventName: 'SubkeyAdded',
            logs: receipt.logs
        });

        return Promise.all(parsedLogs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            primaryKeyFingerprint: log.args.primaryKeyFingerprint,
            subkeyFingerprint: log.args.subkeyFingerprint,
            openPGPMsg: log.args.openPGPMsg
        })));
    }

    /**
     * Extract KeyRevoked event logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns An array of KeyRevokedLog objects extracted from the receipt.
     */
    extractKeyRevokedLog(receipt: TransactionReceipt): Promise<KeyRevokedLog[]> {
        let parsedLogs = parseEventLogs({
            abi: Web3PGPABI,
            eventName: 'KeyRevoked',
            logs: receipt.logs
        });

        return Promise.all(parsedLogs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            revocationCertificate: log.args.revocationCertificate
        })));
    }

    /*****************************************************************************************************************/
    /* UTILITY FUNCTIONS                                                                                             */
    /*****************************************************************************************************************/

    /**
     * Get the current block number of the connected blockchain.
     * @return The current block number as a bigint.
     */
    getBlockNumber(): Promise<bigint> {
        return this.client.getBlockNumber();
    }
}