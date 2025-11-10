// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

/**
 * @title IWeb3PGP
 * @author degengineering.ink
 * @notice This interface defines events and functions used to publish and search OpenPGP public keys, subkeys
 * and revocation certificates on the Ethereum blockchain.
 * 
 * @dev This contract serves as a foundational registry layer. It intentionally does not:
 * - Validate OpenPGP message format or signatures (client-side responsibility)
 * - Enforce access control on key registration (composability by design)
 * - Store key metadata on-chain (uses event logs for gas efficiency)
 * - Manage fees directly (delegated to separate fee management contract)
 * 
 * The design philosophy prioritizes:
 * - Composability: Other contracts can build identity binding, verification, and trust layers
 * - Gas efficiency: Event logs provide cost-effective immutable storage
 * - Simplicity: Minimal on-chain logic reduces attack surface and gas costs
 * - Flexibility: No assumptions about PKI hierarchy or trust models
 * 
 * @custom:security Users MUST validate OpenPGP messages and verify fingerprint correctness off-chain before use.
 * @custom:composability This interface is designed as a building block for higher-level PKI systems.
 */
interface IWeb3PGP {

    /*****************************************************************************************************************/
    /* ERRORS                                                                                                        */
    /*****************************************************************************************************************/

    /**
     * Error emitted when the fingerprint of a public key is already registered.
     * @param fingerprint The fingerprint of the public key that is already registered.
     */
    error AlreadyRegistered(bytes32 fingerprint);

    /**
     * Error emitted when the fingerprint of a public key is not registered although it should be.
     * @param fingerprint The fingerprint of the public key that is not registered.
     */
    error NotRegistered(bytes32 fingerprint);

    /**
     * Error emitted when the user tries to register a subkey to a parent key that is already a subkey.
     * @param fingerprint The fingerprint of the parent key that is already a subkey.
     */
    error ParentIsASubkey(bytes32 fingerprint);

    /*****************************************************************************************************************/
    /* EVENTS                                                                                                        */
    /*****************************************************************************************************************/

    /**
     * Event emitted when a new primary public key has been registered. The event also includes the optional subkeys.
     *
     * @param primaryKeyFingerprint The declared fingerprint of the primary public key.
     * @param subkeyFingerprints The declared fingerprints of the subkeys attached to the primary key.
     * @param openPGPMsg A binary OpenPGP message which contains the public keys, their binding signatures and metadata.
     *
     * @notice This event is used to publish and persist a primary public key and its subkeys within the blockchain.
     *
     * @dev The OpenPGP message must be in binary format, can be compressed, must not be encrypted and must be a valid
     * key certificate. The message must include at least the primary public key and a valid binding signature. It may
     * include metadata (User ID packets) and subkeys (subkeys and their binding signatures). It is the responsibility
     * of the users to validate the OpenPGP message and the public keys contained within before using them. Please refer
     * to the OpenPGP RFC 9580 for more information.
     *
     * @custom:fingerprints bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 
     * 20 bytes to 32 bytes dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it
     * is zero-padded on the left to match the length of 32 bytes.
     *
     * @custom:implnotes The event logs are used as a cost-effective storage to publish and persist public keys on the
     * blockchain. For feasibility and gas-efficiency reasons, the smart contract itself does not validate the OpenPGP
     * messages or the declared fingerprint. Future improvements may introduce off-chain validation mechanisms, for
     * example through Chainlink Automation & Function to automatically verify published keys and maintain indexes of
     * valid, revoked or otherwise annotated keys.
     *
     * @custom:rfc Currently, RFC 9580 is the reference RFC but the upcoming "Post-Quantum Cryptography in OpenPGP" is
     * already taken into account https://datatracker.ietf.org/doc/draft-ietf-openpgp-pqc/12/
     */
    event KeyRegistered(bytes32 indexed primaryKeyFingerprint, bytes32[] subkeyFingerprints, bytes openPGPMsg);

