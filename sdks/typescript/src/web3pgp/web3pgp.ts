import { Web3PGP as Web3PGPABI }  from '../abis/Web3PGP';
import { toBytes32 } from '../utils/0xstr';
import { BlockTag, PublicClient, TransactionReceipt, WalletClient, parseEventLogs, toEventSelector, Transport, Chain } from 'viem';
import { IWeb3PGP } from './web3pgp.interface';
import { KeyRegisteredLog, SubkeyAddedLog, KeyRevokedLog, KeyCertificationRevokedLog, KeyCertifiedLog, KeyUpdatedLog, OwnershipChallengedLog, OwnershipProvedLog, Web3PGPEvents, Web3PGPEventLog } from './types/types';
import { FlatFee } from '../flatfee/flatefee';
import { getBlockTimestamp } from '../utils/viemutils';

export class Web3PGP extends FlatFee implements IWeb3PGP {

    static readonly abi = Web3PGPABI;

    // Pre-computed event definitions for efficient log queries
    private static readonly KEY_REGISTERED_EVENT = Web3PGPABI.find(item => item.type === 'event' && item.name === 'KeyRegistered')!;
    private static readonly SUBKEY_ADDED_EVENT = Web3PGPABI.find(item => item.type === 'event' && item.name === 'SubkeyAdded')!;
    private static readonly KEY_REVOKED_EVENT = Web3PGPABI.find(item => item.type === 'event' && item.name === 'KeyRevoked')!;
    private static readonly KEY_UPDATED_EVENT = Web3PGPABI.find(item => item.type === 'event' && item.name === 'KeyUpdated')!;
    private static readonly OWNERSHIP_CHALLENGED_EVENT = Web3PGPABI.find(item => item.type === 'event' && item.name === 'OwnershipChallenged')!;
    private static readonly OWNERSHIP_PROVED_EVENT = Web3PGPABI.find(item => item.type === 'event' && item.name === 'OwnershipProved')!;
    private static readonly KEY_CERTIFIED_EVENT = Web3PGPABI.find(item => item.type === 'event' && item.name === 'KeyCertified')!;
    private static readonly KEY_CERTIFICATION_REVOKED_EVENT = Web3PGPABI.find(item => item.type === 'event' && item.name === 'KeyCertificationRevoked')!;

