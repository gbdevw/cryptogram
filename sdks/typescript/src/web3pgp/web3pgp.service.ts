import { TransactionReceipt, toHex, toBytes, BlockTag } from 'viem';
import * as openpgp from 'openpgp';
import { IWeb3PGPService } from './web3pgp.service.interface';
import { IWeb3PGP } from './web3pgp.interface';
import { BYTES32_ZERO, to0x, toBytes32 } from '../utils/0xstr';
import { OpenPGPUtils } from '../utils/openpgp';
import { KeyRegisteredLog, KeyRevokedLog, SubkeyAddedLog } from './types/types';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pLimit = require('p-limit');

/*****************************************************************************************************************/
/* CUSTOM ERRORS                                                                                                 */
/*****************************************************************************************************************/

/**
 * Base error class for Web3PGPService errors.
 */
export class Web3PGPServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'Web3PGPServiceError';
    }
}

/**
 * Error thrown when a critical failure occurs during service operations.
 *
 * This error indicates a serious problem that prevents the operation from continuing such as network failures and others has occurred.
 */
export class Web3PGPServiceCriticalError extends Web3PGPServiceError {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'Web3PGPServiceCriticalError';
    }
}

/**
 * Error thrown when key or blockchain data validation fails.
 * 
 * This can happen because the smart contract does not validate the data it stores, they
 * have to be verified by the client application. Furthermore, as anyone can provide keys,
 * malformed or invalid keys may be submitted by malicious actors. 
 */
export class Web3PGPServiceValidationError extends Web3PGPServiceError {
    constructor(message: string) {
        super(message);
        this.name = 'Web3PGPServiceValidationError';
    }
}

/*****************************************************************************************************************/
/* SERVICE IMPLEMENTATION                                                                                        */
/*****************************************************************************************************************/

/**
 * Configuration options for Web3PGPService.
 */
export interface Web3PGPServiceOptions {
    /**
     * Maximum number of concurrent operations performed when retrieving, reconstructing and verifying keys from 
     * the blockchain.
     * 
     * This limit helps prevent resource exhaustion and rate-limiting issues when interacting with RPC endpoints or
     * when processing large numbers of keys.
     * 
     * @default 10
     */
    concurrencyLimit?: number;
}

/**
 * High-level service for managing OpenPGP keys on the blockchain.
 * 
 * This service provides a user-friendly API for working with OpenPGP keys on the Web3PGP contract,
 * handling all the complexity of key validation, serialization, fingerprint extraction, and event parsing.
 * 
 * @remarks
 * Built on top of the low-level Web3PGP contract bindings, this service abstracts away the details
 * of working with raw bytes and blockchain events, allowing developers to work directly with
 * OpenPGP.js key objects.
 */
export class Web3PGPService implements IWeb3PGPService {

    // Low-level Web3PGP contract instance
    private readonly web3pgp: IWeb3PGP;

    /**
     * Limiter to control concurrent operations.
     * 
     * Prevents overwhelming the RPC provider with too many simultaneous requests. Also prevents
     * excessive CPU and memory usage when processing large numbers of keys.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly concurrencyLimit: any;

    /**
     * Create a new Web3PGPService instance.
     * 
     * @param web3pgp The low-level Web3PGP contract instance to use for blockchain interactions
     * 
     * @example
     * ```typescript
     * import { Web3PGP } from './web3pgp';
     * import { Web3PGPService } from './web3pgp.service';
     * 
     * const web3pgp = new Web3PGP(contractAddress, publicClient, walletClient);
     * const service = new Web3PGPService(web3pgp);
     * 
     * // Now use the high-level service
     * const receipt = await service.register(publicKey);
     * ```
     */
    constructor(web3pgp: IWeb3PGP, options?: Web3PGPServiceOptions) {
        this.web3pgp = web3pgp;
        this.concurrencyLimit = pLimit(options?.concurrencyLimit ?? 10);
    }

