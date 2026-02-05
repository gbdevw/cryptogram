import { Address, TransactionReceipt, PublicClient, WalletClient, parseEventLogs, BlockTag } from 'viem';
import { IWeb3Sign } from './web3sign.interface';
import { IWeb3PGP } from '../web3pgp/web3pgp.interface';
import { Recipient, DocumentLog, CopyLog, SignatureLog, TimestampLog, NotificationLog, Web3SignEvents, SignatureRevocationLog } from './types/types';
import { Web3Sign as Web3SignABI }  from '../abis/Web3Sign';
import { to0x, toBytes32 } from '../utils/0xstr';
import { FlatFee } from '../flatfee/flatefee';
import { getBlockTimestamp } from '../utils/viemutils';
import { Web3SignCriticalError, Web3SignError } from './types/errors';

/**
 * Implementation of the Web3Sign contract interface.
 * 
 * This class provides low-level bindings to interact with the Web3Sign contract deployed on the blockchain.
 * Extends FlatFee to inherit fee management and access control functionality.
 */
export class Web3Sign extends FlatFee implements IWeb3Sign {

    public static readonly abi = Web3SignABI;
    
    // Pre-computed event definitions for efficient log queries
    private static readonly DOCUMENT_EVENT = Web3SignABI.find(item => item.type === 'event' && item.name === 'Document')!;
    private static readonly COPY_EVENT = Web3SignABI.find(item => item.type === 'event' && item.name === 'Copy')!;
    private static readonly NOTIFICATION_EVENT = Web3SignABI.find(item => item.type === 'event' && item.name === 'Notification')!;
    private static readonly SIGNATURE_EVENT = Web3SignABI.find(item => item.type === 'event' && item.name === 'Signature')!;
    private static readonly SIGNATURE_REVOCATION_EVENT = Web3SignABI.find(item => item.type === 'event' && item.name === 'SignatureRevocation')!;
    private static readonly TIMESTAMP_EVENT = Web3SignABI.find(item => item.type === 'event' && item.name === 'Timestamp')!;

    /**
     * Creates a new Web3Sign instance.
     * 
     * @param address The address of the Web3Sign smart contract.
     * @param web3pgp An instance implementing the IWeb3PGP interface for public key operations.
     * @param client A Viem public client for interacting with the blockchain.
     * @param walletClient Optional Viem wallet client for signing transactions.
     */
    public constructor(address: Address, web3pgp: IWeb3PGP, client: PublicClient, walletClient?: WalletClient) {
        super(address, client, walletClient);
    }

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS                                                                                               */
    /*****************************************************************************************************************/

