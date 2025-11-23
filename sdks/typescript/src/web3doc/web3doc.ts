import { Address, TransactionReceipt, PublicClient, WalletClient } from 'viem';
import { IWeb3Doc } from './web3doc.interface';
import { IWeb3PGP } from '../web3pgp/web3pgp.interface';
import { Recipient, DocumentLog, CopyLog, SignatureLog, TimestampLog, NotificationLog } from './types/types';

/**
 * Implementation of the Web3Doc contract interface.
 * 
 * This class provides low-level bindings to interact with the Web3Doc contract deployed on the blockchain.
 */
export class Web3Doc implements IWeb3Doc {
    // Address of the Web3Doc contract
    public readonly address: Address;
    // IWeb3PGP instance for public key operations
    private _web3pgp: IWeb3PGP;
    // Viem public client instance used to read from the blockchain
    private _client: PublicClient;
    // Viem wallet client instance used to sign transactions
    private _walletClient: WalletClient | undefined;

    /**
     * Creates a new Web3Doc instance.
     * 
     * @param address The address of the Web3Doc smart contract.
     * @param web3pgp An instance implementing the IWeb3PGP interface for public key operations.
     * @param client A Viem public client for interacting with the blockchain.
     * @param walletClient Optional Viem wallet client for signing transactions.
     */
    constructor(address: Address, web3pgp: IWeb3PGP, client: PublicClient, walletClient?: WalletClient) {
        this.address = address;
        this._web3pgp = web3pgp;
        this._client = client;
        this._walletClient = walletClient;
    }

    /*****************************************************************************************************************/
    /* GETTERS AND SETTERS                                                                                           */
    /*****************************************************************************************************************/

    /**
     * Gets the Web3PGP instance.
     */
    get web3pgp(): IWeb3PGP {
        return this._web3pgp;
    }

