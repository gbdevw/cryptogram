import { BlockTag, TransactionReceipt } from 'viem';
import * as openpgp from 'openpgp';
import { KeyRegisteredLog, SubkeyAddedLog, KeyRevokedLog } from './types/types';

/**
 * Interface for the Web3PGP service that provides high-level operations for managing OpenPGP keys on the blockchain.
 * 
 * This service layer handles:
 * - OpenPGP key validation and processing
 * - Fingerprint extraction and verification
 * - Key serialization to binary format for blockchain storage
 * - Key retrieval and reconstruction from blockchain events
 * - Revocation certificate handling
 * 
 * @remarks
 * This is a higher-order service built on top of the low-level Web3PGP contract bindings.
 * It abstracts away the complexity of working with raw OpenPGP messages and fingerprints,
 * providing a cleaner API that works directly with OpenPGP.js key objects.
 */
export interface IWeb3PGPService {

    /*****************************************************************************************************************/
    /* KEY REGISTRATION                                                                                              */
    /*****************************************************************************************************************/

    /**
     * Register a new OpenPGP public key (primary key with optional subkeys) on the blockchain.
     * 
     * @description
     * This method:
     * 1. Verifies the provided public key and subkeys have a valid signature, are not expired and not revoked.
     * 2. Extracts the primary key fingerprint and subkey fingerprints
     * 3. Serializes the key to binary OpenPGP message format
     * 4. Registers the key on-chain via the Web3PGP contract
     * 
     * @param key The OpenPGP public key to register (must include primary key, may include subkeys)
     * @returns Transaction receipt after successful registration
     * 
     * @throws Error if the key or one of its subkeys are invalid
     * @throws Error if the key or one of its subkeys are already registered on-chain
     * @throws Error if wallet client is not configured
     * @throws Error if transaction fails
     * 
     * @example
     * ```typescript
     * const armoredKey = '-----BEGIN PGP PUBLIC KEY BLOCK-----...';
     * const publicKey = await openpgp.readKey({ armoredKey });
     * const receipt = await service.register(publicKey);
     * console.log(`Key registered at block ${receipt.blockNumber}`);
     * ```
     */
    register(key: openpgp.PublicKey): Promise<TransactionReceipt>;

    /**
     * Add a new subkey to an already registered primary key on the blockchain.
     * 
     * This method:
     * 1. Validates the provided key contains both the primary key and the specified subkey
     * 2. Verifies the primary key is already registered on-chain
     * 3. Verifies the subkey is not already registered
     * 4. Extracts the primary key fingerprint
     * 5. Verifies the provided key and subkey have valid signatures, are not expired and not revoked.
     * 6. Removes extra subkeys and user ID packets.
     * 7. Serializes the key material (primary + subkey) to binary format
     * 8. Adds the subkey on-chain via the Web3PGP contract
     * 
     * @param key The OpenPGP public key containing both the primary key and the new subkey
     * @param subkeyFingerprint The fingerprint of the specific subkey to add (must exist in the key)
     * @returns Transaction receipt after successful subkey addition
     * 
     * @throws Error if the key is invalid or doesn't contain the specified subkey
     * @throws Error if the primary key is not registered on-chain
     * @throws Error if the subkey is already registered on-chain
     * @throws Error if wallet client is not configured
     * @throws Error if transaction fails
     * 
     * @example
     * ```typescript
     * const armoredKey = '-----BEGIN PGP PUBLIC KEY BLOCK-----...';
     * const publicKey = await openpgp.readKey({ armoredKey });
     * const subkeyFp = '0x' + publicKey.subkeys[0].getFingerprint();
     * const receipt = await service.addSubkey(publicKey, subkeyFp);
     * ```
     */
    addSubkey(key: openpgp.PublicKey, subkeyFingerprint: `0x${string}`): Promise<TransactionReceipt>;

    /*****************************************************************************************************************/
    /* KEY REVOCATION                                                                                                */
    /*****************************************************************************************************************/