    /**
     * Sends a document and its detached signature on-chain and notifies the specified recipients.
     *
     * @param emitter The fingerprint of the key used by the emitter to produce the signature.
     * @param recipients The list of recipients to notify and optionally prompt to sign the document.
     * @param dochash The declared keccak256 hash of the document.
     * @param signature A detached binary OpenPGP signature of the document.
     * @param document The binary OpenPGP message which contains the document.
     * @param mimeType Optional, The MIME type of the document and additional attributes (RFC6838)
     */
    public async sendOnChain(
        emitter: `0x${string}`,
        recipients: Recipient[],
        dochash: `0x${string}`,
        signature: `0x${string}`,
        document: `0x${string}`,
        mimeType: string
    ): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the requested fee
        const fee = await this.requestedFee();
        // Simulate client call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3SignABI,
            functionName: 'sendOnChain',
            args: [
                toBytes32(to0x(emitter)), 
                recipients.map(recipient => ({
                    fingerprint: toBytes32(to0x(recipient.fingerprint)),
                    signatureRequested: recipient.signatureRequested,
                })),
                dochash, 
                signature, 
                document, 
                mimeType
            ],
            value: fee, // Include fee in the transaction value
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Sends a document using an off-chain channel, publishes its detached signature on-chain and notifies the specified recipients.
     *
     * @param emitter The fingerprint of the key used to produce the signature.
     * @param recipients The list of recipients to notify and optionally prompt to sign the document.
     * @param dochash The declared keccak256 hash of the document.
     * @param signature A detached binary OpenPGP signature of the document.
     * @param uri A URI which can be used to download the OpenPGP message (compressed and encrypted) which contains the document.
     * @param mimeType Optional, The MIME type of the document and additional attributes (RFC6838)
     */
    public async sendOffChain(
        emitter: `0x${string}`,
        recipients: Recipient[],
        dochash: `0x${string}`,
        signature: `0x${string}`,
        uri: string,
        mimeType: string
    ): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the requested fee
        const fee = await this.requestedFee();
        // Simulate client call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3SignABI,
            functionName: 'sendOffChain',
            args: [
                toBytes32(to0x(emitter)), 
                recipients.map(recipient => ({
                    fingerprint: toBytes32(to0x(recipient.fingerprint)),
                    signatureRequested: recipient.signatureRequested,
                })),
                dochash, 
                signature, 
                uri, 
                mimeType
            ],
            value: fee, // Include fee in the transaction value
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Send a certified copy of a document on-chain.
     *
     * @param original The ID of the original document that is the subject of the copy.
     * @param emitter The fingerprint of the emitter's public key.
     * @param recipients The list of recipient key fingerprints to be notified and, optionally, be prompted for a signature.
     * @param document The binary OpenPGP message containing the copy of the original document.
     */
    public async copyOnChain(
        original: bigint,
        emitter: `0x${string}`,
        recipients: Recipient[],
        document: `0x${string}`
    ): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the requested fee
        const fee = await this.requestedFee();
        // Simulate client call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3SignABI,
            functionName: 'copyOnChain',
            args: [
                original,
                toBytes32(to0x(emitter)), 
                recipients.map(recipient => ({
                    fingerprint: toBytes32(to0x(recipient.fingerprint)),
                    signatureRequested: recipient.signatureRequested,
                })),
                document
            ],
            value: fee, // Include fee in the transaction value
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Send a certified copy of a document using an off-chain storage.
     *
     * @param original The ID of the original document being copied. Must reference a valid, non-copy document.
     * @param emitter The fingerprint of the key used to produce the signature.
     * @param recipients The list of recipient key fingerprints to be notified and, optionally, be prompted for a signature.
     * @param uri A URI which can be used to download the OpenPGP message containing the (compressed, encrypted and signed) document itself.
     */
    public async copyOffChain(
        original: bigint,
        emitter: `0x${string}`,
        recipients: Recipient[],
        uri: string
    ): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the requested fee
        const fee = await this.requestedFee();
        // Simulate client call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3SignABI,
            functionName: 'copyOffChain',
            args: [
                original,
                toBytes32(to0x(emitter)), 
                recipients.map(recipient => ({
                    fingerprint: toBytes32(to0x(recipient.fingerprint)),
                    signatureRequested: recipient.signatureRequested,
                })),
                uri
            ],
            value: fee, // Include fee in the transaction value
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Publishes a binary detached OpenPGP signature of a document made with the emitter's key.
     *
     * @param id The unique ID of the document that has been signed.
     * @param emitter The fingerprint of the key used to produce the signature.
     * @param signature The detached binary OpenPGP signature made over the document.
     */
    public async sign(id: bigint, emitter: `0x${string}`, signature: `0x${string}`): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the requested fee
        const fee = await this.requestedFee();
        // Simulate client call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3SignABI,
            functionName: 'sign',
            args: [
                id,
                toBytes32(to0x(emitter)),
                signature
            ],
            value: fee, // Include fee in the transaction value
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Timestamps a document by publishing a detached signature of the hash of the document on-chain.
     *
     * @param emitter The fingerprint of the key used to produce the signature.
     * @param dochash The keccak256 hash of the document used to find the timestamp from the document and verify their integrity.
     * @param signature A detached binary OpenPGP signature made over the raw bytes of the keccak256 hash of the document.
     */
    public async timestamp(emitter: `0x${string}`, dochash: `0x${string}`, signature: `0x${string}`): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the requested fee
        const fee = await this.requestedFee();
        // Simulate client call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3SignABI,
            functionName: 'timestamp',
            args: [
                toBytes32(to0x(emitter)),
                dochash,
                signature
            ],
            value: fee, // Include fee in the transaction value
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Revokes a signature previously published on-chain.
     *
     * @param id The ID of the document associated with the signature.
     * @param emitter The fingerprint of the key that made the signature.
     * @param signatureHash The hash of the signature to revoke.
     * @param signature A detached binary OpenPGP signature made over the raw bytes of the signature hash.
     */
    public async revokeSignature(
        id: bigint,
        emitter: `0x${string}`,
        signatureHash: `0x${string}`,
        signature: `0x${string}`
    ): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Get the requested fee
        const fee = await this.requestedFee();
        // Simulate client call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: Web3SignABI,
            functionName: 'revokeSignature',
            args: [
                id,
                toBytes32(to0x(emitter)),
                signatureHash,
                signature
            ],
            value: fee, // Include fee in the transaction value
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /*****************************************************************************************************************/
    /* READ FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * Get the address of the Web3PGP contract used as a global public key registry.
     *
     * @return The address of the Web3PGP contract used by this contract.
     */
    public async getWeb3PGPAddress(): Promise<Address> {
        return this.client.readContract({
            address: this.address,
            abi: Web3SignABI,
            functionName: 'getWeb3PGPAddress',
        });
    }

    /**
     * Returns the ID of the original document that the given document is a copy of.
     *
     * @param id The ID of a document that may be a copy of another previously published document.
     * @return The ID of the original document if the given document is a copy, or 0 if it is not a copy.
     */
    public async isCopyOf(id: bigint): Promise<bigint> {
        return this.client.readContract({
            address: this.address,
            abi: Web3SignABI,
            functionName: 'isCopyOf',
            args: [id],
        });
    }

