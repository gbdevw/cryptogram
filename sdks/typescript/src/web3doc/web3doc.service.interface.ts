import { TransactionReceipt } from "viem";
import * as openpgp from "openpgp";

/**
 * Interface representing the Web3Doc service for managing documents on the blockchain.
 * 
 * Higher order bindings are provided and involve OpenPGP operations in order to ease the overall developer experience.
 * 
 * @todo Add methods for document exchange (sendDocument, sendCopy, notifyRecipients, ...)
 */
export interface IWeb3DocService {
                  
    /*****************************************************************************************************************/
    /* TIMESTAMPING                                                                                                  */
    /*****************************************************************************************************************/

    /**
     * Timestamps a document by submitting its keccak256 hash and a detached signature of the hash to the Web3Doc smart
     * contract. The function will compute the hash of the document and will use the private key to sign the document 
     * hash. In case the private key is encrypted, the provided passphrase will be used to unlock it. The private key
     * will remain unlocked only for the duration of this function call.
     * 
     * @param document The document to be timestamped, provided as a Uint8Array or a ReadableStream of Uint8Array chunks.
     * @param key The OpenPGP private key used to sign the document hash. Must be unlocked if no passphrase is provided.
     * @param passphrase Optional passphrase to unlock the private key if it is encrypted.
     * @returns A promise that resolves to the ID assigned to the new timestamp and the transaction receipt.
     */
    timestamp(document: Uint8Array | ReadableStream<Uint8Array>, key: openpgp.PrivateKey, passphrase?: string): Promise<[bigint, TransactionReceipt]>;

    /**
     * Timestamp a document by submitting its keccak256 hash and a detached signature of the hash to the Web3Doc smart
     * contract. The function will use the private key to sign the provided document hash. In case the private key is 
     * encrypted, the provided passphrase will be used to unlock it. The private key will remain unlocked only for the 
     * duration of this function call.
     * 
     * The function does not compute the hash of the document, it is the caller's responsibility to provide the correct
     * keccak256 hash of the document.
     * 
     * @param hash The keccak256 hash of the document to be timestamped, provided as a Uint8Array or a ReadableStream of Uint8Array chunks.
     * @param key The OpenPGP private key used to sign the document hash. Must be unlocked if no passphrase is provided.
     * @param passphrase Optional passphrase to unlock the private key if it is encrypted.
     * @returns A promise that resolves to the ID assigned to the new timestamp and the transaction receipt.
     */
    timestamp(hash: Uint8Array | ReadableStream<Uint8Array>, key: openpgp.PrivateKey, passphrase?: string): Promise<[bigint, TransactionReceipt]>;

    /**
     * This function allows submitting the data needed to timestamp a document to the Web3Doc smart contract.
     * 
     * The function will verify the provided detached signature over the keccak256 hash of the document using the provided 
     * public key. If the signature is valid, it will submit the hash and the signature to the smart contract for timestamping.
     * 
     * The function does not compute the hash of the document, it is the caller's responsibility to provide the correct
     * keccak256 hash of the document.
     * 
     * @param hash The keccak256 hash of the document to be timestamped, provided as a Uint8Array or a ReadableStream of Uint8Array chunks.
     * @param signature The detached OpenPGP signature over the document hash.
     * @param publicKey The OpenPGP public key used to verify the signature.
     * @returns A promise that resolves to the ID assigned to the new timestamp and the transaction receipt.
     */
    timestamp(hash: Uint8Array | ReadableStream<Uint8Array>, signature: openpgp.Signature, publicKey: openpgp.PublicKey): Promise<[bigint, TransactionReceipt]>;

