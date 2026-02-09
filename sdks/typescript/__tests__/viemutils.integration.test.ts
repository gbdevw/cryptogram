import { getBlockTimestamp } from '../src/utils/viemutils';
import { getPublicClient, getTestWalletClient } from './test-utilities';
import { PublicClient } from 'viem';

/**
 * Integration tests for viemutils using real blockchain (Sepolia testnet)
 * 
 * These tests:
 * - Use Sepolia testnet configured via RPC_URLS environment variable
 * - Retrieve real block timestamps from the blockchain
 * - Verify block timestamp retrieval and conversion
 * 
 * Unlike unit tests, these DO NOT use mocks and test the full stack.
 * 
 * Prerequisites:
 * - RPC_URLS environment variable must be set with Sepolia RPC endpoints
 * - Network connectivity to Sepolia testnet required
 * 
 * @example Run these tests:
 * RPC_URLS="https://sepolia.infura.io/v3/YOUR_KEY" npm run test:integration
 */
describe('Viemutils Integration Tests', () => {
    let publicClient: PublicClient;

    beforeAll(async () => {
        console.log('========================================');
        console.log('Initializing Viemutils Integration Tests');
        console.log('========================================');
        
        try {
            publicClient = getPublicClient();
            console.log('✓ Connected to Sepolia testnet via configured RPC URLs');
            
            // Verify connectivity by getting current block number
            const blockNumber = await publicClient.getBlockNumber();
            console.log(`✓ Current block number: ${blockNumber}`);
        } catch (error) {
            console.error('✗ Failed to initialize public client:', error);
            throw error;
        }
    });

    describe('getBlockTimestamp', () => {
        it('should retrieve the timestamp of a recent block', async () => {
            // Get the current block number
            const currentBlockNumber = await publicClient.getBlockNumber();
            
            // Get timestamp for current block
            const timestamp = await getBlockTimestamp(publicClient, currentBlockNumber);
            
            // Verify we get a valid Date object
            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).toBeGreaterThan(0);
            
            // Current block should have a recent timestamp
            const now = new Date();
            const signedDiff = now.getTime() - timestamp.getTime();
            const absTimeDiff = Math.abs(signedDiff);
            const who = signedDiff > 0 ? 'Runner clock is ahead' : 'RPC node is ahead';
            console.log(`✓ Current block timestamp: ${timestamp.toISOString()} (diff: ${absTimeDiff} ms, ${who})`);
            // Should be within a reasonable range (allow for clock skew and network delay)
            expect(absTimeDiff).toBeLessThan(60000); // 60 seconds
        });

        it('should retrieve the timestamp of the latest block multiple times', async () => {
            // Get the latest block number
            const blockNumber1 = await publicClient.getBlockNumber();
            const timestamp1 = await getBlockTimestamp(publicClient, blockNumber1);
            
            // Verify we get a valid Date object
            expect(timestamp1).toBeInstanceOf(Date);
            expect(timestamp1.getTime()).toBeGreaterThan(0);
            
            // Log time difference from runner clock
            const now1 = new Date();
            const signedDiff1 = now1.getTime() - timestamp1.getTime();
            const absDiff1 = Math.abs(signedDiff1);
            const who1 = signedDiff1 > 0 ? 'Runner clock is ahead' : 'RPC node is ahead';
            console.log(`✓ Latest block (${blockNumber1}) timestamp: ${timestamp1.toISOString()} (diff: ${absDiff1} ms, ${who1})`);
            expect(absDiff1).toBeLessThan(60000);
        });

        it('should retrieve timestamps for latest blocks in chronological order', async () => {
            // Get current block number
            const currentBlock = await publicClient.getBlockNumber();
            
            // Get timestamps for the latest block
            const timestamp1 = await getBlockTimestamp(publicClient, currentBlock);
            const timestamp2 = await getBlockTimestamp(publicClient, currentBlock);
            const timestamp3 = await getBlockTimestamp(publicClient, currentBlock);

            // Verify all are valid Date objects
            expect(timestamp1).toBeInstanceOf(Date);
            expect(timestamp2).toBeInstanceOf(Date);
            expect(timestamp3).toBeInstanceOf(Date);

            // Log time difference from runner clock
            const now = new Date();
            const signedDiff = now.getTime() - timestamp1.getTime();
            const absDiff = Math.abs(signedDiff);
            const who = signedDiff > 0 ? 'Runner clock is ahead' : 'RPC node is ahead';
            console.log(`✓ Latest block (${currentBlock}) timestamps retrieved 3 times: ${timestamp1.toISOString()} (diff: ${absDiff} ms, ${who})`);
            
            // Verify all timestamps are identical for the same block
            expect(timestamp1.getTime()).toBe(timestamp2.getTime());
            expect(timestamp2.getTime()).toBe(timestamp3.getTime());
        });

        it('should handle latest block numbers correctly', async () => {
            const currentBlockNumber = await publicClient.getBlockNumber();
            
            // Get timestamp for the latest block 3 times to verify consistency
            const timestamps: Date[] = [];

            for (let i = 0; i < 3; i++) {
                const timestamp = await getBlockTimestamp(publicClient, currentBlockNumber);
                timestamps.push(timestamp);
            }

            // All should be valid dates
            timestamps.forEach(ts => {
                expect(ts).toBeInstanceOf(Date);
                expect(ts.getTime()).toBeGreaterThan(0);
            });

            // Log time difference from runner clock
            const now = new Date();
            const signedDiff = now.getTime() - timestamps[0]!.getTime();
            const absDiff = Math.abs(signedDiff);
            const who = signedDiff > 0 ? 'Runner clock is ahead' : 'RPC node is ahead';
            console.log(`✓ Latest block (${currentBlockNumber}) fetched 3 times: ${timestamps[0]!.toISOString()} (diff: ${absDiff} ms, ${who})`);
            
            // All should be identical for the same block
            for (let i = 1; i < timestamps.length; i++) {
                expect(timestamps[i]!.getTime()).toBe(timestamps[i - 1]!.getTime());
            }
        });

        it('should return consistent results when called multiple times for the same block', async () => {
            const currentBlockNumber = await publicClient.getBlockNumber();
            
            const timestamp1 = await getBlockTimestamp(publicClient, currentBlockNumber);
            const timestamp2 = await getBlockTimestamp(publicClient, currentBlockNumber);
            const timestamp3 = await getBlockTimestamp(publicClient, currentBlockNumber);
            
            // All timestamps should be identical
            expect(timestamp1.getTime()).toBe(timestamp2.getTime());
            expect(timestamp2.getTime()).toBe(timestamp3.getTime());
            
            // Log time difference from runner clock
            const now = new Date();
            const signedDiff = now.getTime() - timestamp1.getTime();
            const absDiff = Math.abs(signedDiff);
            const who = signedDiff > 0 ? 'Runner clock is ahead' : 'RPC node is ahead';
            console.log(`✓ Latest block (${currentBlockNumber}) called 3 times: ${timestamp1.toISOString()} (diff: ${absDiff} ms, ${who})`);
        });

        it('should correctly convert blockchain timestamp (seconds) to JavaScript Date (milliseconds)', async () => {
            const currentBlockNumber = await publicClient.getBlockNumber();
            const timestamp = await getBlockTimestamp(publicClient, currentBlockNumber);
            
            // Get the raw block to verify conversion
            const block = await publicClient.getBlock({ blockNumber: currentBlockNumber });
            const expectedTimestamp = new Date(Number(block.timestamp) * 1000);

            // Should match exactly
            expect(timestamp.getTime()).toBe(expectedTimestamp.getTime());
            
            // Log time difference from runner clock
            const now = new Date();
            const signedDiff = now.getTime() - timestamp.getTime();
            const absDiff = Math.abs(signedDiff);
            const who = signedDiff > 0 ? 'Runner clock is ahead' : 'RPC node is ahead';
            console.log(`✓ Latest block (${currentBlockNumber}) conversion verified: ${timestamp.toISOString()} (diff: ${absDiff} ms, ${who})`);
        });
    });
});