    /**
     * Get the underlying Web3PGP contract instance.
     * 
     * @returns The low-level Web3PGP contract instance
     * 
     * @remarks
     * Exposed for advanced use cases where direct contract access is needed.
     */
    public get contract(): IWeb3PGP {
        return this.web3pgp;
    }

    /*****************************************************************************************************************/
    /* KEY REGISTRATION                                                                                              */
    /*****************************************************************************************************************/

    /**
     * Register a new OpenPGP public key (primary key with optional subkeys) on the blockchain.
     * 
     * @param key The OpenPGP public key to register (must include primary key, may include subkeys)
     * @returns Transaction receipt after successful registration
     * 
     * @throws Error if the key is invalid or missing required components
     * @throws Error if the key is already registered on-chain
     * @throws Error if wallet client is not configured
     * @throws Error if transaction fails
     */
    public async register(key: openpgp.PublicKey): Promise<TransactionReceipt> {
        try {
            // Verify the key and its subkeys
            await OpenPGPUtils.verifyKey(key, new Date());
            // Publish the key and its subkeys on-chain
            return this.web3pgp.register(
                toBytes32(to0x(key.getFingerprint())),
                key.subkeys.map(subkey => toBytes32(to0x(subkey.getFingerprint()))),
                toHex(key.toPublic().write())
            )
        } catch (err) {
            // Wrap and rethrow errors
            throw new Web3PGPServiceError(`Failed to register the OpenPGP key: ${err}`);
        }
    }

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
    public async addSubkey(key: openpgp.PublicKey, subkeyFingerprint: `0x${string}`): Promise<TransactionReceipt> {
        try {
            // Sanitize the key to only include the primary key and the specified subkey
            const pk = await OpenPGPUtils.sanitizeSubkey(key, subkeyFingerprint);
            // Verify the sanitized key
            await OpenPGPUtils.verifyKey(pk, new Date());
            // Publish the sanitized key
            return this.web3pgp.addSubkey(
                toBytes32(to0x(pk.getFingerprint())),
                toBytes32(to0x(subkeyFingerprint)),
                toHex(pk.toPublic().write())
            );
        } catch (err) {
            // Wrap and rethrow errors
            throw new Web3PGPServiceError(`Failed to add the subkey: ${err}`);
        }
    }

    /*****************************************************************************************************************/
    /* KEY REVOCATION                                                                                                */
    /*****************************************************************************************************************/

    /**
     * Revoke a key by publishing a revoked public key or a standalone revocation certificate.
     * 
     * This method is overloaded to support two use cases:
     * 1. Revoke using a revoked key object (containing revocation signature)
     * 2. Revoke using a standalone armored revocation certificate
     * 
     * @param keyOrCertificate The revoked OpenPGP public key or armored revocation certificate
     * @param fingerprint The fingerprint of the key being revoked
     * @returns Transaction receipt after successful revocation publication
     * 
     * @throws Error if the key/certificate is invalid
     * @throws Error if the target key is not registered on-chain
     * @throws Error if wallet client is not configured
     * @throws Error if transaction fails
     */
    public async revoke(keyOrCertificate: openpgp.PublicKey | string, fingerprint: `0x${string}`): Promise<TransactionReceipt> {
        if (typeof keyOrCertificate === 'string') {
            return this.revokeWithCertificate(keyOrCertificate, fingerprint);
        } else {
            return this.revokeWithKey(keyOrCertificate, fingerprint);
        }
    }

