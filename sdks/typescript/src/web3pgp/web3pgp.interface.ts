import { BlockTag, TransactionReceipt } from 'viem';
import { KeyCertificationRevokedLog, KeyCertifiedLog, KeyRegisteredLog, KeyRevokedLog, KeyUpdatedLog, OwnershipChallengedLog, OwnershipProvedLog, SubkeyAddedLog, Web3PGPEventLog } from './types/types';
import { IFlatFee } from '../flatfee/flatefee.interface';

/**
 * Interface for the Web3PGP contract methods.
 * This defines the low-level contract interactions following the IWeb3PGP Solidity interface.
 */
export interface IWeb3PGP extends IFlatFee {

    /*****************************************************************************************************************/
    /* READ FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * Check if a given fingerprint has been used to register a key in the contract.
     * @param fingerprint The fingerprint of the key to check.
     * @return True if the fingerprint has been used to register a key in the contract, false otherwise.
     */
    exists(fingerprint: `0x${string}`): Promise<boolean>;

    /**
     * Check if a given fingerprint corresponds to a key registered as a subkey in the contract.
     * @param fingerprint The fingerprint of the key to check.
     * @return True if the key is a subkey, false otherwise.
     */
    isSubKey(fingerprint: `0x${string}`): Promise<boolean>;

    /**
     * Get the fingerprint of the parent key for a given subkey.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @return The fingerprint of the parent key or zero bytes if there is no parent.
     */
    parentOf(subkeyFingerprint: `0x${string}`): Promise<`0x${string}`>;

    /**
     * Get the block number when a key was published.
     * @param fingerprint The fingerprint of the key to check.
     * @return The block number when the key was published, or 0 if not published.
     */
    getKeyPublicationBlock(fingerprint: `0x${string}`): Promise<bigint>;

    /**
     * Get the block numbers when multiple keys were published.
     * @param fingerprints The fingerprints of the keys to check.
     * @return An array of block numbers corresponding to each fingerprint in the order they were provided.
     */
    getKeyPublicationBlockBatch(fingerprints: `0x${string}`[]): Promise<bigint[]>;

    /**
     * List the block numbers when updates were published for the given fingerprint.
     * @param fingerprint The fingerprint of the key to check.
     * @param start The starting index in the list of updates.
     * @param limit The maximum number of results to return.
     * @return An array of block numbers when updates were published.
     */
    listKeyUpdates(fingerprint: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]>;

    /**
     * List the block numbers when revocation certificates were published for the given fingerprint.
     * @param fingerprint The fingerprint of the key to check.
     * @param start The starting index in the list of revocations.
     * @param limit The maximum number of results to return.
     * @return An array of block numbers when revocation certificates were published.
     */
    listRevocations(fingerprint: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]>;

    /**
     * List the fingerprints of subkeys registered under a given parent key.
     * @param parentKeyFingerprint The fingerprint of the parent key to check.
     * @param start The starting index in the list of subkeys.
     * @param limit The maximum number of results to return.
     * @return An array of subkey fingerprints.
     */
    listSubkeys(parentKeyFingerprint: `0x${string}`, start: bigint, limit: bigint): Promise<`0x${string}`[]>;

    /**
     * List the block numbers when certifications were published for a given key.
     * @param fingerprint The fingerprint of the key to check.
     * @param start The starting index in the list of certifications.
     * @param limit The maximum number of results to return.
     * @return An array of block numbers when certifications were published.
     */
    listCertifications(fingerprint: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]>;

    /**
     * List the block numbers when certification revocations were published for a given key.
     * @param fingerprint The fingerprint of the key to check.
     * @param start The starting index in the list of certification revocations.
     * @param limit The maximum number of results to return.
     * @return An array of block numbers when certification revocations were published.
     */
    listCertificationRevocations(fingerprint: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]>;

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
    register(
        primaryKeyFingerprint: `0x${string}`,
        subkeyFingerprints: `0x${string}`[],
        openPGPMsg: `0x${string}`
    ): Promise<TransactionReceipt>;

    /**
     * Update the metadata of an already registered public key.
     * @param fingerprint The fingerprint of the key to update.
     * @param openPGPMsg A binary OpenPGP message containing the updated key and metadata.
     * @return Transaction receipt after updating the key.
     */
    update(
        fingerprint: `0x${string}`,
        openPGPMsg: `0x${string}`
    ): Promise<TransactionReceipt>;

    /**
     * Add a new subkey to an already registered primary key.
     * @param primaryKeyFingerprint The fingerprint of the primary key to which to attach the subkey.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @param openPGPMsg A binary OpenPGP message containing the subkey and its key binding signatures.
     * @return Transaction receipt after adding the subkey.
     */
    addSubkey(
        primaryKeyFingerprint: `0x${string}`,
        subkeyFingerprint: `0x${string}`,
        openPGPMsg: `0x${string}`
    ): Promise<TransactionReceipt>;

