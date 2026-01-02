import { Address, BlockTag, TransactionReceipt } from 'viem';
import { Recipient, DocumentLog, CopyLog, SignatureLog, TimestampLog, NotificationLog } from './types/types'
import { IFlatFee } from '../flatfee/flatefee.interface';

/**
 * TypeScript interface for the Web3Doc smart contract.
 * 
 * This interface provides low-level bindings to interact with the Web3Doc contract deployed on the blockchain.
 */
export interface IWeb3Doc extends IFlatFee {

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
    sendOnChain(
        emitter: `0x${string}`,
        recipients: Recipient[],
        dochash: `0x${string}`,
        signature: `0x${string}`,
        document: `0x${string}`,
        mimeType: string
    ): Promise<TransactionReceipt>;

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
    sendOffChain(
        emitter: `0x${string}`,
        recipients: Recipient[],
        dochash: `0x${string}`,
        signature: `0x${string}`,
        uri: string,
        mimeType: string
    ): Promise<TransactionReceipt>;

    /**
     * Send a certified copy of a document on-chain.
     *
     * @param original The ID of the original document that is the subject of the copy.
     * @param emitter The fingerprint of the emitter's public key.
     * @param recipients The list of recipient key fingerprints to be notified and, optionally, be prompted for a signature.
     * @param document The binary OpenPGP message containing the copy of the original document.
     */
    copyOnChain(
        original: bigint,
        emitter: `0x${string}`,
        recipients: Recipient[],
        document: `0x${string}`
    ): Promise<TransactionReceipt>;

    /**
     * Send a certified copy of a document using an off-chain storage.
     *
     * @param original The ID of the original document being copied. Must reference a valid, non-copy document.
     * @param emitter The fingerprint of the key used to produce the signature.
     * @param recipients The list of recipient key fingerprints to be notified and, optionally, be prompted for a signature.
     * @param uri A URI which can be used to download the OpenPGP message containing the (compressed, encrypted and signed) document itself.
     */
    copyOffChain(
        original: bigint,
        emitter: `0x${string}`,
        recipients: Recipient[],
        uri: string
    ): Promise<TransactionReceipt>;

    /**
     * Publishes a binary detached OpenPGP signature of a document made with the emitter's key.
     *
     * @param id The unique ID of the document that has been signed.
     * @param emitter The fingerprint of the key used to produce the signature.
     * @param signature The detached binary OpenPGP signature made over the document.
     */
    sign(id: bigint, emitter: `0x${string}`, signature: `0x${string}`): Promise<TransactionReceipt>;

    /**
     * Timestamps a document by publishing a detached signature of the hash of the document on-chain.
     *
     * @param emitter The fingerprint of the key used to produce the signature.
     * @param dochash The keccak256 hash of the document used to find the timestamp from the document and verify their integrity.
     * @param signature A detached binary OpenPGP signature made over the raw bytes of the keccak256 hash of the document.
     */
    timestamp(emitter: `0x${string}`, dochash: `0x${string}`, signature: `0x${string}`): Promise<TransactionReceipt>;

    /**
     * Revokes a previously published signature on a document.
     *
     * @param id The unique ID of the document for which the signature is being revoked.
     * @param emitter The fingerprint of the key used to create the signature.
     * @param signatureHash The keccak256 hash of the signature being revoked.
     * @param signature The binary detached OpenPGP signature over the signatureHash.
     * @returns A transaction receipt.
     */
    revokeSignature(
        id: bigint,
        emitter: `0x${string}`,
        signatureHash: `0x${string}`,
        signature: `0x${string}`
    ): Promise<TransactionReceipt>;

    /*****************************************************************************************************************/
    /* READ FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * Get the address of the Web3PGP contract used as a global public key registry.
     *
     * @return The address of the Web3PGP contract used by this contract.
     */
    getWeb3PGPAddress(): Promise<Address>;

    /**
     * Returns the ID of the original document that the given document is a copy of.
     *
     * @param id The ID of a document that may be a copy of another previously published document.
     * @return The ID of the original document if the given document is a copy, or 0 if it is not a copy.
     */
    isCopyOf(id: bigint): Promise<bigint>;