    /**
     * Event emitted when a new public subkey has been registered and added to a primary key.
     *
     * @param primaryKeyFingerprint The fingerprint of the primary public key.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @param openPGPMsg A binary OpenPGP message which contains the subkey and its key binding signatures.
     *
     * @notice This event is used to publish and attach a public subkey to a primary public key.
     *
     * @dev The OpenPGP message must be in binary format, can be compressed, must not be encrypted and must be a valid
     * key certificate. The message must include at least the primary public key, a valid binding signature and the subkey.
     * It is the responsibility of the users to validate the OpenPGP message and the public keys contained within before
     * using them. Please refer to the OpenPGP RFC 9580 for more information.
     *
     * @custom:fingerprints bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 
     * 20 bytes to 32 bytes dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it
     * is zero-padded on the left to match the length of 32 bytes.
     *
     * @custom:implnotes The event logs are used as a cost-effective storage to publish and persist public keys on the
     * blockchain. For feasibility and gas-efficiency reasons, the smart contract itself does not validate the OpenPGP
     * messages or the declared fingerprint. Future improvements may introduce off-chain validation mechanisms, for
     * example through Chainlink Automation & Function to automatically verify published keys and maintain indexes of
     * valid, revoked or otherwise annotated keys.
     *
     * @custom:rfc Currently, RFC 9580 is the reference RFC but the upcoming "Post-Quantum Cryptography in OpenPGP" is
     * already taken into account https://datatracker.ietf.org/doc/draft-ietf-openpgp-pqc/12/
     */
    event SubkeyAdded(bytes32 indexed primaryKeyFingerprint, bytes32 indexed subkeyFingerprint, bytes openPGPMsg);

    /**
     * Event emitted when a key revocation certificate is published for a target public key (primary or subkey).
     *
     * @param fingerprint The fingerprint of the key to be revoked.
     * @param revocationCertificate The binary OpenPGP message which contains key revocation certificate.
     *
     * @notice This event is used to publish a revocation certificate that revokes a target public key (primary or subkey).
     *
     * @dev The OpenPGP message can be compressed and should not be encrypted. The message should at least contain a
     * Key Revocation Signature packet (Type ID 0x20) or a Subkey Revocation Signature packet (Type ID 0x28). However,
     * as most OpenPGP implementations do not support reading standalone key revocation certificates, it is recommended
     * to revoke the public key and then publish a key certificate that includes the public key and the revocation 
     * signatures.
     * 
     * @custom:fingerprints bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 
     * 20 bytes to 32 bytes dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it
     * is zero-padded on the left to match the length of 32 bytes.
     *
     * @custom:implnotes The event logs are used as a cost-effective storage to publish and persist public keys on the
     * blockchain. For feasibility and gas-efficiency reasons, the smart contract itself does not validate the OpenPGP
     * messages or the declared fingerprint. Future improvements may introduce off-chain validation mechanisms, for
     * example through Chainlink Automation & Function to automatically verify published keys and maintain indexes of
     * valid, revoked or otherwise annotated keys.
     *
     * @custom:rfc Currently, RFC 9580 is the reference RFC but the upcoming "Post-Quantum Cryptography in OpenPGP" is
     * already taken into account https://datatracker.ietf.org/doc/draft-ietf-openpgp-pqc/12/
     */
    event KeyRevoked(bytes32 indexed fingerprint, bytes revocationCertificate);

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS                                                                                               */
    /*****************************************************************************************************************/

