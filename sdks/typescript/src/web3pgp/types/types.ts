import { BaseLog } from "../../common/types/types";

/**
 * Type representing a KeyRegistered event log emitted by the Web3PGP smart contract.
 * 
 * This log contains technical details about the blockchain event as well as the data that were recorded on-chain.
 * The log data are not validated by the smart contract and must be verified by the client application using a
 * OpenPGP implementation.
 */
export type KeyRegisteredLog =  BaseLog & {
    // The declared fingerprint of the registered key as bytes32 hex string
    primaryKeyFingerprint: `0x${string}` | undefined;
    // The declared fingerprints of any subkeys associated with the registered key as bytes32 hex strings
    subkeyFingerprints: readonly `0x${string}`[] | undefined;
    // Hex-encoded OpenPGP binary message published on-chain which should contain the public key data
    openPGPMsg: `0x${string}` | undefined;
};

/**
 * Type representing a SubkeyAdded event log emitted by the Web3PGP smart contract.
 * 
 * This log contains technical details about the blockchain event as well as the data that were recorded on-chain.
 * The log data are not validated by the smart contract and must be verified by the client application using a
 * OpenPGP implementation.
 */
export type SubkeyAddedLog = BaseLog & {
    // The declared fingerprint of the primary key to which the subkey was added as bytes32 hex string
    primaryKeyFingerprint: `0x${string}` | undefined;
    // The declared fingerprint of the added subkey as bytes32 hex string
    subkeyFingerprint: `0x${string}` | undefined;
    // Hex-encoded OpenPGP binary message published on-chain which should contain the public key data
    openPGPMsg: `0x${string}` | undefined;
};

/**
 * Type representing a KeyRevoked event log emitted by the Web3PGP smart contract.
 * 
 * This log contains technical details about the blockchain event as well as the data that were recorded on-chain.
 * The log data are not validated by the smart contract and must be verified by the client application using a
 * OpenPGP implementation.
 */
export type KeyRevokedLog =  BaseLog & {
    // The declared fingerprint of the revoked key as bytes32 hex string
    fingerprint?: `0x${string}` | undefined;
    // Hex-encoded OpenPGP binary message published on-chain which should contain the revocation certificate
    revocationCertificate?: `0x${string}` | undefined;
};