    /**
     * Publish a key revocation certificate for a target public key.
     * @param fingerprint The fingerprint of the key to be revoked.
     * @param revocationCertificate The binary OpenPGP message containing the key revocation certificate.
     * @return Transaction receipt after publishing the revocation.
     */
    revoke(fingerprint: `0x${string}`, revocationCertificate: `0x${string}`): Promise<TransactionReceipt>;

    /**
     * Certifies a key by issuing a key certification.
     *
     * @param fingerprint The fingerprint of the key being certified.
     * @param issuerFingerprint The fingerprint of the issuer key.
     * @param keyCertificate The OpenPGP key certification.
     * @returns A transaction receipt.
     */
    certifyKey(
        fingerprint: `0x${string}`,
        issuerFingerprint: `0x${string}`,
        keyCertificate: `0x${string}`
    ): Promise<TransactionReceipt>;

    /**
     * Issues a revocation for a previously issued key certification.
     *
     * @param fingerprint The fingerprint of the key whose certification is being revoked.
     * @param issuerFingerprint The fingerprint of the issuer who issued the certification.
     * @param revocationSignature The OpenPGP revocation signature.
     * @returns A transaction receipt.
     */
    revokeCertification(
        fingerprint: `0x${string}`,
        issuerFingerprint: `0x${string}`,
        revocationSignature: `0x${string}`
    ): Promise<TransactionReceipt>;

    /**
     * Challenges ownership of a key.
     *
     * @param fingerprint The fingerprint of the key.
     * @param challengeHash The keccak256 hash of the challenge.
     * @returns A transaction receipt.
     */
    challengeOwnership(
        fingerprint: `0x${string}`,
        challengeHash: `0x${string}`
    ): Promise<TransactionReceipt>;

    /**
     * Proves ownership of a key by responding to a challenge.
     *
     * @param fingerprint The fingerprint of the key.
     * @param challengeHash The keccak256 hash of the challenge.
     * @param signature A signature proving ownership.
     * @returns A transaction receipt.
     */
    proveOwnership(
        fingerprint: `0x${string}`,
        challengeHash: `0x${string}`,
        signature: `0x${string}`
    ): Promise<TransactionReceipt>;

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
    getKeyRegisteredLog(primaryKeyFingerprint: `0x${string}`, blockNumber: bigint): Promise<KeyRegisteredLog>;