    /**
     * This function is used to perform a first time registration of a new primary public key and its optional subkeys.
     *
     * @param primaryKeyFingerprint The declared fingerprint of the primary public key.
     * @param subkeyFingerprints Optional, the declared fingerprints of the subkeys attached to the primary key.
     * @param openPGPMsg A binary OpenPGP message which contains the primary public key, its binding signature, its
     * optional metadata (example: User ID packets) and its subkeys (public key and binding signatures packets) if any.
     *
     * @notice This function allows users and PGP servers to publish and register a new public key and its subkeys.
     *
     * The contract enforces the uniqueness of the fingerprints: Once a fingerprint is registered, it cannot be changed
     * or reused. The smart contract does not validate the data that are published: Users are expected to validate the
     * OpenPGP message and the public keys. Please refer to OpenPGP RFC 9580 for more information about the validation 
     * process. Users must also verify the fingerprint provided as parameter matches the fingerprint of the public keys
     * computed from the data of the OpenPGP message. Users should not use public keys with a mismatch between the content
     * of the openPGP message and the declaration (eg. the fingerprints and the number of keys included).
     *
     * @dev The OpenPGP message must be in binary format, can be compressed, must not be encrypted and must be a valid 
     * key certificate that includes at least the primary public key and a valid binding signature. Metadata (User ID
     * packets) and subkeys (public key and binding signature packets) can also be included. It is the responsability
     * of the users to verify the validity of the public keys before using them. Please refer to the OpenPGP RFC 9580 
     * for more information about how to validate and verify these data.
     *
     * @custom:fingerprints bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 
     * 20 bytes to 32 bytes dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it
     * is zero-padded on the left to match the length of 32 bytes.
     *
     * @custom:implnotes The event logs are used as a cost-effective storage to publish and persist public keys on the
     * blockchain. For feasibility and gas-efficiency reasons, the smart contract itself does not validate the OpenPGP
     * messages or the declared fingerprints. Future improvements may introduce off-chain validation mechanisms, for
     * example through Chainlink Automation & Function to automatically verify published keys and maintain indexes of
     * valid, revoked or otherwise annotated keys.
     *
     * @custom:rfc Currently, RFC 9580 is the reference RFC but the upcoming "Post-Quantum Cryptography in OpenPGP" is
     * already taken into account https://datatracker.ietf.org/doc/draft-ietf-openpgp-pqc/12/
     */
    function register(bytes32 primaryKeyFingerprint, bytes32[] calldata subkeyFingerprints, bytes calldata openPGPMsg) external payable;

    /**
     * This function is used to publish a subkey attached to a primary public key that has already been registered.
     *
     * @param primaryKeyFingerprint The fingerprint of the primary key to which attach the subkey.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @param openPGPMsg A binary OpenPGP message which contains the subkey and its key binding signatures.
     *
     * @notice This function allows users and PGP servers to add and publish a public key as a subkey of a primary key
     * that has already been registered with `register` function.
     *
     * The contract enforces the uniqueness of the fingerprints and verifies the primary key has been registered and is
     * not a subkey itself as multiple levels of subkeys is not allowed. The smart contract does not validate the data
     * that are published: Users are expected to validate the OpenPGP message and the public keys. Please refer to the 
     * OpenPGP RFC 9580 for more information about the validation process.
     *
     * Users must also verify the fingerprint provided as parameter matches the fingerprint of the keys computed from
     * the data of the OpenPGP message. Users should not use public keys with a mismatch between these fingerprints.
     *
     * @dev The OpenPGP message must be in binary format, can be compressed and should not be encrypted. The message must contain at least the
     * public subkey, a valid key binding signature from the corresponding private key to prove its ownership and the
     * key binding signature from the parent key. However, as most OpenPGP implementation do not support publishing
     * subkeys without the parent key, the message can also contain the parent key.
     *
     * @custom:fingerprints bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 
     * 20 bytes to 32 bytes dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it
     * is zero-padded on the left to match the length of 32 bytes.
     *
     * @custom:implnotes The event logs are used as a cost-effective storage to publish and persist public keys on the
     * blockchain. For feasibility and gas-efficiency reasons, the smart contract itself does not validate the OpenPGP
     * messages or the declared fingerprint. Future improvements may introduce off-chain validation mechanisms, for
     * example through Chainlink Automation & Function to automatically verify published keys and maintain indexes of
     * valid, revoked or otherwise annotated keys.
     *
     * @custom:rfc Currently, RFC 9580 is the reference RFC but the upcoming "Post-Quantum Cryptography in OpenPGP" is
     * already taken into account https://datatracker.ietf.org/doc/draft-ietf-openpgp-pqc/12/
     */
    function addSubkey(bytes32 primaryKeyFingerprint, bytes32 subkeyFingerprint, bytes calldata openPGPMsg) external payable;