    constructor(address: `0x${string}`, client: PublicClient<Transport, Chain | undefined>, walletClient?: WalletClient) {
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
        } as any) as unknown as Promise<boolean>;
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
        } as any) as unknown as Promise<boolean>;
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
        } as any) as unknown as Promise<`0x${string}`>;
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
        } as any) as unknown as Promise<bigint>;
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
        } as any) as Promise<bigint[]>;
    }

    /**
     * List the block numbers when updates were published for the given fingerprint.
     * @param fingerprint The fingerprint of the key to check.
     * @param start The starting index in the list of updates.
     * @param limit The maximum number of results to return.
     * @return An array of block numbers when updates were published.
     */
    listKeyUpdates(fingerprint: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]>{
        return this.client.readContract({
            address: this.address,
            abi: Web3PGPABI,
            functionName: 'listKeyUpdates',
            args: [toBytes32(fingerprint), start, limit],
        } as any) as Promise<bigint[]>;
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
        } as any) as Promise<bigint[]>;
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
        } as any) as Promise<`0x${string}`[]>;
    }

    /**
     * List the block numbers when key certifications were issued for a given key.
     * @param fingerprint The fingerprint of the key.
     * @param start The starting index in the list of certifications.
     * @param limit The maximum number of results to return.
     * @return An array of block numbers when certifications were issued.
     */
    public listCertifications(fingerprint: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]> {
        return this.client.readContract({
            address: this.address,
            abi: Web3PGPABI,
            functionName: 'listCertifications',
            args: [toBytes32(fingerprint), start, limit],
        } as any) as Promise<bigint[]>;
    }

    /**
     * List the block numbers when key certification revocations were issued for a given key.
     * @param fingerprint The fingerprint of the key.
     * @param start The starting index in the list of revocations.
     * @param limit The maximum number of results to return.
     * @return An array of block numbers when certification revocations were issued.
     */
    public listCertificationRevocations(fingerprint: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]> {
        return this.client.readContract({
            address: this.address,
            abi: Web3PGPABI,
            functionName: 'listCertificationRevocations',
            args: [toBytes32(fingerprint), start, limit],
        } as any) as Promise<bigint[]>;
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
     * Update an existing key with new OpenPGP metadata.
     * @param fingerprint The fingerprint of the key to update.
     * @param openPGPMsg A binary OpenPGP message containing updated key material and signatures.
     * @return Transaction receipt after updating the key.
     */
    public async update(fingerprint: `0x${string}`, openPGPMsg: `0x${string}`): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        const fee = await this.requestedFee();
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'update',
            args: [toBytes32(fingerprint), openPGPMsg],
            value: fee
        });
        const txhash = await this.walletClient!.writeContract(request);
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

    /**
     * Certify a key by issuing a key certification signature.
     * @param fingerprint The fingerprint of the key being certified.
     * @param issuerFingerprint The fingerprint of the key issuing the certification.
     * @param keyCertificate A binary OpenPGP signature constituting the key certification.
     * @return Transaction receipt after publishing the certification.
     */
    public async certifyKey(
        fingerprint: `0x${string}`,
        issuerFingerprint: `0x${string}`,
        keyCertificate: `0x${string}`
    ): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the required fee for certification
        const fee = await this.requestedFee();
        // Simulate the contract call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'certifyKey',
            args: [
                toBytes32(fingerprint),
                toBytes32(issuerFingerprint),
                keyCertificate
            ],
            value: fee
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Revoke a key certification.
     * @param fingerprint The fingerprint of the key whose certification is being revoked.
     * @param issuerFingerprint The fingerprint of the issuer of the certification to revoke.
     * @param revocationSignature A signature constituting the revocation of the certification.
     * @return Transaction receipt after publishing the revocation.
     */
    public async revokeCertification(
        fingerprint: `0x${string}`,
        issuerFingerprint: `0x${string}`,
        revocationSignature: `0x${string}`
    ): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the required fee for revocation
        const fee = await this.requestedFee();
        // Simulate the contract call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'revokeCertification',
            args: [
                toBytes32(fingerprint),
                toBytes32(issuerFingerprint),
                revocationSignature
            ],
            value: fee
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Challenge ownership of a public key.
     * @param fingerprint The fingerprint of the key to challenge.
     * @param challengeHash The keccak256 hash of the challenge data sent to the user for signing.
     * @return Transaction receipt after issuing the challenge.
     */
    public async challengeOwnership(
        fingerprint: `0x${string}`,
        challengeHash: `0x${string}`
    ): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the required fee for challenge
        const fee = await this.requestedFee();
        // Simulate the contract call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'challengeOwnership',
            args: [
                toBytes32(fingerprint),
                toBytes32(challengeHash)
            ],
            value: fee
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Prove ownership of a public key by responding to a challenge.
     * @param fingerprint The fingerprint of the key.
     * @param challengeHash The keccak256 hash of the challenge data.
     * @param signature A signature made over the challenge data.
     * @return Transaction receipt after proving ownership.
     */
    public async proveOwnership(
        fingerprint: `0x${string}`,
        challengeHash: `0x${string}`,
        signature: `0x${string}`
    ): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the required fee for proof
        const fee = await this.requestedFee();
        // Simulate the contract call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3PGPABI,
            functionName: 'proveOwnership',
            args: [
                toBytes32(fingerprint),
                toBytes32(challengeHash),
                signature
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
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return logs.map(log => ({
            type: Web3PGPEvents.KeyRegistered,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            primaryKeyFingerprint: log.args.primaryKeyFingerprint,
            subkeyFingerprints: log.args.subkeyFingerprints,
            openPGPMsg: log.args.openPGPMsg
        }));
    }

        /**
     * Search for KeyUpdated event logs.
     * @param fingerprint The fingerprint(s) of the key to search logs for. Default to all keys.
     * @param fromBlock The starting block number of the search range. 'earliest' is used by default.
     * @param toBlock The ending block number of the search range. 'latest' is used by default.
     * @return An array of KeyUpdatedLog objects matching the search criteria.
     */
    public async searchKeyUpdatedLogs(fingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<KeyUpdatedLog[]> {
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        const args = fingerprint !== undefined ? {
            fingerprint: Array.isArray(fingerprint) ? fingerprint.map(toBytes32) : toBytes32(fingerprint)
        } : undefined;

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3PGP.KEY_UPDATED_EVENT,
            fromBlock: from,
            toBlock: to,
            ...(args !== undefined && { args })
        });

        const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber))];
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return logs.map(log => ({
            type: Web3PGPEvents.KeyUpdated,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
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
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return logs.map(log => ({
            type: Web3PGPEvents.SubkeyAdded,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            primaryKeyFingerprint: log.args.primaryKeyFingerprint,
            subkeyFingerprint: log.args.subkeyFingerprint,
            openPGPMsg: log.args.openPGPMsg
        }));
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
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return logs.map(log => ({
            type: Web3PGPEvents.KeyRevoked,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            revocationCertificate: log.args.revocationCertificate
        }));
    }

    /**
     * Search for OwnershipProved event logs.
     * @param fingerprint The fingerprint(s) of the key whose ownership proofs to search for. Default to all keys.
     * @param challenge The challenge(s) whose ownership proofs to search for. Default to all challenges.
     * @param fromBlock Starting block number (inclusive). 'earliest' block is used if not provided. 'pending' is not allowed.
     * @param toBlock Ending block number (inclusive). 'latest' block is used if not provided. 'pending' is not allowed.
     * @returns An array of OwnershipProvedLog objects matching the search criteria.
     */
    public async searchOwnershipChallengedLogs(fingerprint?: `0x${string}` | `0x${string}`[], challenge?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<OwnershipChallengedLog[]> {
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        let args: any = undefined;
        if (fingerprint !== undefined || challenge !== undefined) {
            args = {};
            if (fingerprint !== undefined) {
                args.fingerprint = Array.isArray(fingerprint) ? fingerprint.map(toBytes32) : toBytes32(fingerprint);
            }
            if (challenge !== undefined) {
                args.challenge = Array.isArray(challenge) ? challenge.map(toBytes32) : toBytes32(challenge);
            }
        }

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3PGP.OWNERSHIP_CHALLENGED_EVENT,
            fromBlock: from,
            toBlock: to,
            ...(args !== undefined && { args })
        });

        const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber))];
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return logs.map(log => ({
            type: Web3PGPEvents.OwnershipChallenged,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            challenge: log.args.challenge
        }));
    }

    /**
     * Search for OwnershipProved event logs.
     * @param fingerprint The fingerprint(s) of the key whose ownership proofs to search for. Default to all keys.
     * @param challenge The challenge(s) associated with the ownership proofs. Default to all challenges.
     * @param fromBlock Starting block number (inclusive). 'earliest' block is used if not provided. 'pending' is not allowed.
     * @param toBlock Ending block number (inclusive). 'latest' block is used if not provided. 'pending' is not allowed.
     * @returns An array of OwnershipProvedLog objects matching the search criteria.
     */
    public async searchOwnershipProvedLogs(fingerprint?: `0x${string}` | `0x${string}`[], challenge?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<OwnershipProvedLog[]> {
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        let args: any = undefined;
        if (fingerprint !== undefined || challenge !== undefined) {
            args = {};
            if (fingerprint !== undefined) {
                args.fingerprint = Array.isArray(fingerprint) ? fingerprint.map(toBytes32) : toBytes32(fingerprint);
            }
            if (challenge !== undefined) {
                args.challenge = Array.isArray(challenge) ? challenge.map(toBytes32) : toBytes32(challenge);
            }
        }

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3PGP.OWNERSHIP_PROVED_EVENT,
            fromBlock: from,
            toBlock: to,
            ...(args !== undefined && { args })
        });

        const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber))];
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return logs.map(log => ({
            type: Web3PGPEvents.OwnershipProved,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            challenge: log.args.challenge,
            signature: log.args.signature
        }));
    }

    /**
     * Search for KeyCertified event logs.
     * 
     * @param fingerprint The fingerprint(s) of the key being certified. Default to all keys.
     * @param issuerFingerprint The fingerprint(s) of the issuer of the certification. Default to all issuers.
     * @param fromBlock Starting block number (inclusive). 'earliest' block is used if not provided. 'pending' is not allowed.
     * @param toBlock Ending block number (inclusive). 'latest' block is used if not provided. 'pending' is not allowed.
     * @returns An array of KeyCertifiedLog objects matching the search criteria.
     */
    public async searchKeyCertifiedLogs(fingerprint?: `0x${string}` | `0x${string}`[], issuerFingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<KeyCertifiedLog[]> {
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        let args: any = undefined;
        if (fingerprint !== undefined || issuerFingerprint !== undefined) {
            args = {};
            if (fingerprint !== undefined) {
                args.fingerprint = Array.isArray(fingerprint) ? fingerprint.map(toBytes32) : toBytes32(fingerprint);
            }
            if (issuerFingerprint !== undefined) {
                args.issuerFingerprint = Array.isArray(issuerFingerprint) ? issuerFingerprint.map(toBytes32) : toBytes32(issuerFingerprint);
            }
        }

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3PGP.KEY_CERTIFIED_EVENT,
            fromBlock: from,
            toBlock: to,
            ...(args !== undefined && { args })
        });

        const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber))];
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return logs.map(log => ({
            type: Web3PGPEvents.KeyCertified,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            issuerFingerprint: log.args.issuer,
            keyCertificate: log.args.keyCertificate
        }));
    }

    /**
     * Search for KeyCertificationRevoked event logs.
     * 
     * @param fingerprint The fingerprint(s) of the key whose certification revocations to search for. Default to all keys.
     * @param issuerFingerprint The fingerprint(s) of the issuers whose certification revocations to search for. Default to all issuers.
     * @param fromBlock Starting block number (inclusive). 'earliest' block is used if not provided. 'pending' is not allowed.
     * @param toBlock Ending block number (inclusive). 'latest' block is used if not provided. 'pending' is not allowed.
     * @returns An array of KeyCertificationRevokedLog objects matching the search criteria.
     */
    public async searchKeyCertificationRevokedLogs(fingerprint?: `0x${string}` | `0x${string}`[], issuerFingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<KeyCertificationRevokedLog[]> {
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        let args: any = undefined;
        if (fingerprint !== undefined || issuerFingerprint !== undefined) {
            args = {};
            if (fingerprint !== undefined) {
                args.fingerprint = Array.isArray(fingerprint) ? fingerprint.map(toBytes32) : toBytes32(fingerprint);
            }
            if (issuerFingerprint !== undefined) {
                args.issuerFingerprint = Array.isArray(issuerFingerprint) ? issuerFingerprint.map(toBytes32) : toBytes32(issuerFingerprint);
            }
        }

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3PGP.KEY_CERTIFICATION_REVOKED_EVENT,
            fromBlock: from,
            toBlock: to,
            ...(args !== undefined && { args })
        });

        const uniqueBlocks = [...new Set(logs.map(l => l.blockNumber))];
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return logs.map(log => ({
            type: Web3PGPEvents.KeyCertificationRevoked,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            issuerFingerprint: log.args.issuer,
            revocationSignature: log.args.revocationSignature
        }));
    }

    /**
     * Searches for all key-related events within a specified block range. Optionally filters by fingerprints.
     * 
     * Note: The fingerprints are the subjects of the events (i.e., the keys being registered, updated, revoked, certified, etc.).
     * Results will also include subkeys added, challenges, and proofs of ownership related to the listed fingerprints.
     * 
     * @param fingerprints The fingerprint(s) of the keys to filter events for. Can be a single fingerprint or an array. Defaults to all keys if not provided.
     * @param fromBlock Starting block number (inclusive). Defaults to 'earliest' if not provided. 'pending' is not allowed.
     * @param toBlock Ending block number (inclusive). Defaults to 'latest' if not provided. 'pending' is not allowed.
     * @return An array of Web3PGPEventLog.
     */
    public async searchKeyEvents(fingerprints?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<Web3PGPEventLog[]> {
        
        // Reject pending block tags for fromBlock/toBlock
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }
        
        // Use default values: fromBlock = earliest, toBlock = latest
        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        // Prepare event selectors for all key-related events (topic 0)
        const eventSelectors = [
            Web3PGP.KEY_REGISTERED_EVENT,
            Web3PGP.SUBKEY_ADDED_EVENT,
            Web3PGP.KEY_REVOKED_EVENT,
            Web3PGP.KEY_UPDATED_EVENT,
            Web3PGP.OWNERSHIP_CHALLENGED_EVENT,
            Web3PGP.OWNERSHIP_PROVED_EVENT,
            Web3PGP.KEY_CERTIFIED_EVENT,
            Web3PGP.KEY_CERTIFICATION_REVOKED_EVENT
        ].map(abi => toEventSelector(abi));

        // Prepare topic 1 if fingerprints are provided
        const fingerprintsArray = fingerprints !== undefined ? (Array.isArray(fingerprints) ? fingerprints.map(fp => toBytes32(fp)) : [toBytes32(fingerprints)]) : undefined;

        // Use low-level eth_getLogs to fetch all relevant logs in one call
        const rawLogs = await this.client.request({            
            method: 'eth_getLogs',
            params: [{
                address: this.address,
                fromBlock: typeof from === 'bigint' ? `0x${from.toString(16)}` : from,
                toBlock: typeof to === 'bigint' ? `0x${to.toString(16)}` : to,
                topics: fingerprintsArray !== undefined ? [eventSelectors, fingerprintsArray] : [eventSelectors]
            }]
        }) as any;

        // Parse the raw logs using the ABI
        const parsedLogs = parseEventLogs({
            abi: Web3PGPABI,
            logs: rawLogs,
            strict: true
        });

        // Batch fetch timestamps for unique block numbers
        // Ensure blockNumbers are bigint (convert from hex strings if needed)
        const uniqueBlocks = [...new Set(parsedLogs.map(l => {
            const blockNum = l.blockNumber;
            return typeof blockNum === 'string' ? BigInt(blockNum) : blockNum;
        }))];
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return parsedLogs.map(log => {
            // Convert blockNumber to bigint if it's a string
            const blockNumber = typeof log.blockNumber === 'string' ? BigInt(log.blockNumber) : log.blockNumber;
            
            const baseLog = {
                blockNumber,
                blockHash: log.blockHash,
                blockTimestamp: blockTimestamps.get(blockNumber)!,
                transactionHash: log.transactionHash
            };

            switch (log.eventName) {
                case 'KeyRegistered':
                    return {
                        ...baseLog,
                        type: Web3PGPEvents.KeyRegistered,
                        primaryKeyFingerprint: log.args.primaryKeyFingerprint,
                        subkeyFingerprints: log.args.subkeyFingerprints,
                        openPGPMsg: log.args.openPGPMsg
                    } as KeyRegisteredLog;
                case 'SubkeyAdded':
                    return {
                        ...baseLog,
                        type: Web3PGPEvents.SubkeyAdded,
                        primaryKeyFingerprint: log.args.primaryKeyFingerprint,
                        subkeyFingerprint: log.args.subkeyFingerprint,
                        openPGPMsg: log.args.openPGPMsg
                    } as SubkeyAddedLog;
                case 'KeyRevoked':
                    return {
                        ...baseLog,
                        type: Web3PGPEvents.KeyRevoked,
                        fingerprint: log.args.fingerprint,
                        revocationCertificate: log.args.revocationCertificate
                    } as KeyRevokedLog;
                case 'KeyUpdated':
                    return {
                        ...baseLog,
                        type: Web3PGPEvents.KeyUpdated,
                        fingerprint: log.args.fingerprint,
                        openPGPMsg: log.args.openPGPMsg
                    } as KeyUpdatedLog;
                case 'OwnershipChallenged':
                    return {
                        ...baseLog,
                        type: Web3PGPEvents.OwnershipChallenged,
                        fingerprint: log.args.fingerprint,
                        challenge: log.args.challenge
                    } as OwnershipChallengedLog;
                case 'OwnershipProved':
                    return {
                        ...baseLog,
                        type: Web3PGPEvents.OwnershipProved,
                        fingerprint: log.args.fingerprint,
                        challenge: log.args.challenge,
                        signature: log.args.signature
                    } as OwnershipProvedLog;
                case 'KeyCertified':
                    return {
                        ...baseLog,
                        type: Web3PGPEvents.KeyCertified,
                        fingerprint: log.args.fingerprint,
                        issuerFingerprint: log.args.issuer,
                        keyCertificate: log.args.keyCertificate
                    } as KeyCertifiedLog;
                case 'KeyCertificationRevoked':
                    return {
                        ...baseLog,
                        type: Web3PGPEvents.KeyCertificationRevoked,
                        fingerprint: log.args.fingerprint,
                        issuerFingerprint: log.args.issuer,
                        revocationSignature: log.args.revocationSignature
                    } as KeyCertificationRevokedLog;
                default:
                    // This should never happen due to strict parsing
                    throw new Error(`Unhandled event type: ${log.eventName}`);
            }
        });
    }

    /**
     * Extract KeyRegistered event logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns An array of KeyRegisteredLog objects extracted from the receipt.
     */
    public async extractKeyRegisteredLog(receipt: TransactionReceipt): Promise<KeyRegisteredLog[]> {
        let parsedLogs = parseEventLogs({
            abi: Web3PGPABI,
            eventName: 'KeyRegistered',
            logs: receipt.logs
        });

        const uniqueBlocks = Array.from(new Set(parsedLogs.map(log => log.blockNumber)));
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return parsedLogs.map(log => ({
            type: Web3PGPEvents.KeyRegistered,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            primaryKeyFingerprint: log.args.primaryKeyFingerprint,
            subkeyFingerprints: log.args.subkeyFingerprints,
            openPGPMsg: log.args.openPGPMsg
        }));
    }

    /**
     * Extract KeyUpdated event logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns An array of KeyUpdatedLog objects extracted from the receipt.
     */
    public async extractKeyUpdatedLog(receipt: TransactionReceipt): Promise<KeyUpdatedLog[]> {
        let parsedLogs = parseEventLogs({
            abi: Web3PGPABI,
            eventName: 'KeyUpdated',
            logs: receipt.logs
        });

        const uniqueBlocks = Array.from(new Set(parsedLogs.map(log => log.blockNumber)));
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return parsedLogs.map(log => ({
            type: Web3PGPEvents.KeyUpdated,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            openPGPMsg: log.args.openPGPMsg
        }));
    }

    /**
     * Extract SubkeyAdded event logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns An array of SubkeyAddedLog objects extracted from the receipt.
     */
    public async extractSubkeyAddedLog(receipt: TransactionReceipt): Promise<SubkeyAddedLog[]> {
        let parsedLogs = parseEventLogs({
            abi: Web3PGPABI,
            eventName: 'SubkeyAdded',
            logs: receipt.logs
        });

        const uniqueBlocks = Array.from(new Set(parsedLogs.map(log => log.blockNumber)));
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return parsedLogs.map(log => ({
            type: Web3PGPEvents.SubkeyAdded,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            primaryKeyFingerprint: log.args.primaryKeyFingerprint,
            subkeyFingerprint: log.args.subkeyFingerprint,
            openPGPMsg: log.args.openPGPMsg
        }));
    }

    /**
     * Extract KeyRevoked event logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns An array of KeyRevokedLog objects extracted from the receipt.
     */
    public async extractKeyRevokedLog(receipt: TransactionReceipt): Promise<KeyRevokedLog[]> {
        let parsedLogs = parseEventLogs({
            abi: Web3PGPABI,
            eventName: 'KeyRevoked',
            logs: receipt.logs
        });

        const uniqueBlocks = Array.from(new Set(parsedLogs.map(log => log.blockNumber)));
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return parsedLogs.map(log => ({
            type: Web3PGPEvents.KeyRevoked,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            revocationCertificate: log.args.revocationCertificate
        }));
    }

    /**
     * Extract OwnershipChallenged event logs from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns An array of OwnershipChallengedLog objects extracted from the receipt.
     */
    public async extractOwnershipChallengedLog(receipt: TransactionReceipt): Promise<OwnershipChallengedLog[]> {
        let parsedLogs = parseEventLogs({
            abi: Web3PGPABI,
            eventName: 'OwnershipChallenged',
            logs: receipt.logs
        });

        const uniqueBlocks = Array.from(new Set(parsedLogs.map(log => log.blockNumber)));
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return parsedLogs.map(log => ({
            type: Web3PGPEvents.OwnershipChallenged,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            challenge: log.args.challenge
        }));
    }

    /**
     * Extract OwnershipProved event logs from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns An array of OwnershipProvedLog objects extracted from the receipt.
     */
    public async extractOwnershipProvedLog(receipt: TransactionReceipt): Promise<OwnershipProvedLog[]> {
        let parsedLogs = parseEventLogs({
            abi: Web3PGPABI,
            eventName: 'OwnershipProved',
            logs: receipt.logs
        });

        const uniqueBlocks = Array.from(new Set(parsedLogs.map(log => log.blockNumber)));
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return parsedLogs.map(log => ({
            type: Web3PGPEvents.OwnershipProved,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            challenge: log.args.challenge,
            signature: log.args.signature
        }));
    }

    /**
     * Extract KeyCertified event logs from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns An array of KeyCertifiedLog objects extracted from the receipt.
     */
    public async extractKeyCertifiedLog(receipt: TransactionReceipt): Promise<KeyCertifiedLog[]> {
        let parsedLogs = parseEventLogs({
            abi: Web3PGPABI,
            eventName: 'KeyCertified',
            logs: receipt.logs
        });

        const uniqueBlocks = Array.from(new Set(parsedLogs.map(log => log.blockNumber)));
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return parsedLogs.map(log => ({
            type: Web3PGPEvents.KeyCertified,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            issuerFingerprint: log.args.issuer,
            keyCertificate: log.args.keyCertificate
        }));
    }

    /**
     * Extract KeyCertificationRevoked event logs from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns An array of KeyCertificationRevokedLog objects extracted from the receipt.
     */
    public async extractKeyCertificationRevokedLog(receipt: TransactionReceipt): Promise<KeyCertificationRevokedLog[]> {
        let parsedLogs = parseEventLogs({
            abi: Web3PGPABI,
            eventName: 'KeyCertificationRevoked',
            logs: receipt.logs
        });

        const uniqueBlocks = Array.from(new Set(parsedLogs.map(log => log.blockNumber)));
        const blockTimestamps = await this.getBlockTimestamps(uniqueBlocks);

        return parsedLogs.map(log => ({
            type: Web3PGPEvents.KeyCertificationRevoked,
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            logIndex: log.logIndex,
            transactionHash: log.transactionHash,
            fingerprint: log.args.fingerprint,
            issuerFingerprint: log.args.issuer,
            revocationSignature: log.args.revocationSignature
        }));
    }

    /*****************************************************************************************************************/
    /* UTILITY FUNCTIONS                                                                                             */
    /*****************************************************************************************************************/

    /**
     * Get the current block number of the connected blockchain.
     * @return The current block number as a bigint.
     */
    public getBlockNumber(): Promise<bigint> {
        return this.client.getBlockNumber();
    }

    /**
     * Helper to efficiently fetch timestamps for a list of logs.
     * Deduplicates block lookups to minimize RPC calls.
     */
    private async getBlockTimestamps(blockNumbers: bigint[]): Promise<Map<bigint, Date>> {
        const uniqueBlocks = [...new Set(blockNumbers)];
        return new Map(
            await Promise.all(uniqueBlocks.map(async bn => 
                [bn, await getBlockTimestamp(this.client, bn)] as [bigint, Date]
            ))
        );
    }
}