    private async revokeWithKey(key: openpgp.PublicKey, fingerprint: `0x${string}`): Promise<TransactionReceipt> {
        // Check the provided key has a key with the given fingerprint
        const normalizedFingerprint = toBytes32(to0x(fingerprint));
        if (toBytes32(to0x(key.getFingerprint())) === normalizedFingerprint) {
            // Sanitize primary key
            const revoked = await OpenPGPUtils.sanitizePrimaryKey(key);
            // Check the provided key is revoked
            if (await revoked.isRevoked()) {
                // Publish the revoked primary key
                return this.web3pgp.revoke(normalizedFingerprint, toHex(revoked.toPublic().write()));
            } else {
                throw new Web3PGPServiceValidationError('The provided key does not contain a valid revocation signature.');
            }
        }
        else {
            // Must be a subkey
            const pk = await OpenPGPUtils.sanitizeSubkey(key, fingerprint);
            // Check subkey is revoked
            if (await OpenPGPUtils.isSubkeyRevoked(
                pk.subkeys[0]!, // We are sure this exists from sanitizeSubkey
                key
            )) {
                // Publish the revoked subkey
                return this.web3pgp.revoke(normalizedFingerprint, toHex(pk.toPublic().write()));
            } else {
                throw new Web3PGPServiceValidationError('The specified subkey does not contain a valid revocation signature.');
            }
        }
    }

    private async revokeWithCertificate(certificate: string, fingerprint: `0x${string}`): Promise<TransactionReceipt> {
        // Download the public key from the blockchain to verify revocation
        const normalizedFingerprint = toBytes32(to0x(fingerprint));
        const publicKey = await this.getPublicKey(normalizedFingerprint);
        // Apply the revocation certificate to the public key
        const revocationCheckDate = new Date()
        const revoked = await openpgp.revokeKey({
            key: publicKey,
            revocationCertificate: certificate,
            date: revocationCheckDate, // To be explicit
            format: 'object'
        });
        if (toBytes32(to0x(revoked.publicKey.getFingerprint())) === normalizedFingerprint) {
            // This is a primary key
            const pk = await OpenPGPUtils.sanitizePrimaryKey(revoked.publicKey);
            // Check the primary key is revoked
            if (await pk.isRevoked()) {
                // Publish the revoked primary key
                return this.web3pgp.revoke(normalizedFingerprint, toHex(pk.toPublic().write()));
            } else {
                throw new Web3PGPServiceValidationError('The provided key does not contain a valid revocation signature.');
            }
        } else {
            // Must be a subkey
            const pk = await OpenPGPUtils.sanitizeSubkey(revoked.publicKey, normalizedFingerprint);
            // Check subkey is revoked
            if (await OpenPGPUtils.isSubkeyRevoked(pk.subkeys[0]!, pk, revocationCheckDate)) {
                // Publish the subkey
                return this.web3pgp.revoke(normalizedFingerprint, toHex(pk.write()));
            } else {
                throw new Web3PGPServiceValidationError('The specified subkey does not contain a valid revocation signature.');
            }
        }
    }

