// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

import { FlatFee} from "src/FlatFee.sol";
import {IWeb3Sign} from "src/IWeb3Sign.sol";
import {IWeb3PGP} from "src/IWeb3PGP.sol";
import {UUPSUpgradeable} from "lib/openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title Web3Sign
 * @author degengineering.eth
 * @notice Decentralized Electronic Data Interchange (EDI) system for secure document exchange.
 * 
 * @dev Implementation Philosophy:
 * This contract provides a minimal, gas-efficient registry for EDI documents on Ethereum,
 * leveraging OpenPGP cryptography for security. It intentionally does NOT:
 * - Validate OpenPGP message format or signatures (client-side responsibility)
 * - Enforce document schemas or business logic (composability)
 * - Store complete documents on-chain by default (gas efficiency via event logs)
 * - Implement workflow orchestration (separation of concerns)
 * 
 * Core Features:
 * - Immutable publication records via indexed events
 * - On-chain and off-chain storage models
 * - Certified copy mechanism with provenance tracking
 * - Signature workflow support for acknowledgments
 * - Proof-of-existence timestamping
 * - Integration with Web3PGP for identity verification
 * 
 * Storage Strategy:
 * - Minimal on-chain storage (IDs, block numbers, relationships)
 * - Document data stored in event logs (cost-effective, immutable)
 * - ERC-7201 namespaced storage prevents collisions
 * 
 * @custom:security All OpenPGP validation MUST be performed off-chain before using documents.
 * @custom:gas-efficiency Event logs provide 90%+ cost savings vs contract storage for document data.
 */
