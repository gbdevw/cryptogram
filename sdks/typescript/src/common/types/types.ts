/**
 * Base type representing common properties of all event logs emitted by the Web3Doc smart contract.
 * 
 * @property transactionHash The hash of the transaction that emitted the event.
 * @property blockNumber The number of the block that contains the transaction.
 * @property blockHash The hash of the block that contains the transaction.
 * @property blockTimestamp The timestamp of the block that contains the transaction.
 */
export type BaseLog = {
    transactionHash: `0x${string}`;
    blockNumber: bigint;
    blockHash: `0x${string}`;
    blockTimestamp: Date;
}