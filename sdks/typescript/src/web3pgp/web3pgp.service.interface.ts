import { BlockTag, TransactionReceipt } from 'viem';
import * as openpgp from 'openpgp';
import { KeyRegisteredLog, SubkeyAddedLog, KeyRevokedLog, KeyUpdatedLog, KeyCertificationRevokedLog, KeyCertifiedLog, OwnershipChallengedLog, OwnershipProvedLog, Web3PGPEventLog } from './types/types';

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
    /* WRITE OPERATIONS                                                                                              */
    /*****************************************************************************************************************/

    /**
     * Register a new OpenPGP public key (primary key with optional subkeys) on the blockchain.
     * 
     * @description
     * This method:
     * 1. (If not insecure) Verifies the provided public key and subkeys have a valid signature, are not expired and not revoked.
     * 2. Extracts the primary key fingerprint and subkey fingerprints
     * 3. Ensures the key and its subkeys are not registered on-chain (enforced by smart contract).
     * 4. Serializes the key into the OpenPGP binary format.
     * 5. Registers the key on-chain via the Web3PGP contract
     * 
     * @param key The OpenPGP public key to register (may include subkeys)
     * @param insecure If true, skips cryptographic verifications of the key and subkeys. Defaults to false.
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
    register(key: openpgp.PublicKey, insecure?: boolean): Promise<TransactionReceipt>;

    /**
     * Update an existing OpenPGP public key on the blockchain to add or revoke user ID packets,
     * change preferences or update key expiration.
     * 
     * @description
     * This method:
     * 1. Verifies the provided public key has a valid signature, is not expired and is not revoked.
     * 2. Prunes subkeys from the key (isolating the primary key for metadata updates).
     * 3. Extracts the primary key fingerprint.
     * 4. Ensures the key is registered on-chain (enforced by smart contract).
     * 5. Serializes the key into the OpenPGP binary format.
     * 6. Calls the update function of the Web3PGP contract to store the updated key on-chain.
     * 
     * @param key The OpenPGP public key to update (must include primary key).
     * @returns Transaction receipt after successful update.
     * 
     * @throws Error if the key is invalid.
     * @throws Error if the key is not already registered on-chain.
     * @throws Error if wallet client is not configured.
     * @throws Error if the transaction fails.
     * 
     * @example
     * ```typescript
     * const armoredKey = '-----BEGIN PGP PUBLIC KEY BLOCK-----...';
     * const publicKey = await openpgp.readKey({ armoredKey });
     * const receipt = await service.update(publicKey);
     * console.log(`Key updated at block ${receipt.blockNumber}`);
     * ```
     */
    update(key: openpgp.PublicKey): Promise<TransactionReceipt>;

    /**
     * Add a new subkey to a primary key registered on the blockchain.
     * 
     * This method:
     * 1. Validates the provided key contains the specified subkey
     * 2. Removes extra subkeys.
     * 3. Verifies the primary key is registered on-chain (enforced by smart contract)
     * 4. Verifies the subkey is not registered on-chain (enforced by smart contract)
     * 5. Extracts the primary key fingerprint
     * 6. Verifies the provided key and subkey have valid signatures, are not expired and not revoked.
     * 7. Serializes the key and its subkey into the OpenPGP binary format.
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

    /**
     * Initiate a challenge to prove ownership of an OpenPGP key registered on-chain.
     * 
     * This method submits a hash of a random challenge generated by the user to the blockchain. The owner
     * of the private key corresponding to the public key must later sign the bytes of the hash off-chain
     * and submit the signature using the `proveOwnership` method to complete the ownership proof process.
     * 
     * @param fingerprint The fingerprint of the key to challenge ownership for (primary key or subkey)
     * @param challengeHash The keccak256 hash of the random challenge generated and hashed by the user (32 bytes hex string)
     * @returns Transaction receipt after successful challenge submission
     * 
     * @throws Error if the key is not registered on-chain
     * @throws Error if wallet client is not configured
     * @throws Error if transaction fails
     */
    challengeOwnership(fingerprint: `0x${string}`, challengeHash: `0x${string}`): Promise<TransactionReceipt>;

    /**
     * Prove ownership of an OpenPGP key by submitting a signature of a previously issued challenge.
     * 
     * This method verifies the provided signature against the challenge associated with the specified
     * key fingerprint on-chain. If the signature is valid, ownership is proven.
     * 
     * The method:
     * 1. Fetches the up-to-date public key from the blockchain using the provided fingerprint
     * 2. Verifies the signature of the challenge (the bytes of the hash) using the public key
     * 3. Submits the ownership proof on-chain via the Web3PGP contract
     * 
     * @param fingerprint The fingerprint of the key to prove ownership for (primary key or subkey)
     * @param challengeHash The keccak256 hash of the original challenge that was issued
     * @param signature The signature of the challenge created using the private key corresponding to the public key
     * @returns Transaction receipt after successful ownership proof submission
     * 
     * @throws Error if the key is not registered on-chain
     * @throws Error if the signature is invalid or the key is revoked or expired at present time
     * @throws Error if wallet client is not configured
     * @throws Error if transaction fails
     */
    proveOwnership(fingerprint: `0x${string}`, challengeHash: `0x${string}`, signature: openpgp.Signature): Promise<TransactionReceipt>;

    /**
     * Publish a third-party certification of an OpenPGP key on the blockchain.
     * 
     * This method allows a user (the issuer) to certify another user's OpenPGP public key by publishing
     * the certification on-chain. The certified key is an OpenPGP public key that contains a certification
     * signature made by the issuer over the target key.
     * 
     * @description
     * This method:
     * 1. Verifies the target key is registered on-chain (enforced by smart contract)
     * 2. Extracts and verifies the certification signature in the certified key
     * 3. Serializes the certified key into the OpenPGP binary format.
     * 4. Publishes the certification on-chain via the Web3PGP contract.
     * 
     * @param issuer The OpenPGP public key of the issuer certifying the target key
     * @param certifiedKey The public key containing the certification signature made by the issuer
     * @returns Transaction receipt after successful certification publication
     * 
     * @throws Error if the target key is not registered on-chain
     * @throws Error if the fingerprint doesn't match the fingerprint of the primary key
     * @throws Error if the certification signature is invalid or not made by the issuer
     * @throws Error if wallet client is not configured
     * @throws Error if transaction fails
     */
    certify(issuer: openpgp.PublicKey, certifiedKey: openpgp.PublicKey): Promise<TransactionReceipt>;

    /**
     * Revoke a third-party certification of an OpenPGP key on the blockchain.
     * 
     * This method allows a user (the issuer) to revoke a previously published certification of another user's
     * OpenPGP public key by publishing a revocation on-chain. The revoked key is an OpenPGP public key that
     * contains a revocation signature made by the issuer over the target key.
     * 
     * @description
     * This method:
     * 1. Verifies the target key is registered on-chain (enforced by smart contract)
     * 2. Extracts and verifies the revoked third-party signature in the key.
     * 3. Serializes the certified key into the OpenPGP binary format.
     * 4. Publishes the certification revocation on-chain via the Web3PGP contract.
     * 
     * @param issuer The OpenPGP public key of the issuer revoking the certification
     * @param keyWithRevokedCertification The public key containing the revocation signature made by the issuer
     * @returns Transaction receipt after successful revocation publication
     * 
     * @throws Error if the target key is not registered on-chain
     * @throws Error if the fingerprint doesn't match the fingerprint of the primary key
     * @throws Error if the revocation signature is invalid or not made by the issuer
     * @throws Error if wallet client is not configured
     * @throws Error if transaction fails
     */
    revokeCertification(issuer: openpgp.PublicKey, keyWithRevokedCertification: openpgp.PublicKey): Promise<TransactionReceipt>;

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
     * 6. If the fingerprint belongs to a subkey, get the fingerprint of the primary key and call recursively to get the full key
     * 7. Retrieves and adds registered subkeys
     * 8. Retrieves and applies revocations using the block timestamp of each event
     * 9. Retrieves and applies key certifications, key certification revocations and updates of the primary key 
     * 10. Returns the reconstructed public key
     * 
     * @param fingerprint The fingerprint of the key to retrieve (primary key or subkey)
     * @param insecure If true, skips cryptographic verifications of the key and subkeys. Defaults to false.
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
    getPublicKey(fingerprint: `0x${string}`, insecure?: boolean): Promise<openpgp.PublicKey>;

    /*****************************************************************************************************************/
    /* LOGS OPERATIONS                                                                                               */
    /*****************************************************************************************************************/

    /**
     * Validate and extract the public key from a KeyRegisteredLog event.
     * 
     * @description
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
     * Validate and extract the updated public key from a KeyUpdatedLog event.
     * 
     * @description
     * This method:
     * 1. Validates the log data contains required fields
     * 2. Extracts and parses the OpenPGP message from the log
     * 3. Verifies the primary key fingerprint matches the declared one
     * 4. (if verifications are enabled) Verifies the primary key has a valid signature, is not expired and is not 
     *    revoked at the time of update (uses the block timestamp).
     * 
     * Cryptographic verifications of the key (step 4) can be skipped by setting the `skipCryptographicVerifications`
     * parameter to true. This is useful when users want to extract and parse the OpenPGP key material in order to perform
     * custom validations or inspections in case the verification fails, is expected to fail or is performed by an external
     * OpenPGP toolkit.
     * 
     * @param log The KeyUpdatedLog event data from the blockchain
     * @param skipCryptographicVerifications If true, skips cryptographic verifications of key. Defaults to false.
     * @returns The validated OpenPGP public key extracted from the log
     * 
     * @throws Web3PGPServiceValidationError if the log data is invalid or missing required fields
     * @throws Web3PGPServiceValidationError if the extracted OpenPGP message is invalid or corrupted
     * @throws Web3PGPServiceValidationError if the primary key fingerprint does not match the log data
     * 
     * @example
     * ```typescript
     * const logs = await web3pgp.searchKeyUpdatedLogs();
     * for (const log of logs) {
     *   try {
     *     const publicKey = await service.extractFromKeyUpdatedLog(log);
     *     console.log(`Valid updated key: ${publicKey.getFingerprint()}`);
     *   } catch (err) {
     *     console.warn(`Invalid log data: ${err.message}`);
     *   }
     * }
     * ```
     */
    extractFromKeyUpdatedLog(log: KeyUpdatedLog, skipCryptographicVerifications?: boolean): Promise<openpgp.PublicKey>;

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

    /**
     * Validate and extract the certified public key from a KeyCertifiedLog event.
     * 
     * @description
     * This method:
     * 1.   Validates the log data contains required fields
     * 2.   Extracts and parses the OpenPGP message from the log
     * 3.   Verifies the primary key fingerprint matches the declared one
     * 4.   (if verifications are enabled) Verifies the primary key has a valid signature, is not expired and is not 
     *        revoked at the time of certification (uses the block timestamp).
     * 5.   Validates that at least one certification signature made by the issuer over the target key is present
     * 
     * Cryptographic verifications of the key (step 4) can be skipped by setting the `skipCryptographicVerifications`
     * parameter to true. This is useful when users want to extract and parse the OpenPGP key material in order to perform
     * custom validations or inspections in case the verification fails, is expected to fail or is performed by an external
     * OpenPGP toolkit.
     * 
     * @param log The KeyCertifiedLog event data from the blockchain
     * @param skipCryptographicVerifications If true, skips cryptographic verifications of key. Defaults to false.
     * @returns The validated OpenPGP public key extracted from the log
     * 
     * @throws Web3PGPServiceValidationError if the log data is invalid or missing required fields
     * @throws Web3PGPServiceValidationError if the extracted OpenPGP message is invalid or corrupted
     * @throws Web3PGPServiceValidationError if the primary key fingerprint does not match the log data
     * @throws Web3PGPServiceValidationError if no valid certification signature made by the issuer is found
     * 
     * @example
     * ```typescript
     * const logs = await web3pgp.searchKeyCertifiedLogs(issuerFingerprint, targetFingerprint);
     * for (const log of logs) {
     *   try {
     *     const certifiedKey = await service.extractFromKeyCertifiedLog(log);
     *     console.log(`Valid certified key: ${certifiedKey.getFingerprint()}`);
     *   } catch (err) {
     *     console.warn(`Invalid log data: ${err.message}`);
     *   }
     * }
     * ```
     */
    extractFromKeyCertifiedLog(log: KeyCertifiedLog, skipCryptographicVerifications?: boolean): Promise<openpgp.PublicKey>;

    /**
     * Validate and extract the revoked certification from a KeyCertificationRevokedLog event.
     * 
     * @description
     * This method:
     * 1.   Validates the log data contains required fields
     * 2.   Extracts and parses the OpenPGP message from the log
     * 3.   Verifies the primary key fingerprint matches the declared one
     * 4.   (if verifications are enabled) Verifies the primary key has a valid signature, is not expired and is not 
     *        revoked at the time of certification revocation (uses the block timestamp).
     * 5.   Validates that at least one certification revocation signature made by the issuer over the target key is present
     * 
     * Cryptographic verifications of the key (step 4) can be skipped by setting the `skipCryptographicVerifications`
     * parameter to true. This is useful when users want to extract and parse the OpenPGP key material in order to perform
     * custom validations or inspections in case the verification fails, is expected to fail or is performed by an external
     * OpenPGP toolkit.
     * 
     * @param log The KeyCertificationRevokedLog event data from the blockchain
     * @param skipCryptographicVerifications If true, skips cryptographic verifications of key. Defaults to false.
     * @returns The validated OpenPGP public key extracted from the log
     * 
     * @throws Web3PGPServiceValidationError if the log data is invalid or missing required fields
     * @throws Web3PGPServiceValidationError if the extracted OpenPGP message is invalid or corrupted
     * @throws Web3PGPServiceValidationError if the primary key fingerprint does not match the log data
     * @throws Web3PGPServiceValidationError if no valid certification revocation signature made by the issuer is found
     * 
     * @example
     * ```typescript
     * const logs = await web3pgp.searchKeyCertificationRevokedLogs(issuerFingerprint, targetFingerprint);
     * for (const log of logs) {
     *   try {
     *     const revokedCertificationKey = await service.extractFromKeyCertificationRevokedLog(log);
     *     console.log(`Valid revoked certification key: ${revokedCertificationKey.getFingerprint()}`);
     *  } catch (err) {
     *    console.warn(`Invalid log data: ${err.message}`);
     *  }
     * }
     * ```
     */
    extractFromKeyCertificationRevokedLog(log: KeyCertificationRevokedLog, skipCryptographicVerifications?: boolean): Promise<openpgp.PublicKey>;

    /**
     * Extract the signature from an OwnershipChallengedLog event. The signature is not verified at this stage.
     * 
     * @description
     * This method:
     * 1.   Validates the log data contains required fields
     * 2.   Extracts and parses the OpenPGP signature from the log
     * 
     * @param log The OwnershipProvedLog event data from the blockchain
     * @returns The OpenPGP signature extracted from the log
     * 
     * @throws Web3PGPServiceValidationError if the log data is invalid or missing required fields
     * @throws Web3PGPServiceValidationError if the extracted OpenPGP signature is invalid or corrupted
     */
    extractFromOwnershipProvedLog(log: OwnershipProvedLog): Promise<openpgp.Signature>;

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

    /*****************************************************************************************************************/
    /* UTILITY FUNCTIONS                                                                                             */
    /*****************************************************************************************************************/
    
    /**
     * Get the current block number of the connected blockchain.
     * @return The current block number as a bigint.
     */
    getBlockNumber(): Promise<bigint>;
}
