import { Address, TransactionReceipt, PublicClient, WalletClient, parseEventLogs } from 'viem';
import { IFlatFee } from './flatefee.interface';
import { RequestedFeeUpdatedLog, FeesWithdrawnLog } from './types/types';
import { FlatFee as FlatFeeABI } from '../abis/FlatFee';
import { getBlockTimestamp } from '../utils/viemutils';
import { AccessManaged } from '../accessmanaged/accessmanaged';

/**
 * Implementation of the FlatFee contract interface.
 * 
 * This class provides low-level bindings to interact with contracts implementing the IFlatFee interface.
 * Extends AccessManaged to inherit access control functionality.
 */
export class FlatFee extends AccessManaged implements IFlatFee {

    /**
     * Creates a new FlatFee instance.
     * 
     * @param address The address of the contract implementing IFlatFee.
     * @param client A Viem public client for interacting with the blockchain.
     * @param walletClient Optional Viem wallet client for signing transactions.
     */
    constructor(address: Address, client: PublicClient, walletClient?: WalletClient) {
        super(address, client, walletClient);
    }

    /*****************************************************************************************************************/
    /* WRITE FUNCTIONS                                                                                               */
    /*****************************************************************************************************************/

    /**
     * Updates the requested service fee.
     * 
     * @param newFee The new requested fee to be set.
     * @returns The transaction receipt of the update operation.
     */
    public async updateRequestedFee(newFee: bigint): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Simulate client call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: FlatFeeABI,
            functionName: 'updateRequestedFee',
            args: [
                newFee
            ],
        });
        // Use the wallet client to send the actual transaction
        const txhash = await this.walletClient!.writeContract(request);
        // Wait for transaction to be mined and return the receipt
        return this.client.waitForTransactionReceipt({ hash: txhash });
    }

    /**
     * Withdraws the full contract balance to the specified address.
     * @param to The address to which the fees are withdrawn.
     * @dev This function should be restricted to authorized users.
     */
    public async withdrawFees(to: Address): Promise<TransactionReceipt> {
        this.ensureWalletClient();
        // Simulate client call
        const { request } = await this.client.simulateContract({
            address: this.address,
            account: this.walletClient!.account,
            abi: FlatFeeABI,
            functionName: 'withdrawFees',
            args: [
                to
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
     * Indicate the fee requested by the smart contract to perform its operations.
     * @returns The requested fee in wei.
     */
    public async requestedFee(): Promise<bigint> {
        return this.client.readContract({
            address: this.address,
            abi: FlatFeeABI,
            functionName: 'requestedFee',
        });
    }

    /*****************************************************************************************************************/
    /* LOG SEARCH FUNCTIONS                                                                                          */
    /*****************************************************************************************************************/

    /**
     * Searches for RequestedFeeUpdated events emitted by the smart contract.
     * 
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of RequestedFeeUpdatedLog matching the provided filters.
     */
    public async searchRequestedFeeUpdatedLogs(
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<RequestedFeeUpdatedLog[]> {
        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        const logs = await this.client.getLogs({
            address: this.address,
            event: FlatFeeABI.find(item => item.type === 'event' && item.name === 'RequestedFeeUpdated')!,
            fromBlock: from,
            toBlock: to,
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            oldFee: log.args.oldFee,
            newFee: log.args.newFee
        })));
    }

    /**
     * Searches for FeesWithdrawn events emitted by the smart contract.
     * 
     * @param recipients Filter by recipient addresses.
     * @param fromBlock Filter events from this block number. Genesis block if not specified.
     * @param toBlock Filter events up to this block number. Latest block if not specified.
     * @returns The list of FeesWithdrawnLog matching the provided filters.
     */
    public async searchFeesWithdrawnLogs(
        recipients?: Address[],
        fromBlock?: bigint,
        toBlock?: bigint
    ): Promise<FeesWithdrawnLog[]> {
        // Use default values: fromBlock = 0n, toBlock = latest block
        const from = fromBlock ?? 0n;
        const to = toBlock ?? await this.client.getBlockNumber();

        // Build args filter if recipients are provided
        const args = recipients ? { to: recipients } : undefined;

        const logs = await this.client.getLogs({
            address: this.address,
            event: FlatFeeABI.find(item => item.type === 'event' && item.name === 'FeesWithdrawn')!,
            fromBlock: from,
            toBlock: to,
            ...(args !== undefined && { args })
        });
        
        return Promise.all(logs.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            to: log.args.to,
            amount: log.args.amount
        })));
    }

    /**
     * Extracts FeesWithdrawnLog entries from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of FeesWithdrawnLog extracted from the receipt.
     */
    public async extractFeesWithdrawnLog(receipt: TransactionReceipt): Promise<FeesWithdrawnLog[]> {

        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: FlatFeeABI,
            eventName: 'FeesWithdrawn'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            to: log.args.to,
            amount: log.args.amount
        })));
    }

    /**
     * Extracts RequestedFeeUpdatedLog entries from a transaction receipt.
     * @param receipt The transaction receipt to extract logs from.
     * @returns The list of RequestedFeeUpdatedLog extracted from the receipt.
     */
    public async extractRequestedFeeUpdatedLog(receipt: TransactionReceipt): Promise<RequestedFeeUpdatedLog[]> {

        const parsed = parseEventLogs({
            logs: receipt.logs,
            abi: FlatFeeABI,
            eventName: 'RequestedFeeUpdated'
        });

        return Promise.all(parsed.map(async log => ({
            blockNumber: log.blockNumber,
            blockHash: log.blockHash,
            blockTimestamp: await getBlockTimestamp(this.client, log.blockNumber),
            transactionHash: log.transactionHash,
            oldFee: log.args.oldFee,
            newFee: log.args.newFee
        })));
    }
}