    /**
     * Returns the block number in which the document or timestamps with the given ID was published.
     *
     * @param id The ID of the document whose block number is to be retrieved.
     * @return The block number in which the document was published. 0 if the document does not exist.
     */
    getDocumentBlockNumberByID(id: bigint): Promise<bigint>;

    /**
     * Returns the block numbers in which the documents or timestamps with the given IDs were published.
     *
     * @param ids The IDs of the documents whose block numbers are to be retrieved.
     * @return The block numbers in which the documents were published.
     */
    getDocumentBlockNumberByIDBatch(ids: bigint[]): Promise<bigint[]>;

    /**
     * Lists the block numbers when were published the signatures associated with the given document.
     *
     * @param id The ID of the document whose signatures are to be listed.
     * @param start The starting index from which to list signatures (0-based).
     * @param limit The maximum number of signatures to list.
     * @return An array of signature IDs associated with the document.
     */
    listSignatures(id: bigint, start: bigint, limit: bigint): Promise<bigint[]>;

    /**
     * Returns the block number in which the signature with the given hash was published.
     *
     * @param signatureHash The keccak256 hash of the signature.
     * @returns The block number in which the signature was published. Returns 0 if not found.
     */
    getSignatureBlockNumberByHash(signatureHash: `0x${string}`): Promise<bigint>;

    /**
     * Returns the block numbers in which the signatures with the given hashes were published.
     *
     * @param signatureHashes The keccak256 hashes of the signatures.
     * @returns The block numbers in which the signatures were published.
     */
    getSignatureBlockNumberByHashBatch(signatureHashes: `0x${string}`[]): Promise<bigint[]>;

    /**
     * Lists document IDs related to a document hash (with pagination).
     *
     * @param dochash The keccak256 hash of the document.
     * @param start The starting index for pagination (0-based).
     * @param limit The maximum number of results to return.
     * @returns An array of document IDs associated with the document hash.
     */
    listDocumentIdsByHash(dochash: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]>;

    /**
     * Lists block numbers when revocations were published for a signature (with pagination).
     *
     * @param signatureHash The keccak256 hash of the signature.
     * @param start The starting index for pagination (0-based).
     * @param limit The maximum number of results to return.
     * @returns An array of block numbers when revocations were published.
     */
    listSignatureRevocationsBlockNumbers(signatureHash: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]>;

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
    searchDocumentLogs(
        ids?: bigint[], 
        emitters?: `0x${string}`[], 
        dochashes?: `0x${string}`[], 
        fromBlock?: BlockTag | bigint, 
        toBlock?: BlockTag | bigint): Promise<DocumentLog[]>;

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
    getDocumentLogByID(id: bigint, blockNumber: bigint): Promise<DocumentLog | undefined>;

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
    searchCopyLogs(
        copies?: bigint[], 
        originals?: bigint[], 
        emitters?: `0x${string}`[], 
        fromBlock?: BlockTag | bigint, 
        toBlock?: BlockTag | bigint): Promise<CopyLog[]>;

    /**
     * Retrieves a Copy event by its unique ID.
     * 
     * @param copy The unique ID of the copy.
     * @param blockNumber The block number where to search for the copy.
     * @returns The CopyLog if found, otherwise undefined.
     * @exampletypescript
     * ```typescript
     * const targetCopyID = 1n;
     * const blockNumber = await web3Doc.getDocumentBlockNumberByID(targetCopyID);
     * const copyLog = await web3Doc.getCopyLogByID(targetCopyID, blockNumber);
     * ```
     */
    getCopyLogByID(copy: bigint, blockNumber: bigint): Promise<CopyLog | undefined>;

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
    searchNotificationLogs(
        ids?: bigint[],
        recipients?: `0x${string}`[],
        signatureRequested?: boolean,
        fromBlock?: BlockTag | bigint, 
        toBlock?: BlockTag | bigint): Promise<NotificationLog[]>;

