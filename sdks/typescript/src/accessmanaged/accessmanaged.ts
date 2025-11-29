import { Address, TransactionReceipt, PublicClient, WalletClient, parseEventLogs } from 'viem';
import { IAccessManaged } from './accessmanaged.interface';
import { AuthorityUpdatedLog } from './types/types';
import { AccessManaged as AccessManagedABI } from '../abis/AccessManaged';
import { getBlockTimestamp } from '../utils/viemutils';

/**
 * Implementation of the AccessManaged contract interface.
 * 
 * This class provides low-level bindings to interact with contracts implementing the IAccessManaged interface
 * from OpenZeppelin's access management system.
 */
export class AccessManaged implements IAccessManaged {
    
    // Address of the AccessManaged contract
    private _address: Address;
    // Viem public client instance used to read from the blockchain
    private _client: PublicClient;
    // Viem wallet client instance used to sign transactions
    private _walletClient: WalletClient | undefined;

    /**
     * Creates a new AccessManaged instance.
     * 
     * @param address The address of the contract implementing IAccessManaged.
     * @param client A Viem public client for interacting with the blockchain.
     * @param walletClient Optional Viem wallet client for signing transactions.
     */
    constructor(address: Address, client: PublicClient, walletClient?: WalletClient) {
        this._address = address;
        this._client = client;
        this._walletClient = walletClient;
    }

    /*****************************************************************************************************************/
    /* GETTERS AND SETTERS                                                                                           */
    /*****************************************************************************************************************/

    /**
     * Gets the contract address.
     */
    get address(): Address {
        return this._address;
    }

    /**
     * Sets the contract address.
     */
    set address(value: Address) {
        this._address = value;
    }

    /**
     * Gets the Viem public client.
     */
    get client(): PublicClient {
        return this._client;
    }

    /**
     * Sets the Viem public client.
     */
    set client(client: PublicClient) {
        this._client = client;
    }

    /**
     * Gets the Viem wallet client.
     */
    get walletClient(): WalletClient | undefined {
        return this._walletClient;
    }

    /**
     * Sets the Viem wallet client.
     */
    set walletClient(value: WalletClient | undefined) {
        this._walletClient = value;
    }

    /**
     * Validate that a wallet client is available for write operations.
     * @throws Error if wallet client is not configured
     */
    protected ensureWalletClient(): void {
        if (!this._walletClient) {
            throw new Error('WalletClient is required for write operations. Please set walletClient before calling this method.');
        }
    }

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS                                                                                               */
    /*****************************************************************************************************************/

    /**
     * Updates the authority address that controls access to restricted functions.
     * 
     * @param newAuthority The address of the new authority contract.
     * @returns The transaction receipt of the update operation.
     */
    public async setAuthority(newAuthority: Address): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Simulate client call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: AccessManagedABI,
            functionName: 'setAuthority',
            args: [
                newAuthority
            ],
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /*****************************************************************************************************************/
    /* READ FUNCTIONS                                                                                                */
    /*****************************************************************************************************************/

    /**
     * Returns the address of the current authority contract.
     * 
     * @returns The address of the authority contract that controls access permissions.
     */
    public async authority(): Promise<Address> {
        return this.client.readContract({
            address: this.address,
            abi: AccessManagedABI,
            functionName: 'authority',
        }) as Promise<Address>;
    }

    /**
     * Indicates if the contract is currently consuming a scheduled operation.
     * 
     * @returns The function selector if consuming a scheduled op, or 0x00000000 otherwise.
     */
    public async isConsumingScheduledOp(): Promise<string> {
        return this.client.readContract({
            address: this.address,
            abi: AccessManagedABI,
            functionName: 'isConsumingScheduledOp',
        }) as Promise<string>;
    }

    /*****************************************************************************************************************/
    /* LOG SEARCH FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    /**
     * Searches for AuthorityUpdated events emitted by the smart contract.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of AuthorityUpdatedLog matching the provided filters.
     */
    public async searchAuthorityUpdatedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<AuthorityUpdatedLog[]> {
        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: AccessManagedABI.find(item => item.type === 'event' && item.name === 'AuthorityUpdated')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            authority: log.args.authority
        })));
    }

    /**
     * Extracts AuthorityUpdatedLog entries from a transaction receipt.
     * 
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of AuthorityUpdatedLog extracted from the receipt.
     */
    public async extractAuthorityUpdatedLog(receipt: TransactionReceipt): Promise<AuthorityUpdatedLog[]> {

        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: AccessManagedABI,
            eventName: 'AuthorityUpdated'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            authority: log.args.authority
        })));
    }
}
