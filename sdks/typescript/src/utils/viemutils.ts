import { PublicClient } from 'viem';

/**
 * Gets the timestamp of a specific block number.
 * @param client The Viem public client to interact with the blockchain.
 * @param blockNumber The block number to get the timestamp for.
 * @returns The timestamp of the block as a Date object.
 */
export async function getBlockTimestamp(client: PublicClient, blockNumber: bigint): Promise<Date> {
    const block = await client.getBlock({ blockNumber });
    return new Date(Number(block.timestamp) * 1000);
}