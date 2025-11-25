import { PublicClient } from 'viem';

export async function getBlockTimestamp(client: PublicClient, blockNumber: bigint): Promise<Date> {
    const block = await client.getBlock({ blockNumber });
    return new Date(Number(block.timestamp) * 1000);
}