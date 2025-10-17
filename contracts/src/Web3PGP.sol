// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import './FlatFee.sol';
import './IWeb3PGP.sol';
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

// Import Hardhat's console
// import "hardhat/console.sol";

/**
 * @title Web3PGP
 * @author degengineering.ink
 * @notice This contract allows users and PGP servers to publish, retrieve and manage OpenPGP public keys (RFC9580).
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
    bytes32 private constant WEB3PGP_STORAGE_LOCATION = 0x4e95c079f7366154e8f4308dea0a0b4c44f1ca4c374479a12e29253c3f561b00;

    function _getWeb3PGPStorage() private pure returns (Web3PGPStorage storage $) {
        assembly {
            $.slot := WEB3PGP_STORAGE_LOCATION
        }
    }

    /*****************************************************************************************************************/
    /* INITIALIZERS                                                                                                  */
    /*****************************************************************************************************************/

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }


    /**
     * Initialize the contract with _msgSender() asx owner and fee as the required service fee.
     * @param fee The service fee required to execute payable functions, expressed in weis.
     */
    function initialize(uint256 fee) external initializer {
        __FlatFee_initialize(fee);
        __UUPSUpgradeable_init();
    }

    /**
     * @notice Reinitializes the contract after an upgrade.
     * @dev This function is used to reinitialize the contract after an upgrade.
     * It is marked as reinitializer(3) to allow for a second initialization.
     */
    function initializeUpgrade() reinitializer(3) external {
        // Add reinitialization logic here and increase the number of reinitializations
    }

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS                                                                                               */
    /*****************************************************************************************************************/

    /**
     * @inheritdoc IWeb3PGP
     */
    function registerPublicKey(
        bytes32 fingerprint,
        bytes calldata openPGPMsg
    ) external payable override nonReentrant collectFee {
        // Get a pointer to the contract storage slot
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        // Check if the public key fingerprint is not already registered
        if ($.keysToPublicationBlockNumber[fingerprint] != 0) revert AlreadyRegistered(fingerprint);
        // Update the publication block number in the key lifecycle using the current block number
        $.keysToPublicationBlockNumber[fingerprint] = uint256(block.number);
        // Emit the NewPublicKey event to signal that a new public key has been registered and store the provided
        // OpenPGP message as is in the Ethereum log system.
        emit NewPublicKey(fingerprint, openPGPMsg);
    }

    /**
     * @inheritdoc IWeb3PGP
     */
    function registerPublicSubkey(
        bytes32  parentKeyFingerprint,
        bytes32  subkeyFingerprint,
        bytes calldata openPGPMsg
    ) external payable override nonReentrant collectFee {
        // Get a pointer to the contract storage slot
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        // Check if the public subkey fingerprint is not already registered
        if ($.keysToPublicationBlockNumber[subkeyFingerprint] != 0) revert AlreadyRegistered(subkeyFingerprint);
        // Check if the parent key is registered
        if ($.keysToPublicationBlockNumber[parentKeyFingerprint] == 0) revert NotRegistered(parentKeyFingerprint);
        // Check if the parent key is not already a subkey
        if ($.subKeyToParent[parentKeyFingerprint] != bytes32(0)) revert ParentIsASubkey(parentKeyFingerprint);
        // Update the mappings
        $.keysToPublicationBlockNumber[subkeyFingerprint] = uint256(block.number);
        $.subKeyToParent[subkeyFingerprint] = parentKeyFingerprint;
        $.parentToSubKeys[parentKeyFingerprint].push(subkeyFingerprint);
        // Register the subkey and emit a NewPublicSubkey event
        emit NewPublicSubkey(parentKeyFingerprint, subkeyFingerprint, openPGPMsg);
    }

    /**
     * @inheritdoc IWeb3PGP
     */
    function revokeKey(
        bytes32 fingerprint,
        bytes calldata revocationCertificate
    ) external payable override nonReentrant collectFee {
        // Check if the public key fingerprint is registered
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        // Check if the target key is registered
        if ($.keysToPublicationBlockNumber[fingerprint] == 0) revert NotRegistered(fingerprint);
        // Store the block number when the revocation certificate was published for the key
        $.keysToRevocations[fingerprint].push(block.number);
        // Emit a NewRevocationCertificate event for the key
        emit NewRevocationCertificate(fingerprint, revocationCertificate);
    }

    /*****************************************************************************************************************/
    /* READ FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * @inheritdoc IWeb3PGP
     */
    function exist(bytes32 fingerprint) external view returns (bool isUsed) {
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
    function getKeyPublication(bytes32 fingerprint) external view override returns (uint256) {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        return $.keysToPublicationBlockNumber[fingerprint];
    }

    /**
     * @inheritdoc IWeb3PGP
     */
    function getKeyPublicationBatch(bytes32[] calldata fingerprints) external view override returns (uint256[] memory) {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        uint256[] memory publications = new uint256[](fingerprints.length);
        for (uint256 i = 0; i < fingerprints.length; i++) {
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
    function listRevocations(
        bytes32 fingerprint,
        uint256 start,
        uint256 limit
    ) external view returns (uint256[] memory) {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        uint256[] memory revocations = $.keysToRevocations[fingerprint];
        // Return an empty array if the start index is out of bounds or if the revocations array is empty or if limit == 0.
        if (start >= revocations.length || revocations.length == 0 || limit == 0) { return new uint256[](0); }
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
    function listSubkeys(
        bytes32 parentKeyFingerprint, 
        uint256 start, 
        uint256 limit
    ) external view override returns (bytes32[] memory) {
        Web3PGPStorage storage $ = _getWeb3PGPStorage();
        bytes32[] memory subkeys = $.parentToSubKeys[parentKeyFingerprint];
        // Return an empty array if the start index is out of bounds or if the subkeys array is empty or if limit == 0.
        if (start >= subkeys.length || subkeys.length == 0 || limit == 0) { return new bytes32[](0); }
        // Compute the size of the result array
        uint256 size =  (subkeys.length - start) > limit ? limit : subkeys.length - start;
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

    function _authorizeUpgrade(
        address newImplementation
    ) internal virtual override  onlyOwner{
        // Ensure the new implementation is not the zero address
        require(
            newImplementation != address(0),
            "New implementation cannot be the zero address"
        );
    }
}