    /*****************************************************************************************************************/
    /* LOG VALIDATION AND EXTRACTION FUNCTIONS                                                                       */
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
    public async extractFromKeyRegisteredLog(log: KeyRegisteredLog, skipCryptographicVerifications?: boolean): Promise<openpgp.PublicKey> {
        try {
            // Validate required data are present
            if (!log.openPGPMsg || !log.primaryKeyFingerprint) {
                throw new Web3PGPServiceValidationError(`The KeyRegisteredLog event is missing the data needed to extract and validate the public key.`);
            }
            // Read the primary key using the hex-encoded binary openPGP message from the log data
            const primaryKey = await openpgp.readKey({ binaryKey: toBytes(log.openPGPMsg) });
            // Verify the primary key has a valid signature and was not expired/revoked at the time of the block in which it was registered
            if (skipCryptographicVerifications !== true) {
                await primaryKey.verifyPrimaryKey(log.blockTimestamp);
            }
            // Validate the key fingerprint matches the declared one
            if (toBytes32(to0x(primaryKey.getFingerprint())) !== toBytes32(to0x(log.primaryKeyFingerprint))) {
                throw new Web3PGPServiceValidationError(`The fingerprint of the retrieved primary key does not match the declared fingerprint in the KeyRegisteredLog event.`);
            }
            // Verify the key contains the declared subkeys and prune the extra ones
            // Payload should match the on-chain data but extra subkeys may exist and should be ignored (not a critical error)
            let subkeys: openpgp.Subkey[] = [];
            for (const subkeyFingerprint of log.subkeyFingerprints || []) {
                const normalizedSubkeyFingerprint = toBytes32(to0x(subkeyFingerprint));
                const subkey = primaryKey.subkeys.find(sk => toBytes32(to0x(sk.getFingerprint())) === normalizedSubkeyFingerprint);
                if (subkey) {
                    // Verify the subkey has a valid signature and was not expired/revoked at the time of the block in which it was registered
                    if (skipCryptographicVerifications !== true) {
                        await subkey.verify(log.blockTimestamp);
                    }
                    subkeys.push(subkey);
                } else {
                    // A declared subkey is missing from the key data - critical error
                    throw new Web3PGPServiceValidationError(`The primary key does not contain the declared subkey with fingerprint ${subkeyFingerprint} from the KeyRegisteredLog event.`);
                }
            }
            // Prune extra subkeys
            primaryKey.subkeys = subkeys;
            console.debug(`[Web3PGP - Service] Successfully extracted primary key ${log.primaryKeyFingerprint} with ${subkeys.length} subkeys from KeyRegisteredLog event`);
            return primaryKey.toPublic();
        } catch (err) {
            if (err instanceof Web3PGPServiceValidationError) {
                // Rethrow validation errors
                throw err;
            }
            // Wrap other errors
            throw new Web3PGPServiceValidationError(`Failed to read the OpenPGP message from the KeyRegisteredLog event: ${err}`);
        }
    }

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
    public async extractFromSubkeyAddedLog(log: SubkeyAddedLog, skipCryptographicVerifications?: boolean): Promise<openpgp.PublicKey> {
        try {
            // Validate required data are present
            if (!log.openPGPMsg || !log.subkeyFingerprint || !log.primaryKeyFingerprint) {
                throw new Web3PGPServiceValidationError(`The SubkeyAddedLog event is missing the data needed to extract and validate the subkey.`);
            }
            // Read and verify the subkey using the hex-encoded binary openPGP message from the log data
            let pk: openpgp.Key;
            try {
                pk = await openpgp.readKey({ binaryKey: toBytes(log.openPGPMsg) });
                // Sanitize to only include primary key and the subkey
                pk = await OpenPGPUtils.sanitizeSubkey(pk, log.subkeyFingerprint);
                // Verify the sanitized key
                if (skipCryptographicVerifications !== true) {
                    await OpenPGPUtils.verifyKey(pk, new Date(log.blockTimestamp));
                }
            } catch (err) {
                throw new Web3PGPServiceValidationError(`Failed to read and sanitize the OpenPGP message for subkey with fingerprint ${log.subkeyFingerprint} from SubkeyAddedLog event: ${err}`);
            }
            // Validate the primary key fingerprint matches the declared one
            if (toBytes32(to0x(pk.getFingerprint())) !== toBytes32(to0x(log.primaryKeyFingerprint))) {
                throw new Web3PGPServiceValidationError(`The primary key fingerprint ${pk.getFingerprint()} does not match the declared primary key fingerprint ${log.primaryKeyFingerprint} in SubkeyAddedLog event.`);
            }
            return pk.toPublic();
        } catch (err) {
            if (err instanceof Web3PGPServiceValidationError) {
                // Rethrow service errors
                throw err;
            }
            // Wrap other errors
            throw new Web3PGPServiceValidationError(`Failed to read the OpenPGP message from the SubkeyAddedLog event: ${err}`);
        }
    }

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
    public async extractFromKeyRevokedLog(log: KeyRevokedLog, skipCryptographicVerifications?: boolean): Promise<[openpgp.PublicKey | undefined, string | undefined]> {
        try {
            // Validate required data are present
            if (!log.fingerprint || !log.revocationCertificate) {
                throw new Web3PGPServiceValidationError(`The KeyRevokedLog event is missing the data needed to extract and validate the revocation.`);
            }

            let revokedKey: openpgp.Key;
            try {
                // Try to parse the revocation certificate as a key certificate
                revokedKey = await openpgp.readKey({ binaryKey: toBytes(log.revocationCertificate) });
            } catch (err) {
                // Fallback - Try to read as a standalone revocation certificate
                const cert = await openpgp.readMessage({ 
                    binaryMessage: toBytes(log.revocationCertificate),
                    config: {
                        // Standalone revocation certs do not have public keys needed to verify the revocations signature
                        // This causes OpenPGP.js to throw an error unless we allow unauthenticated messages
                        allowMissingKeyFlags: true,
                        allowUnauthenticatedMessages: true 
                    }
                });
                // Return the armored standalone revocation certificate - We cannot check if the key is actually revoked without the public key
                console.debug(`[Web3PGP - Service] Successfully extracted revocation certificate for key ${log.fingerprint} from KeyRevokedLog event`);
                return [undefined, cert.armor()];
            }

            // Check the fingerprint matches either the primary key or a subkey
            if (toBytes32(to0x(revokedKey.getFingerprint())) === toBytes32(to0x(log.fingerprint))) {
                // Sanitize primary key
                const pk = await OpenPGPUtils.sanitizePrimaryKey(revokedKey);
                // Check the primary key is revoked
                if (skipCryptographicVerifications !== true && !await pk.isRevoked(undefined, undefined, log.blockTimestamp)) {
                    throw new Web3PGPServiceValidationError(`The primary key with fingerprint ${pk.getFingerprint()} is not revoked as expected in the KeyRevokedLog event.`);
                }
                // Return the revoked key and no standalone revocation certificate
                console.debug(`[Web3PGP - Service] Successfully extracted revocation for primary key ${log.fingerprint} from KeyRevokedLog event`);
                return [pk.toPublic(), undefined];
            } else {
                // Sanitize to keep only the target subkey - Will throw an error if not found
                const pk = await OpenPGPUtils.sanitizeSubkey(revokedKey, log.fingerprint);
                // Check subkey is revoked
                if (skipCryptographicVerifications !== true && !await OpenPGPUtils.isSubkeyRevoked(pk.subkeys[0]!, pk, log.blockTimestamp)) {
                    throw new Web3PGPServiceValidationError(`The subkey with fingerprint ${log.fingerprint} is not revoked as expected in the KeyRevokedLog event.`);
                }
                // Return the revoked key and no standalone revocation certificate
                console.debug(`[Web3PGP - Service] Successfully extracted revocation for subkey ${log.fingerprint} from KeyRevokedLog event`);
                return [pk.toPublic(), undefined];
            }
        } catch (err) {
            if (err instanceof Web3PGPServiceValidationError) {
                // Rethrow service errors
                throw err;
            }
            // Wrap other errors
            throw new Web3PGPServiceValidationError(`Failed to read the OpenPGP message from the KeyRevokedLog event: ${err}`);
        }
    }

