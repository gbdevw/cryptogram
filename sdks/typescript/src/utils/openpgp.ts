import * as openpgp from 'openpgp';
import { to0x, toBytes32 } from './0xstr';

/**
 * Utility functions for OpenPGP operations
 */
export class OpenPGPUtils {

    /**
     * Prepare a primary key for blockchain publication by creating a copy of its without
     * private key material and subkeys. The resulting certificate contains only the primary
     * key with its user IDs for identity verification.
     *
     * Can also be used to sanitize certificates retrieved from blockchain: The smart contract
     * only validates fingerprint uniqueness but not OpenPGP certificate validity and content. 
     *
     * @param key The key to prepare (can be private or public)
     * @returns A sanitized primary key certificate ready for blockchain storage
     */
    static sanitizePrimaryKey(key: openpgp.Key): openpgp.Key {
        // Create a copy of the public key and remove subkeys
        const publicKey = key.toPublic();
        publicKey.subkeys = [];
        return publicKey;
    }

    /**
     * Prepare a specific subkey for blockchain publication by isolating it and removing
     * user IDs to prevent identity collisions.
     *
     * The resulting certificate contains the primary key (for signature verification
     * interoperability) plus exactly one subkey. User IDs are removed to avoid
     * conflicts with the primary key certificate stored separately.
     *
     * This creates a "subkey certificate" that can be combined with the primary
     * key certificate using key.update() for full key reconstruction.
     *
     * Can also be used to sanitize certificates retrieved from blockchain for security,
     * as the smart contract only validates fingerprint uniqueness but not OpenPGP
     * certificate validity. While cryptographic verification of subkeys provides
     * inherent security, this sanitization ensures clean certificate reconstruction.
     *
     * @param key The key containing the target subkey
     * @param fingerprint The subkey fingerprint that will be padded (bytes32 format, with or without 0x prefix)
     * @returns A sanitized subkey certificate ready for blockchain storage
     * @throws - Error if the specified subkey fingerprint is not found
     */
    static sanitizeSubkey(key: openpgp.Key, fingerprint: `0x${string}`): openpgp.Key {
        // Convert and validate fingerprint format
        const targetFingerprint = toBytes32(to0x(fingerprint));

        // Create a copy of the public key
        const publicKey = key.toPublic();

        // Find target subkey
        const targetSubkey = publicKey.subkeys.find(
            sub => toBytes32(to0x(sub.getFingerprint())) === targetFingerprint
        );

        if (!targetSubkey) {
            throw new Error(`No subkey with fingerprint ${fingerprint} found in the provided key`);
        }

        // Keep only the target subkey and remove user IDs to prevent identity collision
        publicKey.subkeys = [targetSubkey];
        publicKey.users = [];
        return publicKey;
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

        // Check if subkey belongs to the primary key
        if (primaryKey.getFingerprint() !== sub.mainKey.getFingerprint()) {
            throw new Error('The provided primary key does not own the specified subkey');
        }

        // Check if the primary key is revoked
        if (await primaryKey.isRevoked(undefined, undefined, date)) {
            return true; // Subkey is revoked because primary is revoked
        }

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
                    primaryPublicKey.keyPacket,        // verification key
                    openpgp.enums.signature.subkeyRevocation,  // signature type
                    sub.keyPacket,           // signed data (the subkey)
                    date                     // verification date
                );

                // If verification succeeds without throwing, the subkey is revoked
                return true;

            } catch (error) {
                // Signature verification failed, try next one
                continue;
            }
        }

        // No valid revocation signature found, subkey is not revoked
        return false;
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

