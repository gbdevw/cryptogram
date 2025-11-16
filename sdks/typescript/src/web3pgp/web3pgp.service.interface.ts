import { TransactionReceipt } from 'viem';
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
     * This method:
     * 1. Validates the provided public key
     * 2. Extracts the primary key fingerprint and subkey fingerprints
     * 3. Serializes the key to binary OpenPGP message format
     * 4. Registers the key on-chain via the Web3PGP contract
     * 
     * @param key The OpenPGP public key to register (must include primary key, may include subkeys)
     * @returns Transaction receipt after successful registration
     * 
     * @throws Error if the key is invalid or missing required components
     * @throws Error if the key is already registered on-chain
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
     * 5. Serializes the key material (primary + subkey) to binary format
     * 6. Adds the subkey on-chain via the Web3PGP contract
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
     * Revoke a key by publishing a revoked public key (containing revocation signature) on the blockchain.
     * 
     * This method handles the case where the user has revoked their key using standard OpenPGP tools
     * and now wants to publish the revoked key (which includes the revocation signature) on-chain.
     * 
     * The method:
     * 1. Validates the provided key contains a valid revocation signature
     * 2. Verifies the target key is registered on-chain
     * 3. Serializes the revoked key to binary format
     * 4. Publishes the revocation on-chain via the Web3PGP contract
     * 
     * @param keyOrCertificate The revoked OpenPGP public key or a revocation certificate
     * @param fingerprint The fingerprint of the key being revoked (primary key or subkey)
     * @returns Transaction receipt after successful revocation publication
     * 
     * @throws Error if the key doesn't contain a valid revocation signature
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
     * This method:
     * 1. Validates the log data contains required fields
     * 2. Extracts and parses the OpenPGP message from the log
     * 3. Verifies the primary key fingerprint matches the declared one
     * 4. Validates all declared subkeys are present in the key
     * 5. Prunes any extra subkeys not declared in the log
     * 
     * @param log The KeyRegisteredLog event data from the blockchain
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
    extractFromKeyRegisteredLog(log: KeyRegisteredLog): Promise<openpgp.PublicKey>;

    /**
     * Validate and extract the subkey from a SubkeyAddedLog event.
     * 
     * This method:
     * 1. Validates the log data contains required fields
     * 2. Extracts and parses the OpenPGP message from the log
     * 3. Sanitizes the key to only include the primary key and the specific subkey
     * 4. Verifies the primary key fingerprint matches the declared one
     * 
     * @param log The SubkeyAddedLog event data from the blockchain
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
    extractFromSubkeyAddedLog(log: SubkeyAddedLog): Promise<openpgp.PublicKey>;

    /**
     * Validate and extract the revoked key or revocation certificate from a KeyRevokedLog event.
     * 
     * This method handles two types of revocation data:
     * 1. Key certificates: Full OpenPGP keys with revocation signatures
     * 2. Standalone revocation certificates: Signature packets only
     * 
     * The method:
     * 1. Validates the log data contains required fields
     * 2. Attempts to parse as a key certificate first
     * 3. If that fails, attempts to parse as a standalone revocation certificate
     * 4. For key certificates, validates the revocation is effective
     * 5. Returns either the revoked key or the armored revocation certificate
     * 
     * @param log The KeyRevokedLog event data from the blockchain
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
    extractFromKeyRevokedLog(log: KeyRevokedLog): Promise<[openpgp.PublicKey | undefined, string | undefined]>;
}
