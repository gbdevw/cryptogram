import { TransactionReceipt, toHex, toBytes } from 'viem';
import * as openpgp from 'openpgp';
import { IWeb3PGPService } from './web3pgp.service.interface';
import { IWeb3PGP } from './web3pgp.interface';
import { BYTES32_ZERO, to0x, toBytes32 } from '../utils/0xstr';
import { OpenPGPUtils } from '../utils/openpgp';
import { KeyRegisteredLog, KeyRevokedLog, SubkeyAddedLog } from './types/types';

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
    constructor(web3pgp: IWeb3PGP) {
        this.web3pgp = web3pgp;
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
        return this.web3pgp.register(
            toBytes32(to0x(key.getFingerprint())),
            key.subkeys.map(subkey => toBytes32(to0x(subkey.getFingerprint()))),
            toHex(key.toPublic().write())
        )
    }

    /**
     * Add a new subkey to an already registered primary key on the blockchain.
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
     */
    public async addSubkey(key: openpgp.PublicKey, subkeyFingerprint: `0x${string}`): Promise<TransactionReceipt> {
        // Sanitize the key to only include the primary key and the specified subkey
        const pk = OpenPGPUtils.sanitizeSubkey(key, subkeyFingerprint);
        // Publish the sanitized key
        return this.web3pgp.addSubkey(
            toBytes32(to0x(pk.getFingerprint())),
            toBytes32(to0x(subkeyFingerprint)),
            toHex(pk.toPublic().write())
        );
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
                throw new Error('The provided key does not contain a valid revocation signature.');
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
                throw new Error('The specified subkey does not contain a valid revocation signature.');
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
            const pk = OpenPGPUtils.sanitizePrimaryKey(revoked.publicKey);
            // Check the primary key is revoked
            if (await pk.isRevoked()) {
                // Publish the revoked primary key
                return this.web3pgp.revoke(normalizedFingerprint, toHex(pk.toPublic().write()));
            } else {
                throw new Error('The provided key does not contain a valid revocation signature.');
            }
        } else {
            // Must be a subkey
            const pk = OpenPGPUtils.sanitizeSubkey(revoked.publicKey, normalizedFingerprint);
            // Check subkey is revoked
            if (await OpenPGPUtils.isSubkeyRevoked(pk.subkeys[0]!, pk, revocationCheckDate)) {
                // Publish the subkey
                return this.web3pgp.revoke(normalizedFingerprint, toHex(pk.write()));
            } else {
                throw new Error('The specified subkey does not contain a valid revocation signature.');
            }
        }
    }

    /*****************************************************************************************************************/
    /* LOG VALIDATION AND EXTRACTION FUNCTIONS                                                                       */
    /*****************************************************************************************************************/

    /**
     * Validate and extract the public key from the KeyRegisteredLog.
     * 
     * @description This method validates the data contained in a KeyRegisteredLog event
     * and extracts the corresponding OpenPGP public key. It ensures that the log data
     * is well-formed and that the extracted key matches the declared fingerprint.
     * 
     * @param log The KeyRegisteredLog event data from the blockchain 
     * @returns The validated OpenPGP public key
     * 
     * @throws Web3PGPServiceValidationError if the log data is invalid or missing required fields
     * @throws Web3PGPServiceValidationError if the extracted OpenPGP message is invalid or corrupted
     * @throws Web3PGPServiceValidationError if the primary key fingerprint does not match the log data
     * @throws Web3PGPServiceValidationError if any declared subkey is missing from the extracted key
     */
    public async extractFromKeyRegisteredLog(log: KeyRegisteredLog): Promise<openpgp.PublicKey> {
        try {
            // Validate required data are present
            if (!log.openPGPMsg || !log.primaryKeyFingerprint) {
                throw new Web3PGPServiceValidationError(`The KeyRegisteredLog event is missing the data needed to extract and validate the public key.`);
            }
            // Read and verify the primary key using the hex-encoded binary openPGP message from the log data
            const primaryKey = await openpgp.readKey({ binaryKey: toBytes(log.openPGPMsg) });
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
     * Validate and extract the subkey from the SubkeyAddedLog.
     * 
     * @param log The SubkeyAddedLog event data from the blockchain
     * @returns The validated OpenPGP public key containing the primary key and the added subkey.
     * @throws Web3PGPServiceValidationError if the log data is invalid or missing required fields
     * @throws Web3PGPServiceValidationError if the extracted OpenPGP message is invalid or corrupted
     * @throws Web3PGPServiceValidationError if the primary key fingerprint does not match the log data
     * @throws Web3PGPServiceValidationError if the subkey is missing from the extracted key
     * 
     * @example
     * ```typescript
     * const subkey = await service.extractFromSubkeyAddedLog(log);
     * pk = await pk.update(subkey);
     * ```
     */
    public async extractFromSubkeyAddedLog(log: SubkeyAddedLog): Promise<openpgp.PublicKey> {
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
                pk = OpenPGPUtils.sanitizeSubkey(pk, log.subkeyFingerprint);
            } catch (err) {
                throw new Web3PGPServiceValidationError(`Failed to read and sanitize the OpenPGP message for subkey with fingerprint ${log.subkeyFingerprint} from SubkeyAddedLog event: ${err}`);
            }
            // Validate the primary key fingerprint matches the declared one
            if (toBytes32(to0x(pk.getFingerprint())) !== toBytes32(to0x(log.primaryKeyFingerprint))) {
                throw new Web3PGPServiceValidationError(`The primary key fingerprint ${pk.getFingerprint()} does not match the declared primary key fingerprint ${log.primaryKeyFingerprint} in SubkeyAddedLog event.`);
            }
            console.debug(`[Web3PGP - Service] Successfully extracted subkey ${log.subkeyFingerprint} for primary key ${log.primaryKeyFingerprint} from SubkeyAddedLog event`);
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
     * Validate and extract the revoked key or revocation certificate from the KeyRevokedLog. In case of a key certificate, the functioon validates it effectively revokes the key or subkey.

     * @param log The KeyRevokedLog event data from the blockchain 
     * @returns A tuple containing either the revoked OpenPGP public key (if a key certificate was provided) or undefined, and either the armored revocation certificate (if provided) or undefined.
     * @throws Web3PGPServiceValidationError if the log data is invalid or missing required fields
     * @throws Web3PGPServiceValidationError if the extracted OpenPGP message is invalid or corrupted
     * @throws Web3PGPServiceValidationError if the key certificate does not effectively revoke the target key or subkey
     * 
     * @example
     * ```typescript
     * const [revokedKey, revocationCert] = await service.extractFromKeyRevokedLog(log);
     * if (revokedKey) {
     *   pk = await pk.update(revokedKey);
     * } else if (revocationCert) {
     *   pk = await openpgp.revokeKey({ key: pk, revocationCertificate: revocationCert, format: 'object' });
     * }
     * ```
     */
    public async extractFromKeyRevokedLog(log: KeyRevokedLog): Promise<[openpgp.PublicKey | undefined, string | undefined]> {
        try {
            // Validate required data are present
            if (!log.fingerprint || !log.revocationCertificate) {
                throw new Web3PGPServiceValidationError(`The KeyRevokedLog event is missing the data needed to extract and validate the revocation.`);
            }
            try {
                // Try to parse the revocation certificate as a key certificate
                const revokedKey = await openpgp.readKey({ armoredKey: log.revocationCertificate });
                // Check the fingerprint matches either the primary key or a subkey
                if (toBytes32(to0x(revokedKey.getFingerprint())) === toBytes32(to0x(log.fingerprint))) {
                    // Sanitize primary key
                    const pk = await OpenPGPUtils.sanitizePrimaryKey(revokedKey);
                    // Check the primary key is revoked
                    if (!await pk.isRevoked()) {
                        throw new Web3PGPServiceValidationError(`The primary key with fingerprint ${pk.getFingerprint()} is not revoked as expected in the KeyRevokedLog event.`);
                    }
                    // Return the revoked key and no standalone revocation certificate
                    console.debug(`[Web3PGP - Service] Successfully extracted revoked primary key ${log.fingerprint} from KeyRevokedLog event`);
                    return [pk.toPublic(), undefined];
                } else {
                    // Sanitize to keep only the target subkey - Will throw an error if not found
                    const pk = await OpenPGPUtils.sanitizeSubkey(revokedKey, log.fingerprint);
                    // Check subkey is revoked
                    if (!await OpenPGPUtils.isSubkeyRevoked(pk.subkeys[0]!, pk)) {
                        throw new Web3PGPServiceValidationError(`The subkey with fingerprint ${log.fingerprint} is not revoked as expected in the KeyRevokedLog event.`);
                    }
                    // Return the revoked key and no standalone revocation certificate
                    console.debug(`[Web3PGP - Service] Successfully extracted revoked subkey ${log.fingerprint} from KeyRevokedLog event`);
                    return [pk.toPublic(), undefined];
                }
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
            throw new Error(`The key with fingerprint ${fingerprint} is not registered on-chain.`);
        }

        console.debug(`[Web3PGP - Service] Key ${normalizedFingerprint} published at block ${publicationBlockNumber}, parent: ${parentFingerprint}`);

        // 2. Get the primary key and verify it
        let primaryKey: openpgp.PublicKey;
        if (parentFingerprint !== BYTES32_ZERO) {
            // This is a subkey, retrieve the parent key first
            console.debug(`[Web3PGP - Service] Key ${normalizedFingerprint} is a subkey, retrieving parent key first`);
            primaryKey = await this.getPublicKey(parentFingerprint);
        } else {
            // This is a primary key - download it from chain
            console.debug(`[Web3PGP - Service] Key ${normalizedFingerprint} is a primary key, downloading from chain`);
            primaryKey = await this.getPrimaryPublicKey(normalizedFingerprint, publicationBlockNumber);
        }

        // 3. Import all the subkeys registered under this primary key
        console.debug(`[Web3PGP - Service] Importing added subkeys for primary key ${primaryKey.getFingerprint()}`);
        primaryKey = await this.importAddedSubkeys(primaryKey);

        // 4. Import and apply revocation certificates to the key and its subkeys
        console.debug(`[Web3PGP - Service] Importing and applying revocations for primary key ${primaryKey.getFingerprint()}`);
        primaryKey = await this.importAndApplyRevocations(primaryKey);

        // 5. Return the reconstructed public key
        console.debug(`[Web3PGP - Service] Successfully retrieved and reconstructed public key ${normalizedFingerprint}`);
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
        const declaredSubkeys = await this.fetchAllPaginated(
            (start, limit) => this.web3pgp.listSubkeys(normalizedFingerprint, start, limit)
        );
        
        // Remove subkeys from declaredSubkeys that are already in primaryKey
        const existingSubkeyFingerprints = new Set(primaryKey.subkeys.map(sk => toBytes32(to0x(sk.getFingerprint()))));
        const subkeysToImport = declaredSubkeys.filter(skFp => !existingSubkeyFingerprints.has(skFp));
        
        // Get the list of block numbers where the remaining subkeys were added
        console.debug(`[Web3PGP - Service] Listing block numbers with subkeys added to primary key ${normalizedFingerprint}`);
        const subkeyBlockNumbers = await this.web3pgp.getKeyPublicationBlockBatch(subkeysToImport);
        // Merge both arrays to create tuples of (subkeyFingerprint, blockNumber)
        const subkeysWithBlocks: Array<{ subkeyFingerprint: `0x${string}`, blockNumber: bigint }> = subkeysToImport.map((skFp, index) => ({
            subkeyFingerprint: skFp,
            blockNumber: subkeyBlockNumbers[index]!
        }));
        // Import and verify each subkey
        console.debug(`[Web3PGP - Service] Importing ${subkeysToImport.length} subkeys for primary key ${normalizedFingerprint}`);
        const importedSubkeys = await Promise.allSettled(subkeysWithBlocks.map(async ({ subkeyFingerprint, blockNumber }) => {
            // Retrieve the subkey data from the blockchain
            console.debug(`[Web3PGP - Service] Fetching SubkeyAdded log for subkey ${subkeyFingerprint} at block ${blockNumber}`);
            const subkeyData = await this.web3pgp.getSubkeyAddedLog(normalizedFingerprint, subkeyFingerprint, blockNumber);
            // Extract and validate the subkey
            const subkey = await this.extractFromSubkeyAddedLog(subkeyData);
            return subkey.toPublic();
        }));
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
        console.debug(`[Web3PGP - Service] Successfully imported ${subkeysToImport.length} subkeys for ${normalizedFingerprint}`);
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
        console.debug(`[Web3PGP - Service] Checking revocations for key ${normalizedFingerprint} and its ${allFingerprints.length - 1} subkeys`);
        const revocationBlocksPromises = Promise.allSettled(allFingerprints.map(async (fp) => {
            return this.fetchAllPaginated(
                (start, limit) => this.web3pgp.listRevocations(fp, start, limit)
            );
        }));
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
        const revocationLogsPromises = await Promise.allSettled(uniqueRevocationBlocks.map(async (blockNumber) => {
            // Search for revocation logs in this block for all fingerprints
            console.debug(`[Web3PGP - Service] Fetching KeyRevoked logs for fingerprints at block ${blockNumber}`);
            const revocationLog = await this.web3pgp.searchKeyRevokedLogs(allFingerprints, blockNumber, blockNumber);
            // Extract the key/certificate from each log
            let validRevokedKeys: openpgp.PublicKey[] = [];
            for (const log of revocationLog) {
                try {
                    console.debug(`[Web3PGP - Service] Processing revocation log for fingerprint ${log.fingerprint} at block ${blockNumber}`);
                    const [revokedKey, cert] = await this.extractFromKeyRevokedLog(log); 
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
        }));
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
        console.debug(`[Web3PGP - Service] Successfully applied revocations for ${normalizedFingerprint}`);
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
}


