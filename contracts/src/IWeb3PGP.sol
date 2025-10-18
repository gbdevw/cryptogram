// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

/**
 * @title IWeb3PGP
 * @author degengineering.ink
 * @notice This interface defines events and functions used to publish and search OpenPGP public keys, sub-keys
 * and revocation certificates. It also provides a RFC compliant enum for hashing algorithms used in OpenPGP.
 */
interface IWeb3PGP {
    /*****************************************************************************************************************/
    /* ERRORS                                                                                                        */
    /*****************************************************************************************************************/

    /**
     * Error emitted when a public key fingerprint is already registered.
     * @param fingerprint The fingerprint of the public key that is already registered.
     */
    error AlreadyRegistered(bytes32 fingerprint);

    /**
     * Error emitted when a public key fingerprint is not registered although it should be.
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
     * Event emitted when a new public key has been registered.
     *
     * @param fingerprint The declared fingerprint of the public key.
     * @param openPGPMsg A binary OpenPGP message which contains the public key, its binding signature and metadata.
     *
     * @notice This event is used to publish and persist a public key within the blockchain.
     *
     * The contract enforces the uniqueness of the fingerprints: Once a fingerprint is registered, it cannot be changed
     * or reused. The smart contract does not verify the validity of the data that are published: Users are expected to
     * validate the OpenPGP message and the public key. Please refer to OpenPGP RFC 9580 for more information about the
     * validation process. Users must also verify the fingerprint provided as parameter matches the fingerprint of the
     * key computed from the data of the OpenPGP message. Users should not use public keys with a mismatch between these
     * fingerprints. Only full length fingerprint must be used.
     *
     * @dev The OpenPGP message can be compressed and must not be encrypted. The message must include at least the
     * public key and a valid signature from the corresponding private key to prove its ownership and allow other users
     * to verify the public key and its metadata. It is up to the users to verify the validity of the public key before
     * using it. Please refer to the OpenPGP RFC 9580 for more information about how to validate and verify these data.
     *
     * bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 20 bytes to 32 bytes
     * dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it is zero-padded on the
     * left to match the length of 32 bytes.
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
    event NewPublicKey(bytes32 indexed fingerprint, bytes openPGPMsg);

    /**
     * Event emitted when a new public subkey has been registered.
     *
     * @param parentKeyFingerprint The fingerprint of the parent key.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @param openPGPMsg A binary OpenPGP message which contains the subkey and its key binding signatures.
     *
     * @notice This event is used to publish a public key as a subkey of a parent key.
     *
     * The contract enforces the uniqueness of the fingerprints and verifies the parent key has been registered and is
     * not a subkey itself as multiple levels of subkeys is not explicitly supported by the OpenPGP RFC 9580. The smart
     * contract does not verify the validity of the data that are published: Users are expected to validate the OpenPGP
     * message and the public key. Please refer to OpenPGP RFC 9580 for more information about the validation process.
     * Users must also verify the fingerprint provided as parameter matches the fingerprint of the key computed from
     * the data of the OpenPGP message. Users should not use public keys with a mismatch between these fingerprints.
     * Only full length fingerprint must be used.
     *
     * @dev The OpenPGP message can be compressed and should not be encrypted. The message must contain at least the
     * public subkey, a valid key binding signature from the corresponding private key to prove its ownership and the
     * key binding signature from the parent key. However, as most OpenPGP implementation do not support publishing
     * subkeys without the parent key, the message can also contain the parent key.
     *
     * bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 20 bytes to 32 bytes
     * dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it is zero-padded on the
     * left to match the length of 32 bytes.
     *
     * @custom:implnotes The event logs are used as a cost-effective storage to publish and persist public keys on the
     * blockchain. For feasibility and gas-efficiency reasons, the smart contract itself does not validate the OpenPGP
     * messages or the declared fingerprint. Future improvements may introduce off-chain validation mechanisms, for
     * example through Chainlink Automation & Function to automatically verify published keys and maintain indexes of
     * valid, revoked or otherwise annotated keys.
     *
     * Put the parent key fingerprint as topic[1] in order to allow to find the publication, subkeys and revocations
     * logs for a given key fingerprint with a single request.
     *
     * @custom:rfc Currently, RFC 9580 is the reference RFC but the upcoming "Post-Quantum Cryptography in OpenPGP" is
     * already taken into account https://datatracker.ietf.org/doc/draft-ietf-openpgp-pqc/12/
     */
    event NewPublicSubkey(bytes32 indexed parentKeyFingerprint, bytes32 indexed subkeyFingerprint, bytes openPGPMsg);

