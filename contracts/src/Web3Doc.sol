// SPDX-License-Identifier: Business Source License 1.1
pragma solidity ^0.8.24;

// Uncomment this line to use console.log
import "./FlatFee.sol";
import "./IWeb3Doc.sol";
import "./IWeb3PGP.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

// RESUME HERE - Impl. the interface

/**
 * @title Web3Doc
 * @author degengineering.ink
 * @notice This contract allows users to publish OpenPGP messages (encrypted or not) which contains detached signatures
 * or documents. The contract does not validate the data. It is the responsibility of the users to validate the data.
 */
contract Web3Doc is FlatFee, IWeb3Doc, UUPSUpgradeable {
    /*****************************************************************************************************************/
    /* STORAGE                                                                                                       */
    /*****************************************************************************************************************/

    /// @custom:storage-location erc7201:openzeppelin.storage.Web3Doc
    struct Web3DocStorage {
        /**
         * Monotically increasing counter to generate unique IDs for the published documents and timestamps.
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
         * @notice Maps a response to the document which is the subject of the response.
         */
        mapping(uint256 => uint256) responseToSubject;
        /**
         * @notice Lists the block numbers when were published the signatures associated with the given document.
         */
        mapping(uint256 => uint256[]) docIdToSignatures;
    }

    /// @dev keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Web3Doc")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant WEB3DOC_STORAGE_LOCATION =
        0x126b4ad6791ca5ab4e9a2b6bda753a1b72d59cc8959232491e0a27e873933a00;

    function _getWeb3DocStorage() private pure returns (Web3DocStorage storage $) {
        assembly {
            $.slot := WEB3DOC_STORAGE_LOCATION
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
     * @param web3pgp The address of the proxy for the Web3PGP contract used by this contract to verify the key existence.
     */
    function initialize(uint256 fee, address web3pgp) external initializer {
        // Initialize flat fee
        __FlatFee_initialize(fee);
        __UUPSUpgradeable_init();
        // Initialize storage
        Web3DocStorage storage $ = _getWeb3DocStorage();
        $.docId = 1; // Use 1 to leave the zero value as the value for non-existing documents
        $.web3pgp = web3pgp;
    }

    /**
     * @notice Reinitializes the contract to allow for upgrades.
     * @dev This function is used to reinitialize the contract after an upgrade.
     * It is marked as reinitializer(3) to allow for a second initialization.
     */
    function initializeUpgrade() external reinitializer(3) {
        // Add reinitialization logic here and increase the number of reinitializations
    }

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS                                                                                               */
    /*****************************************************************************************************************/

    /**
     * @inheritdoc IWeb3Doc
     */
    function sendOnChain(
        bytes32 emitter,
        Recipient[] calldata recipients,
        bytes32 dochash,
        bytes calldata signature,
        bytes calldata document,
        string calldata mimeType
    ) external payable override nonReentrant collectFee {
        // Check if the emitter exists in W3PGP contract
        _checkEmitter(emitter);
        // Check if all recipients exist in W3PGP contract
        _checkRecipients(recipients);
        // Get the next document ID to assign to the publication
        uint256 nextDocId = _getNextDocId();
        // Store the block number for the new document
        _storeBlockNumber(nextDocId, uint256(block.number));
        // Emit a Publication event
        emit Publication(
            nextDocId,
            emitter,
            dochash,
            signature,
            document,
            "", // Use an empty string for uri as it is not provided
            mimeType
        );
        // Emit a Notification event for each recipient
        _notifyRecipients(nextDocId, emitter, recipients, EventType.PUBLICATION);
        // Increase the document ID counter
        _increaseDocId();
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function sendOffChain(
        bytes32 emitter,
        Recipient[] calldata recipients,
        bytes32 dochash,
        bytes calldata signature,
        string calldata uri,
        string calldata mimeType
    ) external payable override nonReentrant collectFee {
        // Check if the emitter exists in W3PGP contract
        _checkEmitter(emitter);
        // Check if all recipients exist in W3PGP contract
        _checkRecipients(recipients);
        // Get the next document ID to assign to the publication
        uint256 nextDocId = _getNextDocId();
        // Store the block number for the new document
        _storeBlockNumber(nextDocId, uint256(block.number));
        // Emit a Publication event
        emit Publication(
            nextDocId,
            emitter,
            dochash,
            signature,
            new bytes(0), // Use an empty byte array for document as it is not provided
            uri,
            mimeType
        );
        // Emit a Notification event for each recipient
        _notifyRecipients(nextDocId, emitter, recipients, EventType.PUBLICATION);
        // Increase the document ID counter
        _increaseDocId();
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function copyOnChain(uint256 original, bytes32 emitter, Recipient[] calldata recipients, bytes calldata document)
        external
        payable
        override
        nonReentrant
        collectFee
    {
        // Check if the emitter exists in W3PGP contract
        _checkEmitter(emitter);
        // Check if all recipients exist in W3PGP contract
        _checkRecipients(recipients);
        // Check if the ID of the original document exists and is not a copy itself: copies of copies are not allowed.
        if (this.isCopyOf(original) != 0) {
            revert DocumentIsACopy(original);
        }
        // Get the next document ID to assign to the publication
        uint256 nextDocId = _getNextDocId();
        // Update the copy to original mapping
        _storeCopy(nextDocId, original);
        // Store the block number for the new document
        _storeBlockNumber(nextDocId, uint256(block.number));
        // Emit a Copy event
        emit Copy(nextDocId, original, emitter, document, "");
        // Emit a Notification event for each recipient
        _notifyRecipients(nextDocId, emitter, recipients, EventType.COPY);
        // Increase the document ID counter
        _increaseDocId();
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function copyOffChain(uint256 original, bytes32 emitter, Recipient[] calldata recipients, string calldata uri)
        external
        payable
        override
        nonReentrant
        collectFee
    {
        // Check if the emitter exists in W3PGP contract
        _checkEmitter(emitter);
        // Check if all recipients exist in W3PGP contract
        _checkRecipients(recipients);
        // Check if the ID of the original document exists and is not a copy itself: copies of copies are not allowed.
        if (this.isCopyOf(original) != 0) {
            revert DocumentIsACopy(original);
        }
        // Get the next document ID to assign to the publication
        uint256 nextDocId = _getNextDocId();
        // Update the copy to original mapping
        _storeCopy(nextDocId, original);
        // Store the block number for the new document
        _storeBlockNumber(nextDocId, uint256(block.number));
        // Emit a Copy event
        emit Copy(
            nextDocId,
            original,
            emitter,
            new bytes(0), // Use an empty byte array for document as it is not provided
            uri
        );
        // Emit a Notification event for each recipient
        _notifyRecipients(nextDocId, emitter, recipients, EventType.COPY);
        // Increase the document ID counter
        _increaseDocId();
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function respondOnChain(
        uint256 to,
        bytes32 emitter,
        Recipient[] calldata recipients,
        bytes32 dochash,
        bytes calldata signature,
        bytes calldata document,
        string calldata mimeType
    ) external payable override nonReentrant collectFee {
        // Check if the ID of the original document exists
        _checkDocumentExists(to);
        // Check if the emitter exists in W3PGP contract
        _checkEmitter(emitter);
        // Check if all recipients exist in W3PGP contract
        _checkRecipients(recipients);
        // Get the next document ID to assign to the publication
        uint256 nextDocId = _getNextDocId();
        // Update the response to subject mapping
        _storeResponse(nextDocId, to);
        // Store the block number for the new document
        _storeBlockNumber(nextDocId, uint256(block.number));
        // Emit a Publication event
        emit Publication(
            nextDocId,
            emitter,
            dochash,
            signature,
            document,
            "", // Use an empty string for uri as it is not provided
            mimeType
        );
        // Emit a Response event
        emit Response(nextDocId, to, emitter);
        // Emit a Notification event for each recipient
        _notifyRecipients(nextDocId, emitter, recipients, EventType.RESPONSE);
        // Increase the document ID counter
        _increaseDocId();
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function respondOffChain(
        uint256 to,
        bytes32 emitter,
        Recipient[] calldata recipients,
        bytes32 dochash,
        bytes calldata signature,
        string calldata uri,
        string calldata mimeType
    ) external payable override nonReentrant collectFee {
        // Check if the ID of the original document exists
        _checkDocumentExists(to);
        // Check if the emitter exists in W3PGP contract
        _checkEmitter(emitter);
        // Check if all recipients exist in W3PGP contract
        _checkRecipients(recipients);
        // Get the next document ID to assign to the publication
        uint256 nextDocId = _getNextDocId();
        // Update the response to subject mapping
        _storeResponse(nextDocId, to);
        // Store the block number for the new document
        _storeBlockNumber(nextDocId, uint256(block.number));
        // Emit a Publication event
        emit Publication(
            nextDocId,
            emitter,
            dochash,
            signature,
            new bytes(0), // Use an empty byte array for document as it is not provided
            uri,
            mimeType
        );
        // Emit a Response event
        emit Response(nextDocId, to, emitter);
        // Emit a Notification event for each recipient
        _notifyRecipients(nextDocId, emitter, recipients, EventType.RESPONSE);
        // Increase the document ID counter
        _increaseDocId();
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function sign(uint256 id, bytes32 emitter, bytes calldata signature)
        external
        payable
        override
        nonReentrant
        collectFee
    {
        // Check if the ID of the document exists
        _checkDocumentExists(id);
        // Check if the emitter exists in W3PGP contract
        _checkEmitter(emitter);
        // Store the signature
        _storeSignature(id, uint256(block.number));
        // Emit a Signature event
        emit Signature(id, emitter, signature);
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function timestamp(bytes32 emitter, bytes32 dochash, bytes calldata signature)
        external
        payable
        override
        nonReentrant
        collectFee
    {
        // Check if the emitter exists in W3PGP contract
        _checkEmitter(emitter);
        // Get the next document ID to assign to the timestamp
        uint256 nextDocId = _getNextDocId();
        // Store current block number for the new document
        _storeBlockNumber(nextDocId, uint256(block.number));
        // Emit a Timestamp event
        emit Timestamp(nextDocId, emitter, dochash, signature);
        // Increment the docId
        _increaseDocId();
    }

    /*****************************************************************************************************************/
    /* VIEW FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * @notice Get the address of the W3PGP contract used by this contract to verify whether a public key exist or not.
     * @return The address of the W3PGP contract.
     */
    function getWeb3PGPAddress() external view override returns (address) {
        Web3DocStorage storage $ = _getWeb3DocStorage();
        return $.web3pgp;
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function isCopyOf(uint256 id) external view override returns (uint256) {
        // Check if the copy exists
        Web3DocStorage storage $ = _getWeb3DocStorage();
        _checkDocumentExists(id);
        // Return the original document ID or zero if it is not a copy
        return $.copyToOriginal[id];
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function isResponseTo(uint256 response) external view override returns (uint256) {
        // Check if the response exists
        Web3DocStorage storage $ = _getWeb3DocStorage();
        _checkDocumentExists(response);
        // Return the subject document ID or zero if it is not a response
        return $.responseToSubject[response];
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function rewindResponseThread(uint256 response, uint256 limit) external view override returns (uint256[] memory) {
        // Check if the response exists
        Web3DocStorage storage $ = _getWeb3DocStorage();
        _checkDocumentExists(response);

        // Evaluate the depth of the response thread
        uint256 depth;
        uint256 cur = response;
        while (true) {
            cur = $.responseToSubject[cur];
            if (cur == 0) break;
            unchecked {
                ++depth;
            }
        }

        // Limit the depth to the provided limit
        if (depth > limit) {
            depth = limit;
        }

        // Traverse the response thread up to the original document that is the start of the thread
        uint256[] memory thread = new uint256[](depth);
        cur = response;
        for (uint256 i; i < depth;) {
            cur = $.responseToSubject[cur];
            thread[i] = cur;
            unchecked {
                ++i;
            }
        }

        return thread;
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function getDocumentBlockNumberByID(uint256 id) external view override returns (uint256) {
        Web3DocStorage storage $ = _getWeb3DocStorage();
        return $.docIdToBlockNumber[id];
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function getDocumentBlockNumberByIDBatch(uint256[] calldata id) external view override returns (uint256[] memory) {
        Web3DocStorage storage $ = _getWeb3DocStorage();
        uint256[] memory blockNumbers = new uint256[](id.length);
        for (uint256 i = 0; i < id.length; i++) {
            blockNumbers[i] = $.docIdToBlockNumber[id[i]];
        }
        return blockNumbers;
    }

    /**
     * @inheritdoc IWeb3Doc
     */
    function listSignatures(uint256 id, uint256 start, uint256 limit)
        external
        view
        override
        returns (uint256[] memory)
    {
        // Get a pointer to the storage of the contract
        Web3DocStorage storage $ = _getWeb3DocStorage();
        // Check the document exists
        _checkDocumentExists(id);
        // List signatures
        uint256 signaturesCount = $.docIdToSignatures[id].length;
        if (start >= signaturesCount || limit == 0) {
            return new uint256[](0);
        }
        uint256 end = start + limit;
        if (end > signaturesCount) {
            end = signaturesCount;
        }
        uint256[] memory signatures = new uint256[](end - start);
        for (uint256 i = start; i < end; i++) {
            signatures[i - start] = $.docIdToSignatures[id][i];
        }
        return signatures;
    }

    /*****************************************************************************************************************/
    /* UUPS PROXY FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    function _authorizeUpgrade(address newImplementation) internal virtual override onlyOwner {
        // Ensure the new implementation is not the zero address
        require(newImplementation != address(0), "New implementation cannot be the zero address");
    }

    /*****************************************************************************************************************/
    /* INTERNAL FUNCTIONS                                                                                            */
    /*****************************************************************************************************************/

    /**
     * @notice Verify whether a public key fingerprint exists or not in Web3PGP contract.
     * @param fingerprint The public key fingerprint to check if it exists or not.
     * @return true if the public key fingerprint exists, false otherwise.
     */
    function exist(bytes32 fingerprint) internal view returns (bool) {
        // Call exist function from Web3PGP contract through its proxy
        Web3DocStorage storage $ = _getWeb3DocStorage();
        return IWeb3PGP($.web3pgp).exist(fingerprint);
    }

    /**
     * @notice Check if the emitter exists in W3PGP contract.
     * @param emitter The emitter to check if it exists.
     * @dev Reverts with EmitterNotFound error if the emitter does not exist.
     */
    function _checkEmitter(bytes32 emitter) internal view {
        // Check if the emitter exists in W3PGP contract
        if (!exist(emitter)) {
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
        for (uint256 i = 0; i < recipients.length; i++) {
            if (!exist(recipients[i].fingerprint)) {
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
        Web3DocStorage storage $ = _getWeb3DocStorage();
        if (id == 0 || id >= $.docId) {
            revert DocumentNotFound(id);
        }
    }

    /**
     * @notice Get the next document ID that can be assigned by the contract.
     * @return The next document ID that can be assigned by the contract.
     */
    function _getNextDocId() internal view returns (uint256) {
        Web3DocStorage storage $ = _getWeb3DocStorage();
        return $.docId;
    }

    /**
     * @notice Internal function to increase the document ID counter.
     * @dev This function is used to ensure that each document has a unique ID.
     */
    function _increaseDocId() internal {
        Web3DocStorage storage $ = _getWeb3DocStorage();
        $.docId++;
    }

    /**
     * @notice Internal function to store the current block number when a new document is published.
     * @param id The ID of the document.
     */
    function _storeBlockNumber(uint256 id, uint256 blockNumber) internal {
        Web3DocStorage storage $ = _getWeb3DocStorage();
        $.docIdToBlockNumber[id] = blockNumber;
    }

    /**
     * @notice Internal function to store a copy of a document.
     * @param copy The ID of the copy document.
     * @param original The ID of the original document.
     */
    function _storeCopy(uint256 copy, uint256 original) internal {
        Web3DocStorage storage $ = _getWeb3DocStorage();
        // Store the original document ID in the mapping
        $.copyToOriginal[copy] = original;
    }

    /**
     * @notice Internal function to store a response to a subject document.
     * @param response The ID of the response document.
     * @param subject The ID of the subject document that the response is related to.
     */
    function _storeResponse(uint256 response, uint256 subject) internal {
        Web3DocStorage storage $ = _getWeb3DocStorage();
        // Store the subject document ID in the mapping
        $.responseToSubject[response] = subject;
    }

    /**
     * @notice Internal function to store a signature for a document.
     * @param id The ID of the document.
     * @param blockNumber The block number where the signature was created.
     */
    function _storeSignature(uint256 id, uint256 blockNumber) internal {
        Web3DocStorage storage $ = _getWeb3DocStorage();
        $.docIdToSignatures[id].push(blockNumber);
    }

    /**
     * @notice Internal function to notify recipients about an event (Publication, Copy or Response).
     * @param docId The ID of the document related to the event.
     * @param emitter The emitter of the event.
     * @param recipients The array of recipients to notify.
     * @param eventType The type of the event.
     */
    function _notifyRecipients(uint256 docId, bytes32 emitter, Recipient[] calldata recipients, EventType eventType)
        internal
    {
        // Emit a Notification event for each recipient
        for (uint256 i = 0; i < recipients.length; i++) {
            emit Notification(docId, emitter, recipients[i].fingerprint, eventType, recipients[i].signatureRequested);
        }
    }
}
