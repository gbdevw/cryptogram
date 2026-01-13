import { hexToBytes, toHex, TransactionReceipt } from 'viem';
import * as openpgp from 'openpgp';
import { IWeb3DocService } from './web3doc.service.interface';
import { IWeb3Doc } from './web3doc.interface';
import { IWeb3PGPService } from '../web3pgp/web3pgp.service.interface';
import { Web3PGPServiceValidationError } from '../web3pgp/web3pgp.service';
import { to0x, toBytes32 } from '../utils/0xstr';

/*****************************************************************************************************************/
/* CUSTOM ERRORS                                                                                                 */
/*****************************************************************************************************************/

/**
 * Base error class for Web3DocService errors.
 */
export class Web3DocServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'Web3DocServiceError';
    }
}

/**
 * Error thrown when a critical failure occurs during service operations.
 *
 * This error indicates a serious problem that prevents the operation from continuing such as network failures and others has occurred.
 */
export class Web3DocServiceCriticalError extends Web3DocServiceError {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'Web3DocServiceCriticalError';
    }
}

/**
 * Error thrown when document or blockchain data validation fails.
 * 
 * This can happen because the smart contract does not validate the data it stores, they
 * have to be verified by the client application. Furthermore, as anyone can submit documents,
 * malformed or invalid data may be submitted by malicious actors. 
 */
export class Web3DocServiceValidationError extends Web3DocServiceError {
    constructor(message: string, public readonly cause?: Error) {
        super(message);
        this.name = 'Web3DocServiceValidationError';
    }
}

/*****************************************************************************************************************/
/* SERVICE IMPLEMENTATION                                                                                        */
/*****************************************************************************************************************/

/**
 * Configuration options for Web3DocService.
 */
export interface Web3DocServiceOptions {
    /**
     * Maximum number of concurrent operations performed when processing documents and verifying signatures.
     * 
     * This limit helps prevent resource exhaustion and rate-limiting issues when interacting with RPC endpoints or
     * when processing large numbers of documents.
     * 
     * @default 10
     */
    concurrencyLimit?: number;
}

/**
 * Implementation of the Web3Doc service interface.
 * 
 * This service provides high-level functions for managing documents on the blockchain with integrated
 * OpenPGP operations to ease developer experience.
 */
export class Web3DocService implements IWeb3DocService {

    private _web3pgpService: IWeb3PGPService;
    private _web3doc: IWeb3Doc;
    private _options: Required<Web3DocServiceOptions>;

    /**
     * Creates a new Web3DocService instance.
     * 
     * @param web3doc An instance implementing the IWeb3Doc interface.
     * @param options Optional configuration options for the service.
     */
    constructor(web3doc: IWeb3Doc, web3pgpService: IWeb3PGPService, options?: Web3DocServiceOptions) {
        this._web3doc = web3doc;
        this._web3pgpService = web3pgpService;
        this._options = {
            concurrencyLimit: options?.concurrencyLimit ?? 10,
        };
    }

    /**
     * Gets the Web3Doc instance.
     */
    get web3doc(): IWeb3Doc {
        return this._web3doc;
    }

    /**
     * Sets the Web3Doc instance.
     */
    set web3doc(value: IWeb3Doc) {
        this._web3doc = value;
    }

    /**
     * Gets the Web3PGP service instance.
     */
    get web3pgpService(): IWeb3PGPService {
        return this._web3pgpService;
    }

    /**
     * Sets the Web3PGP service instance.
     */
    set web3pgpService(value: IWeb3PGPService) {
        this._web3pgpService = value;
    }

    /**
     * Gets the service configuration options.
     */
    get options(): Required<Web3DocServiceOptions> {
        return this._options;
    }