    /**
     * Event emitted when a key revocation certificate is published for a target public key.
     *
     * @param fingerprint The fingerprint of the key to be revoked.
     * @param revocationCertificate The binary OpenPGP message which contains key revocation certificate.
     *
     * @notice This event is used to publish the revocation certificate for a target public key.
     *
     * The smart contract verifies the target public key has been registered. It does not verify the OpenPGP message
     * mor the validity of the key revocation certificate. Users are expected to verify the key revocation certificate
     * validity by using the registered public key to verify the revocation signature. Once verified, users must stop
     * using the target public key. Please refer to the OpenPGP RFC 9580 for more information about how to validate and
     * verify these data.
     *
     * bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 20 bytes to 32 bytes
     * dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it is zero-padded on the
     * left to match the length of 32 bytes.
     *
     * @dev The OpenPGP message can be compressed and should not be encrypted. The message should at least contain a
     * Key Revocation Signature packet (Type ID 0x20) or a Subkey Revocation Signature packet (Type ID 0x28). However,
     * as most OpenPGP implementations do not support even reading standalone key revocation certificates, the message
     * can also include the public key that is revoked.
     *
     * bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 20 bytes to 32 bytes
     * dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it is zero-padded on the
     * left to match the length of 32 bytes.
     *
     * @custom:rfc Currently, RFC 9580 is the reference RFC but the upcoming "Post-Quantum Cryptography in OpenPGP" is
     * already taken into account https://datatracker.ietf.org/doc/draft-ietf-openpgp-pqc/12/
     */
    event NewRevocationCertificate(bytes32 indexed fingerprint, bytes revocationCertificate);

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS                                                                                               */
    /*****************************************************************************************************************/

    /**
     * Publish and register a new public key.
     *
     * @param fingerprint The declared fingerprint of the public key
     * @param openPGPMsg A binary OpenPGP message which contains the public key, its signature and its optional metadata.
     *
     * @notice This function allows users and PGP servers to publish and register a new public key.
     *
     * The contract enforces the uniqueness of the fingerprints: Once a fingerprint is registered, it cannot be changed
     * or reused. The smart contract does not verify the validity of the data that are published: Users are expected to
     * validate the OpenPGP message and the public key. Please refer to OpenPGP RFC 9580 for more information about the
     * validation process. Users must also verify the fingerprint provided as parameter matches the fingerprint of the
     * key computed from the data of the OpenPGP message. Users should not use public keys with a mismatch between these
     * fingerprints. Only full length fingerprint must be used.
     *
     * @dev The OpenPGP message can be compressed and must not be encrypted. The message must include at least the
     * public key and a valid signature from the corresponding private key to prove its ownership and allow other users
     * to verify the public key and its metadata. It is up to the users to verify the validity of the public key before
     * using it. Please refer to the OpenPGP RFC 9580 for more information about how to validate and verify these data.
     *
     * bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 20 bytes to 32 bytes
     * dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it is zero-padded on the
     * left to match the length of 32 bytes.
     *
     * @custom:implnotes The event logs are used as a cost-effective storage to publish and persist public keys on the
     * blockchain. For feasibility and gas-efficiency reasons, the smart contract itself does not validate the OpenPGP
     * messages or the declared fingerprint. Future improvements may introduce off-chain validation mechanisms, for
     * example through Chainlink Automation & Function to automatically verify published keys and maintain indexes of
     * valid, revoked or otherwise annotated keys.
     */
    function registerPublicKey(bytes32 fingerprint, bytes calldata openPGPMsg) external payable;

    /**
     * Publish and register a subkey bound to a parent key.
     *
     * @param parentKeyFingerprint The fingerprint of the parent key.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @param openPGPMsg A binary OpenPGP message which contains the subkey and its key binding signatures.
     *
     * @notice This event is used to publish a public key as a subkey of a parent key.
     *
     * The contract enforces the uniqueness of the fingerprints and verifies the parent key has been registered and is
     * not a subkey itself as multiple levels of subkeys is not explicitly supported by the OpenPGP RFC 9580. The smart
     * contract does not verify the validity of the data that are published: Users are expected to validate the OpenPGP
     * message and the public key. Please refer to OpenPGP RFC 9580 for more information about the validation process.
     * Users must also verify the fingerprint provided as parameter matches the fingerprint of the key computed from
     * the data of the OpenPGP message. Users should not use public keys with a mismatch between these fingerprints.
     * Only full length fingerprint must be used.
     *
     * @dev The OpenPGP message can be compressed and should not be encrypted. The message must contain at least the
     * public subkey, a valid key binding signature from the corresponding private key to prove its ownership and the
     * key binding signature from the parent key. However, as most OpenPGP implementation do not support publishing
     * subkeys without the parent key, the message can also contain the parent key.
     *
     * bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 20 bytes to 32 bytes
     * dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it is zero-padded on the
     * left to match the length of 32 bytes.
     *
     * @custom:implnotes The event logs are used as a cost-effective storage to publish and persist public keys on the
     * blockchain. For feasibility and gas-efficiency reasons, the smart contract itself does not validate the OpenPGP
     * messages or the declared fingerprint. Future improvements may introduce off-chain validation mechanisms, for
     * example through Chainlink Automation & Function to automatically verify published keys and maintain indexes of
     * valid, revoked or otherwise annotated keys.
     *
     * Put the parent key fingerprint as topic[1] in order to allow to find the publication, subkeys and revocations
     * logs for a given key fingerprint with a single request.
     *
     * @custom:rfc Currently, RFC 9580 is the reference RFC but the upcoming "Post-Quantum Cryptography in OpenPGP" is
     * already taken into account https://datatracker.ietf.org/doc/draft-ietf-openpgp-pqc/12/
     */
    function registerPublicSubkey(bytes32 parentKeyFingerprint, bytes32 subkeyFingerprint, bytes calldata openPGPMsg)
        external
        payable;