    /**
     * Sets the Web3PGP instance.
     */
    set web3pgp(web3pgp: IWeb3PGP) {
        this._web3pgp = web3pgp;
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
    async sendOnChain(
        emitter: `0x${string}`,
        recipients: Recipient[],
        dochash: `0x${string}`,
        signature: `0x${string}`,
        document: `0x${string}`,
        mimeType: string
    ): Promise<TransactionReceipt> {
        throw new Error('Not implemented');
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
    async sendOffChain(
        emitter: `0x${string}`,
        recipients: Recipient[],
        dochash: `0x${string}`,
        signature: `0x${string}`,
        uri: string,
        mimeType: string
    ): Promise<TransactionReceipt> {
        throw new Error('Not implemented');
    }

    /**
     * Send a certified copy of a document on-chain.
     *
     * @param original The ID of the original document that is the subject of the copy.
     * @param emitter The fingerprint of the emitter's public key.
     * @param recipients The list of recipient key fingerprints to be notified and, optionally, be prompted for a signature.
     * @param document The binary OpenPGP message containing the copy of the original document.
     */
    async copyOnChain(
        original: bigint,
        emitter: `0x${string}`,
        recipients: Recipient[],
        document: `0x${string}`
    ): Promise<TransactionReceipt> {
        throw new Error('Not implemented');
    }

    /**
     * Send a certified copy of a document using an off-chain storage.
     *
     * @param original The ID of the original document being copied. Must reference a valid, non-copy document.
     * @param emitter The fingerprint of the key used to produce the signature.
     * @param recipients The list of recipient key fingerprints to be notified and, optionally, be prompted for a signature.
     * @param uri A URI which can be used to download the OpenPGP message containing the (compressed, encrypted and signed) document itself.
     */
    async copyOffChain(
        original: bigint,
        emitter: `0x${string}`,
        recipients: Recipient[],
        uri: string
    ): Promise<TransactionReceipt> {
        throw new Error('Not implemented');
    }

    /**
     * Publishes a binary detached OpenPGP signature of a document made with the emitter's key.
     *
     * @param id The unique ID of the document that has been signed.
     * @param emitter The fingerprint of the key used to produce the signature.
     * @param signature The detached binary OpenPGP signature made over the document.
     */
    async sign(id: bigint, emitter: `0x${string}`, signature: `0x${string}`): Promise<TransactionReceipt> {
        throw new Error('Not implemented');
    }

    /**
     * Timestamps a document by publishing a detached signature of the hash of the document on-chain.
     *
     * @param emitter The fingerprint of the key used to produce the signature.
     * @param dochash The keccak256 hash of the document used to find the timestamp from the document and verify their integrity.
     * @param signature A detached binary OpenPGP signature made over the raw bytes of the keccak256 hash of the document.
     */
    async timestamp(emitter: `0x${string}`, dochash: `0x${string}`, signature: `0x${string}`): Promise<TransactionReceipt> {
        throw new Error('Not implemented');
    }

    /*****************************************************************************************************************/
    /* READ FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * Get the address of the Web3PGP contract used as a global public key registry.
     *
     * @return The address of the Web3PGP contract used by this contract.
     */
    async getWeb3PGPAddress(): Promise<Address> {
        throw new Error('Not implemented');
    }

    /**
     * Returns the ID of the original document that the given document is a copy of.
     *
     * @param id The ID of a document that may be a copy of another previously published document.
     * @return The ID of the original document if the given document is a copy, or 0 if it is not a copy.
     */
    async isCopyOf(id: bigint): Promise<bigint> {
        throw new Error('Not implemented');
    }

    /**
     * Returns the block number in which the document or timestamps with the given ID was published.
     *
     * @param id The ID of the document whose block number is to be retrieved.
     * @return The block number in which the document was published. 0 if the document does not exist.
     */
    async getDocumentBlockNumberByID(id: bigint): Promise<bigint> {
        throw new Error('Not implemented');
    }

    /**
     * Returns the block numbers in which the documents or timestamps with the given IDs were published.
     *
     * @param ids The IDs of the documents whose block numbers are to be retrieved.
     * @return The block numbers in which the documents were published.
     */
    async getDocumentBlockNumberByIDBatch(ids: bigint[]): Promise<bigint[]> {
        throw new Error('Not implemented');
    }

    /**
     * Lists the block numbers when were published the signatures associated with the given document.
     *
     * @param id The ID of the document whose signatures are to be listed.
     * @param start The starting index from which to list signatures (0-based).
     * @param limit The maximum number of signatures to list.
     * @return An array of signature IDs associated with the document.
     */
    async listSignatures(id: bigint, start: bigint, limit: bigint): Promise<bigint[]> {
        throw new Error('Not implemented');
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
    async searchDocumentLogs(
        ids?: bigint[], 
        emitters?: `0x${string}`[], 
        dochashes?: `0x${string}`[], 
        fromBlock?: bigint, 
        toBlock?: bigint
    ): Promise<DocumentLog[]> {
        throw new Error('Not implemented');
    }

    /**
     * Retrieves a Document event by its unique ID.
     * 
     * @param id The unique ID of the document.
     * @param blockNumber The block number where to search for the document.
     * @returns The DocumentLog if found, otherwise null.
     * @example
     * ```typescript
     * const targetID = 1n;
     * const blockNumber = await web3Doc.getDocumentBlockNumberByID(targetID);
     * const documentLog = await web3Doc.getDocumentLogByID(targetID, blockNumber);
     * ```
     */
    async getDocumentLogByID(id: bigint, blockNumber: bigint): Promise<DocumentLog | null> {
        throw new Error('Not implemented');
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
    async searchCopyLogs(
        copies?: bigint[], 
        originals?: bigint[], 
        emitters?: `0x${string}`[], 
        fromBlock?: bigint, 
        toBlock?: bigint
    ): Promise<CopyLog[]> {
        throw new Error('Not implemented');
    }

    /**
     * Retrieves a Copy event by its unique ID.
     * 
     * @param copy The unique ID of the copy.
     * @param blockNumber The block number where to search for the copy.
     * @returns The CopyLog if found, otherwise null.
     * @exampletypescript
     * ```typescript
     * const targetCopyID = 1n;
     * const blockNumber = await web3Doc.getDocumentBlockNumberByID(targetCopyID);
     * const copyLog = await web3Doc.getCopyLogByID(targetCopyID, blockNumber);
     * ```
     */
    async getCopyLogByID(copy: bigint, blockNumber: bigint): Promise<CopyLog | null> {
        throw new Error('Not implemented');
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
    async searchNotificationLogs(
        ids?: bigint[],
        recipients?: `0x${string}`[],
        signatureRequested?: boolean,
        fromBlock?: bigint, 
        toBlock?: bigint
    ): Promise<NotificationLog[]> {
        throw new Error('Not implemented');
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
    async searchSignatureLogs(
        ids?: bigint[], 
        emitters?: `0x${string}`[], 
        fromBlock?: bigint, 
        toBlock?: bigint
    ): Promise<SignatureLog[]> {
        throw new Error('Not implemented');
    }

    /**
     * Retries Timestamp events emitted by the smart contract, filtered by the provided criteria.
     * Each value in a filter is combined using a logical OR, while all defined filters are combined using a logical AND.
     * 
     * @param ids Filter by timestamp IDs. Timestamp IDs uniqueness is guaranteed by the smart contract. 
     * @param emitters Filter by emitter fingerprints.
     * @param dochashes Filter by document hashes.
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of TimestampLog matching the provided filters.
     */
    async searchTimestampLogs(
        ids?: bigint[],
        emitters?: `0x${string}`[], 
        dochashes?: `0x${string}`[], 
        fromBlock?: bigint, 
        toBlock?: bigint
    ): Promise<TimestampLog[]> {
        throw new Error('Not implemented');
    }

    /**
     * Retrieves a Timestamp event by its unique ID.
     * 
     * @param id The unique ID of the timestamp.
     * @param blockNumber The block number where to search for the timestamp.
     * @returns The TimestampLog if found, otherwise null.
     * @example
     * ```typescript
     * const targetID = 1n;
     * const blockNumber = await web3Doc.getDocumentBlockNumberByID(targetID);
     * const timestampLog = await web3Doc.getTimestampLogById(targetID, blockNumber);
     * ```
     */
    async getTimestampLogById(id: bigint, blockNumber: bigint): Promise<TimestampLog | null> {
        throw new Error('Not implemented');
    }
}