    /**
     * Publish a key revocation certificate on the blockchain.
     * 
     * @description
     * This method allows users who have revoked their key using standard OpenPGP tools to publish the key revocation
     * certificate on-chain and inform others that the key is no longer valid.
     * 
     * The method accepts either a key object with the revocation signature or a standalone revocation certificate 
     * in armored format. In the later case, the method will download and verify the public key from the blockchain 
     * using the provided fingerprint as ID, apply the revocation certificate, verify the key is revoked at present time
     * and publish the revoked key on-chain.
     * 
     * When a revoked key is provided, the method will verify the target key or subkey, identified by the provided 
     * fingerprint, is indeed revoked in the key object at the present time and will publish the revoked key on-chain. 
     * 
     * @param keyOrCertificate The revoked OpenPGP public key or a revocation certificate
     * @param fingerprint The fingerprint of the key being revoked (primary key or subkey)
     * @returns Transaction receipt after successful revocation publication
     * 
     * @throws Error if the key doesn't contain a valid revocation signature at the present time
     * @throws Error if the fingerprint doesn't match any key in the provided key object
     * @throws Error if the target key is not registered on-chain
     * @throws Error if wallet client is not configured
     * @throws Error if transaction fails
     * 
     * @example
     * ```typescript
     * // After revoking the key with OpenPGP tools
     * const revokedKey = await openpgp.readKey({ armoredKey: revokedArmoredKey });
     * const fingerprint = '0x' + revokedKey.getFingerprint();
     * const receipt = await service.revoke(revokedKey, fingerprint);
     * ```
     */
    revoke(keyOrCertificate: openpgp.PublicKey | string, fingerprint: `0x${string}`): Promise<TransactionReceipt>;

    /*****************************************************************************************************************/
    /* KEY RETRIEVAL                                                                                                 */
    /*****************************************************************************************************************/

    /**
     * Retrieve and reconstruct an OpenPGP public key from the blockchain by its fingerprint.
     * 
     * This method:
     * 1. Verifies the key exists on-chain
     * 2. Retrieves the key publication block number
     * 3. Fetches the KeyRegistered or SubkeyAdded event from that block
     * 4. Extracts the binary OpenPGP message from the event
     * 5. Parses and validates the OpenPGP message
     * 6. Checks for any published revocations
     * 7. Applies revocation signatures if found
     * 8. Returns the reconstructed public key
     * 
     * @param fingerprint The fingerprint of the key to retrieve (primary key or subkey)
     * @returns The reconstructed and validated OpenPGP public key, with revocations applied if any
     * 
     * @throws Error if the key is not registered on-chain
     * @throws Error if the key data cannot be retrieved from blockchain events
     * @throws Error if the retrieved OpenPGP message is invalid or corrupted
     * 
     * @remarks
     * - The returned key will include all subkeys that were registered with the primary key
     * - If the key has been revoked, the revocation signature will be included in the returned key
     * - The key is validated for correctness and fingerprint matching before being returned
     * 
     * @example
     * ```typescript
     * const fingerprint = '0x1234567890abcdef...';
     * const publicKey = await service.getPublicKey(fingerprint);
     * const armored = publicKey.armor();
     * console.log(armored);
     * 
     * // Check if key is revoked
     * const revoked = await publicKey.isRevoked();
     * if (revoked) {
     *   console.log('Warning: This key has been revoked');
     * }
     * ```
     */
    getPublicKey(fingerprint: `0x${string}`): Promise<openpgp.PublicKey>;

    /*****************************************************************************************************************/
    /* LOG VALIDATION AND EXTRACTION                                                                                 */
    /*****************************************************************************************************************/