contract Web3Sign is FlatFee, IWeb3Sign, UUPSUpgradeable {
    /*****************************************************************************************************************/
    /* STORAGE                                                                                                       */
    /*****************************************************************************************************************/

    /// @custom:storage-location erc7201:openzeppelin.storage.Web3Sign
    struct Web3SignStorage {

        /**
         * Monotically increasing counter to generate unique IDs for the published documents and timestamps.
         *
         * Should start at 1 so that the zero value can be used to indicate non-existing documents.
         */
        uint256 docId;

        /**
         * @notice The address of the Web3PGP contract used by this contract to verify whether a public key exists or not.
         */
        address web3pgp;

        /**
         * @notice Maps a document ID to the block number where it was published.
         */
        mapping(uint256 => uint256) docIdToBlockNumber;

        /**
         * @notice Maps a copy document to its original document.
         */
        mapping(uint256 => uint256) copyToOriginal;

        /**
         * @notice Lists the block numbers when were published the signatures associated with the given document.
         */
        mapping(uint256 => uint256[]) docIdToSignatures;

        /**
         * @notice Maps a document hash to the list of document IDs (documents or timestamps) linked to documents or timestamps with that hash were published.
         */
        mapping(bytes32 => uint256[]) docHashToDocIds;

        /**
         * @notice Maps a signature hash to the block number where the signature was published.
         */
        mapping(bytes32 => uint256) signatureHashToBlock;

        /**
         * @notice Lists the block numbers when were published the revocations associated with the signature identified by the given signature hash.
         */
        mapping(bytes32 => uint256[]) signatureHashToRevocationBlocks;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Web3Sign")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant WEB3SIGN_STORAGE_LOCATION = 0xee8561c57681beda608743fac1d07a5402d517a6a8bfc6854d432aa1a9f30000;

    function _getWeb3SignStorage()
        private
        pure
        returns (Web3SignStorage storage $)
    {
        assembly {
            $.slot := WEB3SIGN_STORAGE_LOCATION
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
     * Initialize the contract with msg.sender as owner, set the required fee to fee and set the W3PGP contract address
     * and version.
     *
     * @param fee The service fee required to execute payable functions, expressed in weis.
     * @param manager The address of the AccessManager contract used to manage access control.
     * @param web3pgp The address of the proxy for the Web3PGP contract used by this contract to verify the key existence.
     */
    function initialize(
        uint256 fee,
        address manager,
        address web3pgp
    ) external initializer {
        // Check that the W3PGP address is not the zero address
        require(web3pgp != address(0), "Web3PGP address cannot be zero");
        // Check that the AccessManager address is not the zero address
        require(manager != address(0), "AccessManager address cannot be zero");
        // Initialize flat fee
        __FlatFee_init(fee, manager);
        __UUPSUpgradeable_init();
        // Initialize storage
        Web3SignStorage storage $ = _getWeb3SignStorage();
        $.docId = 1; // Use 1 to leave the zero value as the value for non-existing documents
        $.web3pgp = web3pgp;
    }

    /**
     * @notice Reinitializes the contract to allow for upgrades.
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
     * @inheritdoc IWeb3Sign
     */
    function sendOnChain(
        bytes32 emitter,
        Recipient[] calldata recipients,
        bytes32 dochash,
        bytes calldata signature,
        bytes calldata document,
        string calldata mimeType
    ) external payable override nonReentrant collectFee {
        // Validate emitter and recipients
        _checkEmitter(emitter);
        _checkRecipients(recipients);

        Web3SignStorage storage $ = _getWeb3SignStorage();
        uint256 currentDocId = $.docId;
        uint256 currentBlock = block.number;

        // Store block number for new document
        $.docIdToBlockNumber[currentDocId] = currentBlock;
        $.docHashToDocIds[dochash].push(currentDocId);

        // Emit Document event
        emit Document(
            currentDocId,
            emitter,
            dochash,
            signature,
            document,
            "",
            mimeType
        );

        // Notify recipients
        _notifyRecipients(
            currentDocId,
            emitter,
            recipients,
            EventType.DOCUMENT
        );

        // Increment document ID
        $.docId = currentDocId + 1;
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function sendOffChain(
        bytes32 emitter,
        Recipient[] calldata recipients,
        bytes32 dochash,
        bytes calldata signature,
        string calldata uri,
        string calldata mimeType
    ) external payable override nonReentrant collectFee {
        // Validate emitter and recipients
        _checkEmitter(emitter);
        _checkRecipients(recipients);

        Web3SignStorage storage $ = _getWeb3SignStorage();
        uint256 currentDocId = $.docId;
        uint256 currentBlock = block.number;

        // Store block number for new document
        $.docIdToBlockNumber[currentDocId] = currentBlock;
        $.docHashToDocIds[dochash].push(currentDocId);

        // Emit a Document event
        emit Document(
            currentDocId,
            emitter,
            dochash,
            signature,
            new bytes(0), // Use an empty byte array for document as it is not provided
            uri,
            mimeType
        );

        // Emit a Notification event for each recipient
        _notifyRecipients(
            currentDocId,
            emitter,
            recipients,
            EventType.DOCUMENT
        );

        // Increase the document ID counter
        $.docId = currentDocId + 1;
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function copyOnChain(
        uint256 original,
        bytes32 emitter,
        Recipient[] calldata recipients,
        bytes calldata document
    ) external payable override nonReentrant collectFee {
        // Validate emitter and recipients
        _checkEmitter(emitter);
        _checkRecipients(recipients);

        // Validate that the original document is not a copy
        _checkIsNotACopy(original);

        Web3SignStorage storage $ = _getWeb3SignStorage();
        uint256 currentDocId = $.docId;
        uint256 currentBlock = block.number;

        // Update the copy to original mapping
        $.copyToOriginal[currentDocId] = original;

        // Store the block number for the new document
        $.docIdToBlockNumber[currentDocId] = currentBlock;
        // No hash is stored for copies - refer to the original document for hash

        // Emit a Copy event
        emit Copy(currentDocId, original, emitter, document, "");

        // Emit a Notification event for each recipient
        _notifyRecipients(currentDocId, emitter, recipients, EventType.COPY);
        // Increase the document ID counter
        $.docId = currentDocId + 1;
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function copyOffChain(
        uint256 original,
        bytes32 emitter,
        Recipient[] calldata recipients,
        string calldata uri
    ) external payable override nonReentrant collectFee {
        // Validate emitter and recipients
        _checkEmitter(emitter);
        _checkRecipients(recipients);

        // Validate that the original document is not a copy
        _checkIsNotACopy(original);

        Web3SignStorage storage $ = _getWeb3SignStorage();
        uint256 currentDocId = $.docId;
        uint256 currentBlock = block.number;

        // Update the copy to original mapping
        $.copyToOriginal[currentDocId] = original;
        // No hash is stored for copies - refer to the original document for hash

        // Store the block number for the new document
        $.docIdToBlockNumber[currentDocId] = currentBlock;

        // Emit a Copy event
        emit Copy(
            currentDocId,
            original,
            emitter,
            new bytes(0), // Use an empty byte array for document as it is not provided
            uri
        );

        // Emit a Notification event for each recipient
        _notifyRecipients(currentDocId, emitter, recipients, EventType.COPY);

        // Increase the document ID counter
        $.docId = currentDocId + 1;
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function sign(
        uint256 id,
        bytes32 emitter,
        bytes calldata signature
    ) external payable override nonReentrant collectFee {
        // Check if the ID of the document exists
        _checkDocumentExists(id);

        // Check if the emitter exists in W3PGP contract
        _checkEmitter(emitter);

        // Keccak256 hash of the signature
        bytes32 signatureHash = keccak256(signature);

        // Store the signature
        Web3SignStorage storage $ = _getWeb3SignStorage();
        $.docIdToSignatures[id].push(block.number);
        $.signatureHashToBlock[signatureHash] = block.number;

        // Emit a Signature event
        emit Signature(id, emitter, signatureHash, signature);
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function revokeSignature(
        uint256 id,
        bytes32 emitter,
        bytes32 signatureHash,
        bytes calldata signature
    ) external payable override {
        // Check if the ID of the document exists
        _checkDocumentExists(id);

        // Check if the emitter exists in W3PGP contract
        _checkEmitter(emitter);

        // Check if the signature to be revoked exists
        _checkSignatureExists(signatureHash);

        // Store the revocation
        Web3SignStorage storage $ = _getWeb3SignStorage();
        $.signatureHashToRevocationBlocks[signatureHash].push(block.number);

        // Emit a SignatureRevocation event
        emit SignatureRevocation(id, emitter, signatureHash, signature);
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function timestamp(
        bytes32 emitter,
        bytes32 dochash,
        bytes calldata signature
    ) external payable override nonReentrant collectFee {
        // Check if the emitter exists in W3PGP contract
        _checkEmitter(emitter);

        Web3SignStorage storage $ = _getWeb3SignStorage();
        uint256 currentDocId = $.docId;
        uint256 currentBlock = block.number;

        // Store current block number for the new document
        $.docIdToBlockNumber[currentDocId] = currentBlock;
        $.docHashToDocIds[dochash].push(currentDocId);

        // Emit a Timestamp event
        emit Timestamp(currentDocId, emitter, dochash, signature);

        // Increment the docId
        $.docId = currentDocId + 1;
    }

    /*****************************************************************************************************************/
    /* VIEW FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * @notice Get the address of the W3PGP contract used by this contract to verify whether a public key exist or not.
     * @return The address of the W3PGP contract.
     */
    function getWeb3PGPAddress() external view override returns (address) {
        Web3SignStorage storage $ = _getWeb3SignStorage();
        return $.web3pgp;
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function isCopyOf(uint256 id) external view override returns (uint256) {
        // Check if the copy exists
        Web3SignStorage storage $ = _getWeb3SignStorage();
        _checkDocumentExists(id);
        // Return the original document ID or zero if it is not a copy
        return $.copyToOriginal[id];
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function getDocumentBlockNumberByID(
        uint256 id
    ) external view override returns (uint256) {
        Web3SignStorage storage $ = _getWeb3SignStorage();
        return $.docIdToBlockNumber[id];
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function getDocumentBlockNumberByIDBatch(
        uint256[] calldata ids
    ) external view override returns (uint256[] memory) {
        Web3SignStorage storage $ = _getWeb3SignStorage();
        uint256 length = ids.length;
        uint256[] memory blockNumbers = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            blockNumbers[i] = $.docIdToBlockNumber[ids[i]];
        }
        return blockNumbers;
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function listSignatures(
        uint256 id,
        uint256 start,
        uint256 limit
    ) external view override returns (uint256[] memory) {
        // Get a pointer to the storage of the contract
        Web3SignStorage storage $ = _getWeb3SignStorage();
        // Check the document exists
        _checkDocumentExists(id);

        // List signatures
        uint256[] storage storedSignatures = $.docIdToSignatures[id];
        uint256 signaturesCount = storedSignatures.length;

        if (start >= signaturesCount || limit == 0 || signaturesCount == 0) {
            return new uint256[](0);
        }

        uint256 end = start + limit;
        if (end > signaturesCount) {
            end = signaturesCount;
        }

        uint256 resultLength = end - start;
        uint256[] memory signatures = new uint256[](resultLength);
        for (uint256 i = 0; i < resultLength; ++i) {
            signatures[i] = storedSignatures[start + i];
        }

        return signatures;
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function getSignatureBlockNumberByHash(
        bytes32 signatureHash
    ) external view override returns (uint256) {
        Web3SignStorage storage $ = _getWeb3SignStorage();
        return $.signatureHashToBlock[signatureHash];
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function getSignatureBlockNumberByHashBatch(
        bytes32[] calldata signatureHashes
    ) external view override returns (uint256[] memory) {
        Web3SignStorage storage $ = _getWeb3SignStorage();
        uint256 length = signatureHashes.length;
        uint256[] memory blockNumbers = new uint256[](length);
        for (uint256 i = 0; i < length; ++i) {
            blockNumbers[i] = $.signatureHashToBlock[signatureHashes[i]];
        }
        return blockNumbers;
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function listSignatureRevocationsBlockNumbers(
        bytes32 signatureHash,
        uint256 start,
        uint256 limit
    ) external view override returns (uint256[] memory) {
        Web3SignStorage storage $ = _getWeb3SignStorage();
        uint256[] storage revocationBlocks = $.signatureHashToRevocationBlocks[
            signatureHash
        ];
        uint256 revocationsCount = revocationBlocks.length;

        if (start >= revocationsCount || limit == 0 || revocationsCount == 0) {
            return new uint256[](0);
        }

        uint256 end = start + limit;
        if (end > revocationsCount) {
            end = revocationsCount;
        }

        uint256 resultLength = end - start;
        uint256[] memory blocks = new uint256[](resultLength);
        for (uint256 i = 0; i < resultLength; ++i) {
            blocks[i] = revocationBlocks[start + i];
        }

        return blocks;
    }

    /**
     * @inheritdoc IWeb3Sign
     */
    function listDocumentIdsByHash(
        bytes32 dochash,
        uint256 start,
        uint256 limit
    ) external view override returns (uint256[] memory) {
        Web3SignStorage storage $ = _getWeb3SignStorage();
        uint256[] storage docIds = $.docHashToDocIds[dochash];
        uint256 docIdsCount = docIds.length;

        if (start >= docIdsCount || limit == 0 || docIdsCount == 0) {
            return new uint256[](0);
        }

        uint256 end = start + limit;
        if (end > docIdsCount) {
            end = docIdsCount;
        }

        uint256 resultLength = end - start;
        uint256[] memory ids = new uint256[](resultLength);
        for (uint256 i = 0; i < resultLength; ++i) {
            ids[i] = docIds[start + i];
        }

        return ids;
    }

    /*****************************************************************************************************************/
    /* UUPS PROXY FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    function _authorizeUpgrade(
        address newImplementation
    ) internal virtual override restricted {
        // Ensure the new implementation is not the zero address
        require(
            newImplementation != address(0),
            "New implementation cannot be the zero address"
        );
    }

    /*****************************************************************************************************************/
    /* INTERNAL FUNCTIONS                                                                                            */
    /*****************************************************************************************************************/

    /**
     * @notice Verify whether a public key fingerprint exists or not in Web3PGP contract.
     * @param fingerprint The public key fingerprint to check if it exists or not.
     * @return true if the public key fingerprint exists, false otherwise.
     */
    function _exists(bytes32 fingerprint) internal view returns (bool) {
        // Call exists function from Web3PGP contract through its proxy
        Web3SignStorage storage $ = _getWeb3SignStorage();
        return IWeb3PGP($.web3pgp).exists(fingerprint);
    }

    /**
     * @notice Check if the emitter exists in W3PGP contract.
     * @param emitter The emitter to check if it exists.
     * @dev Reverts with EmitterNotFound error if the emitter does not exist.
     */
    function _checkEmitter(bytes32 emitter) internal view {
        // Check if the emitter exists in W3PGP contract
        if (!_exists(emitter)) {
            revert EmitterNotFound(emitter);
        }
    }

    /**
     * @notice Check if all recipients exist in W3PGP contract.
     * @param recipients The array of recipients to check.
     * @dev Reverts with RecipientNotFound error if one of the recipients does not exist.
     */
    function _checkRecipients(Recipient[] calldata recipients) internal view {
        // Check if all recipients exist in W3PGP contract
        uint256 length = recipients.length;
        for (uint256 i = 0; i < length; ++i) {
            if (!_exists(recipients[i].fingerprint)) {
                revert RecipientNotFound(recipients[i].fingerprint);
            }
        }
    }

    /**
     * @notice Check if the document with the given ID exists.
     * @param id The ID of the document to check.
     * @dev Reverts with DocumentNotFound error if the document does not exist.
     */
    function _checkDocumentExists(uint256 id) internal view {
        // Check if the document exists
        Web3SignStorage storage $ = _getWeb3SignStorage();
        if (id == 0 || id >= $.docId) {
            revert DocumentNotFound(id);
        }
    }

    /**
     * @notice Check if the document with the given ID is not a copy.
     * @param id The ID of the document to check.
     * @dev Reverts with DocumentIsACopy error if the document is a copy.
     */
    function _checkIsNotACopy(uint256 id) internal view {
        Web3SignStorage storage $ = _getWeb3SignStorage();
        if ($.copyToOriginal[id] != 0) {
            revert DocumentIsACopy(id);
        }
    }

    /**
     * @notice Check if the signature with the given hash exists.
     * @param signatureHash The keccak256 hash of the signature to check.
     * @dev Reverts with SignatureNotFound error if the signature does not exist.
     */
    function _checkSignatureExists(bytes32 signatureHash) internal view {
        Web3SignStorage storage $ = _getWeb3SignStorage();
        if ($.signatureHashToBlock[signatureHash] == 0) {
            revert SignatureNotFound(signatureHash);
        }
    }

    /**
     * @notice Internal function to notify recipients about an event (Publication, Copy or Response).
     * @param docId The ID of the document related to the event.
     * @param emitter The emitter of the event.
     * @param recipients The array of recipients to notify.
     * @param eventType The type of the event.
     */
    function _notifyRecipients(
        uint256 docId,
        bytes32 emitter,
        Recipient[] calldata recipients,
        EventType eventType
    ) internal {
        // Emit a Notification event for each recipient
        uint256 length = recipients.length;
        for (uint256 i = 0; i < length; ++i) {
            emit Notification(
                docId,
                emitter,
                recipients[i].fingerprint,
                eventType,
                recipients[i].signatureRequested
            );
        }
    }
}