    /*****************************************************************************************************************/
    /* KEY RETRIEVAL                                                                                                 */
    /*****************************************************************************************************************/

    /**
     * Retrieve and reconstruct an OpenPGP public key from the blockchain by its fingerprint.
     * 
     * @param fingerprint The fingerprint of the key to retrieve (primary key or subkey)
     * @returns The reconstructed and validated OpenPGP public key, with revocations applied if any
     * 
     * @throws Error if the key is not registered on-chain
     * @throws Error if the key data cannot be retrieved from blockchain events
     * @throws Error if the retrieved OpenPGP message is invalid or corrupted
     */
    public async getPublicKey(fingerprint: `0x${string}`): Promise<openpgp.PublicKey> {

        // 1. Get the publication block number of the target key and its parent if any
        const normalizedFingerprint = toBytes32(to0x(fingerprint));
        console.debug(`[Web3PGP - Service] Retrieving public key for fingerprint: ${normalizedFingerprint}`);
        const [publicationBlock, parent] = await Promise.allSettled([
            this.web3pgp.getKeyPublicationBlock(normalizedFingerprint),
            this.web3pgp.parentOf(normalizedFingerprint)
        ])

        if (publicationBlock.status === 'rejected') {
            throw new Web3PGPServiceCriticalError(`Failed to retrieve key publication block: ${publicationBlock.reason}`, publicationBlock.reason);
        }

        if (parent.status === 'rejected') {
            throw new Web3PGPServiceCriticalError(`Failed to retrieve parent fingerprint: ${parent.reason}`, parent.reason);
        }

        const publicationBlockNumber = publicationBlock.value;
        const parentFingerprint = parent.value;

        if (publicationBlockNumber === BigInt(0)) {
            console.debug(`[Web3PGP - Service] Key ${normalizedFingerprint} is not registered on-chain`);
            throw new Web3PGPServiceError(`The key with fingerprint ${fingerprint} is not registered on-chain.`);
        }

        console.debug(`[Web3PGP - Service] Key ${normalizedFingerprint} published at block ${publicationBlockNumber}, parent: ${parentFingerprint}`);

        // 2. Get the primary key and verify it
        let primaryKey: openpgp.PublicKey;
        if (parentFingerprint !== BYTES32_ZERO) {
            // This is a subkey, retrieve the parent key and return the reconstructed full key
            console.debug(`[Web3PGP - Service] Key ${normalizedFingerprint} is a subkey, retrieving parent key to reconstruct full key`);
            return await this.getPublicKey(parentFingerprint);
        } else {
            // This is a primary key - download it from chain
            console.debug(`[Web3PGP - Service] Key ${normalizedFingerprint} is a primary key`);
            primaryKey = await this.getPrimaryPublicKey(normalizedFingerprint, publicationBlockNumber);
        }

        // 3. Import all the subkeys registered under this primary key
        console.debug(`[Web3PGP - Service] Importing added subkeys for primary key ${primaryKey.getFingerprint()}`);
        primaryKey = await this.importAddedSubkeys(primaryKey);

        // 4. Import and apply revocation certificates to the key and its subkeys
        console.debug(`[Web3PGP - Service] Importing and applying revocations to primary key ${primaryKey.getFingerprint()} and its ${primaryKey.getSubkeys().length} subkeys`);
        primaryKey = await this.importAndApplyRevocations(primaryKey);

        // 5. Return the reconstructed public key
        console.debug(`[Web3PGP - Service] Successfully retrieved and reconstructed the public key`);
        return primaryKey;
    }