    /**
     * Validate and extract the public key from a KeyRegisteredLog event.
     * 
     * @description
     * 
     * This method:
     * 1.   Validates the log data contains required fields
     * 2.   Extracts and parses the OpenPGP message from the log
     * 3.   Verifies the primary key fingerprint matches the declared one
     * 4.   (if verifications are enabled) Verifies the primary key has a valid signature, is not expired and is not 
     *      revoked at the time of registration (uses the block timestamp)..
     * 5.   Validates all declared subkeys are present in the key
     * 6.   (if verifications are enabled) Verifies each subkey has a valid signature, is not expired and is not 
     *      revoked at the time of registration (uses the block timestamp).
     * 7.   Prunes any extra subkeys not declared in the log
     * 
     * Cryptographic verifications of the keys (steps 4 and 6) can be skipped by setting the `skipCryptographicVerifications`
     * parameter to true. This is useful when users want to extract and parse the OpenPGP key material in order to perform
     * custom validations or inspections in case the verification fails, is expected to fail or is performed by an external
     * OpenPGP toolkit.
     * 
     * @param log The KeyRegisteredLog event data from the blockchain
     * @param skipCryptographicVerifications If true, skips cryptographic verifications of key and subkeys. Defaults to false.
     * @returns The validated OpenPGP public key extracted from the log
     * 
     * @throws Web3PGPServiceValidationError if the log data is invalid or missing required fields
     * @throws Web3PGPServiceValidationError if the extracted OpenPGP message is invalid or corrupted
     * @throws Web3PGPServiceValidationError if the primary key fingerprint does not match the log data
     * @throws Web3PGPServiceValidationError if any declared subkey is missing from the extracted key
     * 
     * @example
     * ```typescript
     * const logs = await web3pgp.searchKeyRegisteredLogs();
     * for (const log of logs) {
     *   try {
     *     const publicKey = await service.extractFromKeyRegisteredLog(log);
     *     console.log(`Valid key: ${publicKey.getFingerprint()}`);
     *   } catch (err) {
     *     console.warn(`Invalid log data: ${err.message}`);
     *   }
     * }
     * ```
     */
    extractFromKeyRegisteredLog(log: KeyRegisteredLog, skipCryptographicVerifications?: boolean): Promise<openpgp.PublicKey>;

    /**
     * Validate and extract the subkey from a SubkeyAddedLog event.
     * 
     * @description
     * This method:
     * 1. Validates the log data contains required fields
     * 2. Extracts and parses the OpenPGP message from the log
     * 3. Verifies the primary key fingerprint matches the declared one
     * 4. Verifies the subkey fingerprint matches the declared one
     * 5. Prunes any extra subkeys and user ID packets, returning only the primary key and the added subkey
     * 6. (if verifications are enabled) Verifies the primary key has a valid signature, is not expired and is not 
     *    revoked at the time of subkey addition (uses the block timestamp).
     * 7. (if verifications are enabled) Verifies the subkey has a valid signature, is not expired and is not 
     *    revoked at the time of addition (uses the block timestamp).
     * 
     * Cryptographic verifications of the keys (steps 6 and 7) can be skipped by setting the `skipCryptographicVerifications`
     * parameter to true. This is useful when users want to extract and parse the OpenPGP key material in order to perform
     * custom validations or inspections in case the verification fails, is expected to fail or is performed by an external
     * OpenPGP toolkit.
     * 
     * @param log The SubkeyAddedLog event data from the blockchain
     * @param skipCryptographicVerifications If true, skips cryptographic verifications of key and subkey. Defaults to false.
     * @returns The validated OpenPGP public key containing the primary key and the added subkey
     * 
     * @throws Web3PGPServiceValidationError if the log data is invalid or missing required fields
     * @throws Web3PGPServiceValidationError if the extracted OpenPGP message is invalid or corrupted
     * @throws Web3PGPServiceValidationError if the primary key fingerprint does not match the log data
     * @throws Web3PGPServiceValidationError if the subkey is missing from the extracted key
     * 
     * @example
     * ```typescript
     * const logs = await web3pgp.searchSubkeyAddedLogs(primaryFingerprint);
     * let primaryKey = await service.getPublicKey(primaryFingerprint);
     * for (const log of logs) {
     *   const subkey = await service.extractFromSubkeyAddedLog(log);
     *   primaryKey = await primaryKey.update(subkey);
     * }
     * ```
     */
    extractFromSubkeyAddedLog(log: SubkeyAddedLog, skipCryptographicVerifications?: boolean): Promise<openpgp.PublicKey>;

