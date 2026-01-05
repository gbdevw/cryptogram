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
    primaryKeyFingerprint: `0x${string}`;
    // The declared fingerprints of any subkeys associated with the registered key as bytes32 hex strings
    subkeyFingerprints: readonly `0x${string}`[];
    // Hex-encoded OpenPGP binary message published on-chain which should contain the public key data
    openPGPMsg: `0x${string}`;
};

export type KeyUpdatedLog = BaseLog & {
    // The declared fingerprint of the updated key as bytes32 hex string
    fingerprint: `0x${string}`;
    // Hex-encoded OpenPGP binary message published on-chain which should contain the updated public key data
    openPGPMsg: `0x${string}`;
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
    primaryKeyFingerprint: `0x${string}`;
    // The declared fingerprint of the added subkey as bytes32 hex string
    subkeyFingerprint: `0x${string}`;
    // Hex-encoded OpenPGP binary message published on-chain which should contain the public key data
    openPGPMsg: `0x${string}`;
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
    fingerprint?: `0x${string}`;
    // Hex-encoded OpenPGP binary message published on-chain which should contain the revocation certificate
    revocationCertificate?: `0x${string}`;
};

/**
 * Type representing a KeyCertified event log emitted by the Web3PGP smart contract.
 * 
 * This log contains technical details about the blockchain event as well as the data that were recorded on-chain.
 */
export type KeyCertifiedLog = BaseLog & {
    // The fingerprint of the certified key as bytes32 hex string
    fingerprint: `0x${string}`;
    // The fingerprint of the issuer that certified the key as bytes32 hex string
    issuerFingerprint: `0x${string}`;
    // Hex-encoded OpenPGP signature that constitutes the key certification
    keyCertificate: `0x${string}`;
};

/**
 * Type representing a KeyCertificationRevoked event log emitted by the Web3PGP smart contract.
 * 
 * This log contains technical details about the blockchain event as well as the data that were recorded on-chain.
 */
export type KeyCertificationRevokedLog = BaseLog & {
    // The fingerprint of the key whose certification was revoked as bytes32 hex string
    fingerprint: `0x${string}`;
    // The fingerprint of the issuer of the certification as bytes32 hex string
    issuerFingerprint: `0x${string}`;
    // Hex-encoded OpenPGP signature that constitutes the revocation
    revocationSignature: `0x${string}`;
};

/**
 * Type representing an OwnershipChallenged event log emitted by the Web3PGP smart contract.
 * 
 * This log contains technical details about the blockchain event as well as the data that were recorded on-chain.
 */
export type OwnershipChallengedLog = BaseLog & {
    // The fingerprint of the challenged key as bytes32 hex string
    fingerprint: `0x${string}`;
    // The challenge data sent to the key owner for signing as bytes32 hex string which is the keccak256 hash of a
    // random nonce
    challenge: `0x${string}`;
};

/**
 * Type representing an OwnershipProved event log emitted by the Web3PGP smart contract.
 * 
 * This log contains technical details about the blockchain event as well as the data that were recorded on-chain.
 */
export type OwnershipProvedLog = BaseLog & {
    // The fingerprint of the key whose ownership was proved as bytes32 hex string
    fingerprint: `0x${string}`;
    // The original challenge data (keccak256 hash of a random nonce) as bytes32 hex string
    challenge: `0x${string}`;
    // Hex-encoded OpenPGP signature made over the challenge data
    signature: `0x${string}`;
};