    /**
     * Retrieve and verify the primary key from the blockchain.
     * @param primaryKeyFingerprint The fingerprint of the primary key to retrieve
     * @param blockNumber The block number where the key was registered
     * @returns The verified primary key
     */
    private async getPrimaryPublicKey(primaryKeyFingerprint: `0x${string}`, blockNumber: bigint): Promise<openpgp.PublicKey> {
        // Fetch the log for the primary key
        console.debug(`[Web3PGP - Service] Fetching KeyRegistered log for ${primaryKeyFingerprint} at block ${blockNumber}`);
        const normalizedPrimaryKeyFingerprint = toBytes32(to0x(primaryKeyFingerprint));
        const registration = await this.web3pgp.getKeyRegisteredLog(normalizedPrimaryKeyFingerprint, blockNumber);
        console.debug(`[Web3PGP - Service] KeyRegistered log found for key ${primaryKeyFingerprint} at block ${blockNumber} in transaction ${registration.transactionHash}`);
        // Extract the key data from the log
        const primaryKey = await this.extractFromKeyRegisteredLog(registration);
        return primaryKey.toPublic();
    }

    /**
     * Import subkeys that were added after the primary key was registered in the Web3PGP contract.
     * @param primaryKey The primary key to import subkeys for
     * @returns A copy of the primary key with imported subkeys
     */
    private async importAddedSubkeys(primaryKey: openpgp.PublicKey): Promise<openpgp.PublicKey> {
        // List subkeys related to the primary key
        const normalizedFingerprint = toBytes32(to0x(primaryKey.getFingerprint()));
        let copyPk = primaryKey.toPublic();
        console.debug(`[Web3PGP - Service] Listing declared subkeys for primary key ${normalizedFingerprint}`);
        const declaredSubkeys = await this.fetchAllPaginated(
            (start, limit) => this.web3pgp.listSubkeys(normalizedFingerprint, start, limit)
        );
        
        // Remove subkeys from declaredSubkeys that are already in primaryKey
        const existingSubkeyFingerprints = new Set(primaryKey.subkeys.map(sk => toBytes32(to0x(sk.getFingerprint()))));
        const subkeysToImport = declaredSubkeys.filter(skFp => !existingSubkeyFingerprints.has(skFp));
        console.debug(`[Web3PGP - Service] Found ${subkeysToImport.length} additional subkeys for primary key ${normalizedFingerprint}`);
        
        // Get the list of block numbers where the remaining subkeys were added
        console.debug(`[Web3PGP - Service] Listing blocks with subkeys added to primary key ${normalizedFingerprint}`);
        const subkeyBlockNumbers = await this.web3pgp.getKeyPublicationBlockBatch(subkeysToImport);
        // Merge both arrays to create tuples of (subkeyFingerprint, blockNumber)
        const subkeysWithBlocks: Array<{ subkeyFingerprint: `0x${string}`, blockNumber: bigint }> = subkeysToImport.map((skFp, index) => ({
            subkeyFingerprint: skFp,
            blockNumber: subkeyBlockNumbers[index]!
        }));
        // Import and verify each subkey
        const importedSubkeys = await Promise.allSettled(
            subkeysWithBlocks.map(({ subkeyFingerprint, blockNumber }) => {
                return this.concurrencyLimit(async () => {
                    // Retrieve the subkey data from the blockchain
                    console.debug(`[Web3PGP - Service] Fetching SubkeyAdded log for subkey ${subkeyFingerprint} at block ${blockNumber}`);
                    const subkeyData = await this.web3pgp.getSubkeyAddedLog(normalizedFingerprint, subkeyFingerprint, blockNumber);
                    console.debug(`[Web3PGP - Service] SubkeyAdded log found for subkey ${subkeyFingerprint} at block ${blockNumber} in transaction ${subkeyData.transactionHash}`);
                    // Extract and validate the subkey
                    const subkey = await this.extractFromSubkeyAddedLog(subkeyData);
                    return subkey.toPublic();
                })
            })
        );
        // Update the primary key with the imported subkeys
        for (const result of importedSubkeys) {
            if (result.status === 'fulfilled') {
                copyPk = await copyPk.update(result.value);
            } else {
                if (result.reason instanceof Web3PGPServiceValidationError) {
                    // Non-critical validation error - log a warning but continue
                    console.warn(`[Web3PGP - Service] Failed to import subkey in key ${copyPk.getFingerprint()}: ${result.reason}`);
                } else {
                    // Critical failure that prevented the subkey import (network failure, others) - wrap and throw
                    throw new Web3PGPServiceCriticalError(`Critical error occured while importing subkey for key ${copyPk.getFingerprint()}: ${result.reason}`);
                }
            }
        }
        // Return the updated primary key with imported subkeys
        console.debug(`[Web3PGP - Service] Successfully imported ${subkeysToImport.length} additional subkeys in key ${normalizedFingerprint}`);
        return copyPk;
    }