    /**
     * Validate and extract the revoked key or revocation certificate from a KeyRevokedLog event.
     * 
     * @description
     * This method handles two types of revocation data:
     * 1. Key certificates: Full OpenPGP keys with revocation signatures
     * 2. Standalone revocation certificates: Revocation signature packets only
     * 
     * The method:
     * 1.   Validates the log data contains required fields
     * 2.   Attempts to parse as a key certificate first
     * 3.   If that fails, attempts to parse as a standalone revocation certificate and returns the armored certificate.
     *      It is the user's responsibility to verify and apply the revocation certificate to the target key.
     * 4. For key certificates, validates the fingerprint matches the target key
     * 5. (if verifications are enabled) Verifies the primary key has a valid signature, is not expired and is revoked
     *    at the time of revocation (uses the block timestamp).
     * 6. Returns either the revoked key or the armored revocation certificate
     * 
     * @param log The KeyRevokedLog event data from the blockchain
     * @param skipCryptographicVerifications If true, skips cryptographic verifications of the revoked key. Defaults to false.
     * @returns A tuple containing either:
     *   - [revokedKey, undefined] if a valid key certificate was found
     *   - [undefined, armoredCert] if a standalone revocation certificate was found
     * 
     * @throws Web3PGPServiceValidationError if the log data is invalid or missing required fields
     * @throws Web3PGPServiceValidationError if the extracted OpenPGP message is invalid or corrupted
     * @throws Web3PGPServiceValidationError if a key certificate does not effectively revoke the target key
     * 
     * @example
     * ```typescript
     * const logs = await web3pgp.searchKeyRevokedLogs(fingerprint);
     * let publicKey = await service.getPublicKey(fingerprint);
     * for (const log of logs) {
     *   const [revokedKey, revocationCert] = await service.extractFromKeyRevokedLog(log);
     *   if (revokedKey) {
     *     publicKey = await publicKey.update(revokedKey);
     *   } else if (revocationCert) {
     *     const result = await openpgp.revokeKey({ 
     *       key: publicKey, 
     *       revocationCertificate: revocationCert 
     *     });
     *     publicKey = result.publicKey;
     *   }
     * }
     * ```
     */
    extractFromKeyRevokedLog(log: KeyRevokedLog, skipCryptographicVerifications?: boolean): Promise<[openpgp.PublicKey | undefined, string | undefined]>;

    /*****************************************************************************************************************/
    /* EVENT LISTENING AND SYNCHRONIZATION                                                                          */
    /*****************************************************************************************************************/

    /**
     * Search for all key-related events within a specified block range.
     * 
     * @description
     * This high-level method searches for KeyRegistered, SubkeyAdded, and KeyRevoked events
     * in a single operation, providing a unified interface for event synchronization.
     * 
     * @param fromBlock Starting block number (inclusive). Defaults to 'earliest' if not provided.
     * @param toBlock Ending block number (inclusive). Defaults to 'latest' if not provided.
     * @returns An array of key-related event logs with validated and parsed data
     * 
     * @throws Web3PGPServiceValidationError if the block range is invalid
     * 
     * @example
     * ```typescript
     * const events = await service.searchKeyEvents('earliest', 'latest');
     * for (const event of events) {
     *   if (event.type === 'KeyRegistered') {
     *     const publicKey = await service.extractFromKeyRegisteredLog(event);
     *   }
     * }
     * ```
     */
    searchKeyEvents(
        fromBlock?: BlockTag | bigint,
        toBlock?: BlockTag | bigint,
    ): Promise<(KeyRegisteredLog | SubkeyAddedLog | KeyRevokedLog)[]>;
    
    /**
     * Get the current block number of the connected blockchain.
     * @return The current block number as a bigint.
     */
    getBlockNumber(): Promise<bigint>;
}
