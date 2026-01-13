import { TransactionReceipt, toHex, toBytes, BlockTag } from 'viem';
import * as openpgp from 'openpgp';
import { IWeb3PGPService } from './web3pgp.service.interface';
import { IWeb3PGP } from './web3pgp.interface';
import { BYTES32_ZERO, to0x, toBytes32 } from '../utils/0xstr';
import { OpenPGPUtils } from '../utils/openpgp';
import { KeyCertificationRevokedLog, KeyCertifiedLog, KeyRegisteredLog, KeyRevokedLog, KeyUpdatedLog, OwnershipProvedLog, SubkeyAddedLog, Web3PGPEventLog, Web3PGPEvents } from './types/types';
import pLimit from 'p-limit';
import { PacketList } from 'openpgp';

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
    /* WRITE OPERATIONS                                                                                              */
    /*****************************************************************************************************************/

    /**
     * Register a new OpenPGP public key (primary key with optional subkeys) on the blockchain.
     * 
     * @description
     * This method:
     * 1. Verifies the provided public key and subkeys have a valid signature, are not expired and not revoked.
     * 2. Extracts the primary key fingerprint and subkey fingerprints
     * 3. Ensures the key and its subkeys are not registered on-chain (enforced by smart contract).
     * 4. Serializes the key into the OpenPGP binary format.
     * 5. Registers the key on-chain via the Web3PGP contract
     * 
     * @param key The OpenPGP public key to register (may include subkeys)
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
    public async update(key: openpgp.PublicKey): Promise<TransactionReceipt> {
        try {
            // Remove extra subkey
            const pk = await OpenPGPUtils.sanitizePrimaryKey(key);
            // Verify the key
            await OpenPGPUtils.verifyKey(key, new Date());
            // Publish the updated key
            return this.web3pgp.update(
                toBytes32(to0x(pk.getFingerprint())),
                toHex(pk.toPublic().write())
            );
        } catch (err) {
            // Wrap and rethrow errors
            throw new Web3PGPServiceError(`Failed to update the OpenPGP key: ${err}`);
        }
    }

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
    public async addSubkey(key: openpgp.PublicKey, subkeyFingerprint: `0x${string}`): Promise<TransactionReceipt> {
        try {
            // Sanitize the key to only include the primary key and the specified subkey
            const pk = await OpenPGPUtils.sanitizeSubkey(key, subkeyFingerprint);
            const sk = pk.getSubkeys()[0];
            const now = new Date();
            // Verify the sanitized key
            await OpenPGPUtils.verifyKey(pk, now);
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
    public async revoke(keyOrCertificate: openpgp.PublicKey | string, fingerprint: `0x${string}`): Promise<TransactionReceipt> {
        if (typeof keyOrCertificate === 'string') {
            return this.revokeWithCertificate(keyOrCertificate, fingerprint);
        } else {
            return this.revokeWithKey(keyOrCertificate, fingerprint);
        }
    }

    /**
     * Revoke a key or subkey using a key object containing the revocation signature.
     * 
     * The method will verify the target key or subkey, identified by the provided fingerprint, is indeed revoked
     * in the key object at the present time and publish the revoked key on-chain.
     * 
     * @param key The OpenPGP public key containing the revocation signature 
     * @param fingerprint The fingerprint of the key being revoked
     * @returns Transaction receipt after successful revocation publication
     */
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

    /**
     * Revoke a key or subkey using a standalone revocation certificate.
     * 
     * The method will download and verify the public key from the blockchain using the provided fingerprint as ID,
     * apply the revocation certificate, verify the key is revoked at present time and publish the revoked key on-chain.
     * 
     * @param certificate The armored revocation certificate
     * @param fingerprint The fingerprint of the key being revoked
     * @returns Transaction receipt after successful revocation publication
     */
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

    /**
     * Initiate a challenge to prove ownership of an OpenPGP key registered on-chain.
     * 
     * This method submits a hash of a random challenge generated by the user to the blockchain. The owner
     * of the private key corresponding to the public key must later sign the original challenge off-chain
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
    public async challengeOwnership(fingerprint: `0x${string}`, challengeHash: `0x${string}`): Promise<TransactionReceipt> {
        return this.web3pgp.challengeOwnership(fingerprint, challengeHash);
    }

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
    public async proveOwnership(fingerprint: `0x${string}`, challengeHash: `0x${string}`, signature: openpgp.Signature): Promise<TransactionReceipt> {
        try {
            // Fetch the public key from the blockchain
            const publicKey = await this.getPublicKey(fingerprint);
            // Verify the signature of the challenge hash
            const verificationResult = await openpgp.verify({
                message: await openpgp.createMessage({ binary: toBytes(challengeHash) }),
                verificationKeys: publicKey,
                signature: signature,
            });
            let isValid = false;
            for (const sig of verificationResult.signatures) {
                try {
                    await sig.verified;
                    isValid = true;
                    break;
                } catch (e) {
                    // Invalid signature - Loop to check next signature
                    console.debug(`[WEB3PGP SERVICE] Invalid ownership proof signature found and skipped: ${e}`);
                }
            }
            if (!isValid) {
                throw new Web3PGPServiceValidationError('The provided signature is invalid.');
            }
            // Submit the ownership proof on-chain
            return this.web3pgp.proveOwnership(fingerprint, challengeHash, toHex(signature.write()));
        } catch (err) {
            // Wrap and rethrow errors
            throw new Web3PGPServiceError(`Failed to prove ownership of the OpenPGP key: ${err}`);
        }
    }

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
    public async certify(issuer: openpgp.PublicKey, certifiedKey: openpgp.PublicKey): Promise<TransactionReceipt> {
        try {
            // 1. Sanity Check
            if (issuer.getFingerprint() === certifiedKey.getFingerprint()) {
                throw new Web3PGPServiceValidationError('The issuer key must be different from the certified key.');
            }

            // 2. Remove extra subkeys
            const pk = await OpenPGPUtils.sanitizePrimaryKey(certifiedKey);

            // 3. Keep only valid certifications made by the issuer
            let hasValidCertification = false;
            for (const user of pk.users) {
                // Verify each certification signature using the issuer public key
                console.debug(`[WEB3PGP SERVICE] Verifying ${user.otherCertifications.length} certifications for user ID "${user.userID?.toString()}"...`);
                const validCertifications: openpgp.SignaturePacket[] = [];
                for (const cert of user.otherCertifications) {
                    try {
                        console.debug(`[WEB3PGP SERVICE] Verifying certification made by ${cert.issuerFingerprint ? toHex(cert.issuerFingerprint) : cert.issuerKeyID.toHex()}...`);
                        const verified = await user.verifyCertificate(cert, [issuer]);
                        if (verified) {
                            validCertifications.push(cert);
                            hasValidCertification = true;
                        } else {
                            console.debug(`[WEB3PGP SERVICE] Invalid certification signature found and skipped.`);
                        }
                    } catch (e) {
                        console.debug(`[WEB3PGP SERVICE] Invalid certification signature found and skipped: ${e}`);
                    }
                }

                // C. Update the user with only valid certifications
                user.otherCertifications = validCertifications;
            }

            if (!hasValidCertification) {
                throw new Web3PGPServiceValidationError('The certified key does not contain a valid certification signature made by the issuer.');
            }

            // 4. Filter out users without valid certifications
            pk.users = pk.users.filter(user => user.otherCertifications.length > 0);

            // 5. Publication
            return this.web3pgp.certifyKey(
                toBytes32(to0x(pk.getFingerprint())),
                toBytes32(to0x(issuer.getFingerprint())),
                toHex(pk.toPublic().write())
            );

        } catch (err) {
            throw new Web3PGPServiceError(`Failed to certify the OpenPGP key: ${err}`);
        }
    }

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
    public async revokeCertification(issuer: openpgp.PublicKey, keyWithRevokedCertification: openpgp.PublicKey): Promise<TransactionReceipt> {
        try {
            // 1. Sanity Check
            if (issuer.getFingerprint() === keyWithRevokedCertification.getFingerprint()) {
                throw new Web3PGPServiceValidationError('Issuer must be different from the target key.');
            }
            const now = new Date();
            const pk = await OpenPGPUtils.sanitizePrimaryKey(keyWithRevokedCertification); 
            pk.users = keyWithRevokedCertification.users; 
            // BUGFIX - TODO: Deep copy users as serializing/deserializing lose some context needed for verification
            // but modifying the users have side effect on the original key


            // 2. Keep only valid revocation signatures made by the issuer (there may be multiple users and certifications)
            let hasValidRevocation = false;
            for (const user of pk.users) {
                // Verify each certification signature using the issuer public key
                console.debug(`[WEB3PGP SERVICE] Verifying ${user.revocationSignatures.length}  revocation signatures for user ID "${user.userID?.toString()}"...`);
                const revokedCertifications: openpgp.SignaturePacket[] = [];
                const validRevocations: openpgp.SignaturePacket[] = [];
                for (const revSig of user.revocationSignatures) {
                    try {
                        // Find the key packets needed for verification
                        //
                        // Although revocation signatures are normally made with the issuer's primary key,
                        // OpenPGP allows using any key of the issuer, so we must find the correct one.
                        const issuerKeyPacket = issuer.getKeys().find(k => k.getKeyID().equals(revSig.issuerKeyID));
                        if (!issuerKeyPacket) {
                            throw new Web3PGPServiceValidationError(`Issuer key packet with Key ID ${revSig.issuerKeyID.toHex()} not found in issuer key.`);
                        }
                        console.debug(`[WEB3PGP SERVICE] Verifying revocation signature made by ${revSig.issuerFingerprint ? toHex(revSig.issuerFingerprint) : revSig.issuerKeyID.toHex()}...`);
                        await revSig.verify(
                            issuerKeyPacket.keyPacket, 
                            revSig.signatureType ?? openpgp.enums.signature.certRevocation,
                            {
                                key: keyWithRevokedCertification.keyPacket,
                                userId: user.userID,
                                userAttribute: user.userAttribute
                            },
                            now,
                        );
                        console.debug(`[WEB3PGP SERVICE] Valid revocation signature found.`);
                        validRevocations.push(revSig);
                        hasValidRevocation = true;
                    } catch (e) {
                        console.debug(`[WEB3PGP SERVICE] Invalid revocation signature found and skipped: ${e}`);
                        continue;
                    }
                }
                // Find all certifications being revoked. Use the creation date of the revocation signature as upper bound.
                for (const cert of user.otherCertifications) {
                    for (const revSig of validRevocations) {
                        if (cert.issuerKeyID.equals(revSig.issuerKeyID)) {
                            // Mark the certification as revoked if one of the revocation signatures was created after the certification
                            cert.revoked = cert.revoked || (cert.created || now) <= (revSig.created || now);
                            if (cert.revoked) {
                                revokedCertifications.push(cert);
                                break; // No need to check other revocation signatures
                            }
                        }   
                    }
                }
                
                // C. Update the user with only valid revocations and remove revoked certifications
                user.revocationSignatures = validRevocations;
                user.otherCertifications = revokedCertifications;
            }
            if (!hasValidRevocation) {
                throw new Web3PGPServiceValidationError('No valid certification revocation signature made by the issuer was found on the target key.');
            }

            // 3. Publication
            return this.web3pgp.revokeCertification(
                toBytes32(to0x(pk.getFingerprint())),
                toBytes32(to0x(issuer.getFingerprint())),
                toHex(pk.toPublic().write())
            );
        } catch (err) {
            throw new Web3PGPServiceError(`Failed to revoke certification: ${err}`);
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
            // Read and verify the subkey using the hex-encoded binary openPGP message from the log data
            let pk: openpgp.Key;
            try {
                pk = await openpgp.readKey({ binaryKey: toBytes(log.openPGPMsg) });
                // Sanitize to only include primary key and the subkey
                pk = await OpenPGPUtils.sanitizeSubkey(pk, log.subkeyFingerprint);
                // Verify the sanitized key
                if (skipCryptographicVerifications !== true) {
                    await OpenPGPUtils.verifyKey(pk, log.blockTimestamp);
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
    public async extractFromKeyUpdatedLog(log: KeyUpdatedLog, skipCryptographicVerifications?: boolean): Promise<openpgp.PublicKey> {
        try {
            // Read the OpenPGP message using the hex-encoded binary openPGP message from the log data
            let pk = await openpgp.readKey({ binaryKey: toBytes(log.openPGPMsg) });
            const pkFp = toBytes32(to0x(pk.getFingerprint()));
            // Verify the fingerprint matches the declared one
            if (pkFp !== toBytes32(to0x(log.fingerprint))) {
                throw new Web3PGPServiceValidationError(`The fingerprint of the retrieved primary key ${pkFp} does not match the declared fingerprint in the KeyUpdatedLog event ${log.fingerprint}`);
            }
            // Remove extra subkeys
            pk = await OpenPGPUtils.sanitizePrimaryKey(pk);
            // Verify the key if needed
            if (skipCryptographicVerifications !== true) {
                await OpenPGPUtils.verifyKey(pk, log.blockTimestamp);
            }
            console.debug(`[Web3PGP - Service] Successfully extracted updated key ${pk.getFingerprint()} from KeyUpdatedLog event`);
            return pk.toPublic();
        } catch (err) {
            if (err instanceof Web3PGPServiceValidationError) {
                // Rethrow validation errors
                throw err;
            }
            // Wrap other errors
            throw new Web3PGPServiceValidationError(`Failed to extract the public key form the OpenPGP message in the KeyUpdatedLog event: ${err}`);
        }
    }

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
    public async extractFromKeyCertifiedLog(log: KeyCertifiedLog, skipCryptographicVerifications?: boolean): Promise<openpgp.PublicKey> {
        try {
            // Read the OpenPGP message using the hex-encoded binary openPGP message from the log data
            let pk = await openpgp.readKey({ binaryKey: toBytes(log.keyCertificate) });
            const pkFp = toBytes32(to0x(pk.getFingerprint()));
            
            // Verify the fingerprint matches the declared one
            if (pkFp !== toBytes32(to0x(log.fingerprint))) {
                throw new Web3PGPServiceValidationError(`The fingerprint of the retrieved primary key ${pkFp} does not match the declared fingerprint in the KeyCertifiedLog event ${log.fingerprint}`);
            }
            // Remove extra subkeys
            pk = await OpenPGPUtils.sanitizePrimaryKey(pk);
            // Remove certifications revocations
            pk.users.forEach(user => {
                user.revocationSignatures = [];
            })
            // Verify the key if needed
            //
            // Note: Certifications are not verified here as they will be verified by the caller when needed.
            // This avoids fetching the public key of the issuer multiple times if there are multiple certifications to verify.
            if (skipCryptographicVerifications !== true) {
                await OpenPGPUtils.verifyKey(pk, log.blockTimestamp);
            }
            console.debug(`[Web3PGP - Service] Successfully extracted updated key ${pk.getFingerprint()} from KeyUpdatedLog event`);
            return pk.toPublic();
        } catch (err) {
            if (err instanceof Web3PGPServiceValidationError) {
                // Rethrow validation errors
                throw err;
            }
            // Wrap other errors
            throw new Web3PGPServiceValidationError(`Failed to extract the public key form the OpenPGP message in the KeyUpdatedLog event: ${err}`);
        }
    }

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
    public async extractFromKeyCertificationRevokedLog(log: KeyCertificationRevokedLog, skipCryptographicVerifications?: boolean): Promise<openpgp.PublicKey> {
        try {
            // Read the OpenPGP message using the hex-encoded binary openPGP message from the log data
            let pk = await openpgp.readKey({ binaryKey: toBytes(log.revocationSignature) });
            const pkFp = toBytes32(to0x(pk.getFingerprint()));
            const issuerFp = toBytes32(to0x(log.issuerFingerprint));

            // Verify the fingerprint matches the declared one
            if (pkFp !== toBytes32(to0x(log.fingerprint))) {
                throw new Web3PGPServiceValidationError(`The fingerprint of the retrieved primary key ${pkFp} does not match the declared fingerprint in the KeyCertificationRevokedLog event ${log.fingerprint}`);
            }
            // Remove extra subkeys
            pk = await OpenPGPUtils.sanitizePrimaryKey(pk);
            // Verify the key if needed
            //
            // Note: Certifications and their revocations are not verified here as they will be verified by the caller when needed.
            // This avoids fetching the public key of the issuer multiple times if there are multiple certifications to verify.
            if (skipCryptographicVerifications !== true) {
                await OpenPGPUtils.verifyKey(pk, log.blockTimestamp);
            }
            console.debug(`[Web3PGP - Service] Successfully extracted updated key ${pk.getFingerprint()} from KeyUpdatedLog event`);
            return pk.toPublic();
        } catch (err) {
            if (err instanceof Web3PGPServiceValidationError) {
                // Rethrow validation errors
                throw err;
            }
            // Wrap other errors
            throw new Web3PGPServiceValidationError(`Failed to extract the public key form the OpenPGP message in the KeyUpdatedLog event: ${err}`);
        }
    }

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
    public async extractFromOwnershipProvedLog(log: OwnershipProvedLog): Promise<openpgp.Signature> {
        try {
            // Read the OpenPGP signature using the hex-encoded binary signature from the log data
            return openpgp.readSignature({ binarySignature: toBytes(log.signature) });
        } catch (err) {
            throw new Web3PGPServiceValidationError(`Failed to read the OpenPGP signature from the OwnershipProvedLog event: ${err}`);
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

        // 2. Determine if the target key is a primary key or a subkey
        if (parentFingerprint !== BYTES32_ZERO) {
            // This is a subkey, retrieve the parent key and return the reconstructed full key
            console.debug(`[Web3PGP - Service] Key ${normalizedFingerprint} is a subkey, retrieving parent key to reconstruct full key`);
            return await this.getPublicKey(parentFingerprint);
        }

        // 3. List all subkeys and their revocations (certifications and revocations are not handled because subkeys cannot be certified)
        const subkeys = await this.fetchAllPaginated((start, limit) => this.web3pgp.listSubkeys(normalizedFingerprint, start, limit));

        // 4. Use the target fingerprint to retrieve blocks with logs related to the primary key and its subkeys
        let blockNumbers = await Promise.all([
            this.web3pgp.getKeyPublicationBlockBatch(subkeys),
            this.fetchAllPaginated((start, limit) => this.web3pgp.listKeyUpdates(normalizedFingerprint, start, limit)),
            this.fetchAllPaginated((start, limit) => this.web3pgp.listRevocations(normalizedFingerprint, start, limit)),
            this.fetchAllPaginated((start, limit) => this.web3pgp.listCertifications(normalizedFingerprint, start, limit)),
            this.fetchAllPaginated((start, limit) => this.web3pgp.listCertificationRevocations(normalizedFingerprint, start, limit)),
            ...subkeys.map(subkeyFingerprint => 
                this.concurrencyLimit(() => 
                    this.fetchAllPaginated((start, limit) => 
                        this.web3pgp.listRevocations(subkeyFingerprint, start, limit)
                    )
                )
            )
        ]);

        // 5. Merge and deduplicate all block numbers with key events
        const rawBlocks = [publicationBlockNumber, ...blockNumbers.flat()];
        const uniqueBlocks = [...new Set(rawBlocks)].filter(b => b > 0n);

        // 6. Build a map of the expectations for each block to ensure data consistency
        const expectationsMap: Map<bigint, (logs: Web3PGPEventLog[]) => boolean> = new Map();
        
        for (const blockNumber of uniqueBlocks) {
            const isPublicationBlock = blockNumber === publicationBlockNumber;

            // 1. Calculate how many explicit 'SubkeyAdded' events are expected in this block.
            // We exclude subkeys from the publication block count here because they are implicitly 
            // included within the 'KeyRegistered' event, not emitted as separate 'SubkeyAdded' events.
            const subkeyAddedEventsExpected = blockNumbers[0].filter(b => b === blockNumber && b !== publicationBlockNumber).length;
            
            // 2. Calculate the total expected registration events (KeyRegistered + SubkeyAdded).
            // If this is the publication block, we MUST expect exactly 1 'KeyRegistered' event.
            // This prevents a race condition where an empty RPC response (0 events) would validate 
            // as correct against an expectation of 0 events.
            const totalRegistrationEventsExpected = subkeyAddedEventsExpected + (isPublicationBlock ? 1 : 0);

            // 3. Calculate expectations for other event types
            const KeyUpdatedExpected = blockNumbers[1].filter(b => b === blockNumber).length;
            
            // Initial count for primary key revocations
            let KeyRevokedExpected = blockNumbers[2].filter(b => b === blockNumber).length;
            
            const KeyCertifiedExpected = blockNumbers[3].filter(b => b === blockNumber).length;
            const KeyCertificationRevokedExpected = blockNumbers[4].filter(b => b === blockNumber).length;
            
            // Add expectations for subkey revocations (iterating through the rest of the batch)
            for (let i = 5; i < blockNumbers.length; i++) {
                KeyRevokedExpected += blockNumbers[i].filter((b: bigint) => b === blockNumber).length;
            }

            // Build the predicate function that validates if the retrieved logs match the expectations
            expectationsMap.set(blockNumber, (logs: Web3PGPEventLog[]) => {
                const counts = {
                    [Web3PGPEvents.KeyRegistered]: 0,
                    [Web3PGPEvents.SubkeyAdded]: 0,
                    [Web3PGPEvents.KeyUpdated]: 0,
                    [Web3PGPEvents.KeyRevoked]: 0,
                    [Web3PGPEvents.KeyCertified]: 0,
                    [Web3PGPEvents.KeyCertificationRevoked]: 0
                };
                
                // Count actual events received from RPC
                for (const log of logs) {
                    if (counts.hasOwnProperty(log.type)) {
                        counts[log.type as keyof typeof counts]++;
                    }
                }

                // Combine KeyRegistered and SubkeyAdded for comparison
                const keyRegisteredOrSubkeyAddedCount = counts[Web3PGPEvents.KeyRegistered] + counts[Web3PGPEvents.SubkeyAdded];

                // Strict equality check:
                // We use === to ensure we have exactly the number of events recorded in the smart contract state.
                // If the RPC is lagging and returns fewer events (or empty), this returns false and triggers a retry.
                return (
                    keyRegisteredOrSubkeyAddedCount === totalRegistrationEventsExpected &&
                    counts[Web3PGPEvents.KeyUpdated] === KeyUpdatedExpected &&
                    counts[Web3PGPEvents.KeyRevoked] === KeyRevokedExpected &&
                    counts[Web3PGPEvents.KeyCertified] === KeyCertifiedExpected &&
                    counts[Web3PGPEvents.KeyCertificationRevoked] === KeyCertificationRevokedExpected
                );
            });
        }

        // 7. Use the searchKeyEvents method to find all relevant logs until we satisfy the expectations for each block
        //
        // Note: We perform up to 3 attempts per block with exponential backoff in case the RPC returns incomplete data.
        // This can happen when writing data to the blockchain and then immediatly querying for events, especially on public RPCs.
        // Although the low level client waits for the transaction to be mined, the event indexer used by the RPC may still be lagging behind.
        // Furthermore, load balancing and network latency can cause inconsistent results across multiple requests. This is why we
        // use the data from the smart contract state (step 5) as the source of truth for the expected events.
        const logs = await Promise.all(
            uniqueBlocks.map(blockNumber => 
                this.concurrencyLimit(async () => {
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        console.debug(`[Web3PGP - Service] Searching for key events for block ${blockNumber}, attempt ${attempt}...`);
                        let logs = await this.web3pgp.searchKeyEvents([normalizedFingerprint, ...subkeys], blockNumber, blockNumber);
                        const validate = expectationsMap.get(blockNumber);
                        if (!validate) {
                            // This should never happen
                            throw new Web3PGPServiceCriticalError(`Missing expectations validator for block ${blockNumber}`);
                        }
                        if (validate(logs)) {
                            console.debug(`[Web3PGP - Service] Retrieved all (${logs.length}) expected logs for block ${blockNumber} after ${attempt} attempt(s)`);
                            return logs;
                        } else {
                            // Log and wait with an exponential backoff before retrying (start at 200ms)
                            const delay = 200 * Math.pow(2, attempt - 1);
                            console.debug(`[Web3PGP - Service] Retrieved logs for block ${blockNumber} do not match expectations on attempt ${attempt}. Retrying in ${delay}ms...`);
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    }
                    // If we reach here, all attempts failed
                    throw new Web3PGPServiceError(`Failed to retrieve expected logs for block ${blockNumber} after 3 attempts.`);
                })
            ) as Promise<Web3PGPEventLog[]>[]
        );

        // 8. Flatten and sort the logs array
        const flattenedLogs = logs
            .flat()
            .sort((a, b) => {
                // Sort by block (Safe BigInt comparison)
                if (a.blockNumber < b.blockNumber) return -1;
                if (a.blockNumber > b.blockNumber) return 1;
                
                // Sort by log index within the block (Safe BigInt comparison)
                if (a.logIndex < b.logIndex) return -1;
                if (a.logIndex > b.logIndex) return 1;
                
                return 0;
            });

        // 9. KeyRegisteredLog contains the primary key and should be the first log given we sorted them
        // and no other log can be emitted by the smart contract before that log
        if (flattenedLogs[0].type !== Web3PGPEvents.KeyRegistered) {
            throw new Web3PGPServiceError(
                `Invalid event sequence: Key history must start with KeyRegistered. Found ${flattenedLogs[0].type} at block ${flattenedLogs[0].blockNumber} - tx ${flattenedLogs[0].transactionHash}.`
            );
        }
        console.debug(`[Web3PGP - Service] Found KeyRegistered log for primary key ${normalizedFingerprint} at block ${flattenedLogs[0].blockNumber} - tx ${flattenedLogs[0].transactionHash}`);
        let primaryKey = await this.extractFromKeyRegisteredLog(flattenedLogs[0]);

        // 10. Iterate over the logs and reconstruct the key
        console.debug(`[Web3PGP - Service] Reconstructing primary key ${normalizedFingerprint} from ${flattenedLogs.length} logs`);
        const historyLogs = flattenedLogs.slice(1); // Exclude the first log (KeyRegistered)
        for (const log of historyLogs) {
            try {
                switch (log.type) {
                    case Web3PGPEvents.SubkeyAdded:
                        console.debug(`[Web3PGP - Service] Processing SubkeyAdded log for subkey ${log.subkeyFingerprint} at block ${log.blockNumber} - tx ${log.transactionHash}`);
                        const subkey = await this.extractFromSubkeyAddedLog(log);
                        primaryKey = await primaryKey.update(subkey, log.blockTimestamp);
                        break;
                    case Web3PGPEvents.KeyRevoked:
                        console.debug(`[Web3PGP - Service] Processing KeyRevoked log for fingerprint ${log.fingerprint} at block ${log.blockNumber} - tx ${log.transactionHash}`);
                        const [revokedKey, revocationCert] = await this.extractFromKeyRevokedLog(log);
                        if (revokedKey) {
                            primaryKey = await primaryKey.update(revokedKey, log.blockTimestamp);
                        } else if (revocationCert) {
                            try {
                                const result = await openpgp.revokeKey({ 
                                    key: primaryKey, 
                                    revocationCertificate: revocationCert,
                                    date: log.blockTimestamp,
                                    format: 'object'
                                });
                                
                                primaryKey = await primaryKey.update(result.publicKey, log.blockTimestamp);
                            } catch (err) {
                                // Wrap and throw error when the application of the revocation certificate fails because it does not match the key
                                throw new Web3PGPServiceValidationError(`Failed to apply standalone revocation certificate for key ${log.fingerprint} from KeyRevokedLog event: ${err}`);
                            }
                        }
                        break;
                    case Web3PGPEvents.KeyUpdated:
                        console.debug(`[Web3PGP - Service] Processing KeyUpdated log at block ${log.blockNumber} - tx ${log.transactionHash}`);
                        const updatedKey = await this.extractFromKeyUpdatedLog(log);
                        primaryKey = await primaryKey.update(updatedKey, log.blockTimestamp);
                        break;
                    case Web3PGPEvents.KeyCertified:
                        console.debug(`[Web3PGP - Service] Processing KeyCertified log at block ${log.blockNumber} - tx ${log.transactionHash}`);
                        const certifiedKey = await this.extractFromKeyCertifiedLog(log);
                        primaryKey = await primaryKey.update(certifiedKey, log.blockTimestamp);
                        break;
                    case Web3PGPEvents.KeyCertificationRevoked:
                        console.debug(`[Web3PGP - Service] Processing KeyCertificationRevoked log at block ${log.blockNumber} - tx ${log.transactionHash}`);
                        const certRevokedKey = await this.extractFromKeyCertificationRevokedLog(log);
                        primaryKey = await primaryKey.update(certRevokedKey, log.blockTimestamp);
                        break;
                    default:
                        // OwnershipChallenged and OwnershipProved logs are not relevant for key reconstruction
                        console.warn(`[Web3PGP - Service] Unused log type ${log.type} at block ${log.blockNumber} - tx ${log.transactionHash}`);
                        break;
                }
            } catch (err) {
                if (err instanceof Web3PGPServiceValidationError) {
                    console.warn(`[Web3PGP - Service] Failed to process log of type ${log.type} at block ${log.blockNumber} for key ${primaryKey.getFingerprint()}: ${err}`);
                } else {
                    // Rethrow other errors
                    throw err;
                }
            }      
        }

        // 11. Return the reconstructed public key
        console.debug(`[Web3PGP - Service] Successfully retrieved and reconstructed the public key`);
        return primaryKey;
    }

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
    public async searchKeyEvents(fingerprints?: `0x${string}` | `0x${string}`[], fromBlock?: BlockTag | bigint, toBlock?: BlockTag | bigint): Promise<Web3PGPEventLog[]> {
        return this.web3pgp.searchKeyEvents(fingerprints, fromBlock, toBlock);
    }
    
    /**
     * Get the current block number of the connected blockchain.
     * @return The current block number as a bigint.
     */
    public async getBlockNumber(): Promise<bigint> {
        return this.web3pgp.getBlockNumber();
    }

    /*****************************************************************************************************************/
    /* UTILITY FUNCTIONS                                                                                             */
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


