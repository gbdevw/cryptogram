import { TransactionReceipt } from 'viem';
import * as openpgp from 'openpgp';
import { IWeb3DocService } from './web3doc.service.interface';
import { IWeb3Doc } from './web3doc.interface';

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
    constructor(message: string) {
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
    private _web3doc: IWeb3Doc;
    private _options: Required<Web3DocServiceOptions>;

    /**
     * Creates a new Web3DocService instance.
     * 
     * @param web3doc An instance implementing the IWeb3Doc interface.
     * @param options Optional configuration options for the service.
     */
    constructor(web3doc: IWeb3Doc, options?: Web3DocServiceOptions) {
        this._web3doc = web3doc;
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

    async timestamp(
        document: Uint8Array | ReadableStream<Uint8Array>,
        key: openpgp.PrivateKey,
        passphrase?: string
    ): Promise<[bigint, TransactionReceipt]>;
    
    async timestamp(
        hash: Uint8Array,
        key: openpgp.PrivateKey,
        passphrase?: string
    ): Promise<[bigint, TransactionReceipt]>;
    
    async timestamp(
        hash: Uint8Array,
        signature: openpgp.Signature,
        publicKey: openpgp.PublicKey
    ): Promise<[bigint, TransactionReceipt]>;
    
    async timestamp(
        document: Uint8Array | ReadableStream<Uint8Array>,
        signature: openpgp.Signature,
        publicKey: openpgp.PublicKey
    ): Promise<[bigint, TransactionReceipt]>;
    
    async timestamp(
        hash: Uint8Array,
        signature: openpgp.Signature,
        emitter: `0x${string}`
    ): Promise<[bigint, TransactionReceipt]>;
    
    async timestamp(
        document: Uint8Array | ReadableStream<Uint8Array>,
        signature: openpgp.Signature,
        emitter: `0x${string}`
    ): Promise<[bigint, TransactionReceipt]>;

    async timestamp(
        documentOrHash: Uint8Array | ReadableStream<Uint8Array>,
        keyOrSignature: openpgp.PrivateKey | openpgp.Signature,
        passphraseOrPublicKeyOrEmitter?: string | openpgp.PublicKey | `0x${string}`
    ): Promise<[bigint, TransactionReceipt]> {
        throw new Error('Not implemented');
    }

    /*****************************************************************************************************************/
    /* DOCUMENT EXCHANGE                                                                                             */
    /*****************************************************************************************************************/

    // TODO: Implement document exchange methods (sendDocument, sendCopy, signDocument, etc.)
}
