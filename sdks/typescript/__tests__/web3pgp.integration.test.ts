import { getBlockTimestamp } from '../src/utils/viemutils';
import { Web3PGP } from '../src/web3pgp/web3pgp';
import { AnvilHelper } from './helpers/anvil.helper';
import { Address } from 'viem';

/**
 * Integration tests for Web3PGP contract using real blockchain (Anvil)
 * 
 * These tests:
 * - Start a local Anvil blockchain
 * - Deploy real contracts
 * - Execute actual transactions
 * - Verify on-chain state
 * 
 * Unlike unit tests, these DO NOT use mocks and test the full stack.
 */
describe('Web3PGP Integration Tests', () => {
    let anvil: AnvilHelper;
    let web3pgp: Web3PGP;
    let contractAddress: Address;

    // Helper to generate unique fingerprints for test isolation
    const generateUniqueFingerprint = (): `0x${string}` => {
        const timestamp = Date.now().toString(16).padStart(16, '0');
        const random = Math.random().toString(16).substring(2, 18).padStart(16, '0');
        const unique = (timestamp + random).padStart(64, '0').substring(0, 64);
        return `0x${unique}` as `0x${string}`;
    };

    // Test data (mock OpenPGP data - we're testing blockchain interactions, not PGP validation)
    const mockFingerprint1 = '0x1111111111111111111111111111111111111111111111111111111111111111' as `0x${string}`;
    const mockFingerprint2 = '0x2222222222222222222222222222222222222222222222222222222222222222' as `0x${string}`;
    const mockFingerprint3 = '0x3333333333333333333333333333333333333333333333333333333333333333' as `0x${string}`;
    const mockOpenPGPMsg = '0xdeadbeef' as `0x${string}`;
    const mockRevocationCert = '0xcafebabe' as `0x${string}`;

    beforeAll(async () => {
        console.log('========================================');
        console.log('Setting up Web3PGP Integration Tests');
        console.log('========================================');
        
        console.log('Starting Anvil blockchain...');
        anvil = new AnvilHelper({ port: 8545, blockTime: 1 });
        await anvil.start();
        console.log('✓ Anvil started at', anvil.getRpcUrl());

        console.log('Deploying contracts via Foundry scripts...');
        // Deploy contracts with proper UUPS proxy setup using Foundry scripts
        // This matches production deployment exactly
        const deployed = await anvil.deployWeb3PGP(0n); // Initialize with 0 fee
        contractAddress = deployed.web3pgp; // Use proxy address
        
        console.log('✓ Deployment summary:');
        console.log('  - AccessManager:', deployed.accessManager);
        console.log('  - Implementation:', deployed.implementation);
        console.log('  - Proxy (Web3PGP):', deployed.proxy);
        console.log('  - Roles: ADMIN(0), UPGRADE_MANAGER(1), TREASURER(2)');
        console.log('Using Web3PGP contract at:', contractAddress);

        // Create Web3PGP instance with real clients
        const publicClient = anvil.getPublicClient();
        const walletClient = anvil.getWalletClient(0);

        web3pgp = new Web3PGP(contractAddress, publicClient, walletClient);
        console.log('✓ Web3PGP SDK initialized');
        console.log('========================================\n');
    }, 120000); // Increased timeout for Foundry script execution (2 minutes)

    afterAll(async () => {
        console.log('Stopping Anvil...');
        anvil.stop();
    });

    describe('Contract Initialization', () => {
        test('should verify contract is deployed', async () => {
            const publicClient = anvil.getPublicClient();
            const code = await publicClient.getBytecode({ address: contractAddress });
            expect(code).toBeDefined();
            expect(code).not.toBe('0x');
        });

        test('should read requested fee', async () => {
            const fee = await web3pgp.requestedFee();
            expect(fee).toBeDefined();
            expect(typeof fee).toBe('bigint');
        });
    });

    describe('Key Registration', () => {
        test('should register a new primary key', async () => {
            // Check key doesn't exist yet
            const existsBefore = await web3pgp.exists(mockFingerprint1);
            expect(existsBefore).toBe(false);

            // Register the key
            const receipt = await web3pgp.register(mockFingerprint1, [], mockOpenPGPMsg);
            
            expect(receipt.status).toBe('success');
            expect(receipt.blockNumber).toBeGreaterThan(0n);

            // Verify key now exists
            const existsAfter = await web3pgp.exists(mockFingerprint1);
            expect(existsAfter).toBe(true);

            // Verify publication block
            const pubBlock = await web3pgp.getKeyPublicationBlock(mockFingerprint1);
            expect(pubBlock).toBe(receipt.blockNumber);

            // Verify it's not a subkey
            const isSubkey = await web3pgp.isSubKey(mockFingerprint1);
            expect(isSubkey).toBe(false);
        });

        test('should register a primary key with subkeys', async () => {
            const subkeys = [mockFingerprint2, mockFingerprint3];

            // Register primary key with subkeys
            const receipt = await web3pgp.register(
                '0x4444444444444444444444444444444444444444444444444444444444444444' as `0x${string}`,
                subkeys,
                mockOpenPGPMsg
            );

            expect(receipt.status).toBe('success');

            // Verify subkeys exist and have correct parent
            for (const subkey of subkeys) {
                const exists = await web3pgp.exists(subkey);
                expect(exists).toBe(true);

                const isSubkey = await web3pgp.isSubKey(subkey);
                expect(isSubkey).toBe(true);

                const parent = await web3pgp.parentOf(subkey);
                expect(parent).toBe('0x4444444444444444444444444444444444444444444444444444444444444444');
            }
        });

        test('should list registered subkeys', async () => {
            const parentKey = '0x5555555555555555555555555555555555555555555555555555555555555555' as `0x${string}`;
            const subkey1 = '0x6666666666666666666666666666666666666666666666666666666666666666' as `0x${string}`;
            const subkey2 = '0x7777777777777777777777777777777777777777777777777777777777777777' as `0x${string}`;

            // Register parent with subkeys
            await web3pgp.register(parentKey, [subkey1, subkey2], mockOpenPGPMsg);

            // List subkeys
            const subkeys = await web3pgp.listSubkeys(parentKey, 0n, 10n);
            
            expect(subkeys).toHaveLength(2);
            expect(subkeys).toContain(subkey1);
            expect(subkeys).toContain(subkey2);
        });

        test('should handle pagination in subkey listing', async () => {
            const parentKey = '0x8888888888888888888888888888888888888888888888888888888888888888' as `0x${string}`;
            const subkeys = [
                '0x9999999999999999999999999999999999999999999999999999999999999999' as `0x${string}`,
                '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as `0x${string}`,
                '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`,
            ];

            await web3pgp.register(parentKey, subkeys, mockOpenPGPMsg);

            // Get first 2 subkeys
            const page1 = await web3pgp.listSubkeys(parentKey, 0n, 2n);
            expect(page1).toHaveLength(2);

            // Get next subkey
            const page2 = await web3pgp.listSubkeys(parentKey, 2n, 2n);
            expect(page2).toHaveLength(1);

            // Verify all subkeys are present across pages
            const allSubkeys = [...page1, ...page2];
            expect(allSubkeys).toHaveLength(3);
            subkeys.forEach(sk => {
                expect(allSubkeys).toContain(sk);
            });
        });
    });

    describe('Subkey Addition', () => {
        const primaryKey = '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc' as `0x${string}`;
        const newSubkey = '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd' as `0x${string}`;

        beforeAll(async () => {
            // Register primary key first
            await web3pgp.register(primaryKey, [], mockOpenPGPMsg);
        });

        test('should add subkey to existing primary key', async () => {
            const receipt = await web3pgp.addSubkey(primaryKey, newSubkey, mockOpenPGPMsg);
            
            expect(receipt.status).toBe('success');

            // Verify subkey exists
            const exists = await web3pgp.exists(newSubkey);
            expect(exists).toBe(true);

            // Verify it's marked as subkey
            const isSubkey = await web3pgp.isSubKey(newSubkey);
            expect(isSubkey).toBe(true);

            // Verify correct parent
            const parent = await web3pgp.parentOf(newSubkey);
            expect(parent).toBe(primaryKey);
        });
    });

    describe('Key Revocation', () => {
        const keyToRevoke = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' as `0x${string}`;

        beforeAll(async () => {
            // Register key first
            await web3pgp.register(keyToRevoke, [], mockOpenPGPMsg);
        });

        test('should publish revocation certificate', async () => {
            // Get revocations before
            const revocationsBefore = await web3pgp.listRevocations(keyToRevoke, 0n, 10n);
            expect(revocationsBefore).toHaveLength(0);

            // Publish revocation
            const receipt = await web3pgp.revoke(keyToRevoke, mockRevocationCert);
            expect(receipt.status).toBe('success');

            // Get revocations after
            const revocationsAfter = await web3pgp.listRevocations(keyToRevoke, 0n, 10n);
            expect(revocationsAfter).toHaveLength(1);
            expect(revocationsAfter[0]).toBe(receipt.blockNumber);
        });

        test('should allow multiple revocations', async () => {
            const key = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff' as `0x${string}`;
            
            await web3pgp.register(key, [], mockOpenPGPMsg);

            // Publish multiple revocation certificates
            const receipt1 = await web3pgp.revoke(key, mockRevocationCert);
            const receipt2 = await web3pgp.revoke(key, '0x1234' as `0x${string}`);
            const receipt3 = await web3pgp.revoke(key, '0x5678' as `0x${string}`);

            // List all revocations
            const revocations = await web3pgp.listRevocations(key, 0n, 10n);
            expect(revocations).toHaveLength(3);
            expect(revocations).toContain(receipt1.blockNumber);
            expect(revocations).toContain(receipt2.blockNumber);
            expect(revocations).toContain(receipt3.blockNumber);
        });
    });

    describe('Event Logs', () => {
        const logTestKey = '0x1010101010101010101010101010101010101010101010101010101010101010' as `0x${string}`;
        const logTestSubkey = '0x2020202020202020202020202020202020202020202020202020202020202020' as `0x${string}`;

        test('should retrieve KeyRegistered event log', async () => {
            const receipt = await web3pgp.register(logTestKey, [logTestSubkey], mockOpenPGPMsg);

            // Get specific log
            const log = await web3pgp.getKeyRegisteredLog(logTestKey, receipt.blockNumber);

            expect(log.primaryKeyFingerprint).toBe(logTestKey);
            expect(log.subkeyFingerprints).toContain(logTestSubkey);
            expect(log.openPGPMsg).toBe(mockOpenPGPMsg);
            expect(log.blockNumber).toBe(receipt.blockNumber);
            expect(log.transactionHash).toBe(receipt.transactionHash);
        });

        test('should search KeyRegistered event logs', async () => {
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();

            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);

            // Search for all logs without specifying block range (should use defaults)
            const allLogs = await web3pgp.searchKeyRegisteredLogs();
            expect(allLogs.length).toBeGreaterThan(0);

            // Search for specific key without block range (should use defaults)
            const key1Logs = await web3pgp.searchKeyRegisteredLogs(key1);
            expect(key1Logs).toHaveLength(1);
            expect(key1Logs[0]!.primaryKeyFingerprint).toBe(key1);

            // Search for multiple keys without block range (should use defaults)
            const multipleLogs = await web3pgp.searchKeyRegisteredLogs([key1, key2]);
            expect(multipleLogs.length).toBeGreaterThanOrEqual(2);
        });

        test('should retrieve SubkeyAdded event log', async () => {
            const primary = '0x5050505050505050505050505050505050505050505050505050505050505050' as `0x${string}`;
            const subkey = '0x6060606060606060606060606060606060606060606060606060606060606060' as `0x${string}`;

            await web3pgp.register(primary, [], mockOpenPGPMsg);
            const receipt = await web3pgp.addSubkey(primary, subkey, mockOpenPGPMsg);

            const log = await web3pgp.getSubkeyAddedLog(primary, subkey, receipt.blockNumber);

            expect(log.primaryKeyFingerprint).toBe(primary);
            expect(log.subkeyFingerprint).toBe(subkey);
            expect(log.openPGPMsg).toBe(mockOpenPGPMsg);
        });

        test('should retrieve KeyRevoked event log', async () => {
            const key = '0x7070707070707070707070707070707070707070707070707070707070707070' as `0x${string}`;

            await web3pgp.register(key, [], mockOpenPGPMsg);
            const receipt = await web3pgp.revoke(key, mockRevocationCert);

            const log = await web3pgp.getKeyRevokedLog(key, receipt.blockNumber);

            expect(log.fingerprint).toBe(key);
            expect(log.revocationCertificate).toBe(mockRevocationCert);
            expect(log.blockNumber).toBe(receipt.blockNumber);
        });
    });

    describe('Batch Operations', () => {
        test('should get publication blocks for multiple keys', async () => {
            const key1 = '0x8080808080808080808080808080808080808080808080808080808080808080' as `0x${string}`;
            const key2 = '0x9090909090909090909090909090909090909090909090909090909090909090' as `0x${string}`;
            const key3 = '0xa0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0' as `0x${string}`;

            const receipt1 = await web3pgp.register(key1, [], mockOpenPGPMsg);
            const receipt2 = await web3pgp.register(key2, [], mockOpenPGPMsg);

            // Batch get publication blocks (including non-existent key)
            const blocks = await web3pgp.getKeyPublicationBlockBatch([key1, key2, key3]);

            expect(blocks).toHaveLength(3);
            expect(blocks[0]).toBe(receipt1.blockNumber);
            expect(blocks[1]).toBe(receipt2.blockNumber);
            expect(blocks[2]).toBe(0n); // Non-existent key returns 0
        });
    });

    describe('Utility Functions', () => {
        test('should get block timestamp', async () => {
            const publicClient = anvil.getPublicClient();
            const blockNumber = await publicClient.getBlockNumber();

            const timestamp = await getBlockTimestamp(publicClient, blockNumber);

            expect(timestamp).toBeInstanceOf(Date);
            expect(timestamp.getTime()).toBeGreaterThan(0);
        });
    });

    describe('Fee Management (Restricted Functions)', () => {
        test('should read current requested fee', async () => {
            const fee = await web3pgp.requestedFee();
            expect(fee).toBe(0n); // Deployed with 0 fee
        });

        test('should update requested fee (admin only)', async () => {
            const newFee = BigInt(1000000); // 0.000001 ETH in wei

            // Update the fee (account 0 is admin in deployment)
            const receipt = await web3pgp.updateRequestedFee(newFee);
            expect(receipt.status).toBe('success');

            // Verify fee was updated
            const updatedFee = await web3pgp.requestedFee();
            expect(updatedFee).toBe(newFee);

            // Reset fee back to 0 for other tests
            await web3pgp.updateRequestedFee(0n);
        });

        test('should register key with fee when fee is set', async () => {
            const testFee = BigInt(100000); // Small fee
            const testKey = generateUniqueFingerprint();

            // Set a fee
            await web3pgp.updateRequestedFee(testFee);

            // Register key with fee
            const receipt = await web3pgp.register(testKey, [], mockOpenPGPMsg);
            expect(receipt.status).toBe('success');

            // Verify key was registered
            const exists = await web3pgp.exists(testKey);
            expect(exists).toBe(true);

            // Reset fee
            await web3pgp.updateRequestedFee(0n);
        });

        test('should withdraw accumulated fees (admin only)', async () => {
            const publicClient = anvil.getPublicClient();
            const recipientAddress = anvil.accounts[1]!.address;

            // Set a fee
            const fee = BigInt(100000);
            await web3pgp.updateRequestedFee(fee);

            // Register some keys to accumulate fees
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);

            // Get recipient balance before withdrawal
            const balanceBefore = await publicClient.getBalance({ address: recipientAddress });

            // Withdraw fees
            const receipt = await web3pgp.withdrawFees(recipientAddress);
            expect(receipt.status).toBe('success');

            // Get recipient balance after withdrawal
            const balanceAfter = await publicClient.getBalance({ address: recipientAddress });

            // Balance should have increased (at least by the fees collected)
            expect(balanceAfter).toBeGreaterThan(balanceBefore);
            const increase = balanceAfter - balanceBefore;
            expect(increase).toBeGreaterThanOrEqual(fee * 2n); // At least 2 registrations worth of fees

            // Reset fee
            await web3pgp.updateRequestedFee(0n);
        });

        test('should search RequestedFeeUpdated event logs', async () => {
            const oldFee = await web3pgp.requestedFee();
            const newFee = BigInt(500000);

            // Update fee
            const receipt = await web3pgp.updateRequestedFee(newFee);

            // Search for fee update logs
            const logs = await web3pgp.searchRequestedFeeUpdatedLogs(receipt.blockNumber, receipt.blockNumber);

            expect(logs.length).toBeGreaterThan(0);
            const log = logs.find(l => l.blockNumber === receipt.blockNumber);
            expect(log).toBeDefined();
            expect(log!.oldFee).toBe(oldFee);
            expect(log!.newFee).toBe(newFee);
            expect(log!.blockTimestamp).toBeInstanceOf(Date);

            // Reset fee
            await web3pgp.updateRequestedFee(0n);
        });

        test('should extract RequestedFeeUpdated log from receipt', async () => {
            const newFee = BigInt(750000);

            // Update fee
            const receipt = await web3pgp.updateRequestedFee(newFee);

            // Extract log from receipt
            const logs = await web3pgp.extractRequestedFeeUpdatedLog(receipt);

            expect(logs).toHaveLength(1);
            expect(logs[0]!.newFee).toBe(newFee);
            expect(logs[0]!.transactionHash).toBe(receipt.transactionHash);

            // Reset fee
            await web3pgp.updateRequestedFee(0n);
        });

        test('should search FeesWithdrawn event logs', async () => {
            const recipientAddress = anvil.accounts[2]!.address;

            // Set fee and register keys to accumulate fees
            await web3pgp.updateRequestedFee(BigInt(100000));
            await web3pgp.register(generateUniqueFingerprint(), [], mockOpenPGPMsg);
            await web3pgp.register(generateUniqueFingerprint(), [], mockOpenPGPMsg);

            // Withdraw fees
            const receipt = await web3pgp.withdrawFees(recipientAddress);

            // Search for withdrawal logs
            const logs = await web3pgp.searchFeesWithdrawnLogs([recipientAddress], receipt.blockNumber, receipt.blockNumber);

            expect(logs.length).toBeGreaterThan(0);
            const log = logs.find(l => l.blockNumber === receipt.blockNumber);
            expect(log).toBeDefined();
            expect(log!.to).toBe(recipientAddress);
            expect(log!.amount).toBeGreaterThan(0n);
            expect(log!.blockTimestamp).toBeInstanceOf(Date);

            // Reset fee
            await web3pgp.updateRequestedFee(0n);
        });

        test('should extract FeesWithdrawn log from receipt', async () => {
            const recipientAddress = anvil.accounts[3]!.address;

            // Set fee and register keys
            await web3pgp.updateRequestedFee(BigInt(100000));
            await web3pgp.register(generateUniqueFingerprint(), [], mockOpenPGPMsg);

            // Withdraw fees
            const receipt = await web3pgp.withdrawFees(recipientAddress);

            // Extract log from receipt
            const logs = await web3pgp.extractFeesWithdrawnLog(receipt);

            expect(logs).toHaveLength(1);
            expect(logs[0]!.to).toBe(recipientAddress);
            expect(logs[0]!.amount).toBeGreaterThan(0n);
            expect(logs[0]!.transactionHash).toBe(receipt.transactionHash);

            // Reset fee
            await web3pgp.updateRequestedFee(0n);
        });

        test('should handle fee updates across multiple operations', async () => {
            const fee1 = BigInt(100000);
            const fee2 = BigInt(200000);
            const fee3 = BigInt(150000);

            // Multiple fee updates
            await web3pgp.updateRequestedFee(fee1);
            let currentFee = await web3pgp.requestedFee();
            expect(currentFee).toBe(fee1);

            await web3pgp.updateRequestedFee(fee2);
            currentFee = await web3pgp.requestedFee();
            expect(currentFee).toBe(fee2);

            await web3pgp.updateRequestedFee(fee3);
            currentFee = await web3pgp.requestedFee();
            expect(currentFee).toBe(fee3);

            // Reset
            await web3pgp.updateRequestedFee(0n);
        });
    });

    describe('Blockchain State Management', () => {
        test('should use snapshots for state isolation', async () => {
            const testKey = '0xb0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0' as `0x${string}`;

            // Take snapshot
            const snapshotId = await anvil.snapshot();

            // Register a key
            await web3pgp.register(testKey, [], mockOpenPGPMsg);
            const existsAfterReg = await web3pgp.exists(testKey);
            expect(existsAfterReg).toBe(true);

            // Revert to snapshot
            await anvil.revert(snapshotId);

            // Key should no longer exist
            const existsAfterRevert = await web3pgp.exists(testKey);
            expect(existsAfterRevert).toBe(false);
        });

        test('should mine blocks on demand', async () => {
            const publicClient = anvil.getPublicClient();
            
            // Register a key to create a transaction and mine a block
            const startBlock = await publicClient.getBlockNumber();
            const testKey = generateUniqueFingerprint();
            
            // This will cause a block to be mined
            await web3pgp.register(testKey, [], mockOpenPGPMsg);
            
            const endBlock = await publicClient.getBlockNumber();
            
            // At least one block should have been mined for the transaction
            expect(endBlock).toBeGreaterThan(startBlock);
        });
    });
});