    /**
     * Publish a key revocation certificate for a target public key.
     *
     * @param fingerprint The fingerprint of the key to be revoked.
     * @param revocationCertificate The binary OpenPGP message which contains key revocation certificate.
     *
     * @notice This event is used to publish the revocation certificate for a target public key.
     *
     * The smart contract verifies the target public key has been registered. It does not verify the OpenPGP message
     * nor the validity of the key revocation certificate. Users are expected to verify the key revocation certificate
     * validity by using the registered public key to verify the revocation signature. Once verified, users must stop
     * using the target public key. In case a primary key is revoked, consider all its subkeys as revoked as well.
     * Please refer to the OpenPGP RFC 9580 for more information about how to validate and verify these data.
     *
     * @dev The OpenPGP message can be compressed and should not be encrypted. The message should at least contain a
     * Key Revocation Signature packet (Type ID 0x20) or a Subkey Revocation Signature packet (Type ID 0x28). However,
     * as most OpenPGP implementations do not support even reading standalone key revocation certificates, the message
     * can also include the public key that is revoked.
     *
     * @custom:fingerprints bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 
     * 20 bytes to 32 bytes dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it
     * is zero-padded on the left to match the length of 32 bytes.
     *
     * @custom:implnotes The event logs are used as a cost-effective storage to publish and persist public keys on the
     * blockchain. For feasibility and gas-efficiency reasons, the smart contract itself does not validate the OpenPGP
     * messages or the declared fingerprint. Future improvements may introduce off-chain validation mechanisms, for
     * example through Chainlink Automation & Function to automatically verify published keys and maintain indexes of
     * valid, revoked or otherwise annotated keys.
     *
     * @custom:rfc Currently, RFC 9580 is the reference RFC but the upcoming "Post-Quantum Cryptography in OpenPGP" is
     * already taken into account https://datatracker.ietf.org/doc/draft-ietf-openpgp-pqc/12/
     */
    function revoke(bytes32 fingerprint, bytes calldata revocationCertificate) external payable;

    /*****************************************************************************************************************/
    /* READ FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * @notice Indicates whether a public key with the provided fingerprint has been registered.
     * @param fingerprint The fingerprint of the public key to check.
     * @return True if the public key is registered, false otherwise.
     */
    function exists(bytes32 fingerprint) external view returns (bool);

    /**
     * @notice Indicates whether the public key with the provided fingerprint has been registered and is a subkey.
     * @param fingerprint The fingerprint of the sub-key to check.
     * @return True if the sub-key is registered, false otherwise.
     */
    function isSubKey(bytes32 fingerprint) external view returns (bool);

    /**
     * @notice Returns the fingerprint of the parent key for a given subkey. The zero value means there is no parent.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @return The fingerprint of the parent key or the zero value if there is no parent.
     * @dev Reverts with NotRegistered if the provided fingerprint is not registered.
     */
    function parentOf(bytes32 subkeyFingerprint) external view returns (bytes32);

    /**
     * @notice Returns the block number when a key was published.
     * @param fingerprint The fingerprint of the public key to retrieve publication information for.
     * @return The block number when the specified public key was published or 0 if not published.
     */
    function getKeyPublicationBlock(bytes32 fingerprint) external view returns (uint256);

    /**
     * @notice Returns the block number when the key was published for a batch of keys.
     * @param fingerprints The fingerprints of the public keys to retrieve publication information for.
     * @return The block numbers when the specified public keys were published in the same order as the input array.
     * If a key was not published, the corresponding block number will be 0.
     */
    function getKeyPublicationBlock(bytes32[] calldata fingerprints) external view returns (uint256[] memory);

    /**
     * @notice Returns a list of block numbers when revocation certificates were published for a given key.
     * @param fingerprint The fingerprint of the public key to retrieve revocation information for.
     * @param start The starting index for the revocation list.
     * @param limit The maximum number of revocations to return.
     * @return An array of block numbers when revocation certificates were published for the specified key.
     * @dev This function supports pagination through the `start` and `limit` parameters to efficiently handle cases
     * where a parent key has a large number of revocation events (unlikely but possible). Loop until an empty array
     * is returned or until the length of the returned array is less than the limit.    
     */
    function listRevocations(bytes32 fingerprint, uint256 start, uint256 limit) external view returns (uint256[] memory);

    /**
     * @notice Returns a list of subkeys for a given parent key.
     * @param parentKeyFingerprint The fingerprint of the parent key to retrieve subkeys for.
     * @param start The starting index for the subkey list.
     * @param limit The maximum number of subkeys to return.
     * @return An array of subkey fingerprints. An empty array means no subkeys or the start index is out of bounds.
     * @dev This function supports pagination through the `start` and `limit` parameters to efficiently handle cases
     * where a parent key has a large number of subkeys. Loop until an empty array is returned or until the length of
     * the returned array is less than the limit.
     */
    function listSubkeys(bytes32 parentKeyFingerprint, uint256 start, uint256 limit) external view returns (bytes32[] memory);
}
