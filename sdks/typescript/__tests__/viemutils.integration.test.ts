import { getBlockTimestamp } from '../src/utils/viemutils';
import { AnvilHelper } from './helpers/anvil.helper';
import { PublicClient } from 'viem';

/**
 * Integration tests for viemutils using real blockchain (Anvil)
 * 
 * These tests:
 * - Start a local Anvil blockchain
 * - Mine blocks with real timestamps
 * - Verify block timestamp retrieval
 * 
 * Unlike unit tests, these DO NOT use mocks and test the full stack.
 */
describe('Viemutils Integration Tests', () => {
    let anvil: AnvilHelper;
    let publicClient: PublicClient;

    beforeAll(async () => {
        // Use dynamic port based on Jest worker ID for parallel test execution
        const workerId = process.env.JEST_WORKER_ID ? parseInt(process.env.JEST_WORKER_ID) : 1;
        const port = 8545 + (workerId - 1) * 100; // Worker 1: 8545, Worker 2: 8645, Worker 3: 8745, Worker 4: 8845
        
        console.log(`Starting Anvil blockchain on port ${port} (Worker ${workerId})...`);
        anvil = new AnvilHelper({ port, blockTime: 0.01 });
        await anvil.start();
        console.log('Anvil started at', anvil.getRpcUrl());

        publicClient = anvil.getPublicClient();
    });

    afterAll(() => {
        console.log('Stopping Anvil blockchain...');
        anvil.stop();
    });

    describe('getBlockTimestamp', () => {
        it('should retrieve the timestamp of the genesis block (block 0)', async () => {
            const blockNumber = 0n;
            const timestamp = await getBlockTimestamp(publicClient, blockNumber);

            // Verify we get a valid Date object
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).toBeGreaterThan(0);
            
            // Genesis block should have a timestamp close to when Anvil started
            const now = new Date();
            const timeDiff = Math.abs(now.getTime() - timestamp.getTime());
            // Should be within a reasonable range (10 seconds)
            expect(timeDiff).toBeLessThan(10000);
        });

        it('should retrieve the timestamp of the latest block', async () => {
            // Get the latest block number
            const latestBlockNumber = await publicClient.getBlockNumber();
            const timestamp = await getBlockTimestamp(publicClient, latestBlockNumber);

            // Verify we get a valid Date object
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).toBeGreaterThan(0);
            
            // Latest block should have a very recent timestamp
            const now = new Date();
            const timeDiff = Math.abs(now.getTime() - timestamp.getTime());
            // Should be within a few seconds
            expect(timeDiff).toBeLessThan(5000);
        });

        it('should retrieve timestamps for multiple blocks in chronological order', async () => {
            // Get current block number
            const currentBlock = await publicClient.getBlockNumber();
            
            // Mine a few new blocks to ensure we have multiple blocks
            const walletClient = anvil.getWalletClient();
            
            // Send some transactions to mine new blocks
            for (let i = 0; i < 3; i++) {
                await walletClient.sendTransaction({
                    account: walletClient.account!,
                    to: walletClient.account!.address,
                    value: 0n,
                });
                // Wait a bit for block to be mined
                await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for blockTime + buffer
            }

            // Get timestamps for a sequence of blocks
            const block1 = currentBlock;
            const block2 = currentBlock + 1n;
            const block3 = currentBlock + 2n;

            const timestamp1 = await getBlockTimestamp(publicClient, block1);
            const timestamp2 = await getBlockTimestamp(publicClient, block2);
            const timestamp3 = await getBlockTimestamp(publicClient, block3);

            // Verify all are valid Date objects
            expect(timestamp1).toBeInstanceOf(Date);
            expect(timestamp2).toBeInstanceOf(Date);
            expect(timestamp3).toBeInstanceOf(Date);

            // Verify chronological order (later blocks should have later timestamps)
            expect(timestamp2.getTime()).toBeGreaterThanOrEqual(timestamp1.getTime());
            expect(timestamp3.getTime()).toBeGreaterThanOrEqual(timestamp2.getTime());
        });

        it('should handle different block numbers correctly', async () => {
            const blockNumbers = [0n, 1n, 2n];
            const timestamps: Date[] = [];

            for (const blockNum of blockNumbers) {
                const timestamp = await getBlockTimestamp(publicClient, blockNum);
                timestamps.push(timestamp);
            }

            // All should be valid dates
            timestamps.forEach(ts => {
                expect(ts).toBeInstanceOf(Date);
                expect(ts.getTime()).toBeGreaterThan(0);
            });

            // Block 1 should be after block 0
            expect(timestamps[1]!.getTime()).toBeGreaterThanOrEqual(timestamps[0]!.getTime());
            // Block 2 should be after block 1
            expect(timestamps[2]!.getTime()).toBeGreaterThanOrEqual(timestamps[1]!.getTime());
        });

        it('should return consistent results when called multiple times for the same block', async () => {
            const blockNumber = 0n;
            
            const timestamp1 = await getBlockTimestamp(publicClient, blockNumber);
            const timestamp2 = await getBlockTimestamp(publicClient, blockNumber);
            const timestamp3 = await getBlockTimestamp(publicClient, blockNumber);

            // All timestamps should be identical
            expect(timestamp1.getTime()).toBe(timestamp2.getTime());
            expect(timestamp2.getTime()).toBe(timestamp3.getTime());
        });

        it('should correctly convert blockchain timestamp (seconds) to JavaScript Date (milliseconds)', async () => {
            const blockNumber = 0n;
            const timestamp = await getBlockTimestamp(publicClient, blockNumber);

            // Get the raw block to verify conversion
            const block = await publicClient.getBlock({ blockNumber });
            const expectedTimestamp = new Date(Number(block.timestamp) * 1000);

            // Should match exactly
            expect(timestamp.getTime()).toBe(expectedTimestamp.getTime());
        });
    });
});
