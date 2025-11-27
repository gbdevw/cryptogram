import { Address, TransactionReceipt, PublicClient, WalletClient, parseEventLogs } from 'viem';
import { IWeb3Doc } from './web3doc.interface';
import { IWeb3PGP } from '../web3pgp/web3pgp.interface';
import { Recipient, DocumentLog, CopyLog, SignatureLog, TimestampLog, NotificationLog } from './types/types';
import { Web3Doc as Web3DocABI }  from '../abis/Web3Doc';
import { to0x, toBytes32 } from '../utils/0xstr';
import { RequestedFeeUpdatedLog, FeesWithdrawnLog } from '../flatfee/types/types';
import { FlatFee } from '../flatfee/flatefee';
import { getBlockTimestamp } from '../utils/viemutils';
import { Web3DocCriticalError, Web3DocError } from './types/errors';

/**
 * Implementation of the Web3Doc contract interface.
 * 
 * This class provides low-level bindings to interact with the Web3Doc contract deployed on the blockchain.
 */
export class Web3Doc implements IWeb3Doc {

    public static readonly abi = Web3DocABI;
    
    // Pre-computed event definitions for efficient log queries
    private static readonly DOCUMENT_EVENT = Web3DocABI.find(item => item.type === 'event' && item.name === 'Document')!;
    private static readonly COPY_EVENT = Web3DocABI.find(item => item.type === 'event' && item.name === 'Copy')!;
    private static readonly NOTIFICATION_EVENT = Web3DocABI.find(item => item.type === 'event' && item.name === 'Notification')!;
    private static readonly SIGNATURE_EVENT = Web3DocABI.find(item => item.type === 'event' && item.name === 'Signature')!;
    private static readonly TIMESTAMP_EVENT = Web3DocABI.find(item => item.type === 'event' && item.name === 'Timestamp')!;
    
    // Address of the Web3Doc contract
    private _address: Address;
    // IWeb3PGP instance for public key operations
    private _web3pgp: IWeb3PGP;
    // Viem public client instance used to read from the blockchain
    private _client: PublicClient;
    // Viem wallet client instance used to sign transactions
    private _walletClient: WalletClient | undefined;
    // FlatFee client instance
    private _flatfee: FlatFee

    /**
     * Creates a new Web3Doc instance.
     * 
     * @param address The address of the Web3Doc smart contract.
     * @param web3pgp An instance implementing the IWeb3PGP interface for public key operations.
     * @param client A Viem public client for interacting with the blockchain.
     * @param walletClient Optional Viem wallet client for signing transactions.
     */
    public constructor(address: Address, web3pgp: IWeb3PGP, client: PublicClient, walletClient?: WalletClient) {
        this._address = address;
        this._web3pgp = web3pgp;
        this._client = client;
        this._walletClient = walletClient;
        this._flatfee = new FlatFee(address, client, walletClient);
    }

    /*****************************************************************************************************************/
    /* GETTERS AND SETTERS                                                                                           */
    /*****************************************************************************************************************/

    /**
     * Gets the Web3PGP instance.
     */
    public get web3pgp(): IWeb3PGP {
        return this._web3pgp;
    }

    /**
     * Sets the Web3PGP instance.
     */
    public set web3pgp(web3pgp: IWeb3PGP) {
        this._web3pgp = web3pgp;
    }

    /**
     * Gets the Viem public client.
     */
    public get client(): PublicClient {
        return this._client;
    }

    /**
     * Sets the Viem public client.
     */
    public set client(client: PublicClient) {
        this._client = client;
        // Reflect downstream
        this._flatfee.client = client;
    }

    /**
     * Gets the Viem wallet client.
     */
    public get walletClient(): WalletClient | undefined {
        return this._walletClient;
    }

    /**
     * Sets the Viem wallet client.
     */
    public set walletClient(value: WalletClient | undefined) {
        this._walletClient = value;
        // Reflect downstream
        this._flatfee.walletClient = value;
    }

    /**
     * Gets the Web3Doc contract address.
     */
    public get address(): Address {
        return this._address;
    }

