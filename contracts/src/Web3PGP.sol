// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import "./FlatFee.sol";
import "./IWeb3PGP.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title Web3PGP
 * @author degengineering.eth
 * @notice This contract allows users and PGP servers to publish, retrieve and manage OpenPGP public keys (RFC9580).
 * 
 * @dev Design Philosophy:
 * This contract serves as a minimal, gas-efficient registry for OpenPGP public keys on Ethereum.
 * It intentionally does NOT:
 * - Validate OpenPGP message format or cryptographic signatures (client-side responsibility)
 * - Enforce identity verification or access control on key registration (composability)
 * - Store complete key data on-chain (uses event logs for cost efficiency)
 * 
 * Instead, it provides:
 * - Immutable publication records via event logs
 * - Efficient key discovery through indexed events
 * - Relationship tracking (primary keys and subkeys)
 * - Revocation certificate publication
 * 
 * Higher-level systems can build on this foundation to add:
 * - Identity verification and attestation
 * - Trust scoring and reputation
 * - Enterprise PKI hierarchies
 * - Automated key rotation systems
 * 
 * @custom:security All OpenPGP validation MUST be performed off-chain before using published keys.
 */
contract Web3PGP is FlatFee, IWeb3PGP, UUPSUpgradeable {

    /*****************************************************************************************************************/
    /* CONTRACT STORAGE                                                                                              */
    /*****************************************************************************************************************/

    /// @custom:storage-location erc7201:openzeppelin.storage.Web3PGP
    struct Web3PGPStorage {

        /**
         * @notice Map used to register when a key was published (block number).
         */
        mapping(bytes32 => uint256) keysToPublicationBlockNumber;

        /**
         * @notice Map used to register the block numbers when key revocation certificates were published for the key.
         */
        mapping(bytes32 => uint256[]) keysToRevocations;

        /**
         * @notice Map used to register the link between a subkey fingerprint and its parent fingerprint.
         *
         * @dev The map is used both to help finding the parent of a subkey and to ensure that a subkey cannot be bound
         * to another subkey.
         */
        mapping(bytes32 => bytes32) subKeyToParent;

        /**
         * @notice Map used to find the declared subkeys of a parent key.
         *
         * @dev This map can be used to retrieve all subkeys associated with a given parent key without needing to
         * browse the full log history to find them.
         */
        mapping(bytes32 => bytes32[]) parentToSubKeys;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Web3PGP")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant WEB3PGP_STORAGE_LOCATION =
        0x4e95c079f7366154e8f4308dea0a0b4c44f1ca4c374479a12e29253c3f561b00;

    function _getWeb3PGPStorage() private pure returns (Web3PGPStorage storage $) {
        assembly {
            $.slot := WEB3PGP_STORAGE_LOCATION
        }
    }

    /*****************************************************************************************************************/
    /* INITIALIZERS                                                                                                  */
    /*****************************************************************************************************************/

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * Initialize the contract with _msgSender() asx owner and fee as the required service fee.
     * @param fee The service fee required to execute payable functions, expressed in weis.
     * @param manager The address of the AccessManager contract that manages access control for this contract.
     */
    function initialize(uint256 fee, address manager) external initializer {
        // Check that the AccessManager address is not the zero address
        require(manager != address(0), "AccessManager address cannot be zero");
        __FlatFee_init(fee, manager); 
        __UUPSUpgradeable_init();
    }

    /**
     * @notice Reinitializes the contract after an upgrade.
     * @dev This function is used to reinitialize the contract after an upgrade.
     * It is marked as reinitializer(2) to allow for a second initialization.
     */
    function initializeUpgrade() external reinitializer(2) {
        // Add reinitialization logic here and increase the number of reinitializations
    }

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS                                                                                               */
    /*****************************************************************************************************************/

    /**
     * @inheritdoc IWeb3PGP
     */
    function register(bytes32 primaryKeyFingerprint, bytes32[] calldata subkeyFingerprints, bytes calldata openPGPMsg) 
        external payable
        override
        nonReentrant
        collectFee
    {
        // Check if the public key fingerprint is not already registered
        _checkKeyNotRegistered(primaryKeyFingerprint);
        // For each subkey fingerprint, check if it is not already registered and link it to the parent key
        _checkSubkeysNotRegistered(primaryKeyFingerprint, subkeyFingerprints);
        // Register the primary key and its subkeys
        _registerKeys(primaryKeyFingerprint, subkeyFingerprints);
        // Emit the KeyRegistered event to signal that a new public key (primary key + subkeys) has been registered
        // and to store the provided OpenPGP message as is in the Ethereum log system.
        emit KeyRegistered(primaryKeyFingerprint, subkeyFingerprints, openPGPMsg);
    }

    /**
     * @inheritdoc IWeb3PGP
     */
    function addSubkey(bytes32 primaryKeyFingerprint, bytes32 subkeyFingerprint, bytes calldata openPGPMsg)
        external
        payable
        override
        nonReentrant
        collectFee
    {
        // Check if the public subkey fingerprint is not already registered
        _checkKeyNotRegistered(subkeyFingerprint);
        // Check if the parent key is registered
        _checkKeyIsRegistered(primaryKeyFingerprint);
        // Check if the parent key is not already a subkey
        _checkIsNotSubkey(primaryKeyFingerprint);
        // Register the subkey
        _registerSubkey(primaryKeyFingerprint, subkeyFingerprint, block.number);
        // Emit a SubkeyAdded event to store the provided OpenPGP subkey message as is in the Ethereum log system
        // and signal other users a new subkey is available for the primary key.
        emit SubkeyAdded(primaryKeyFingerprint, subkeyFingerprint, openPGPMsg);
    }

    /**
     * @inheritdoc IWeb3PGP
     */
    function revoke(bytes32 fingerprint, bytes calldata revocationCertificate)
        external
        payable
        override
        nonReentrant
        collectFee
    {
        // Check if the target key is registered
        _checkKeyIsRegistered(fingerprint);
        // Store the block number when the revocation certificate was published for the key
        _registerRevocation(fingerprint, block.number);
        // Emit a KeyRevoked event for the key to store the provided revocation certificate as is in the Ethereum log system
        // and signal other users that the key has been revoked (primary key or subkey).
        emit KeyRevoked(fingerprint, revocationCertificate);
    }

    /*****************************************************************************************************************/
    /* READ FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * @inheritdoc IWeb3PGP
     */
    function exists(bytes32 fingerprint) external view returns (bool isUsed) {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        return $.keysToPublicationBlockNumber[fingerprint] != 0;
    }

    /**
     * @inheritdoc IWeb3PGP
     */
    function isSubKey(bytes32 fingerprint) external view override returns (bool) {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        return $.subKeyToParent[fingerprint] != bytes32(0);
    }

    /**
     * @inheritdoc IWeb3PGP
     */
    function parentOf(bytes32 subkeyFingerprint) external view override returns (bytes32) {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        return $.subKeyToParent[subkeyFingerprint];
    }

    /**
     * @inheritdoc IWeb3PGP
     */
    function getKeyPublicationBlock(bytes32 fingerprint) external view override returns (uint256) {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        return $.keysToPublicationBlockNumber[fingerprint];
    }

    /**
     * @inheritdoc IWeb3PGP
     */
    function getKeyPublicationBlock(bytes32[] calldata fingerprints) external view override returns (uint256[] memory) {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        uint256 length = fingerprints.length;
        uint256[] memory publications = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            publications[i] = $.keysToPublicationBlockNumber[fingerprints[i]];
        }
        return publications;
    }

    /**
     * @notice Returns a list of block numbers when revocation certificates were published for a given key.
     * @param fingerprint The fingerprint of the public key to retrieve revocation information for.
     * @param start The starting index for the revocation list.
     * @param limit The maximum number of revocations to return.
     * @return An array of block numbers when revocation certificates were published for the specified key.
     */
    function listRevocations(bytes32 fingerprint, uint256 start, uint256 limit)
        external
        view
        returns (uint256[] memory)
    {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        uint256[] memory revocations = $.keysToRevocations[fingerprint];
        // Return an empty array if the start index is out of bounds or if the revocations array is empty or if limit == 0.
        if (start >= revocations.length || revocations.length == 0 || limit == 0) return new uint256[](0);
        // Compute the size of the result array
        uint256 size = (revocations.length - start) > limit ? limit : revocations.length - start;
        uint256[] memory result = new uint256[](size);
        uint256 count = 0;
        for (uint256 i = start; i < revocations.length && count < limit; i++) {
            result[count] = revocations[i];
            count++;
        }
        return result;
    }

    /**
     * @inheritdoc IWeb3PGP
     */
    function listSubkeys(bytes32 parentKeyFingerprint, uint256 start, uint256 limit)
        external
        view
        override
        returns (bytes32[] memory)
    {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        bytes32[] memory subkeys = $.parentToSubKeys[parentKeyFingerprint];
        // Return an empty array if the start index is out of bounds or if the subkeys array is empty or if limit == 0.
        if (start >= subkeys.length || subkeys.length == 0 || limit == 0) return new bytes32[](0);
        // Compute the size of the result array
        uint256 size = (subkeys.length - start) > limit ? limit : subkeys.length - start;
        bytes32[] memory result = new bytes32[](size);
        uint256 count = 0;
        for (uint256 i = start; i < subkeys.length && count < limit; i++) {
            result[count] = subkeys[i];
            count++;
        }
        return result;
    }

    /*****************************************************************************************************************/
    /* UUPS PROXY FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    function _authorizeUpgrade(address newImplementation) internal virtual override restricted {
        // Ensure the new implementation is not the zero address
        require(newImplementation != address(0), "New implementation cannot be the zero address");
    }

    /*****************************************************************************************************************/
    /* INTERNAL FUNCTIONS                                                                                            */
    /*****************************************************************************************************************/

    function _checkKeyNotRegistered(bytes32 fingerprint) internal view {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        if ($.keysToPublicationBlockNumber[fingerprint] != 0) {
            revert AlreadyRegistered(fingerprint);
        }
    }

    function _checkKeyIsRegistered(bytes32 fingerprint) internal view {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        if ($.keysToPublicationBlockNumber[fingerprint] == 0) {
            revert NotRegistered(fingerprint);
        }
    }

    function _checkIsNotSubkey(bytes32 fingerprint) internal view {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        if ($.subKeyToParent[fingerprint] != bytes32(0)) {
            revert ParentIsASubkey(fingerprint);
        }
    }

    function _checkSubkeysNotRegistered(bytes32 primaryKeyFingerprint, bytes32[] calldata subkeyFingerprints) internal view {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        uint256 length = subkeyFingerprints.length;
        for (uint256 i = 0; i < length; ++i) {
            if ($.keysToPublicationBlockNumber[subkeyFingerprints[i]] != 0 || subkeyFingerprints[i] == primaryKeyFingerprint) {
                revert AlreadyRegistered(subkeyFingerprints[i]);
            }
        }
    }

    function _registerKeys(bytes32 primaryKeyFingerprint, bytes32[] calldata subkeyFingerprints) internal {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        uint256 blockNumber = uint256(block.number);
        uint256 length = subkeyFingerprints.length;
        // Register the primary key
        $.keysToPublicationBlockNumber[primaryKeyFingerprint] = blockNumber;
        // Register each subkey
        for (uint256 i = 0; i < length; ++i) {
            _registerSubkey(primaryKeyFingerprint, subkeyFingerprints[i], blockNumber);
        }
    }

    function _registerSubkey(bytes32 primaryKeyFingerprint, bytes32 subkeyFingerprint, uint256 blockNumber) internal {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        // Register the subkey fingerprint and its publication block number using the provided block number
        $.keysToPublicationBlockNumber[subkeyFingerprint] = blockNumber;
        // Link the subkey to its parent key
        $.subKeyToParent[subkeyFingerprint] = primaryKeyFingerprint;
        $.parentToSubKeys[primaryKeyFingerprint].push(subkeyFingerprint);
    }

    function _registerRevocation(bytes32 fingerprint, uint256 blockNumber) internal {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        $.keysToRevocations[fingerprint].push(blockNumber);
    }
}
