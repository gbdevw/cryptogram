import * as openpgp from 'openpgp';
import * as pLimit from 'p-limit';

/**
 * Result of verifying a revocation certificate.
 */
export interface RevocationVerificationResult {
    /** Whether the revocation certificate is valid */
    isValid: boolean;
    /** Fingerprint of the key being revoked (empty string if invalid) */
    revokedKeyFingerprint: string;
    /** Reason why the verification is invalid (empty string if valid) */
    invalidReason: string;
}

/**
 * Utility functions for OpenPGP operations
 */
export class OpenPGPUtils {

    /**
     * Sanitize a primary key and prepare it for publication by removing any private key material
     * and removing all subkeys.
     * 
     * @param key The public key to sanitize
     * @returns The sanitized public key ready for publication
     */
    static sanitizePrimaryKey(key: openpgp.Key): openpgp.Key {
        // Create a copy of the public key material and remove subkeys
        const copy = key.toPublic();
        copy.subkeys = [];
        return copy;
    }

    /**
     * Check if a subkey is revoked by verifying its revocation certificates.
     *
     * @param sub The subkey to check
     * @param primaryKey The primary key that may have issued the revocation
     * @param date The date to check against (defaults to now)
     * 
     * @returns True if the subkey is revoked, false otherwise
     */
    static async isSubkeyRevoked(sub: openpgp.Subkey, primaryKey: openpgp.Key, date: Date = new Date()): Promise<boolean> {
        // Check if subkey has revocation signatures
        if (sub.revocationSignatures.length === 0) {
            return false;
        }

        // Get the primary key's public key for verification
        const primaryPublicKey = primaryKey.toPublic();

        // Verify each revocation signature
        for (const revocationSig of sub.revocationSignatures) {
            try {
                // Verify the revocation signature
                // OpenPGP.js signature verification requires signature type and other parameters
                await revocationSig.verify(
                    sub.keyPacket,           // signed data (the subkey)
                    openpgp.enums.signature.subkeyRevocation,  // signature type
                    primaryPublicKey,        // verification key
                    date                     // verification date
                );

                // If verification succeeds without throwing, the subkey is revoked
                return true;

            } catch (error) {
                // Signature verification failed, try next one
                continue;
            }
        }

        return false;
    }

    /**
     * Verify a standalone key revocation certificate.
     *
     * @param primaryKey The primary key that should have issued the revocation
     * @param signaturePacket The signature packet containing the revocation certificate
     * @param date The date to check against for signature validity
     * @returns Array of verification results for all signature packets
     */
    static async verifyRevocationCertificate(
        primaryKey: openpgp.Key,
        signaturePacket: openpgp.Signature,
        date: Date
    ): Promise<RevocationVerificationResult[]> {
        // Limit concurrency to 3 simultaneous signature verifications
        const limit = pLimit(3);

        // Get the primary key's public key for verification
        const primaryPublicKey = primaryKey.toPublic();

        // Create verification tasks for each signature packet
        const verificationTasks = signaturePacket.packets.map((sigPacket) =>
            limit(async (): Promise<RevocationVerificationResult> => {
                try {
                    const sigType = sigPacket.signatureType;

                    if (sigType === openpgp.enums.signature.keyRevocation) {
                        // Primary key revocation
                        const fingerprint = primaryKey.getFingerprint();

                        // Verify the signature against the primary key
                        await sigPacket.verify(
                            primaryKey.keyPacket,
                            sigType,
                            primaryPublicKey,
                            date
                        );

                        return { isValid: true, revokedKeyFingerprint: fingerprint, invalidReason: '' };

                    } else if (sigType === openpgp.enums.signature.subkeyRevocation) {
                        // Subkey revocation - the signature is made over the subkey's key material
                        // We need to find which subkey by trying to verify against each subkey
                        const subkeys = primaryKey.getSubkeys();

                        for (const subkey of subkeys) {
                            try {
                                // Try to verify the signature against this subkey's key material
                                await sigPacket.verify(
                                    subkey.keyPacket,
                                    sigType,
                                    primaryPublicKey,
                                    date
                                );

                                // If verification succeeds, this is the revoked subkey
                                return { isValid: true, revokedKeyFingerprint: subkey.getFingerprint(), invalidReason: '' };
                            } catch (error) {
                                // This subkey doesn't match, try the next one
                                continue;
                            }
                        }

                        // No matching subkey found
                        return { isValid: false, revokedKeyFingerprint: '', invalidReason: 'no matching subkey found' };

                    } else {
                        // Unsupported revocation type
                        return { isValid: false, revokedKeyFingerprint: '', invalidReason: 'unsupported revocation type' };
                    }

                } catch (error) {
                    // Verification failed for this packet
                    return { isValid: false, revokedKeyFingerprint: '', invalidReason: 'signature verification failed' };
                }
            })
        );

        // Execute all verification tasks and collect results
        const settledResults = await Promise.allSettled(verificationTasks);

        // Extract the actual results, flattening any nested arrays
        const results: RevocationVerificationResult[] = settledResults.map((result) => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                // If the task itself failed (shouldn't happen with our try/catch, but just in case)
                return { isValid: false, revokedKeyFingerprint: '', invalidReason: 'task execution failed' };
            }
        });

        return results;
    }

    /**
     * Check if a key contains private key material, including subkeys.
     * This checks for the presence of private keys regardless of whether the primary key
     * has private material or only subkeys do.
     * 
     * @param key The key to check
     * @returns True if the key or any subkey contains private key material, false otherwise
     */
    static containsPrivateKeyMaterial(key: openpgp.Key): boolean {
        if (key.isPrivate()) {
            return true;
        } else {
            for (const subkey of key.getSubkeys()) {
                if (subkey.keyPacket instanceof openpgp.SecretSubkeyPacket) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * List all fingerprints of keys that contain private key material.
     * Includes the primary key if it has private material, and any subkeys with private material.
     * 
     * @param key The key to analyze
     * @returns Array of fingerprints for keys containing private material
     */
    static listPrivateKeyFingerprints(key: openpgp.Key): string[] {
        const fingerprints: string[] = [];

        // Check primary key
        if (key.isPrivate()) {
            fingerprints.push(key.getFingerprint());
        }

        // Check subkeys
        for (const subkey of key.getSubkeys()) {
            if (subkey.keyPacket instanceof openpgp.SecretSubkeyPacket) {
                fingerprints.push(subkey.getFingerprint());
            }
        }

        return fingerprints;
    }

    /**
     * List all fingerprints of a key, including subkeys
     * 
     * @param key The key to list fingerprints from
     * @returns An array of fingerprints
     */
    static listAllFingerprints(key: openpgp.Key): string[] {
        return [key.getFingerprint(), ...key.getSubkeys().map(sub => sub.getFingerprint())];
    }
}