    /**
     * Sets the Web3Doc contract address.
     */
    public set address(address: Address) {
        this._address = address;
        // Reflect downstream
        this._flatfee.address = address;
    }

    /**
     * Validate that a wallet client is available for write operations.
     * @throws Error if wallet client is not configured
     */
    private ensureWalletClient(): void {
        if (!this._walletClient) {
            throw new Web3DocError('WalletClient is required for write operations. Please set walletClient before calling this method.');
        }
    }

    /*****************************************************************************************************************/
    /* FEES MANAGEMENT FUNCTIONS                                                                                     */
    /*****************************************************************************************************************/

    /**
     * Updates the requested fee for document operations.
     * @param newFee The new fee amount in wei.
     * @returns A promise that resolves to the transaction receipt.
     */
    public updateRequestedFee(newFee: bigint): Promise<TransactionReceipt> {
        // Delegate to downstream
        return this._flatfee.updateRequestedFee(newFee);
    }

    /**
     * Withdraws accumulated fees to the specified address.
     * @param to The address to which the fees will be withdrawn.
     * @returns A promise that resolves to the transaction receipt.
     */
    public withdrawFees(to: Address): Promise<TransactionReceipt> {
        // Delegate to downstream
        return this._flatfee.withdrawFees(to);
    }

    /**
     * Gets the currently requested fee for document operations.
     * @returns A promise that resolves to the requested fee amount in wei.
     */
    public requestedFee(): Promise<bigint> {
        // Delegate to downstream
        return this._flatfee.requestedFee();
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
            abi: Web3DocABI,
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
            abi: Web3DocABI,
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
            abi: Web3DocABI,
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
            abi: Web3DocABI,
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
            abi: Web3DocABI,
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
            abi: Web3DocABI,
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
            abi: Web3DocABI,
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
            abi: Web3DocABI,
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
            abi: Web3DocABI,
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
            abi: Web3DocABI,
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
            abi: Web3DocABI,
            functionName: 'listSignatures',
            args: [id, start, limit],
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
        fromBlock?: bigint, 
        toBlock?: bigint
    ): Promise<DocumentLog[]> {
        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

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
            address: this.address,
            event: Web3Doc.DOCUMENT_EVENT,
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
        throw new Web3DocCriticalError(`Multiple Document logs found for document ID ${id} at block ${blockNumber}`);
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
        fromBlock?: bigint, 
        toBlock?: bigint
    ): Promise<CopyLog[]> {
        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();
        
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
            address: this.address,
            event: Web3Doc.COPY_EVENT,
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
        throw new Web3DocCriticalError(`Multiple Copy logs found for copy ID ${copy} at block ${blockNumber}`);
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
        fromBlock?: bigint, 
        toBlock?: bigint
    ): Promise<NotificationLog[]> {
        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();
        
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
            address: this.address,
            event: Web3Doc.NOTIFICATION_EVENT,
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
        throw new Web3DocCriticalError(`Multiple Notification logs found for document ID ${id} and recipient ${recipient} at block ${blockNumber}`);
    }