    /**
     * Returns the block number in which the document or timestamps with the given ID was published.
     *
     * @param id The ID of the document whose block number is to be retrieved.
     * @return The block number in which the document was published. 0 if the document does not exist.
     */
    public async getDocumentBlockNumberByID(id: bigint): Promise<bigint> {
        return this.client.readContract({
            address: this.address,
            abi: Web3SignABI,
            functionName: 'getDocumentBlockNumberByID',
            args: [id],
        });
    }

    /**
     * Returns the block numbers in which the documents or timestamps with the given IDs were published.
     *
     * @param ids The IDs of the documents whose block numbers are to be retrieved.
     * @return The block numbers in which the documents were published.
     */
    public async getDocumentBlockNumberByIDBatch(ids: bigint[]): Promise<bigint[]> {
        return this.client.readContract({
            address: this.address,
            abi: Web3SignABI,
            functionName: 'getDocumentBlockNumberByIDBatch',
            args: [ids],
        }) as Promise<bigint[]>;
    }

    /**
     * Lists the block numbers when were published the signatures associated with the given document.
     *
     * @param id The ID of the document whose signatures are to be listed.
     * @param start The starting index from which to list signatures (0-based).
     * @param limit The maximum number of signatures to list.
     * @return An array of signature IDs associated with the document.
     */
    public async listSignatures(id: bigint, start: bigint, limit: bigint): Promise<bigint[]> {
        return this.client.readContract({
            address: this.address,
            abi: Web3SignABI,
            functionName: 'listSignatures',
            args: [id, start, limit],
        }) as Promise<bigint[]>;
    }

        /**
     * Returns the block number in which the signature with the given hash was created or 0 if the signature does not exist.
     *
     * @param signatureHash The hash of the signature.
     * @return The block number in which the signature was created, or 0 if the signature does not exist.
     */
    public async getSignatureBlockNumberByHash(signatureHash: `0x${string}`): Promise<bigint> {
        return this.client.readContract({
            address: this.address,
            abi: Web3SignABI,
            functionName: 'getSignatureBlockNumberByHash',
            args: [signatureHash],
        });
    }

    /**
     * Returns the block numbers in which the signatures with the given hashes were created.
     *
     * @param signatureHashes The hashes of the signatures.
     * @return The block numbers in which the signatures were created.
     */
    public async getSignatureBlockNumberByHashBatch(signatureHashes: `0x${string}`[]): Promise<bigint[]> {
        return this.client.readContract({
            address: this.address,
            abi: Web3SignABI,
            functionName: 'getSignatureBlockNumberByHashBatch',
            args: [signatureHashes],
        }) as Promise<bigint[]>;
    }

    /**
     * Lists the document IDs by the given document hash.
     *
     * @param dochash The hash of the document.
     * @param start The starting index from which to list documents (0-based).
     * @param limit The maximum number of documents to list.
     * @return An array of document IDs with the given hash.
     */
    public async listDocumentIdsByHash(dochash: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]> {
        return this.client.readContract({
            address: this.address,
            abi: Web3SignABI,
            functionName: 'listDocumentIdsByHash',
            args: [dochash, start, limit],
        }) as Promise<bigint[]>;
    }

    /**
     * Lists the block numbers of signature revocations for the given signature hash.
     *
     * @param signatureHash The hash of the signature.
     * @param start The starting index from which to list revocations (0-based).
     * @param limit The maximum number of revocations to list.
     * @return An array of block numbers where the signature was revoked.
     */
    public async listSignatureRevocationsBlockNumbers(signatureHash: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]> {
        return this.client.readContract({
            address: this.address,
            abi: Web3SignABI,
            functionName: 'listSignatureRevocationsBlockNumbers',
            args: [signatureHash, start, limit],
        }) as Promise<bigint[]>;
    }

    /*****************************************************************************************************************/
    /* LOGS SEARCH FUNCTIONS                                                                                         */
    /*****************************************************************************************************************/