    /**
     * Publish a key revocation certificate for a target public key.
     *
     * @param fingerprint The fingerprint of the key to be revoked.
     * @param revocationCertificate The binary OpenPGP message which contains key revocation certificate.
     *
     * @notice This event is used to publish the revocation certificate for a target public key.
     *
     * The smart contract verifies the target public key has been registered. It does not verify the OpenPGP message
     * mor the validity of the key revocation certificate. Users are expected to verify the key revocation certificate
     * validity by using the registered public key to verify the revocation signature. Once verified, users must stop
     * using the target public key. Please refer to the OpenPGP RFC 9580 for more information about how to validate and
     * verify these data.
     *
     * bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 20 bytes to 32 bytes
     * dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it is zero-padded on the
     * left to match the length of 32 bytes.
     *
     * @dev The OpenPGP message can be compressed and should not be encrypted. The message should at least contain a
     * Key Revocation Signature packet (Type ID 0x20) or a Subkey Revocation Signature packet (Type ID 0x28). However,
     * as most OpenPGP implementations do not support even reading standalone key revocation certificates, the message
     * can also include the public key that is revoked.
     *
     * bytes32 is the type used for fingerprints as the length of the fingerprints ranges from 20 bytes to 32 bytes
     * dependending on the key version (v4 vs v6). If the fingerprint is less than 32 bytes, it is zero-padded on the
     * left to match the length of 32 bytes.
     *
     * @custom:rfc Currently, RFC 9580 is the reference RFC but the upcoming "Post-Quantum Cryptography in OpenPGP" is
     * already taken into account https://datatracker.ietf.org/doc/draft-ietf-openpgp-pqc/12/
     */
    function revokeKey(bytes32 fingerprint, bytes calldata revocationCertificate) external payable;

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS                                                                                               */
    /*****************************************************************************************************************/

    /**
     * @notice Indicates wether or not a public key with the provided fingerprint has been registered.
     * @param fingerprint The fingerprint of the public key to check.
     * @return True if the public key is registered, false otherwise.
     */
    function exist(bytes32 fingerprint) external view returns (bool);

    /**
     * @notice Indicates wether or not the public key with the provided fingerprint has been registered and is a subkey.
     * @param fingerprint The fingerprint of the sub-key to check.
     * @return True if the sub-key is registered, false otherwise.
     */
    function isSubKey(bytes32 fingerprint) external view returns (bool);

    /**
     * @notice Returns the fingerprint of the parent key for a given subkey. The zero value means there is no parent.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @return The fingerprint of the parent key or the zero value if there is no parent.
     */
    function parentOf(bytes32 subkeyFingerprint) external view returns (bytes32);

    /**
     * @notice Returns the block number when a key was published.
     * @param fingerprint The fingerprint of the public key to retrieve publication information for.
     * @return The block number when the specified public key was published.
     */
    function getKeyPublication(bytes32 fingerprint) external view returns (uint256);

    /**
     * @notice Returns the key publication information for a batch of public keys.
     * @param fingerprints The fingerprints of the public keys to retrieve publication information for.
     * @return The key publication information for the specified public keys in the same order as the input array.
     */
    function getKeyPublicationBatch(bytes32[] calldata fingerprints) external view returns (uint256[] memory);

    /**
     * @notice Returns a list of block numbers when revocation certificates were published for a given key.
     * @param fingerprint The fingerprint of the public key to retrieve revocation information for.
     * @param start The starting index for the revocation list.
     * @param limit The maximum number of revocations to return.
     * @return An array of block numbers when revocation certificates were published for the specified key.
     * @dev This function supports pagination through the `start` and `limit` parameters to efficiently handle cases
     * where a parent key has a large number of subkeys. Loop until an empty array is returned or until the length of
     * the returned array is less than the limit.
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
    function listSubkeys(bytes32 parentKeyFingerprint, uint256 start, uint256 limit)
        external
        view
        returns (bytes32[] memory);
}