    /**
     * Search for KeyRegistered event logs.
     *
     * @param primaryKeyFingerprint The fingerprint(s) of the primary key to search logs for. Default to all keys.
     * @param fromBlock The starting block number of the search range. 'earliest' is used by default. 'pending' is not allowed.
     * @param toBlock The ending block number of the search range. 'latest' is used by default. 'pending' is not allowed.
     * @return An array of KeyRegisteredLog objects matching the search criteria.
     */
    searchKeyRegisteredLogs(primaryKeyFingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<KeyRegisteredLog[]>;

    /**
     * Search for KeyUpdated event logs.
     * 
     * @param fingerprint The fingerprint(s) of the key to search logs for. Default to all keys.
     * @param fromBlock The starting block number of the search range. 'earliest' is used by default. 'pending' is not allowed.
     * @param toBlock The ending block number of the search range. 'latest' is used by default. 'pending' is not allowed.
     * @return An array of KeyUpdatedLog objects matching the search criteria.
     */
    searchKeyUpdatedLogs(fingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<KeyUpdatedLog[]>;

    /**
     * Get the log of a subkey addition event using the provided primary key fingerprint, subkey fingerprint, and block number.
     * @param primaryKeyFingerprint The fingerprint of the primary key.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @param blockNumber The block number where the event was emitted.
     * @throws Error if the event log cannot be found.
     * @return The SubkeyAddedLog object containing event details.
     */
    getSubkeyAddedLog(primaryKeyFingerprint: `0x${string}`, subkeyFingerprint: `0x${string}`, blockNumber: bigint): Promise<SubkeyAddedLog>;

    /**
     * Search for SubkeyAdded event logs.
     * @param primaryKeyFingerprint The fingerprint(s) of the primary key to search logs for. Default to all keys.
     * @param subkeyFingerprint The fingerprint(s) of the subkey to search logs for. Default to all subkeys.
     * @param fromBlock The starting block number of the search range. 'earliest' is used by default. 'pending' is not allowed.
     * @param toBlock The ending block number of the search range. 'latest' is used by default. 'pending' is not allowed.
     * @return An array of SubkeyAddedLog objects matching the search criteria.
     */
    searchSubkeyAddedLogs(primaryKeyFingerprint?: `0x${string}` | `0x${string}`[], subkeyFingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<SubkeyAddedLog[]>;

    /**
     * Search for KeyRevoked event logs.
     * @param fingerprint The fingerprint(s) of the key to search logs for. Default to all keys.
     * @param fromBlock The starting block number of the search range. 'earliest' is used by default. 'pending' is not allowed.
     * @param toBlock The ending block number of the search range. 'latest' is used by default. 'pending' is not allowed.
     * @return An array of KeyRevokedLog objects matching the search criteria.
     */
    searchKeyRevokedLogs(fingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<KeyRevokedLog[]>;

    /**
     * Search for OwnershipChallenged event logs.
     * 
     * @param fingerprint The fingerprint(s) of the key to search logs for. Default to all keys.
     * @param challenge The challenge(s) to search logs for. Default to all challenges.
     * @param fromBlock The starting block number of the search range. 'earliest' is used by default. 'pending' is not allowed.
     * @param toBlock The ending block number of the search range. 'latest' is used by default. 'pending' is not allowed.
     * @return An array of OwnershipChallengedLog objects matching the search criteria.
     */
    searchOwnershipChallengedLogs(fingerprint?: `0x${string}` | `0x${string}`[], challenge?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<OwnershipChallengedLog[]>;

    /**
     * Search for OwnershipProved event logs.
     * 
     * @param fingerprint The fingerprint(s) of the key to search logs for. Default to all keys.
     * @param challenge The challenge(s) to search logs for. Default to all challenges.
     * @param fromBlock The starting block number of the search range. 'earliest' is used by default. 'pending' is not allowed.
     * @param toBlock The ending block number of the search range. 'latest' is used by default. 'pending' is not allowed.
     * @return An array of OwnershipProvedLog objects matching the search criteria.
     */
    searchOwnershipProvedLogs(fingerprint?: `0x${string}` | `0x${string}`[], challenge?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<OwnershipProvedLog[]>;
    
    /**
     * Search for KeyCertified event logs.
     * 
     * @param fingerprint The fingerprint(s) of the key to search logs for. Default to all keys.
     * @param issuerFingerprint The fingerprint(s) of the issuer to search logs for. Default to all issuers.
     * @param fromBlock The starting block number of the search range. 'earliest' is used by default. 'pending' is not allowed.
     * @param toBlock The ending block number of the search range. 'latest' is used by default. 'pending' is not allowed.
     * @return An array of KeyCertifiedLog objects matching the search criteria.
     */
    searchKeyCertifiedLogs(fingerprint?: `0x${string}` | `0x${string}`[], issuerFingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<KeyCertifiedLog[]>;

    /**
     * Search for KeyCertificationRevoked event logs.
     * 
     * @param fingerprint The fingerprint(s) of the key to search logs for. Default to all keys.
     * @param issuerFingerprint The fingerprint(s) of the issuer to search logs for. Default to all issuers.
     * @param fromBlock The starting block number of the search range. 'earliest' is used by default. 'pending' is not allowed.
     * @param toBlock The ending block number of the search range. 'latest' is used by default. 'pending' is not allowed.
     * @return An array of KeyCertificationRevokedLog objects matching the search criteria.
     */
    searchKeyCertificationRevokedLogs(fingerprint?: `0x${string}` | `0x${string}`[], issuerFingerprint?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<KeyCertificationRevokedLog[]>;

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
    searchKeyEvents(fingerprints?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<Web3PGPEventLog[]>;

    /**
     * Extracts KeyRegisteredLog entries from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @return The list of KeyRegisteredLog extracted from the receipt.
     */
    extractKeyRegisteredLog(receipt: TransactionReceipt): Promise<KeyRegisteredLog[]>;

    /**
     * Extracts KeyUpdatedLog entries from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @return The list of KeyUpdatedLog extracted from the receipt.
     */
    extractKeyUpdatedLog(receipt: TransactionReceipt): Promise<KeyUpdatedLog[]>;

    /**
     * Extracts SubkeyAddedLog entries from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @return The list of SubkeyAddedLog extracted from the receipt.
     */
    extractSubkeyAddedLog(receipt: TransactionReceipt): Promise<SubkeyAddedLog[]>;

    /**
     * Extracts KeyRevokedLog entries from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @return The list of KeyRevokedLog extracted from the receipt.
     */
    extractKeyRevokedLog(receipt: TransactionReceipt): Promise<KeyRevokedLog[]>;

    /**
     * Extracts OwnershipChallengedLog entries from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @return The list of OwnershipChallengedLog extracted from the receipt.
     */
    extractOwnershipChallengedLog(receipt: TransactionReceipt): Promise<OwnershipChallengedLog[]>;

    /**
     * Extracts OwnershipProvedLog entries from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @return The list of OwnershipProvedLog extracted from the receipt.
     */
    extractOwnershipProvedLog(receipt: TransactionReceipt): Promise<OwnershipProvedLog[]>;

    /**
     * Extracts KeyCertifiedLog entries from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @return The list of KeyCertifiedLog extracted from the receipt.
     */
    extractKeyCertifiedLog(receipt: TransactionReceipt): Promise<KeyCertifiedLog[]>;

    /**
     * Extracts KeyCertificationRevokedLog entries from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @return The list of KeyCertificationRevokedLog extracted from the receipt.
     */
    extractKeyCertificationRevokedLog(receipt: TransactionReceipt): Promise<KeyCertificationRevokedLog[]>;

    /*****************************************************************************************************************/
    /* UTILITY FUNCTIONS                                                                                             */
    /*****************************************************************************************************************/

    /**
     * Get the current block number of the connected blockchain.
     * @return The current block number as a bigint.
     */
    getBlockNumber(): Promise<bigint>;
}