    /**
     * Import and apply revocation certificates from the blockchain for the primary key and its subkeys.
     * @param primaryKey The primary key to import revocations for
     * @returns A copy of the primary key with revocations applied
     */
    private async importAndApplyRevocations(primaryKey: openpgp.PublicKey) {
        // List the block numbers where revocations were published for this key and its subkeys
        const normalizedFingerprint = toBytes32(to0x(primaryKey.getFingerprint()));
        let copyPk = primaryKey.toPublic();
        const allFingerprints = OpenPGPUtils.listAllFingerprints(copyPk).map(fp => toBytes32(to0x(fp)));
        console.debug(`[Web3PGP - Service] Checking revocations for key ${normalizedFingerprint} and its ${primaryKey.getSubkeys().length} subkeys`);
        const revocationBlocksPromises = Promise.allSettled(
            allFingerprints.map((fp) => {
                return this.concurrencyLimit(async () => {
                    return this.fetchAllPaginated(
                        (start, limit) => this.web3pgp.listRevocations(fp, start, limit)
                    );
                })
            })
        );
        // Flatten the results and keep unique values. Throw an error if any promise was rejected.
        const revocationBlocksResults = await revocationBlocksPromises;
        let allRevocationBlocks: bigint[] = [];
        for (const result of revocationBlocksResults) {
            if (result.status === 'fulfilled') {
                allRevocationBlocks.push(...result.value);
            } else {
                // Throw critical error - we cannot continue if we cannot get all revocation blocks
                throw new Web3PGPServiceCriticalError(`An error occurred while retrieving revocation blocks from the blockchain: ${result.reason}`);
            }
        }
        const uniqueRevocationBlocks = Array.from(new Set(allRevocationBlocks));
        
        // Get the revocation logs for each block
        const revocationLogsPromises = await Promise.allSettled(
            uniqueRevocationBlocks.map((blockNumber) => {
                return this.concurrencyLimit(async () => {
                    // Search for revocation logs in this block for all fingerprints
                    console.debug(`[Web3PGP - Service] Fetching KeyRevoked logs for the key and its subkeys at block ${blockNumber}`);
                    const revocationLog = await this.web3pgp.searchKeyRevokedLogs(allFingerprints, blockNumber, blockNumber);
                    // Extract the key/certificate from each log
                    let validRevokedKeys: openpgp.PublicKey[] = [];
                    for (const log of revocationLog) {
                        try {
                            console.debug(`[Web3PGP - Service] Processing revocation log for fingerprint ${log.fingerprint} at block ${blockNumber}`);
                            const [revokedKey, cert] = await this.extractFromKeyRevokedLog(log); 
                            console.debug(`[Web3PGP - Service] Successfully extracted revocation data for fingerprint ${log.fingerprint} at block ${blockNumber} in transaction ${log.transactionHash}`);
                            if (revokedKey) {
                                validRevokedKeys.push(revokedKey);
                            } else {
                                // Standalone revocation certificate - apply it to a copy of the primary key and then push the revoked key to results
                                let r = await openpgp.revokeKey({
                                    key: copyPk,
                                    revocationCertificate: cert!,
                                    format: 'object'
                                });
                                validRevokedKeys.push(r.publicKey);
                            }
                        } catch (err) {
                            // Log and skip invalid revoked keys
                            console.warn(`[Web3PGP - Service] Skipping. Failed to read or sanitize revoked key ${log.fingerprint} from log at block ${blockNumber}: ${err}`);
                            continue;
                        }
                    }
                    return validRevokedKeys;
                })
            })
        );
        // Apply revocations to the primary key
        for (const result of revocationLogsPromises) {
            if (result.status === 'fulfilled') {
                for (const revokedKey of result.value) {
                    copyPk = await copyPk.update(revokedKey);
                }
            } else {
                // Should not happen as errors are caught per log - but just in case
                throw new Web3PGPServiceCriticalError(`A fatal error occurred while processing revocation logs from the blockchain: ${result.reason}`);
            }
        }
        // Return the updated primary key with revocations applied
        console.debug(`[Web3PGP - Service] Successfully applied revocations to key ${normalizedFingerprint} and its subkeys`);
        return copyPk;
    }

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
    public searchKeyEvents(
        fromBlock?: BlockTag | bigint,
        toBlock?: BlockTag | bigint,
    ): Promise<(KeyRegisteredLog | SubkeyAddedLog | KeyRevokedLog)[]>{
        return this.web3pgp.searchKeyEvents(fromBlock, toBlock);
    }
    
    /**
     * Get the current block number of the connected blockchain.
     * @return The current block number as a bigint.
     */
    public getBlockNumber(): Promise<bigint> {
        return this.web3pgp.getBlockNumber();
    }
}