    /**
     * Searches for Document events emitted by the smart contract, filtered by the provided criteria.
     * Each value in a filter is combined using a logical OR, while all defined filters are combined using a logical AND.
     * 
     * @param ids Filter by document IDs. IDs uniqueness is guaranteed by the smart contract.
     * @param emitters Filter by emitter fingerprints.
     * @param dochashes Filter by document hashes.
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of DocumentLog matching the provided filters.
     */
    public async searchDocumentLogs(
        ids?: bigint[], 
        emitters?: `0x${string}`[], 
        dochashes?: `0x${string}`[], 
        fromBlock?: BlockTag | bigint, 
        toBlock?: BlockTag | bigint
    ): Promise<DocumentLog[]> {
        // Reject pending block tags for fromBlock/toBlock
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        // Use default values: fromBlock = earliest block, toBlock = latest block
        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        // Build args only if a filter is provided
        let args: any = undefined;
        if (ids !== undefined || emitters !== undefined || dochashes !== undefined) {
            args = {};
            if (ids !== undefined) {
                args.id = ids;
            }
            if (emitters !== undefined) {
                args.emitter = emitters.map(toBytes32);
            }
            if (dochashes !== undefined) {
                args.dochash = dochashes;
            }
        }

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3Sign.DOCUMENT_EVENT,
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
            logIndex: log.logIndex,
            type: Web3SignEvents.Document,
            id: log.args.id,
            emitter: log.args.emitter,
            dochash: log.args.dochash,
            signature: log.args.signature,
            document: log.args.document,
            uri: log.args.uri,
            mimeType: log.args.mimeType,
        }));
    }

    /**
     * Retrieves a Document event by its unique ID.
     * 
     * @param id The unique ID of the document.
     * @param blockNumber The block number where to search for the document.
     * @returns The DocumentLog if found, otherwise undefined.
     * @example
     * ```typescript
     * const targetID = 1n;
     * const blockNumber = await web3Doc.getDocumentBlockNumberByID(targetID);
     * const documentLog = await web3Doc.getDocumentLogByID(targetID, blockNumber);
     * ```
     */
    public async getDocumentLogByID(id: bigint, blockNumber: bigint): Promise<DocumentLog | undefined> {
        const logs = await this.searchDocumentLogs([id], undefined, undefined, blockNumber, blockNumber);
        if (logs.length === 1) return logs[0];
        if (logs.length === 0) return undefined;
        // This should never happen as document IDs are unique but we guard against it anyway
        throw new Web3SignCriticalError(`Multiple Document logs found for document ID ${id} at block ${blockNumber}`);
    }

    /**
     * Searches for Copy events emitted by the smart contract, filtered by the provided criteria.
     * Each value in a filter is combined using a logical OR, while all defined filters are combined using a logical AND.
     * 
     * @param copies Filter by copy IDs. Copy IDs uniqueness is guaranteed by the smart contract. 
     * @param originals Filter by original document IDs.
     * @param emitters Filter by emitter fingerprints.
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of CopyLog matching the provided filters.
     */
    public async searchCopyLogs(
        copies?: bigint[], 
        originals?: bigint[], 
        emitters?: `0x${string}`[], 
        fromBlock?: BlockTag | bigint, 
        toBlock?: BlockTag | bigint
    ): Promise<CopyLog[]> {
        // Reject pending block tags for fromBlock/toBlock
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        // Use default values: fromBlock = earliest block, toBlock = latest block
        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';
        
        // Build args only if a filter is provided
        let args: any = undefined;
        if (copies !== undefined || originals !== undefined || emitters !== undefined) {
            args = {};
            if (copies !== undefined) {
                args.copy = copies;
            }
            if (originals !== undefined) {
                args.original = originals;
            }
            if (emitters !== undefined) {
                args.emitter = emitters.map(toBytes32);
            }
        }

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3Sign.COPY_EVENT,
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
            logIndex: log.logIndex,
            type: Web3SignEvents.Copy,
            copy: log.args.copy,
            original: log.args.original,
            emitter: log.args.emitter,
            document: log.args.document,
            uri: log.args.uri,
        }));
    }

    /**
     * Retrieves a Copy event by its unique ID.
     * 
     * @param copy The unique ID of the copy.
     * @param blockNumber The block number where to search for the copy.
     * @returns The CopyLog if found, otherwise undefined.
     * @example
     * ```typescript
     * const targetCopyID = 1n;
     * const blockNumber = await web3Doc.getDocumentBlockNumberByID(targetCopyID);
     * const copyLog = await web3Doc.getCopyLogByID(targetCopyID, blockNumber);
     * ```
     */
    public async getCopyLogByID(copy: bigint, blockNumber: bigint): Promise<CopyLog | undefined> {
        const logs = await this.searchCopyLogs([copy], undefined, undefined, blockNumber, blockNumber);
        if (logs.length === 1) return logs[0];
        if (logs.length === 0) return undefined;
        // This should never happen as copy IDs are unique but we guard against it anyway
        throw new Web3SignCriticalError(`Multiple Copy logs found for copy ID ${copy} at block ${blockNumber}`);
    }

    /**
     * Searches for Notification events emitted by the smart contract, filtered by the provided criteria.
     * Each value in a filter is combined using a logical OR, while all defined filters are combined using a logical AND.
     * 
     * @param ids Filter by document IDs. Document IDs uniqueness is guaranteed by the smart contract.
     * @param recipients Filter by recipient fingerprints.
     * @param signatureRequested Filter by whether a signature was requested or not.
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of NotificationLog matching the provided filters.
     */
    public async searchNotificationLogs(
        ids?: bigint[],
        recipients?: `0x${string}`[],
        signatureRequested?: boolean,
        fromBlock?: BlockTag | bigint, 
        toBlock?: BlockTag | bigint
    ): Promise<NotificationLog[]> {
        // Reject pending block tags for fromBlock/toBlock
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        // Use default values: fromBlock = earliest block, toBlock = latest block
        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';
        
        // Build args only if a filter is provided
        let args: any = undefined;
        if (ids !== undefined || recipients !== undefined || signatureRequested !== undefined) {
            args = {};
            if (ids !== undefined) {
                args.id = ids;
            }
            if (recipients !== undefined) {
                args.recipient = recipients.map(toBytes32);
            }
            if (signatureRequested !== undefined) {
                args.signatureRequested = signatureRequested;
            }
        }

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3Sign.NOTIFICATION_EVENT,
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
            logIndex: log.logIndex,
            type: Web3SignEvents.Notification,
            id: log.args.id,
            recipient: log.args.recipient,
            emitter: log.args.emitter,
            source: log.args.source,
            signatureRequested: log.args.signatureRequested,
        }));
    }

    /**
     * Retrieves a Notification event by its unique ID and recipient.
     * 
     * @param id The unique ID of the document that is the subject of the notification. 
     * @param recipient The fingerprint of the recipient who received the notification.
     * @param blockNumber The block number where to search for the notification.
     * @returns The NotificationLog if found, otherwise undefined.
     * @example
     * ```typescript
     * const targetID = 1n;
     * const recipientFingerprint = '0x...';
     * const blockNumber = await web3Doc.getDocumentBlockNumberByID(targetID);
     * const notificationLog = await web3Doc.getNotificationLog(targetID, recipientFingerprint, blockNumber);
     * ```
     */
    public async getNotificationLog(id: bigint, recipient: `0x${string}`, blockNumber: bigint): Promise<NotificationLog | undefined> {
        const logs = await this.searchNotificationLogs([id], [recipient], undefined, blockNumber, blockNumber);
        if (logs.length === 1) return logs[0];
        if (logs.length === 0) return undefined;
        // This should never happen as document ID + recipient uniqueness is guaranteed by the smart contract but we guard against it anyway
        throw new Web3SignCriticalError(`Multiple Notification logs found for document ID ${id} and recipient ${recipient} at block ${blockNumber}`);
    }

    /**
     * Searches for Signature events emitted by the smart contract, filtered by the provided criteria.
     * Each value in a filter is combined using a logical OR, while all defined filters are combined using a logical AND.
     * 
     * @param ids Filter by signature IDs. Signature IDs uniqueness is guaranteed by the smart contract.
     * @param emitters Filter by emitter fingerprints.
     * @param signatureHashes Filter by signature hashes.
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of SignatureLog matching the provided filters.
     */
    public async searchSignatureLogs(
        ids?: bigint[], 
        emitters?: `0x${string}`[], 
        signatureHashes?: `0x${string}`[],
        fromBlock?: BlockTag | bigint, 
        toBlock?: BlockTag | bigint
    ): Promise<SignatureLog[]> {
        // Reject pending block tags for fromBlock/toBlock
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        // Use default values: fromBlock = earliest block, toBlock = latest block
        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        // Build args only if a filter is provided
        let args: any = undefined;
        if (ids !== undefined || emitters !== undefined || signatureHashes !== undefined) {
            args = {};
            if (ids !== undefined) {
                args.id = ids;
            }
            if (emitters !== undefined) {
                args.emitter = emitters.map(toBytes32);
            }
            if (signatureHashes !== undefined) {
                args.signatureHash = signatureHashes;
            }
        }

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3Sign.SIGNATURE_EVENT,
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
            logIndex: log.logIndex,
            type: Web3SignEvents.Signature,
            id: log.args.id,
            emitter: log.args.emitter,
            signatureHash: log.args.signatureHash,
            signature: log.args.signature,
        }));
    }

    /**
     * Retrieves Timestamp events emitted by the smart contract, filtered by the provided criteria.
     * Each value in a filter is combined using a logical OR, while all defined filters are combined using a logical AND.
     * 
     * @param ids Filter by timestamp IDs. Timestamp IDs uniqueness is guaranteed by the smart contract. 
     * @param emitters Filter by emitter fingerprints.
     * @param dochashes Filter by document hashes.
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of TimestampLog matching the provided filters.
     */
    public async searchTimestampLogs(
        ids?: bigint[],
        emitters?: `0x${string}`[], 
        dochashes?: `0x${string}`[], 
        fromBlock?: BlockTag | bigint, 
        toBlock?: BlockTag | bigint
    ): Promise<TimestampLog[]> {
        // Reject pending block tags for fromBlock/toBlock
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        // Use default values: fromBlock = earliest block, toBlock = latest block
        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        // Build args only if a filter is provided
        let args: any = undefined;
        if (ids !== undefined || emitters !== undefined || dochashes !== undefined) {
            args = {};
            if (ids !== undefined) {
                args.id = ids;
            }
            if (emitters !== undefined) {
                args.emitter = emitters.map(toBytes32);
            }
            if (dochashes !== undefined) {
                args.dochash = dochashes;
            }
        }

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3Sign.TIMESTAMP_EVENT,
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
            logIndex: log.logIndex,
            type: Web3SignEvents.Timestamp,
            id: log.args.id,
            emitter: log.args.emitter,
            dochash: log.args.dochash,
            signature: log.args.signature,
        }));
    }

    /**
     * Retrieves a Timestamp event by its unique ID.
     * @param id The unique ID of the timestamp.
     * @param blockNumber The block number where to search for the timestamp.
     * @returns The TimestampLog if found, otherwise undefined.
     */
    public async getTimestampLogByID(id: bigint, blockNumber: bigint): Promise<TimestampLog | undefined> {
        const logs = await this.searchTimestampLogs([id], undefined, undefined, blockNumber, blockNumber);
        if (logs.length === 1) return logs[0];
        if (logs.length === 0) return undefined;
        // This should never happen as timestamp IDs are unique but we guard against it anyway
        throw new Web3SignCriticalError(`Multiple Timestamp logs found for timestamp ID ${id} at block ${blockNumber}`);
    }

    /**
     * Extracts Document logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @param timestamp Optional timestamp to assign to all extracted logs. This is useful when the receipt is from a transaction included in the latest block or in a block that has not been indexed yet.
     * @returns A promise that resolves to an array of DocumentLog objects.
     */
    public async extractDocumentLog(receipt: TransactionReceipt, timestamp?: Date): Promise<DocumentLog[]> {
        const parsedLogs = parseEventLogs({
            abi: Web3SignABI,
            eventName: 'Document',
            logs: receipt.logs
        });

        if (timestamp) {
            // Use the provided timestamp for all logs
            return parsedLogs.map(log => ({
                blockNumber: log.blockNumber,
                blockHash: log.blockHash,
                blockTimestamp: timestamp,
                transactionHash: log.transactionHash,
                logIndex: log.logIndex,
                type: Web3SignEvents.Document,
                id: log.args.id,
                emitter: log.args.emitter,
                dochash: log.args.dochash,
                signature: log.args.signature,
                document: log.args.document,
                uri: log.args.uri,
                mimeType: log.args.mimeType,
            }));
        }

        // Get block timestamps from the chain
        const uniqueBlocks = [...new Set(parsedLogs.map(l => l.blockNumber))];
        const blockTimestamps = new Map(
            await Promise.all(uniqueBlocks.map(async bn => 
                [bn, await getBlockTimestamp(this.client, bn)] as [bigint, Date]
            ))
        );
        
        return parsedLogs.map(log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            transactionHash: log.transactionHash,
            id: log.args.id,
            emitter: log.args.emitter,
            dochash: log.args.dochash,
            signature: log.args.signature,
            document: log.args.document,
            uri: log.args.uri,
            mimeType: log.args.mimeType,
            logIndex: log.logIndex,
            type: Web3SignEvents.Document,
        }));
    }

    /**
     * Extracts Copy logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns A promise that resolves to an array of CopyLog objects.
     * @returns A promise that resolves to an array of CopyLog objects.
     */
    public async extractCopyLog(receipt: TransactionReceipt, timestamp?: Date): Promise<CopyLog[]> {
        const parsedLogs = parseEventLogs({
            abi: Web3SignABI,
            eventName: 'Copy',
            logs: receipt.logs
        });

        if (timestamp) {
            // Use the provided timestamp for all logs
            return parsedLogs.map(log => ({
                blockNumber: log.blockNumber,
                blockHash: log.blockHash,
                blockTimestamp: timestamp,
                transactionHash: log.transactionHash,
                logIndex: log.logIndex,
                type: Web3SignEvents.Copy,
                copy: log.args.copy,
                original: log.args.original,
                emitter: log.args.emitter,
                document: log.args.document,
                uri: log.args.uri,
            }));
        }

        // Get block timestamps from the chain
        const uniqueBlocks = [...new Set(parsedLogs.map(l => l.blockNumber))];
        const blockTimestamps = new Map(
            await Promise.all(uniqueBlocks.map(async bn => 
                [bn, await getBlockTimestamp(this.client, bn)] as [bigint, Date]
            ))
        );
        
        return parsedLogs.map(log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            type: Web3SignEvents.Copy,
            copy: log.args.copy,
            original: log.args.original,
            emitter: log.args.emitter,
            document: log.args.document,
            uri: log.args.uri,
        }));
    }

    /**
     * Extracts Signature logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @param timestamp Optional timestamp to assign to all extracted logs. This is useful when the receipt is from a transaction included in the latest block or in a block that has not been indexed yet.
     * @returns A promise that resolves to an array of SignatureLog objects.
     */
    public async extractSignatureLog(receipt: TransactionReceipt, timestamp?: Date): Promise<SignatureLog[]> {
        const parsedLogs = parseEventLogs({
            abi: Web3SignABI,
            eventName: 'Signature',
            logs: receipt.logs
        });

        if (timestamp) {
            // Use the provided timestamp for all logs
            return parsedLogs.map(log => ({
                blockNumber: log.blockNumber,
                blockHash: log.blockHash,
                blockTimestamp: timestamp,
                transactionHash: log.transactionHash,
                logIndex: log.logIndex,
                type: Web3SignEvents.Signature,
                id: log.args.id,
                emitter: log.args.emitter,
                signatureHash: log.args.signatureHash,
                signature: log.args.signature,
            }));
        }

        // Get block timestamps from the chain
        const uniqueBlocks = [...new Set(parsedLogs.map(l => l.blockNumber))];
        const blockTimestamps = new Map(
            await Promise.all(uniqueBlocks.map(async bn => 
                [bn, await getBlockTimestamp(this.client, bn)] as [bigint, Date]
            ))
        );
        
        return parsedLogs.map(log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            type: Web3SignEvents.Signature,
            id: log.args.id,
            emitter: log.args.emitter,
            signatureHash: log.args.signatureHash,
            signature: log.args.signature,
        }));
    }

    /**
     * Extracts Timestamp logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @param timestamp Optional timestamp to assign to all extracted logs. This is useful when the receipt is from a transaction included in the latest block or in a block that has not been indexed yet.
     * @returns A promise that resolves to an array of TimestampLog objects.
     */
    public async extractTimestampLog(receipt: TransactionReceipt, timestamp?: Date): Promise<TimestampLog[]> {
        const parsedLogs = parseEventLogs({
            abi: Web3SignABI,
            eventName: 'Timestamp',
            logs: receipt.logs
        });

        if (timestamp) {
            // Use the provided timestamp for all logs
            return parsedLogs.map(log => ({
                blockNumber: log.blockNumber,
                blockHash: log.blockHash,
                blockTimestamp: timestamp,
                transactionHash: log.transactionHash,
                logIndex: log.logIndex,
                type: Web3SignEvents.Timestamp,
                id: log.args.id,
                emitter: log.args.emitter,
                dochash: log.args.dochash,
                signature: log.args.signature,
            }));
        }

        // Get block timestamps from the chain
        const uniqueBlocks = [...new Set(parsedLogs.map(l => l.blockNumber))];
        const blockTimestamps = new Map(
            await Promise.all(uniqueBlocks.map(async bn => 
                [bn, await getBlockTimestamp(this.client, bn)] as [bigint, Date]
            ))
        );

        return parsedLogs.map(log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            type: Web3SignEvents.Timestamp,
            id: log.args.id,
            emitter: log.args.emitter,
            dochash: log.args.dochash,
            signature: log.args.signature,
        }));
    }

    /**
     * Extracts Notification logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @param timestamp Optional timestamp to assign to all extracted logs. This is useful when the receipt is from a transaction included in the latest block or in a block that has not been indexed yet.
     * @returns A promise that resolves to an array of NotificationLog objects.
     */
    public async extractNotificationLog(receipt: TransactionReceipt, timestamp?: Date): Promise<NotificationLog[]> {
        const parsedLogs = parseEventLogs({
            strict: true,
            abi: Web3SignABI,
            eventName: 'Notification',
            logs: receipt.logs
        });

        if (timestamp) {
            // Use the provided timestamp for all logs
            return parsedLogs.map(log => ({
                blockNumber: log.blockNumber,
                blockHash: log.blockHash,
                blockTimestamp: timestamp,
                transactionHash: log.transactionHash,
                logIndex: log.logIndex,
                type: Web3SignEvents.Notification,
                id: log.args.id,
                recipient: log.args.recipient,
                emitter: log.args.emitter,
                source: log.args.source,
                signatureRequested: log.args.signatureRequested,
            }));
        }

        // Get block timestamps from the chain
        const uniqueBlocks = [...new Set(parsedLogs.map(l => l.blockNumber))];
        const blockTimestamps = new Map(
            await Promise.all(uniqueBlocks.map(async bn => 
                [bn, await getBlockTimestamp(this.client, bn)] as [bigint, Date]
            ))
        );

        return parsedLogs.map(log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: blockTimestamps.get(log.blockNumber)!,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex,
            type: Web3SignEvents.Notification,
            id: log.args.id,
            recipient: log.args.recipient,
            emitter: log.args.emitter,
            source: log.args.source,
            signatureRequested: log.args.signatureRequested,
        }));
    }

    /**
     * Retireve signature revocation events emitted by the smart contract, filtered by the provided criteria.
     * Each value in a filter is combined using a logical OR, while all defined filters are combined using a logical AND.
     * 
     * @param ids Filter by signature IDs. Signature IDs uniqueness is guaranteed by the smart contract.
     * @param emitters Filter by emitter fingerprints.
     * @param signatureHashes Filter by signature hashes.
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of SignatureRevocationLog matching the provided filters.
     */
    public async searchSignatureRevocationLogs(ids?: bigint[], emitters?: `0x${string}`[], signatureHashes?: `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<SignatureRevocationLog[]> {
        // Reject pending block tags for fromBlock/toBlock
        if (fromBlock === 'pending' || toBlock === 'pending') {
            throw new Error('fromBlock and toBlock cannot be "pending" for log searches');
        }

        // Use default values: fromBlock = earliest block, toBlock = latest block
        const from = fromBlock ?? 'earliest';
        const to = toBlock ?? 'latest';

        // Build args only if a filter is provided
        let args: any = undefined;
        if (ids !== undefined || emitters !== undefined || signatureHashes !== undefined) {
            args = {};
            if (ids !== undefined) {
                args.id = ids;
            }
            if (emitters !== undefined) {
                args.emitter = emitters.map(toBytes32);
            }
            if (signatureHashes !== undefined) {
                args.signatureHash = signatureHashes;
            }
        }

        const logs = await this.client.getLogs({
            strict: true,
            address: this.address,
            event: Web3Sign.SIGNATURE_REVOCATION_EVENT,
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
            logIndex: log.logIndex,
            type: Web3SignEvents.SignatureRevocation,
            id: log.args.id,
            emitter: log.args.emitter,
            signatureHash: log.args.signatureHash,
            signature: log.args.signature,
        }));
    }

    /**
     * Retrieves Timestamp events by document hash.
     * @param dochash The keccak256 hash of the document.
     * @returns An array of TimestampLog entries associated with the document hash.
     */
    public async getTimestampLogsByHash(dochash: `0x${string}`): Promise<TimestampLog[]> {

        // TODO: Add concurrency control if needed

        // List all document IDs for the given document hash
        let ids = await this.fetchAllPaginated((start, limit) => 
            this.listDocumentIdsByHash(dochash, start, limit)
        );
        if (ids.length === 0) {
            return [];
        }

        // List block numbers for each document ID
        let blockNumbers = await this.getDocumentBlockNumberByIDBatch(ids);
        if (blockNumbers.length !== ids.length) {
            throw new Web3SignCriticalError('Mismatch between document IDs and block numbers length');
        }

        // Search timestamp logs by IDs
        const timestampLogs = await Promise.all(
            blockNumbers.map(async (blockNumber) => {
                return this.searchTimestampLogs(ids, undefined, [dochash], blockNumber, blockNumber);
            })
        );

        // Flatten the array of arrays
        return timestampLogs.flat();
    }
    
    extractSignatureRevocationLog(receipt: TransactionReceipt, timestamp?: Date): Promise<SignatureRevocationLog[]> {
        const parsedLogs = parseEventLogs({
            strict: true,
            abi: Web3SignABI,
            eventName: 'SignatureRevocation',
            logs: receipt.logs
        });

        if (timestamp) {
            // Use the provided timestamp for all logs
            return Promise.resolve(parsedLogs.map(log => ({
                blockNumber: log.blockNumber,
                blockHash: log.blockHash,
                blockTimestamp: timestamp,
                transactionHash: log.transactionHash,
                logIndex: log.logIndex,
                type: Web3SignEvents.SignatureRevocation,
                id: log.args.id,
                emitter: log.args.emitter,
                signatureHash: log.args.signatureHash,
                signature: log.args.signature,
            })));
        }

        // Get block timestamps from the chain
        const uniqueBlocks = [...new Set(parsedLogs.map(l => l.blockNumber))];
        return Promise.all(uniqueBlocks.map(async bn => 
            [bn, await getBlockTimestamp(this.client, bn)] as [bigint, Date]
        )).then(blockTimestampArray => {
            const blockTimestamps = new Map(blockTimestampArray);

            return parsedLogs.map(log => ({
                blockNumber: log.blockNumber,
                blockHash: log.blockHash,
                blockTimestamp: blockTimestamps.get(log.blockNumber)!,
                transactionHash: log.transactionHash,
                logIndex: log.logIndex,
                type: Web3SignEvents.SignatureRevocation,
                id: log.args.id,
                emitter: log.args.emitter,
                signatureHash: log.args.signatureHash,
                signature: log.args.signature,
            }));
        });
    }

    /*****************************************************************************************************************/
    /* UTILITY METHODS                                                                                              */
    /*****************************************************************************************************************/

    /**
     * Helper method to fetch all items from a paginated contract method.
     * @param fetchFn The paginated fetch function to call
     * @param limit The number of items to fetch per page
     * @param maxItems The maximum number of items to fetch in total (safety limit)
     * @returns An array containing all fetched items
     */
    private async fetchAllPaginated<T>(
        fetchFn: (start: bigint, limit: bigint) => Promise<T[]>,
        limit: bigint = 1000n,
        maxItems: bigint = 100000n // Safety limit
    ): Promise<T[]> {
        const results: T[] = [];
        let start = 0n;

        do {
            const batch = await fetchFn(start, limit);
            results.push(...batch);

            if (batch.length < Number(limit) || results.length >= Number(maxItems)) {
                break;
            }
            start += limit;
        } while (true);

        return results;
    }
}
