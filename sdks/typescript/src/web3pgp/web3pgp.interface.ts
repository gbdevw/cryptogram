import { Address, TransactionReceipt } from 'viem';

/**
 * Interface for the Web3PGP contract methods.
 * This defines the low-level contract interactions following the IWeb3PGP Solidity interface.
 */
export interface IWeb3PGP {

    /*****************************************************************************************************************/
    /* READ FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * Check if a given fingerprint has been used to register a key in the contract.
     * @param fingerprint The fingerprint of the key to check.
     * @return True if the fingerprint has been used to register a key in the contract, false otherwise.
     */
    exists(fingerprint: `0x${string}`): Promise<boolean>;

    /**
     * Check if a given fingerprint corresponds to a key registered as a subkey in the contract.
     * @param fingerprint The fingerprint of the key to check.
     * @return True if the key is a subkey, false otherwise.
     */
    isSubKey(fingerprint: `0x${string}`): Promise<boolean>;

    /**
     * Get the fingerprint of the parent key for a given subkey.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @return The fingerprint of the parent key or zero bytes if there is no parent.
     */
    parentOf(subkeyFingerprint: `0x${string}`): Promise<`0x${string}`>;

    /**
     * Get the block number when a key was published.
     * @param fingerprint The fingerprint of the key to check.
     * @return The block number when the key was published, or 0 if not published.
     */
    getKeyPublicationBlock(fingerprint: `0x${string}`): Promise<bigint>;

    /**
     * Get the block numbers when multiple keys were published.
     * @param fingerprints The fingerprints of the keys to check.
     * @return An array of block numbers corresponding to each fingerprint in the order they were provided.
     */
    getKeyPublicationBlockBatch(fingerprints: `0x${string}`[]): Promise<bigint[]>;

    /**
     * List the block numbers when revocation certificates were published for the given fingerprint.
     * @param fingerprint The fingerprint of the key to check.
     * @param start The starting index in the list of revocations.
     * @param limit The maximum number of results to return.
     * @return An array of block numbers when revocation certificates were published.
     */
    listRevocations(fingerprint: `0x${string}`, start: bigint, limit: bigint): Promise<bigint[]>;

    /**
     * List the fingerprints of subkeys registered under a given parent key.
     * @param parentKeyFingerprint The fingerprint of the parent key to check.
     * @param start The starting index in the list of subkeys.
     * @param limit The maximum number of results to return.
     * @return An array of subkey fingerprints.
     */
    listSubkeys(parentKeyFingerprint: `0x${string}`, start: bigint, limit: bigint): Promise<`0x${string}`[]>;

    /**
     * Get the requested fee for payable operations.
     * @return The requested fee in wei.
     */
    requestedFee(): Promise<bigint>;

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS (PAYABLE)                                                                                     */
    /*****************************************************************************************************************/

    /**
     * Register a new primary public key and its optional subkeys.
     * @param primaryKeyFingerprint The declared fingerprint of the primary public key.
     * @param subkeyFingerprints Optional array of declared fingerprints of the subkeys attached to the primary key.
     * @param openPGPMsg A binary OpenPGP message containing the primary key, binding signature, metadata, and subkeys.
     * @return Transaction receipt after registration.
     */
    register(
        primaryKeyFingerprint: `0x${string}`,
        subkeyFingerprints: `0x${string}`[],
        openPGPMsg: `0x${string}`
    ): Promise<TransactionReceipt>;

    /**
     * Add a new subkey to an already registered primary key.
     * @param primaryKeyFingerprint The fingerprint of the primary key to which to attach the subkey.
     * @param subkeyFingerprint The fingerprint of the subkey.
     * @param openPGPMsg A binary OpenPGP message containing the subkey and its key binding signatures.
     * @return Transaction receipt after adding the subkey.
     */
    addSubkey(
        primaryKeyFingerprint: `0x${string}`,
        subkeyFingerprint: `0x${string}`,
        openPGPMsg: `0x${string}`
    ): Promise<TransactionReceipt>;

    /**
     * Publish a key revocation certificate for a target public key.
     * @param fingerprint The fingerprint of the key to be revoked.
     * @param revocationCertificate The binary OpenPGP message containing the key revocation certificate.
     * @return Transaction receipt after publishing the revocation.
     */
    revoke(fingerprint: `0x${string}`, revocationCertificate: `0x${string}`): Promise<TransactionReceipt>;

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS (RESTRICTED - ACCESS CONTROLLED)                                                             */
    /*****************************************************************************************************************/

    /**
     * Update the requested service fee.
     * @param newFee The new requested fee to be set in wei.
     * @return Transaction receipt after updating the fee.
     */
    updateRequestedFee(newFee: bigint): Promise<TransactionReceipt>;

    /**
     * Withdraw the full contract balance to the specified address.
     * @param to The address to which the fees are withdrawn.
     * @return Transaction receipt after withdrawing fees.
     */
    withdrawFees(to: Address): Promise<TransactionReceipt>;

    /*****************************************************************************************************************/
    /* INITIALIZATION & UPGRADE FUNCTIONS                                                                            */
    /*****************************************************************************************************************/

    /**
     * Initialize the contract with fee and access manager settings.
     * @param fee The service fee required to execute payable functions, expressed in wei.
     * @param manager The address of the AccessManager contract that manages access control for this contract.
     * @return Transaction receipt after initialization.
     */
    initialize(fee: bigint, manager: Address): Promise<TransactionReceipt>;

    /**
     * Reinitialize the contract after an upgrade.
     * @return Transaction receipt after reinitialization.
     */
    initializeUpgrade(): Promise<TransactionReceipt>;

    /**
     * Upgrade the contract to a new implementation and optionally call a function.
     * @param newImplementation The address of the new implementation contract.
     * @param data The calldata to execute on the new implementation (can be empty bytes).
     * @return Transaction receipt after upgrade.
     */
    upgradeToAndCall(newImplementation: Address, data: `0x${string}`): Promise<TransactionReceipt>;
}