    /**
     * This function allows submitting the data needed to timestamp a document to the Web3Doc smart contract.
     * 
     * The function will compute the keccak256 hash of the provided document and will verify the provided detached 
     * signature over the document hash using the provided public key. If the signature is valid, it will submit the 
     * hash and the signature to the smart contract for timestamping.
     * 
     * @param document The document to be timestamped, provided as a Uint8Array or a ReadableStream of Uint8Array chunks.
     * @param signature The detached OpenPGP signature over the document hash.
     * @param publicKey The OpenPGP public key used to verify the signature.
     * @returns A promise that resolves to the ID assigned to the new timestamp and the transaction receipt.
     */
    timestamp(document: Uint8Array | ReadableStream<Uint8Array>, signature: openpgp.Signature, publicKey: openpgp.PublicKey): Promise<[bigint, TransactionReceipt]>;

    /**
     * This function allows submitting the data needed to timestamp a document to the Web3Doc smart contract.
     * 
     * The function will download and verify the emitter's public key using the Web3PGP contract and then it will verify
     * the provided detached signature over the keccak256 hash of the document. If the signature is valid, it will submit
     * the hash and the signature to the smart contract for timestamping.
     * 
     * The service is expected to be configured with a Web3PGP service instance to enable automatic public key retrieval based
     * on their fingerprint.
     * 
     * @param hash The keccak256 hash of the document to be timestamped, provided as a Uint8Array or a ReadableStream of Uint8Array chunks.
     * @param signature The detached OpenPGP signature over the document hash.
     * @param emitter The fingerprint of the public key used to create the signature. Will be used to download the public key from Web3PGP.
     * @return A promise that resolves to the ID assigned to the new timestamp and the transaction receipt.
     */
    timestamp(hash: Uint8Array | ReadableStream<Uint8Array>, signature: openpgp.Signature, emitter: `0x${string}`): Promise<[bigint, TransactionReceipt]>;

    /**
     * This function allows submitting the data needed to timestamp a document to the Web3Doc smart contract.
     * 
     * The function will compute the keccak256 hash of the provided document and will download and verify the emitter's
     * public key using the Web3PGP contract. It will then verify the provided detached signature over the document hash.
     * If the signature is valid, it will submit the hash and the signature to the smart contract for timestamping.
     * 
     * The service is expected to be configured with a Web3PGP service instance to enable automatic public key retrieval based
     * on their fingerprint.
     * 
     * @param document The document to be timestamped, provided as a Uint8Array or a ReadableStream of Uint8Array chunks.
     * @param signature The detached OpenPGP signature over the document hash.
     * @param emitter The fingerprint of the public key used to create the signature. Will be used to download the public key from Web3PGP.
     * @return A promise that resolves to the ID assigned to the new timestamp and the transaction receipt.
     */
    timestamp(document: Uint8Array | ReadableStream<Uint8Array>, signature: openpgp.Signature, emitter: `0x${string}`): Promise<[bigint, TransactionReceipt]>;

    /**
     * Verifies a timestamp entry on the blockchain by its ID. The function retrieves the timestamp data from the
     * Web3Doc smart contract and verifies the detached signature over the document hash using the emitter's public key.
     * 
     * The function returns the document hash, the signature, and the public key used for verification.
     * 
     * The user can then compare the hash received from this function with the keccak256 hash they compute from their 
     * document to ensure integrity.
     * 
     * @param id The ID of the timestamp entry to verify.
     * @returns A promise that resolves to an object containing the document hash, signature, the public key, the transaction hash and the date of the timestamp. 
     */
    verifyTimestamp(id: bigint): Promise<{
        documentHash: Uint8Array; 
        signature: openpgp.Signature; 
        publicKey: openpgp.PublicKey;
        tx: `0x${string}`,
        date: Date,
    }>;

    /**
     * Finds all timestamp IDs associated with a given document hash. Timestamp IDs can be used to retrieve and verify
     * timestamp entries on the blockchain.
     * 
     * @param hash The keccak256 hash of the document to search for.
     * @returns A promise that resolves to an array of timestamp IDs associated with the provided document hash.
     */
    findTimestampsByHash(hash: Uint8Array): Promise<bigint[]>;
}