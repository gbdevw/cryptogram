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
     * This function allows submitting the data needed to timestamp a document to the Web3Doc smart contract.
     * 
     * The function will download and verify the emitter's public key using the Web3PGP contract and then it will verify
     * the provided detached signature over the keccak256 hash of the document. If the signature is valid, it will submit
     * the hash and the signature to the smart contract for timestamping.
     * 
     * The service is expected to be configured with a Web3PGP service instance to enable automatic public key retrieval based
     * on their fingerprint.
     * 
     * @param hash The keccak256 hash of the document to be timestamped, provided as a Uint8Array.
     * @param signature The detached OpenPGP signature over the document hash.
     * @param emitter The fingerprint of the public key used to create the signature. Will be used to download the public key from Web3PGP.
     * @return A promise that resolves to the ID assigned to the new timestamp and the transaction receipt.
     */
    timestamp(hash: Uint8Array, signature: openpgp.Signature, emitter: `0x${string}`): Promise<[bigint, TransactionReceipt]>;

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