    /**
     * Retrieves a Notification event by its document ID and recipient.
     * @param id The unique ID of the document.
     * @param recipient The fingerprint of the recipient's key.
     * @param blockNumber The block number where to search for the notification.
     * @returns The NotificationLog if found, otherwise undefined.
     * @example
     * ```typescript
     * const targetID = 1n;
     * const recipient = '0xABCDEF...'; // recipient fingerprint
     * const blockNumber = await web3Doc.getDocumentBlockNumberByID(targetID);
     * const notificationLog = await web3Doc.getNotificationLog(targetID, recipient, blockNumber);
     * ```
     */
    getNotificationLog(id: bigint, recipient: `0x${string}`, blockNumber: bigint): Promise<NotificationLog | undefined>;

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
    searchSignatureLogs(
        ids?: bigint[], 
        emitters?: `0x${string}`[], 
        fromBlock?: BlockTag | bigint, 
        toBlock?: BlockTag | bigint): Promise<SignatureLog[]>;

    
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
    searchTimestampLogs(
        ids?: bigint[],
        emitters?: `0x${string}`[], 
        dochashes?: `0x${string}`[], 
        fromBlock?: BlockTag | bigint, 
        toBlock?: BlockTag | bigint): Promise<TimestampLog[]>;

    /**
     * Retrieves a Timestamp event by its unique ID.
     * @param id The unique ID of the timestamp.
     * @param blockNumber The block number where to search for the timestamp.
     * @returns The TimestampLog if found, otherwise undefined.
     */
    getTimestampLogByID(id: bigint, blockNumber: bigint): Promise<TimestampLog | undefined>;

    /*****************************************************************************************************************/
    /* LOGS PARSING FUNCTIONS                                                                                        */
    /*****************************************************************************************************************/

    /**
     * Extracts DocumentLog entries from a given transaction receipt.
     * 
     * @param receipt The transaction receipt containing the logs to be parsed.
     * @param timestamp Optional timestamp to assign to all extracted logs. This is useful when the receipt is from a transaction included in the latest block or in a block that has not been indexed yet.
     * @returns A promise that resolves to an array of DocumentLog entries extracted from the transaction receipt.
     */
    extractDocumentLog(receipt: TransactionReceipt, timestamp?: Date): Promise<DocumentLog[]>;

    /**
     * Extracts CopyLog entries from a given transaction receipt.
     * 
     * @param receipt The transaction receipt containing the logs to be parsed.
     * @param timestamp Optional timestamp to assign to all extracted logs. This is useful when the receipt is from a transaction included in the latest block or in a block that has not been indexed yet.
     * @returns A promise that resolves to an array of CopyLog entries extracted from the transaction receipt.
     */
    extractCopyLog(receipt: TransactionReceipt, timestamp?: Date): Promise<CopyLog[]>;

    /**
     * Extracts SignatureLog entries from a given transaction receipt.
     * 
     * @param receipt The transaction receipt containing the logs to be parsed.
     * @param timestamp Optional timestamp to assign to all extracted logs. This is useful when the receipt is from a transaction included in the latest block or in a block that has not been indexed yet.
     * @returns A promise that resolves to an array of SignatureLog entries extracted from the transaction receipt.
     */
    extractSignatureLog(receipt: TransactionReceipt, timestamp?: Date): Promise<SignatureLog[]>;

    /**
     * Extracts TimestampLog entries from a given transaction receipt.
     * 
     * @param receipt The transaction receipt containing the logs to be parsed.
     * @param timestamp Optional timestamp to assign to all extracted logs. This is useful when the receipt is from a transaction included in the latest block or in a block that has not been indexed yet.
     * @returns A promise that resolves to an array of TimestampLog entries extracted from the transaction receipt.
     */
    extractTimestampLog(receipt: TransactionReceipt, timestamp?: Date): Promise<TimestampLog[]>;

    /**
     * Extracts NotificationLog entries from a given transaction receipt.
     * 
     * @param receipt The transaction receipt containing the logs to be parsed.
     * @param timestamp Optional timestamp to assign to all extracted logs. This is useful when the receipt is from a transaction included in the latest block or in a block that has not been indexed yet.
     * @returns A promise that resolves to an array of NotificationLog entries extracted from the transaction receipt.
     */
    extractNotificationLog(receipt: TransactionReceipt, timestamp?: Date): Promise<NotificationLog[]>;
}