    /**
     * Sets the service configuration options.
     */
    set options(value: Required<Web3DocServiceOptions>) {
        this._options = value;
    }

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
    public async timestamp(hash: Uint8Array, signature: openpgp.Signature, emitter: `0x${string}`): Promise<[bigint, TransactionReceipt]> {
        try {
            // Download and verify the emitter's public key using the Web3PGP service
            console.debug(`[Web3Doc Service] Retrieving public key for emitter fingerprint: ${emitter}`);
            const pk = await this.web3pgpService.getPublicKey(emitter)
            
            // Verify the signature over the document hash
            console.debug(`[Web3Doc Service] Verifying signature for timestamp with emitter fingerprint: ${emitter}`);
            try {
                await openpgp.verify({
                    message: await openpgp.createMessage({ binary: hash }),
                    signature: signature,
                    verificationKeys: pk,
                    date: new Date(), // Use current date for verification
                })
            } catch (error) {
                throw new Web3DocServiceValidationError(`Signature verification failed for emitter fingerprint: ${emitter}`, error instanceof Error ? error : undefined);
            }

            // Submit the timestamp to the Web3Doc smart contract - Use the primary key fingerprint as emitter s the provided 
            // arg might point to a subkey - It is preferable to always use the primary key fingerprint for emitter identification
            console.debug(`[Web3Doc Service] Submitting timestamp to Web3Doc smart contract for emitter fingerprint: ${emitter}`);
            const receipt = await this.web3doc.timestamp(toBytes32(to0x(pk.getFingerprint())), toHex(hash), toHex(signature.write()));
            console.debug(`[Web3Doc Service] Timestamp transaction submitted successfully`);
            // Extract the timestamp log from the transaction receipt - Use current date as timestamp as the receipt is 
            // from a just submitted transaction and experience showed that the block timestamp may not be available yet
            const logs = await this.web3doc.extractTimestampLog(receipt, new Date());
            if (logs.length !== 1) {
                throw new Web3DocServiceCriticalError(`Unexpected number of timestamp logs in transaction receipt: ${logs.length}`);
            }
            console.debug(`[Web3Doc Service] Timestamp submitted successfully with ID: ${logs[0].id.toString()}`);
            return [logs[0].id, receipt];
        } catch (error) {
            if (error instanceof Web3PGPServiceValidationError) {
                // Wrap and rethrow validation errors from Web3PGP service
                throw new Web3DocServiceValidationError(`Emitter public key not valid for fingerprint: ${emitter}`, error);
            }
            console.error(error);
            throw new Web3DocServiceCriticalError('Failed to retrieve or verify emitter public key', error instanceof Error ? error : undefined);
        }
    }

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
    public async verifyTimestamp(id: bigint): Promise<{ documentHash: Uint8Array; signature: openpgp.Signature; publicKey: openpgp.PublicKey; tx: `0x${string}`; date: Date; }> {
        try {
        // Get the block number where to search for the timestamp
        const blockNumber = await this.web3doc.getDocumentBlockNumberByID(id);

        // Retrieve the timestamp log from the blockchain
        const timestamp = await this.web3doc.getTimestampLogByID(id, blockNumber);
        if (!timestamp) {
            throw new Web3DocServiceValidationError(`Timestamp with ID ${id.toString()} not found on the blockchain`);
        }

        // Retrieve and verify the emitter's public key using the Web3PGP service
        console.debug(`[Web3Doc Service] Retrieving public key for emitter fingerprint: ${timestamp.emitter}`);
        const pk = await this.web3pgpService.getPublicKey(timestamp.emitter);

        // Verify the signature over the document hash
        console.debug(`[Web3Doc Service] Verifying signature for timestamp ID: ${id.toString()}`);
        const signature = await openpgp.readSignature({ binarySignature: hexToBytes(timestamp.signature) });
        try {
            await openpgp.verify({
                message: await openpgp.createMessage({ binary: hexToBytes(timestamp.dochash) }),
                signature: signature,
                verificationKeys: pk,
                date: timestamp.blockTimestamp, // Use the block timestamp for verification
            });
        } catch (error) {
            throw new Web3DocServiceValidationError(`Signature verification failed for timestamp ID: ${id.toString()}`, error instanceof Error ? error : undefined);
        }

        console.debug(`[Web3Doc Service] Timestamp ID: ${id.toString()} verified successfully`);
        return {
            documentHash: hexToBytes(timestamp.dochash),
            signature: signature,
            publicKey: pk,
            tx: timestamp.transactionHash,
            date: timestamp.blockTimestamp,
        };
        } catch (error) {
            if (error instanceof Web3PGPServiceValidationError) {
                // Wrap and rethrow validation errors from Web3PGP service
                throw new Web3DocServiceValidationError(`Emitter public key not valid`, error);
            }
            throw new Web3DocServiceCriticalError('Failed to retrieve or verify the timestamp', error instanceof Error ? error : undefined);
        }
    }

    /**
     * Finds all timestamp IDs associated with a given document hash. Timestamp IDs can be used to retrieve and verify
     * timestamp entries on the blockchain.
     * 
     * @param hash The keccak256 hash of the document to search for.
     * @returns A promise that resolves to an array of timestamp IDs associated with the provided document hash.
     */
    public async findTimestampsByHash(hash: Uint8Array): Promise<bigint[]> {
        const timestamps = await this.web3doc.getTimestampLogsByHash(toHex(hash));
        return timestamps.map(t => t.id);
    }

    /*****************************************************************************************************************/
    /* DOCUMENT EXCHANGE                                                                                             */
    /*****************************************************************************************************************/

    // TODO: Implement document exchange methods (sendDocument, sendCopy, signDocument, etc.)
}