    /**
     * Searches for Signature events emitted by the smart contract, filtered by the provided criteria.
     * Each value in a filter is combined using a logical OR, while all defined filters are combined using a logical AND.
     * 
     * @param ids Filter by signature IDs. Signature IDs uniqueness is guaranteed by the smart contract.
     * @param emitters Filter by emitter fingerprints.
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of SignatureLog matching the provided filters.
     */
    public async searchSignatureLogs(
        ids?: bigint[], 
        emitters?: `0x${string}`[], 
        fromBlock?: bigint, 
        toBlock?: bigint
    ): Promise<SignatureLog[]> {
        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        // Build args only if a filter is provided
        let args: any = undefined;
        if (ids !== undefined || emitters !== undefined) {
            args = {};
            if (ids !== undefined) {
                args.id = ids;
            }
            if (emitters !== undefined) {
                args.emitter = emitters.map(toBytes32);
            }
        }

        const logs = await this.client.getLogs({
            address: this.address,
            event: Web3Doc.SIGNATURE_EVENT,
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
            id: log.args.id,
            emitter: log.args.emitter,
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
        fromBlock?: bigint, 
        toBlock?: bigint
    ): Promise<TimestampLog[]> {
        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

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
            address: this.address,
            event: Web3Doc.TIMESTAMP_EVENT,
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
            id: log.args.id,
            emitter: log.args.emitter,
            dochash: log.args.dochash,
            signature: log.args.signature,
        }));
    }

    /**
     * Extracts Document logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns A promise that resolves to an array of DocumentLog objects.
     */
    public async extractDocumentLog(receipt: TransactionReceipt): Promise<DocumentLog[]> {
        const parsedLogs = parseEventLogs({
            abi: Web3DocABI,
            eventName: 'Document',
            logs: receipt.logs
        });

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
        }));
    }

    /**
     * Extracts Copy logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns A promise that resolves to an array of CopyLog objects.
     */
    public async extractCopyLog(receipt: TransactionReceipt): Promise<CopyLog[]> {
        const parsedLogs = parseEventLogs({
            abi: Web3DocABI,
            eventName: 'Copy',
            logs: receipt.logs
        });

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
     * @returns A promise that resolves to an array of SignatureLog objects.
     */
    public async extractSignatureLog(receipt: TransactionReceipt): Promise<SignatureLog[]> {
        const parsedLogs = parseEventLogs({
            abi: Web3DocABI,
            eventName: 'Signature',
            logs: receipt.logs
        });

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
            signature: log.args.signature,
        }));
    }

    /**
     * Extracts Timestamp logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns A promise that resolves to an array of TimestampLog objects.
     */
    public async extractTimestampLog(receipt: TransactionReceipt): Promise<TimestampLog[]> {
        const parsedLogs = parseEventLogs({
            abi: Web3DocABI,
            eventName: 'Timestamp',
            logs: receipt.logs
        });

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
        }));
    }

    /**
     * Extracts Notification logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns A promise that resolves to an array of NotificationLog objects.
     */
    public async extractNotificationLog(receipt: TransactionReceipt): Promise<NotificationLog[]> {
        const parsedLogs = parseEventLogs({
            abi: Web3DocABI,
            eventName: 'Notification',
            logs: receipt.logs
        });

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
            recipient: log.args.recipient,
            emitter: log.args.emitter,
            source: log.args.source,
            signatureRequested: log.args.signatureRequested,
        }));
    }

    /**
     * Searches for RequestedFeeUpdated events emitted by the smart contract, filtered by the provided criteria.
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns A promise that resolves to an array of RequestedFeeUpdatedLog objects.
     */
    public searchRequestedFeeUpdatedLogs(fromBlock?: bigint, toBlock?: bigint): Promise<RequestedFeeUpdatedLog[]> {
        // Delegate to downstream
        return this._flatfee.searchRequestedFeeUpdatedLogs(fromBlock, toBlock);
    }

    /**
     * Searches for FeesWithdrawn events emitted by the smart contract, filtered by the provided criteria.
     * @param recipients Filter by recipient addresses.
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns A promise that resolves to an array of FeesWithdrawnLog objects.
     */
    public searchFeesWithdrawnLogs(recipients?: Address[], fromBlock?: bigint, toBlock?: bigint): Promise<FeesWithdrawnLog[]> {
        // Delegate to downstream
        return this._flatfee.searchFeesWithdrawnLogs(recipients, fromBlock, toBlock);
    }

    /**
     * Extracts FeesWithdrawn logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns A promise that resolves to an array of FeesWithdrawnLog objects.
     */
    public extractFeesWithdrawnLog(receipt: TransactionReceipt): Promise<FeesWithdrawnLog[]> {
        // Delegate to downstream
        return this._flatfee.extractFeesWithdrawnLog(receipt);
    }

    /**
     * Extracts RequestedFeeUpdated logs from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns A promise that resolves to an array of RequestedFeeUpdatedLog objects.
     */
    public extractRequestedFeeUpdatedLog(receipt: TransactionReceipt): Promise<RequestedFeeUpdatedLog[]> {
        // Delegate to downstream
        return this._flatfee.extractRequestedFeeUpdatedLog(receipt);
    }
}
