import { getBlockTimestamp } from '../src/utils/viemutils';
import { Web3PGP } from '../src/web3pgp/web3pgp';
import { Address, createPublicClient, createWalletClient, http } from 'viem';
import { foundry } from 'viem/chains';
import { getPublicClient, getTestWalletClient, getContractAddress } from '../src/utils/test-wallet';
import { KeyRegisteredLog, SubkeyAddedLog, KeyRevokedLog, KeyUpdatedLog, OwnershipChallengedLog, OwnershipProvedLog, KeyCertifiedLog, KeyCertificationRevokedLog, Web3PGPEvents } from '../src/web3pgp/types/types';

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
    let web3pgp: Web3PGP;
    let contractAddress: Address;

    // Type guards for narrowing union types
    const isKeyRegisteredLog = (log: KeyRegisteredLog | SubkeyAddedLog | KeyRevokedLog): log is KeyRegisteredLog => {
        return 'subkeyFingerprints' in log && !('fingerprint' in log);
    };

    const isSubkeyAddedLog = (log: KeyRegisteredLog | SubkeyAddedLog | KeyRevokedLog): log is SubkeyAddedLog => {
        return 'subkeyFingerprint' in log && 'primaryKeyFingerprint' in log && !('subkeyFingerprints' in log);
    };

    const isKeyRevokedLog = (log: KeyRegisteredLog | SubkeyAddedLog | KeyRevokedLog): log is KeyRevokedLog => {
        return 'fingerprint' in log && 'revocationCertificate' in log;
    };

    const isKeyUpdatedLog = (log: any): log is KeyUpdatedLog => {
        return 'fingerprint' in log && 'openPGPMsg' in log && !('subkeyFingerprints' in log) && !('subkeyFingerprint' in log);
    };

    const isOwnershipChallengedLog = (log: any): log is OwnershipChallengedLog => {
        return 'fingerprint' in log && 'challenge' in log && !('signature' in log);
    };

    const isOwnershipProvedLog = (log: any): log is OwnershipProvedLog => {
        return 'fingerprint' in log && 'challenge' in log && 'signature' in log;
    };

    const isKeyCertifiedLog = (log: any): log is KeyCertifiedLog => {
        return 'fingerprint' in log && 'issuerFingerprint' in log && 'keyCertificate' in log;
    };

    const isKeyCertificationRevokedLog = (log: any): log is KeyCertificationRevokedLog => {
        return 'fingerprint' in log && 'issuerFingerprint' in log && 'revocationSignature' in log;
    };

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
        console.log('Initializing Web3PGP Integration Tests');
        console.log('========================================');

        // Verify required environment variables
        if (!process.env.DEXES_WEB3PGP) {
            throw new Error(
                'Contract addresses not found in environment.\n' +
                'Please run "npm test" to start anvil and deploy contracts.'
            );
        }

        contractAddress = getContractAddress('DEXES_WEB3PGP');

        console.log('✓ Contract address loaded from environment:');
        console.log('  - Web3PGP:', contractAddress);

        // Create Web3PGP instance with test clients
        const publicClient = getPublicClient();
        const walletClient = getTestWalletClient();

        web3pgp = new Web3PGP(contractAddress, publicClient, walletClient);
        console.log('✓ Web3PGP SDK initialized');
        console.log('========================================\n');
    }, 240000); // 4 minute timeout for Foundry script execution

    describe('Contract Initialization', () => {
        test('should verify contract is deployed', async () => {
            const publicClient = getPublicClient();
            const code = await publicClient.getBytecode({ address: contractAddress });
            expect(code).toBeDefined();
            expect(code).not.toBe('0x');
        });

        test('should read requested fee', async () => {
            const fee = await web3pgp.requestedFee();
            expect(fee).toBeDefined();
            expect(typeof fee).toBe('bigint');
        });

        test('should get contract address', async () => {
            expect(web3pgp.address).toBe(contractAddress);
        });

        test('should get public client', async () => {
            expect(web3pgp.client).toBeDefined();
            // Verify chain is correctly set to foundry (anvil)
            expect(web3pgp.client.chain?.name).toBe('Foundry');
        });

        test('should get wallet client', async () => {
            expect(web3pgp.walletClient).toBeDefined();
            // Note: Each call to getWalletClient() creates a new instance, so we just verify it's defined
            expect(web3pgp.walletClient!.chain).toBe(getTestWalletClient().chain);
        });

        test('should set contract address', async () => {
            const originalAddress = web3pgp.address;
            const testAddress = '0x1234567890123456789012345678901234567890' as Address;
            
            web3pgp.address = testAddress;
            expect(web3pgp.address).toBe(testAddress);
            
            // Restore original address
            web3pgp.address = originalAddress;
        });
    });

    describe('Key State Queries', () => {
        test('exists() should return true for registered key', async () => {
            const key = generateUniqueFingerprint();
            
            // Key should not exist before registration
            let exists = await web3pgp.exists(key);
            expect(exists).toBe(false);
            
            // Register the key
            await web3pgp.register(key, [], mockOpenPGPMsg);
            
            // Key should now exist
            exists = await web3pgp.exists(key);
            expect(exists).toBe(true);
        });

        test('exists() should return false for non-existent key', async () => {
            const nonExistentKey = generateUniqueFingerprint();
            const exists = await web3pgp.exists(nonExistentKey);
            expect(exists).toBe(false);
        });

        test('isSubKey() should return false for primary keys', async () => {
            const primaryKey = generateUniqueFingerprint();
            
            await web3pgp.register(primaryKey, [], mockOpenPGPMsg);
            
            const isSubkey = await web3pgp.isSubKey(primaryKey);
            expect(isSubkey).toBe(false);
        });

        test('isSubKey() should return true for subkeys', async () => {
            const primaryKey = generateUniqueFingerprint();
            const subkey = generateUniqueFingerprint();
            
            await web3pgp.register(primaryKey, [subkey], mockOpenPGPMsg);
            
            const isSubkey = await web3pgp.isSubKey(subkey);
            expect(isSubkey).toBe(true);
        });

        test('parentOf() should return correct parent for subkeys', async () => {
            const primaryKey = generateUniqueFingerprint();
            const subkey = generateUniqueFingerprint();
            
            await web3pgp.register(primaryKey, [subkey], mockOpenPGPMsg);
            
            const parent = await web3pgp.parentOf(subkey);
            expect(parent).toBe(primaryKey);
        });

        test('parentOf() should return zero bytes for primary keys', async () => {
            const primaryKey = generateUniqueFingerprint();
            
            await web3pgp.register(primaryKey, [], mockOpenPGPMsg);
            
            const parent = await web3pgp.parentOf(primaryKey);
            expect(parent).toBe('0x0000000000000000000000000000000000000000000000000000000000000000');
        });

        test('getKeyPublicationBlock() should return exact block number', async () => {
            const key = generateUniqueFingerprint();
            
            const receipt = await web3pgp.register(key, [], mockOpenPGPMsg);
            
            const blockNumber = await web3pgp.getKeyPublicationBlock(key);
            expect(blockNumber).toBe(receipt.blockNumber);
        });

        test('getKeyPublicationBlock() should return 0 for non-existent key', async () => {
            const nonExistentKey = generateUniqueFingerprint();
            
            const blockNumber = await web3pgp.getKeyPublicationBlock(nonExistentKey);
            expect(blockNumber).toBe(0n);
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

        test('listRevocations() should handle pagination with start and limit', async () => {
            const key = generateUniqueFingerprint();
            await web3pgp.register(key, [], mockOpenPGPMsg);

            // Publish 5 revocations
            const receipts = [];
            for (let i = 0; i < 5; i++) {
                const receipt = await web3pgp.revoke(key, `0x${i.toString().padStart(64, '0')}` as `0x${string}`);
                receipts.push(receipt);
            }

            // Get first 2 revocations
            const page1 = await web3pgp.listRevocations(key, 0n, 2n);
            expect(page1).toHaveLength(2);
            expect(page1[0]).toBe(receipts[0]!.blockNumber);
            expect(page1[1]).toBe(receipts[1]!.blockNumber);

            // Get next 2 revocations
            const page2 = await web3pgp.listRevocations(key, 2n, 2n);
            expect(page2).toHaveLength(2);
            expect(page2[0]).toBe(receipts[2]!.blockNumber);
            expect(page2[1]).toBe(receipts[3]!.blockNumber);

            // Get last revocation
            const page3 = await web3pgp.listRevocations(key, 4n, 2n);
            expect(page3).toHaveLength(1);
            expect(page3[0]).toBe(receipts[4]!.blockNumber);
        });

        test('listRevocations() should return empty array for key with no revocations', async () => {
            const key = generateUniqueFingerprint();
            await web3pgp.register(key, [], mockOpenPGPMsg);

            const revocations = await web3pgp.listRevocations(key, 0n, 10n);
            expect(revocations).toHaveLength(0);
        });
    });

    describe('Error Handling', () => {
        test('should reject pending block tag in fromBlock parameter', async () => {
            await expect(web3pgp.searchKeyEvents('pending' as any)).rejects.toThrow('pending');
        });

        test('should reject pending block tag in toBlock parameter', async () => {
            await expect(web3pgp.searchKeyEvents(undefined, 0n, 'pending' as any)).rejects.toThrow('pending');
        });

        test('searchKeyRegisteredLogs should reject pending in fromBlock', async () => {
            await expect(web3pgp.searchKeyRegisteredLogs(undefined, 'pending' as any)).rejects.toThrow('pending');
        });

        test('searchKeyRevokedLogs should reject pending in toBlock', async () => {
            await expect(web3pgp.searchKeyRevokedLogs(undefined, 0n, 'pending' as any)).rejects.toThrow('pending');
        });

        test('searchKeyUpdatedLogs should reject pending block tags', async () => {
            await expect(web3pgp.searchKeyUpdatedLogs(undefined, 'pending' as any)).rejects.toThrow('pending');
        });

        test('searchSubkeyAddedLogs should reject pending block tags', async () => {
            await expect(web3pgp.searchSubkeyAddedLogs(undefined, undefined, 'pending' as any)).rejects.toThrow('pending');
        });

        test('searchOwnershipChallengedLogs should reject pending block tags', async () => {
            await expect(web3pgp.searchOwnershipChallengedLogs(undefined, undefined, 0n, 'pending' as any)).rejects.toThrow('pending');
        });

        test('searchOwnershipProvedLogs should reject pending block tags', async () => {
            await expect(web3pgp.searchOwnershipProvedLogs(undefined, undefined, 'pending' as any)).rejects.toThrow('pending');
        });

        test('searchKeyCertifiedLogs should reject pending block tags', async () => {
            await expect(web3pgp.searchKeyCertifiedLogs(undefined, undefined, 0n, 'pending' as any)).rejects.toThrow('pending');
        });

        test('searchKeyCertificationRevokedLogs should reject pending block tags', async () => {
            await expect(web3pgp.searchKeyCertificationRevokedLogs(undefined, undefined, 'pending' as any)).rejects.toThrow('pending');
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

            const logs = await web3pgp.searchKeyRevokedLogs(key, receipt.blockNumber, receipt.blockNumber);
            expect(logs.length).toBe(1);
            const log = logs[0];

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
            const publicClient = getPublicClient();
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
            const publicClient = getPublicClient();
            const recipientAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as Address;

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
            const recipientAddress = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as Address;

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
            const recipientAddress = '0x90F79bf6EB2c4f870365E785982E1f101E93b906' as Address;

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
        test('should demonstrate state changes in blockchain', async () => {
            const testKey = '0xb0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0' as `0x${string}`;

            // Register a key
            await web3pgp.register(testKey, [], mockOpenPGPMsg);
            const existsAfterReg = await web3pgp.exists(testKey);
            expect(existsAfterReg).toBe(true);

            // Note: State rollback no longer available in orchestrator pattern
            // Instead, verify state is persisted correctly
            const verifyExists = await web3pgp.exists(testKey);
            expect(verifyExists).toBe(true);
        });

        test('should mine blocks on demand', async () => {
            const publicClient = getPublicClient();
            
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

    describe('Log Extraction from Transaction Receipts', () => {
        test('should extract KeyRegistered log from receipt', async () => {
            const testKey = '0xc1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1' as `0x${string}`;
            const testSubkey = '0xd1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1' as `0x${string}`;

            // Register a key and capture the receipt
            const receipt = await web3pgp.register(testKey, [testSubkey], mockOpenPGPMsg);

            // Extract log from receipt
            const logs = await web3pgp.extractKeyRegisteredLog(receipt);

            expect(logs).toHaveLength(1);
            expect(logs[0]!.primaryKeyFingerprint).toBe(testKey);
            expect(logs[0]!.subkeyFingerprints).toContain(testSubkey);
            expect(logs[0]!.openPGPMsg).toBe(mockOpenPGPMsg);
            expect(logs[0]!.transactionHash).toBe(receipt.transactionHash);
            expect(logs[0]!.blockTimestamp).toBeInstanceOf(Date);
        });

        test('should extract SubkeyAdded log from receipt', async () => {
            const primary = '0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1' as `0x${string}`;
            const newSubkey = '0xf1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1f1' as `0x${string}`;

            // Register primary key first
            await web3pgp.register(primary, [], mockOpenPGPMsg);

            // Add subkey and capture receipt
            const receipt = await web3pgp.addSubkey(primary, newSubkey, mockOpenPGPMsg);

            // Extract log from receipt
            const logs = await web3pgp.extractSubkeyAddedLog(receipt);

            expect(logs).toHaveLength(1);
            expect(logs[0]!.primaryKeyFingerprint).toBe(primary);
            expect(logs[0]!.subkeyFingerprint).toBe(newSubkey);
            expect(logs[0]!.openPGPMsg).toBe(mockOpenPGPMsg);
            expect(logs[0]!.transactionHash).toBe(receipt.transactionHash);
            expect(logs[0]!.blockTimestamp).toBeInstanceOf(Date);
        });

        test('should extract KeyRevoked log from receipt', async () => {
            const revokeKey = '0x0101010101010101010101010101010101010101010101010101010101010101' as `0x${string}`;
            const revokeCert = '0xabcdef' as `0x${string}`;

            // Register key and then revoke it
            await web3pgp.register(revokeKey, [], mockOpenPGPMsg);
            const receipt = await web3pgp.revoke(revokeKey, revokeCert);

            // Extract log from receipt
            const logs = await web3pgp.extractKeyRevokedLog(receipt);

            expect(logs).toHaveLength(1);
            expect(logs[0]!.fingerprint).toBe(revokeKey);
            expect(logs[0]!.revocationCertificate).toBe(revokeCert);
            expect(logs[0]!.transactionHash).toBe(receipt.transactionHash);
            expect(logs[0]!.blockTimestamp).toBeInstanceOf(Date);
        });
    });

    describe('Event Log Filtering and Pagination', () => {
        test('should search KeyRegisteredLogs with array of fingerprints', async () => {
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();
            const key3 = generateUniqueFingerprint();

            // Register three keys
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);
            await web3pgp.register(key3, [], mockOpenPGPMsg);

            // Search for logs of multiple keys at once
            const logs = await web3pgp.searchKeyRegisteredLogs([key1, key2]);

            expect(logs.length).toBeGreaterThanOrEqual(2);
            const fingerprints = logs.map(l => l.primaryKeyFingerprint);
            expect(fingerprints).toContain(key1);
            expect(fingerprints).toContain(key2);
            expect(fingerprints).not.toContain(key3);
        });

        test('should search SubkeyAddedLogs with filters', async () => {
            const primaryKey = generateUniqueFingerprint();
            const subkey1 = generateUniqueFingerprint();
            const subkey2 = generateUniqueFingerprint();

            // Register primary key and add subkeys
            await web3pgp.register(primaryKey, [], mockOpenPGPMsg);
            await web3pgp.addSubkey(primaryKey, subkey1, mockOpenPGPMsg);
            await web3pgp.addSubkey(primaryKey, subkey2, mockOpenPGPMsg);

            // Search for subkey additions for specific primary key
            const allLogs = await web3pgp.searchSubkeyAddedLogs(primaryKey);
            const logs = allLogs.filter((l): l is SubkeyAddedLog => l.type === Web3PGPEvents.SubkeyAdded);

            expect(logs.length).toBeGreaterThanOrEqual(2);
            const subkeyFps = logs.map(l => l.subkeyFingerprint);
            expect(subkeyFps).toContain(subkey1);
            expect(subkeyFps).toContain(subkey2);
        });

        test('should search SubkeyAddedLogs with specific subkey fingerprint', async () => {
            const primaryKey = '0x0505050505050505050505050505050505050505050505050505050505050505' as `0x${string}`;
            const targetSubkey = '0x0606060606060606060606060606060606060606060606060606060606060606' as `0x${string}`;
            const otherSubkey = '0x0707070707070707070707070707070707070707070707070707070707070707' as `0x${string}`;

            // Register and add subkeys
            await web3pgp.register(primaryKey, [], mockOpenPGPMsg);
            await web3pgp.addSubkey(primaryKey, targetSubkey, mockOpenPGPMsg);
            await web3pgp.addSubkey(primaryKey, otherSubkey, mockOpenPGPMsg);

            // Search for specific subkey additions
            const allLogs = await web3pgp.searchSubkeyAddedLogs(undefined, targetSubkey);
            const logs = allLogs.filter((l): l is SubkeyAddedLog => l.type === Web3PGPEvents.SubkeyAdded);

            expect(logs.length).toBeGreaterThanOrEqual(1);
            const subkeyFps = logs.map(l => l.subkeyFingerprint);
            expect(subkeyFps).toContain(targetSubkey);
        });

        test('should search KeyRevokedLogs with block range', async () => {
            const blockBefore = await getPublicClient().getBlockNumber();
            
            const revokeKey = '0x0808080808080808080808080808080808080808080808080808080808080808' as `0x${string}`;
            await web3pgp.register(revokeKey, [], mockOpenPGPMsg);
            const revokeReceipt = await web3pgp.revoke(revokeKey, mockRevocationCert);
            
            const blockAfter = await getPublicClient().getBlockNumber();

            // Search within specific block range
            const logs = await web3pgp.searchKeyRevokedLogs(revokeKey, blockBefore, blockAfter);

            expect(logs.length).toBeGreaterThanOrEqual(1);
            const log = logs.find(l => l.transactionHash === revokeReceipt.transactionHash);
            expect(log).toBeDefined();
            expect(log!.fingerprint).toBe(revokeKey);
        });

        test('searchKeyRevokedLogs should filter by single fingerprint', async () => {
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();

            // Register and revoke both keys
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);
            await web3pgp.revoke(key1, '0xaaaa' as `0x${string}`);
            await web3pgp.revoke(key2, '0xbbbb' as `0x${string}`);

            // Search for revocations of key1 only
            const allLogsKey1 = await web3pgp.searchKeyRevokedLogs(key1);
            const logsKey1 = allLogsKey1.filter((l): l is KeyRevokedLog => l.type === Web3PGPEvents.KeyRevoked);

            expect(logsKey1.length).toBeGreaterThanOrEqual(1);
            logsKey1.forEach(log => {
                expect(log.fingerprint).toBe(key1);
            });
        });

        test('searchKeyRevokedLogs should filter by array of fingerprints', async () => {
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();
            const key3 = generateUniqueFingerprint();

            // Register and revoke keys
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);
            await web3pgp.register(key3, [], mockOpenPGPMsg);
            await web3pgp.revoke(key1, '0x1111' as `0x${string}`);
            await web3pgp.revoke(key2, '0x2222' as `0x${string}`);
            await web3pgp.revoke(key3, '0x3333' as `0x${string}`);

            // Search for revocations of key1 and key2 only
            const allLogs = await web3pgp.searchKeyRevokedLogs([key1, key2]);
            const logs = allLogs.filter((l): l is KeyRevokedLog => l.type === Web3PGPEvents.KeyRevoked);

            expect(logs.length).toBeGreaterThanOrEqual(2);
            const fingerprints = logs.map(l => l.fingerprint);
            expect(fingerprints).toContain(key1);
            expect(fingerprints).toContain(key2);
            // key3 might be in logs if block range includes its revocation
        });

        test('searchKeyRevokedLogs should work with block tags', async () => {
            const key = generateUniqueFingerprint();
            
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.revoke(key, '0xdead' as `0x${string}`);

            // Search using block tags
            const logs = await web3pgp.searchKeyRevokedLogs(key, 'earliest', 'latest');
            
            expect(logs.length).toBeGreaterThanOrEqual(1);
            expect(logs.some(l => l.fingerprint === key)).toBe(true);
        });

        test('searchKeyRevokedLogs should return empty for non-existent key', async () => {
            const nonExistentKey = generateUniqueFingerprint();
            
            const logs = await web3pgp.searchKeyRevokedLogs(nonExistentKey);
            expect(logs).toHaveLength(0);
        });
    });

    describe('searchKeyEvents Method', () => {
        test('should search all key-related events without block range', async () => {
            const key1 = generateUniqueFingerprint();
            const subkey1 = generateUniqueFingerprint();

            // Perform multiple key operations
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.addSubkey(key1, subkey1, mockOpenPGPMsg);

            // Search all key events without specifying block range
            const events = await web3pgp.searchKeyEvents();

            expect(Array.isArray(events)).toBe(true);
            expect(events.length).toBeGreaterThan(0);

            // Verify we got different event types
            const hasKeyRegistered = events.some((e: any) => e.primaryKeyFingerprint !== undefined && e.subkeyFingerprints !== undefined);
            const hasSubkeyAdded = events.some((e: any) => e.primaryKeyFingerprint !== undefined && e.subkeyFingerprint !== undefined && !e.subkeyFingerprints);
            expect(hasKeyRegistered || hasSubkeyAdded).toBe(true);

            // Verify all events have required properties
            events.forEach((event: any) => {
                expect(event.blockNumber).toBeGreaterThan(0n);
                expect(event.blockHash).toBeDefined();
                expect(event.blockTimestamp).toBeInstanceOf(Date);
                expect(event.transactionHash).toBeDefined();
            });
        });

        test('should search key events with specific block range', async () => {
            const blockBefore = await getPublicClient().getBlockNumber();
            
            const key1 = generateUniqueFingerprint();
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            
            const blockAfter = await getPublicClient().getBlockNumber();

            // Search events within specific block range
            const events = await web3pgp.searchKeyEvents(undefined, blockBefore, blockAfter);

            expect(Array.isArray(events)).toBe(true);
            expect(events.length).toBeGreaterThanOrEqual(1);

            // Verify all returned events are within the block range
            events.forEach((event: any) => {
                expect(event.blockNumber).toBeGreaterThanOrEqual(blockBefore);
                expect(event.blockNumber).toBeLessThanOrEqual(blockAfter);
            });
        });

        test('should search key events from specific block to latest', async () => {
            const blockStart = await getPublicClient().getBlockNumber();
            
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();
            
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);

            // Search events from a specific block to latest
            const events = await web3pgp.searchKeyEvents(undefined, blockStart);

            expect(Array.isArray(events)).toBe(true);
            expect(events.length).toBeGreaterThanOrEqual(2);

            // All events should be at or after the starting block
            events.forEach((event: any) => {
                expect(event.blockNumber).toBeGreaterThanOrEqual(blockStart);
            });
        });

        test('should return KeyRegistered events in searchKeyEvents', async () => {
            const key1 = generateUniqueFingerprint();

            const blockBefore = await getPublicClient().getBlockNumber();
            const receipt = await web3pgp.register(key1, [], mockOpenPGPMsg);
            const blockAfter = await getPublicClient().getBlockNumber();

            // Search events within the block range of the registration
            const events = await web3pgp.searchKeyEvents(undefined, blockBefore, blockAfter);

            // Find the KeyRegistered event
            const keyRegisteredEvent = events.find((e): e is KeyRegisteredLog => e.type === Web3PGPEvents.KeyRegistered);

            expect(keyRegisteredEvent).toBeDefined();
            
            if (keyRegisteredEvent) {
                expect(keyRegisteredEvent.primaryKeyFingerprint).toBe(key1);
                expect(keyRegisteredEvent.subkeyFingerprints).toBeDefined();
                expect(Array.isArray(keyRegisteredEvent.subkeyFingerprints)).toBe(true);
                expect(keyRegisteredEvent.openPGPMsg).toBe(mockOpenPGPMsg);
                expect(keyRegisteredEvent.transactionHash).toBe(receipt.transactionHash);
            }
        });

        test('should return SubkeyAdded events in searchKeyEvents', async () => {
            const primaryKey = generateUniqueFingerprint();
            const subkey1 = generateUniqueFingerprint();

            await web3pgp.register(primaryKey, [], mockOpenPGPMsg);
            
            const blockBefore = await getPublicClient().getBlockNumber();
            const receipt = await web3pgp.addSubkey(primaryKey, subkey1, mockOpenPGPMsg);
            const blockAfter = await getPublicClient().getBlockNumber();

            // Search events within the block range of the subkey addition
            const events = await web3pgp.searchKeyEvents(undefined, blockBefore, blockAfter);

            // Find the SubkeyAdded event
            const subkeyAddedEvent = events.find((e): e is SubkeyAddedLog => e.type === Web3PGPEvents.SubkeyAdded);

            expect(subkeyAddedEvent).toBeDefined();

            if (subkeyAddedEvent) {
                expect(subkeyAddedEvent.primaryKeyFingerprint).toBe(primaryKey);
                expect(subkeyAddedEvent.subkeyFingerprint).toBe(subkey1);
                expect(subkeyAddedEvent.openPGPMsg).toBe(mockOpenPGPMsg);
                expect(subkeyAddedEvent.transactionHash).toBe(receipt.transactionHash);
            }
        });

        test('should return KeyRevoked events in searchKeyEvents', async () => {
            const key1 = generateUniqueFingerprint();

            await web3pgp.register(key1, [], mockOpenPGPMsg);
            
            const blockBefore = await getPublicClient().getBlockNumber();
            const receipt = await web3pgp.revoke(key1, mockRevocationCert);
            const blockAfter = await getPublicClient().getBlockNumber();

            // Search events within the block range of the revocation
            const events = await web3pgp.searchKeyEvents(undefined, blockBefore, blockAfter);

            // Find the KeyRevoked event
            const keyRevokedEvent = events.find((e): e is KeyRevokedLog => e.type === Web3PGPEvents.KeyRevoked);

            expect(keyRevokedEvent).toBeDefined();

            if (keyRevokedEvent) {
                expect(keyRevokedEvent.fingerprint).toBe(key1);
                expect(keyRevokedEvent.revocationCertificate).toBe(mockRevocationCert);
                expect(keyRevokedEvent.transactionHash).toBe(receipt.transactionHash);
            }
        });

        test('should return mixed event types in correct order', async () => {
            const primaryKey = generateUniqueFingerprint();
            const subkey1 = generateUniqueFingerprint();
            
            const blockBefore = await getPublicClient().getBlockNumber();
            
            // Register primary key (KeyRegistered event)
            await web3pgp.register(primaryKey, [], mockOpenPGPMsg);
            
            // Add subkey (SubkeyAdded event)
            await web3pgp.addSubkey(primaryKey, subkey1, mockOpenPGPMsg);
            
            // Revoke key (KeyRevoked event)
            await web3pgp.revoke(primaryKey, mockRevocationCert);
            
            const blockAfter = await getPublicClient().getBlockNumber();

            // Search for all events in the block range
            const events = await web3pgp.searchKeyEvents(undefined, blockBefore, blockAfter);

            // Should have at least 3 events (register, add subkey, revoke)
            expect(events.length).toBeGreaterThanOrEqual(3);

            // Verify block numbers are in order (ascending)
            for (let i = 1; i < events.length; i++) {
                expect(events[i]!.blockNumber).toBeGreaterThanOrEqual(events[i - 1]!.blockNumber);
            }

            // Verify we have all three event types
            const hasKeyRegistered = events.some(e => e.type === Web3PGPEvents.KeyRegistered);
            const hasSubkeyAdded = events.some(e => e.type === Web3PGPEvents.SubkeyAdded);
            const hasKeyRevoked = events.some(e => e.type === Web3PGPEvents.KeyRevoked);
            
            expect(hasKeyRegistered).toBe(true);
            expect(hasSubkeyAdded).toBe(true);
            expect(hasKeyRevoked).toBe(true);
        });

        test('should throw error when using pending block tag', async () => {
            await expect(web3pgp.searchKeyEvents('pending' as any)).rejects.toThrow('pending');
        });

        test('should handle empty results gracefully', async () => {
            // Search a far future block range that shouldn't have any events
            const latestBlock = await getPublicClient().getBlockNumber();
            const futureBlock = latestBlock + 1000n;

            const events = await web3pgp.searchKeyEvents(undefined, latestBlock, futureBlock);

            expect(Array.isArray(events)).toBe(true);
            expect(events.length).toBe(0);
        });

        test('should include correct timestamps for all event types', async () => {
            const key1 = generateUniqueFingerprint();
            
            const blockBefore = await getPublicClient().getBlockNumber();
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            const blockAfter = await getPublicClient().getBlockNumber();

            const events = await web3pgp.searchKeyEvents(undefined, blockBefore, blockAfter);

            expect(events.length).toBeGreaterThan(0);

            events.forEach((event: any) => {
                expect(event.blockTimestamp).toBeInstanceOf(Date);
                expect(event.blockTimestamp.getTime()).toBeGreaterThan(0);
            });
        });

        test('should find all events when using earliest and latest tags', async () => {
            const key1 = generateUniqueFingerprint();
            
            // Register a key to create an event
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            
            // Search using block tags
            const events = await web3pgp.searchKeyEvents(undefined, 'earliest', 'latest');

            expect(Array.isArray(events)).toBe(true);
            expect(events.length).toBeGreaterThan(0);

            // Note: State rollback no longer available - state changes persist
        });

        test('should filter events by single fingerprint', async () => {
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();

            const blockBefore = await getPublicClient().getBlockNumber();
            
            // Register two different keys
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);
            
            const blockAfter = await getPublicClient().getBlockNumber();

            // Search events filtered by key1 only
            const eventsForKey1 = await web3pgp.searchKeyEvents(key1, blockBefore, blockAfter);

            // All events should be for key1
            expect(eventsForKey1.length).toBeGreaterThan(0);
            eventsForKey1.forEach((event: any) => {
                if (event.type === Web3PGPEvents.KeyRegistered) {
                    expect(event.primaryKeyFingerprint).toBe(key1);
                } else if ('fingerprint' in event) {
                    expect(event.fingerprint).toBe(key1);
                }
            });
        });

        test('should filter events by multiple fingerprints', async () => {
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();
            const key3 = generateUniqueFingerprint();

            const blockBefore = await getPublicClient().getBlockNumber();
            
            // Register three different keys
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);
            await web3pgp.register(key3, [], mockOpenPGPMsg);
            
            const blockAfter = await getPublicClient().getBlockNumber();

            // Search events filtered by key1 and key2 only
            const eventsForKey1AndKey2 = await web3pgp.searchKeyEvents([key1, key2], blockBefore, blockAfter);

            // All events should be for key1 or key2, not key3
            expect(eventsForKey1AndKey2.length).toBeGreaterThan(0);
            eventsForKey1AndKey2.forEach((event: any) => {
                const eventFingerprint = event.type === Web3PGPEvents.KeyRegistered ? event.primaryKeyFingerprint : event.fingerprint;
                expect([key1, key2]).toContain(eventFingerprint);
            });
        });

        test('should return empty array when filtering by non-existent fingerprint', async () => {
            const nonExistentKey = generateUniqueFingerprint();

            const blockBefore = await getPublicClient().getBlockNumber();
            
            // Register a key
            const key1 = generateUniqueFingerprint();
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            
            const blockAfter = await getPublicClient().getBlockNumber();

            // Search events for a non-existent key
            const events = await web3pgp.searchKeyEvents(nonExistentKey, blockBefore, blockAfter);

            expect(Array.isArray(events)).toBe(true);
            expect(events.length).toBe(0);
        });

        test('should filter subkey and related events by parent fingerprint', async () => {
            const primaryKey = generateUniqueFingerprint();
            const subkey1 = generateUniqueFingerprint();

            const blockBefore = await getPublicClient().getBlockNumber();
            
            // Register primary key with subkey
            await web3pgp.register(primaryKey, [], mockOpenPGPMsg);
            await web3pgp.addSubkey(primaryKey, subkey1, mockOpenPGPMsg);
            
            const blockAfter = await getPublicClient().getBlockNumber();

            // Search events filtered by primary key
            const events = await web3pgp.searchKeyEvents(primaryKey, blockBefore, blockAfter);

            // Should include both KeyRegistered and SubkeyAdded events for this primary key
            expect(events.length).toBeGreaterThan(0);
            expect(events.some(e => e.type === Web3PGPEvents.KeyRegistered)).toBe(true);
            expect(events.some((e): e is SubkeyAddedLog => e.type === Web3PGPEvents.SubkeyAdded && e.primaryKeyFingerprint === primaryKey)).toBe(true);
        });
    });

    describe('Key Update', () => {
        const keyToUpdate = '0x1111111111111111111111111111111111111111111111111111111111111112' as `0x${string}`;
        const updatedOpenPGPMsg = '0xdeadbeef0102' as `0x${string}`;

        beforeAll(async () => {
            // Register key first
            await web3pgp.register(keyToUpdate, [], mockOpenPGPMsg);
        });

        test('should update a key with new OpenPGP message', async () => {
            const blockBefore = await getPublicClient().getBlockNumber();
            
            // Update the key
            const receipt = await web3pgp.update(keyToUpdate, updatedOpenPGPMsg);
            
            expect(receipt.status).toBe('success');
            expect(receipt.blockNumber).toBeGreaterThan(blockBefore);

            // Verify key still exists
            const exists = await web3pgp.exists(keyToUpdate);
            expect(exists).toBe(true);
        });

        test('should search KeyUpdated event logs', async () => {
            const key = generateUniqueFingerprint();
            const newOpenPGPMsg = '0xcafebabe1234' as `0x${string}`;

            // Register and then update
            await web3pgp.register(key, [], mockOpenPGPMsg);
            const receipt = await web3pgp.update(key, newOpenPGPMsg);

            // Search for update logs
            const logs = await web3pgp.searchKeyUpdatedLogs(key);

            expect(logs.length).toBeGreaterThanOrEqual(1);
            const updateLog = logs.find(l => l.transactionHash === receipt.transactionHash);
            expect(updateLog).toBeDefined();
            expect(updateLog!.fingerprint).toBe(key);
            expect(updateLog!.openPGPMsg).toBe(newOpenPGPMsg);
            expect(updateLog!.blockTimestamp).toBeInstanceOf(Date);
        });

        test('should search KeyUpdated logs for multiple keys', async () => {
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();

            // Register and update both keys
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);
            await web3pgp.update(key1, '0xaaaa' as `0x${string}`);
            await web3pgp.update(key2, '0xbbbb' as `0x${string}`);

            // Search for updates for multiple keys
            const logs = await web3pgp.searchKeyUpdatedLogs([key1, key2]);

            expect(logs.length).toBeGreaterThanOrEqual(2);
            const fingerprints = logs.map(l => l.fingerprint);
            expect(fingerprints).toContain(key1);
            expect(fingerprints).toContain(key2);
        });

        test('should extract KeyUpdated log from receipt', async () => {
            const key = generateUniqueFingerprint();
            const msgForExtraction = '0xfeedfeed' as `0x${string}`;

            // Register and update
            await web3pgp.register(key, [], mockOpenPGPMsg);
            const receipt = await web3pgp.update(key, msgForExtraction);

            // Extract log from receipt
            const logs = await web3pgp.extractKeyUpdatedLog(receipt);

            expect(logs).toHaveLength(1);
            expect(logs[0]!.fingerprint).toBe(key);
            expect(logs[0]!.openPGPMsg).toBe(msgForExtraction);
            expect(logs[0]!.transactionHash).toBe(receipt.transactionHash);
            expect(logs[0]!.blockTimestamp).toBeInstanceOf(Date);
        });

        test('searchKeyUpdatedLogs should filter by block range', async () => {
            const key = generateUniqueFingerprint();
            
            await web3pgp.register(key, [], mockOpenPGPMsg);
            const blockBefore = await getPublicClient().getBlockNumber();
            
            const receipt = await web3pgp.update(key, '0xaabbccdd' as `0x${string}`);
            
            const blockAfter = await getPublicClient().getBlockNumber();

            // Search within specific block range
            const logsInRange = await web3pgp.searchKeyUpdatedLogs(key, blockBefore, blockAfter);
            expect(logsInRange.length).toBeGreaterThanOrEqual(1);
            
            const log = logsInRange.find(l => l.transactionHash === receipt.transactionHash);
            expect(log).toBeDefined();
            expect(log!.blockNumber).toBeGreaterThanOrEqual(blockBefore);
            expect(log!.blockNumber).toBeLessThanOrEqual(blockAfter);
        });

        test('searchKeyUpdatedLogs should work with block tags', async () => {
            const key = generateUniqueFingerprint();
            
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.update(key, '0x11223344' as `0x${string}`);

            // Search using block tags
            const logs = await web3pgp.searchKeyUpdatedLogs(key, 'earliest', 'latest');
            
            expect(logs.length).toBeGreaterThanOrEqual(1);
            expect(logs.some(l => l.fingerprint === key)).toBe(true);
        });

        test('searchKeyUpdatedLogs should return empty for non-existent key', async () => {
            const nonExistentKey = generateUniqueFingerprint();
            
            const logs = await web3pgp.searchKeyUpdatedLogs(nonExistentKey);
            expect(logs).toHaveLength(0);
        });

        test('searchKeyUpdatedLogs should filter by array of fingerprints', async () => {
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();
            const key3 = generateUniqueFingerprint();

            // Register and update keys
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);
            await web3pgp.register(key3, [], mockOpenPGPMsg);
            
            await web3pgp.update(key1, '0xaaaa' as `0x${string}`);
            await web3pgp.update(key2, '0xbbbb' as `0x${string}`);
            await web3pgp.update(key3, '0xcccc' as `0x${string}`);

            // Search for updates on key1 and key2 only
            const logs = await web3pgp.searchKeyUpdatedLogs([key1, key2]);

            expect(logs.length).toBeGreaterThanOrEqual(2);
            const fingerprints = logs.map(l => l.fingerprint);
            expect(fingerprints).toContain(key1);
            expect(fingerprints).toContain(key2);
            expect(fingerprints).not.toContain(key3);
        });
    });

    describe('Ownership Challenge and Proof', () => {
        test('should challenge ownership of a key', async () => {
            const keyForChallenge = generateUniqueFingerprint();
            const challengeData = generateUniqueFingerprint();

            // Register key for challenge test
            await web3pgp.register(keyForChallenge, [], mockOpenPGPMsg);
            const receipt = await web3pgp.challengeOwnership(keyForChallenge, challengeData);
            
            expect(receipt.status).toBe('success');
            expect(receipt.blockNumber).toBeGreaterThan(0n);
        });

        test('should search OwnershipChallenged event logs', async () => {
            const key = generateUniqueFingerprint();
            const challenge = generateUniqueFingerprint();

            // Register key and challenge ownership
            await web3pgp.register(key, [], mockOpenPGPMsg);
            const receipt = await web3pgp.challengeOwnership(key, challenge);

            // Search for challenge logs
            const logs = await web3pgp.searchOwnershipChallengedLogs(key);

            expect(logs.length).toBeGreaterThanOrEqual(1);
            const challengeLog = logs.find(l => l.transactionHash === receipt.transactionHash);
            expect(challengeLog).toBeDefined();
            expect(challengeLog!.fingerprint).toBe(key);
            expect(challengeLog!.challenge).toBe(challenge);
            expect(challengeLog!.blockTimestamp).toBeInstanceOf(Date);
        });

        test('should search OwnershipChallenged logs for multiple keys', async () => {
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();
            const challenge1 = generateUniqueFingerprint();
            const challenge2 = generateUniqueFingerprint();

            // Register and challenge keys
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);
            await web3pgp.challengeOwnership(key1, challenge1);
            await web3pgp.challengeOwnership(key2, challenge2);

            // Search for challenges on multiple keys
            const logs = await web3pgp.searchOwnershipChallengedLogs([key1, key2]);

            expect(logs.length).toBeGreaterThanOrEqual(2);
            const fingerprints = logs.map(l => l.fingerprint);
            expect(fingerprints).toContain(key1);
            expect(fingerprints).toContain(key2);
        });

        test('should search OwnershipChallenged logs by challenge data', async () => {
            const key = generateUniqueFingerprint();
            const challenge = generateUniqueFingerprint();

            // Register and challenge
            await web3pgp.register(key, [], mockOpenPGPMsg);
            const receipt = await web3pgp.challengeOwnership(key, challenge);

            // Search for specific challenge
            const logs = await web3pgp.searchOwnershipChallengedLogs(undefined, challenge);

            expect(logs.length).toBeGreaterThanOrEqual(1);
            const challengeLog = logs.find(l => l.transactionHash === receipt.transactionHash);
            expect(challengeLog).toBeDefined();
            expect(challengeLog!.challenge).toBe(challenge);
        });

        test('should extract OwnershipChallenged log from receipt', async () => {
            const key = generateUniqueFingerprint();
            const challenge = generateUniqueFingerprint();

            // Register and challenge
            await web3pgp.register(key, [], mockOpenPGPMsg);
            const receipt = await web3pgp.challengeOwnership(key, challenge);

            // Extract log from receipt
            const logs = await web3pgp.extractOwnershipChallengedLog(receipt);

            expect(logs).toHaveLength(1);
            expect(logs[0]!.fingerprint).toBe(key);
            expect(logs[0]!.challenge).toBe(challenge);
            expect(logs[0]!.transactionHash).toBe(receipt.transactionHash);
            expect(logs[0]!.blockTimestamp).toBeInstanceOf(Date);
        });

        test('should prove ownership in response to challenge', async () => {
            const key = generateUniqueFingerprint();
            const challenge = generateUniqueFingerprint();
            const signature = generateUniqueFingerprint();

            // Register, challenge, and prove
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.challengeOwnership(key, challenge);
            const receipt = await web3pgp.proveOwnership(key, challenge, signature);

            expect(receipt.status).toBe('success');
            expect(receipt.blockNumber).toBeGreaterThan(0n);
        });

        test('should search OwnershipProved event logs', async () => {
            const key = generateUniqueFingerprint();
            const challenge = generateUniqueFingerprint();
            const signature = generateUniqueFingerprint();

            // Register, challenge, and prove
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.challengeOwnership(key, challenge);
            const receipt = await web3pgp.proveOwnership(key, challenge, signature);

            // Search for proof logs
            const logs = await web3pgp.searchOwnershipProvedLogs(key);

            expect(logs.length).toBeGreaterThanOrEqual(1);
            const proofLog = logs.find(l => l.transactionHash === receipt.transactionHash);
            expect(proofLog).toBeDefined();
            expect(proofLog!.fingerprint).toBe(key);
            expect(proofLog!.challenge).toBe(challenge);
            expect(proofLog!.signature).toBe(signature);
            expect(proofLog!.blockTimestamp).toBeInstanceOf(Date);
        });

        test('should search OwnershipProved logs by challenge', async () => {
            const key = generateUniqueFingerprint();
            const challenge = generateUniqueFingerprint();
            const signature = generateUniqueFingerprint();

            // Register, challenge, and prove
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.challengeOwnership(key, challenge);
            const receipt = await web3pgp.proveOwnership(key, challenge, signature);

            // Search for specific challenge proof
            const logs = await web3pgp.searchOwnershipProvedLogs(undefined, challenge);

            expect(logs.length).toBeGreaterThanOrEqual(1);
            const proofLog = logs.find(l => l.transactionHash === receipt.transactionHash);
            expect(proofLog).toBeDefined();
            expect(proofLog!.challenge).toBe(challenge);
        });

        test('should extract OwnershipProved log from receipt', async () => {
            const key = generateUniqueFingerprint();
            const challenge = generateUniqueFingerprint();
            const signature = generateUniqueFingerprint();

            // Register, challenge, and prove
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.challengeOwnership(key, challenge);
            const receipt = await web3pgp.proveOwnership(key, challenge, signature);

            // Extract log from receipt
            const logs = await web3pgp.extractOwnershipProvedLog(receipt);

            expect(logs).toHaveLength(1);
            expect(logs[0]!.fingerprint).toBe(key);
            expect(logs[0]!.challenge).toBe(challenge);
            expect(logs[0]!.signature).toBe(signature);
            expect(logs[0]!.transactionHash).toBe(receipt.transactionHash);
            expect(logs[0]!.blockTimestamp).toBeInstanceOf(Date);
        });

        test('should handle multiple challenges for same key', async () => {
            const key = generateUniqueFingerprint();
            const challenge1 = generateUniqueFingerprint();
            const challenge2 = generateUniqueFingerprint();
            const signature1 = generateUniqueFingerprint();
            const signature2 = generateUniqueFingerprint();

            // Register and perform multiple challenge/proof cycles
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.challengeOwnership(key, challenge1);
            await web3pgp.proveOwnership(key, challenge1, signature1);
            await web3pgp.challengeOwnership(key, challenge2);
            await web3pgp.proveOwnership(key, challenge2, signature2);

            // Search for all proofs for the key
            const proofLogs = await web3pgp.searchOwnershipProvedLogs(key);
            expect(proofLogs.length).toBeGreaterThanOrEqual(2);

            const challenges = proofLogs.map(l => l.challenge);
            expect(challenges).toContain(challenge1);
            expect(challenges).toContain(challenge2);
        });
    });

    describe('Key Certification', () => {
        const generateIssuersAndKeys = async () => {
            const keyToCertify = generateUniqueFingerprint();
            const issuerKey = generateUniqueFingerprint();
            // Register both keys
            await web3pgp.register(keyToCertify, [], mockOpenPGPMsg);
            await web3pgp.register(issuerKey, [], mockOpenPGPMsg);
            return { keyToCertify, issuerKey };
        };

        test('should certify a key', async () => {
            const { keyToCertify, issuerKey } = await generateIssuersAndKeys();
            const certSignature = generateUniqueFingerprint();

            const receipt = await web3pgp.certifyKey(keyToCertify, issuerKey, certSignature);
            
            expect(receipt.status).toBe('success');
            expect(receipt.blockNumber).toBeGreaterThan(0n);
        });

        test('should search KeyCertified event logs', async () => {
            const key = generateUniqueFingerprint();
            const issuer = generateUniqueFingerprint();
            const cert = '0xd1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1' as `0x${string}`;

            // Register both keys and certify
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.register(issuer, [], mockOpenPGPMsg);
            const receipt = await web3pgp.certifyKey(key, issuer, cert);

            // Search for certification logs
            const logs = await web3pgp.searchKeyCertifiedLogs(key);

            expect(logs.length).toBeGreaterThanOrEqual(1);
            const certLog = logs.find(l => l.transactionHash === receipt.transactionHash);
            expect(certLog).toBeDefined();
            expect(certLog!.fingerprint).toBe(key);
            expect(certLog!.issuerFingerprint).toBe(issuer);
            expect(certLog!.keyCertificate).toBe(cert);
            expect(certLog!.blockTimestamp).toBeInstanceOf(Date);
        });

        test('should search KeyCertified logs for multiple keys', async () => {
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();
            const issuer = generateUniqueFingerprint();

            // Register all keys
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);
            await web3pgp.register(issuer, [], mockOpenPGPMsg);

            // Certify both keys
            await web3pgp.certifyKey(key1, issuer, '0xaaaa' as `0x${string}`);
            await web3pgp.certifyKey(key2, issuer, '0xbbbb' as `0x${string}`);

            // Search for certifications of multiple keys
            const logs = await web3pgp.searchKeyCertifiedLogs([key1, key2]);

            expect(logs.length).toBeGreaterThanOrEqual(2);
            const fingerprints = logs.map(l => l.fingerprint);
            expect(fingerprints).toContain(key1);
            expect(fingerprints).toContain(key2);
        });

        test('should extract KeyCertified log from receipt', async () => {
            const key = generateUniqueFingerprint();
            const issuer = generateUniqueFingerprint();
            const cert = generateUniqueFingerprint();

            // Register and certify
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.register(issuer, [], mockOpenPGPMsg);
            const receipt = await web3pgp.certifyKey(key, issuer, cert);

            // Extract log from receipt
            const logs = await web3pgp.extractKeyCertifiedLog(receipt);

            expect(logs).toHaveLength(1);
            expect(logs[0]!.fingerprint).toBe(key);
            expect(logs[0]!.issuerFingerprint).toBe(issuer);
            expect(logs[0]!.keyCertificate).toBe(cert);
            expect(logs[0]!.transactionHash).toBe(receipt.transactionHash);
            expect(logs[0]!.blockTimestamp).toBeInstanceOf(Date);
        });

        test('should revoke a key certification', async () => {
            const key = generateUniqueFingerprint();
            const issuer = generateUniqueFingerprint();
            const cert = '0xf3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3f3' as `0x${string}`;
            const revocation = '0x0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a0a' as `0x${string}`;

            // Register, certify, and revoke
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.register(issuer, [], mockOpenPGPMsg);
            await web3pgp.certifyKey(key, issuer, cert);
            const receipt = await web3pgp.revokeCertification(key, issuer, revocation);

            expect(receipt.status).toBe('success');
            expect(receipt.blockNumber).toBeGreaterThan(0n);
        });

        test('should search KeyCertificationRevoked event logs', async () => {
            const key = generateUniqueFingerprint();
            const issuer = generateUniqueFingerprint();
            const cert = '0x1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b' as `0x${string}`;
            const revocation = '0x2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b' as `0x${string}`;

            // Register, certify, and revoke
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.register(issuer, [], mockOpenPGPMsg);
            await web3pgp.certifyKey(key, issuer, cert);
            const receipt = await web3pgp.revokeCertification(key, issuer, revocation);

            // Search for revocation logs
            const logs = await web3pgp.searchKeyCertificationRevokedLogs(key);

            expect(logs.length).toBeGreaterThanOrEqual(1);
            const revocationLog = logs.find(l => l.transactionHash === receipt.transactionHash);
            expect(revocationLog).toBeDefined();
            expect(revocationLog!.fingerprint).toBe(key);
            expect(revocationLog!.issuerFingerprint).toBe(issuer);
            expect(revocationLog!.revocationSignature).toBe(revocation);
            expect(revocationLog!.blockTimestamp).toBeInstanceOf(Date);
        });

        test('should extract KeyCertificationRevoked log from receipt', async () => {
            const key = generateUniqueFingerprint();
            const issuer = generateUniqueFingerprint();
            const cert = generateUniqueFingerprint();
            const revocation = generateUniqueFingerprint();

            // Register, certify, and revoke
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.register(issuer, [], mockOpenPGPMsg);
            await web3pgp.certifyKey(key, issuer, cert);
            const receipt = await web3pgp.revokeCertification(key, issuer, revocation);

            // Extract log from receipt
            const logs = await web3pgp.extractKeyCertificationRevokedLog(receipt);

            expect(logs).toHaveLength(1);
            expect(logs[0]!.fingerprint).toBe(key);
            expect(logs[0]!.issuerFingerprint).toBe(issuer);
            expect(logs[0]!.revocationSignature).toBe(revocation);
            expect(logs[0]!.transactionHash).toBe(receipt.transactionHash);
            expect(logs[0]!.blockTimestamp).toBeInstanceOf(Date);
        });

        test('should handle multiple certifications on same key', async () => {
            const key = generateUniqueFingerprint();
            const issuer1 = generateUniqueFingerprint();
            const issuer2 = generateUniqueFingerprint();

            // Register all keys
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.register(issuer1, [], mockOpenPGPMsg);
            await web3pgp.register(issuer2, [], mockOpenPGPMsg);

            // Certify from multiple issuers
            await web3pgp.certifyKey(key, issuer1, '0xcccc' as `0x${string}`);
            await web3pgp.certifyKey(key, issuer2, '0xdddd' as `0x${string}`);

            // Search for all certifications on the key
            const logs = await web3pgp.searchKeyCertifiedLogs(key);

            expect(logs.length).toBeGreaterThanOrEqual(2);
            const issuers = logs.map(l => l.issuerFingerprint);
            expect(issuers).toContain(issuer1);
            expect(issuers).toContain(issuer2);
        });

        test('listCertifications should support pagination with start and limit', async () => {
            const issuer = generateUniqueFingerprint();
            const key1 = generateUniqueFingerprint();
            const key2 = generateUniqueFingerprint();

            // Register keys and create multiple certifications
            await web3pgp.register(issuer, [], mockOpenPGPMsg);
            await web3pgp.register(key1, [], mockOpenPGPMsg);
            await web3pgp.register(key2, [], mockOpenPGPMsg);

            await web3pgp.certifyKey(key1, issuer, '0x1111' as `0x${string}`);
            await web3pgp.certifyKey(key2, issuer, '0x2222' as `0x${string}`);

            // List all certifications
            const allCerts = await web3pgp.listCertifications(issuer, 0n, BigInt(100));
            expect(allCerts.length).toBeGreaterThanOrEqual(2);

            // Test pagination with limit
            const firstPage = await web3pgp.listCertifications(issuer, 0n, 1n);
            expect(firstPage.length).toBeLessThanOrEqual(1);
        });

        test('listCertifications should return empty array for key with no certifications', async () => {
            const keyWithNoCerts = generateUniqueFingerprint();
            await web3pgp.register(keyWithNoCerts, [], mockOpenPGPMsg);

            const certs = await web3pgp.listCertifications(keyWithNoCerts, 0n, BigInt(100));
            expect(certs).toHaveLength(0);
        });

        test('listCertificationRevocations should support pagination with start and limit', async () => {
            const key = generateUniqueFingerprint();
            const issuer1 = generateUniqueFingerprint();
            const issuer2 = generateUniqueFingerprint();

            // Register all keys
            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.register(issuer1, [], mockOpenPGPMsg);
            await web3pgp.register(issuer2, [], mockOpenPGPMsg);

            // Certify and revoke from both issuers
            await web3pgp.certifyKey(key, issuer1, '0x3333' as `0x${string}`);
            await web3pgp.revokeCertification(key, issuer1, '0x4444' as `0x${string}`);
            await web3pgp.certifyKey(key, issuer2, '0x5555' as `0x${string}`);
            await web3pgp.revokeCertification(key, issuer2, '0x6666' as `0x${string}`);

            // List all revocations
            const allRevocations = await web3pgp.listCertificationRevocations(key, 0n, BigInt(100));
            expect(allRevocations.length).toBeGreaterThanOrEqual(2);

            // Test pagination with limit
            const firstPage = await web3pgp.listCertificationRevocations(key, 0n, 1n);
            expect(firstPage.length).toBeLessThanOrEqual(1);
        });

        test('listCertificationRevocations should return empty for key with no revocations', async () => {
            const key = generateUniqueFingerprint();
            
            await web3pgp.register(key, [], mockOpenPGPMsg);

            const revocations = await web3pgp.listCertificationRevocations(key, 0n, BigInt(100));
            expect(revocations).toHaveLength(0);
        });
    });

    describe('searchKeyEvents with All Event Types', () => {
        test('should include KeyUpdated events in searchKeyEvents', async () => {
            const key = generateUniqueFingerprint();
            const updateMsg = generateUniqueFingerprint();

            await web3pgp.register(key, [], mockOpenPGPMsg);
            
            const blockBefore = await getPublicClient().getBlockNumber();
            const receipt = await web3pgp.update(key, updateMsg);
            const blockAfter = await getPublicClient().getBlockNumber();

            const events = await web3pgp.searchKeyEvents(undefined, blockBefore, blockAfter);

            const updateEvent = events.find(e => isKeyUpdatedLog(e));
            expect(updateEvent).toBeDefined();
            expect(isKeyUpdatedLog(updateEvent!)).toBe(true);
            
            if (isKeyUpdatedLog(updateEvent!)) {
                expect(updateEvent.fingerprint).toBe(key);
                expect(updateEvent.openPGPMsg).toBe(updateMsg);
                expect(updateEvent.transactionHash).toBe(receipt.transactionHash);
            }
        });

        test('should include OwnershipChallenged and OwnershipProved events', async () => {
            const key = generateUniqueFingerprint();
            const challenge = generateUniqueFingerprint();
            const signature = generateUniqueFingerprint();

            await web3pgp.register(key, [], mockOpenPGPMsg);
            
            const blockBefore = await getPublicClient().getBlockNumber();
            await web3pgp.challengeOwnership(key, challenge);
            const receipt = await web3pgp.proveOwnership(key, challenge, signature);
            const blockAfter = await getPublicClient().getBlockNumber();

            const events = await web3pgp.searchKeyEvents(undefined, blockBefore, blockAfter);

            const challengeEvent = events.find(e => isOwnershipChallengedLog(e));
            const proofEvent = events.find(e => isOwnershipProvedLog(e));

            expect(challengeEvent).toBeDefined();
            expect(proofEvent).toBeDefined();

            if (isOwnershipChallengedLog(challengeEvent!)) {
                expect(challengeEvent.fingerprint).toBe(key);
                expect(challengeEvent.challenge).toBe(challenge);
            }

            if (isOwnershipProvedLog(proofEvent!)) {
                expect(proofEvent.fingerprint).toBe(key);
                expect(proofEvent.challenge).toBe(challenge);
                expect(proofEvent.signature).toBe(signature);
                expect(proofEvent.transactionHash).toBe(receipt.transactionHash);
            }
        });

        test('should include KeyCertified and KeyCertificationRevoked events', async () => {
            const key = generateUniqueFingerprint();
            const issuer = generateUniqueFingerprint();
            const cert = generateUniqueFingerprint();
            const revocation = generateUniqueFingerprint();

            await web3pgp.register(key, [], mockOpenPGPMsg);
            await web3pgp.register(issuer, [], mockOpenPGPMsg);
            
            const blockBefore = await getPublicClient().getBlockNumber();
            await web3pgp.certifyKey(key, issuer, cert);
            const receipt = await web3pgp.revokeCertification(key, issuer, revocation);
            const blockAfter = await getPublicClient().getBlockNumber();

            const events = await web3pgp.searchKeyEvents(undefined, blockBefore, blockAfter);

            const certEvent = events.find(e => isKeyCertifiedLog(e));
            const revocationEvent = events.find(e => isKeyCertificationRevokedLog(e));

            expect(certEvent).toBeDefined();
            expect(revocationEvent).toBeDefined();

            if (isKeyCertifiedLog(certEvent!)) {
                expect(certEvent.fingerprint).toBe(key);
                expect(certEvent.issuerFingerprint).toBe(issuer);
                expect(certEvent.keyCertificate).toBe(cert);
            }

            if (isKeyCertificationRevokedLog(revocationEvent!)) {
                expect(revocationEvent.fingerprint).toBe(key);
                expect(revocationEvent.issuerFingerprint).toBe(issuer);
                expect(revocationEvent.revocationSignature).toBe(revocation);
                expect(revocationEvent.transactionHash).toBe(receipt.transactionHash);
            }
        });

        test('should return all 8 event types in comprehensive test', async () => {
            const key1 = generateUniqueFingerprint();
            const subkey1 = generateUniqueFingerprint();
            const issuer1 = generateUniqueFingerprint();
            const updateMsg = generateUniqueFingerprint();
            const challenge = generateUniqueFingerprint();
            const signature = generateUniqueFingerprint();
            const cert = generateUniqueFingerprint();
            const revocation = generateUniqueFingerprint();

            const blockBefore = await getPublicClient().getBlockNumber();

            // 1. KeyRegistered
            await web3pgp.register(key1, [], mockOpenPGPMsg);

            // 2. SubkeyAdded
            await web3pgp.addSubkey(key1, subkey1, mockOpenPGPMsg);

            // 3. KeyUpdated
            await web3pgp.update(key1, updateMsg);

            // 4. OwnershipChallenged
            await web3pgp.challengeOwnership(key1, challenge);

            // 5. OwnershipProved
            await web3pgp.proveOwnership(key1, challenge, signature);

            // Register issuer for certification
            await web3pgp.register(issuer1, [], mockOpenPGPMsg);

            // 6. KeyCertified
            await web3pgp.certifyKey(key1, issuer1, cert);

            // 7. KeyCertificationRevoked
            await web3pgp.revokeCertification(key1, issuer1, revocation);

            // 8. KeyRevoked
            await web3pgp.revoke(key1, mockRevocationCert);

            const blockAfter = await getPublicClient().getBlockNumber();

            const events = await web3pgp.searchKeyEvents(undefined, blockBefore, blockAfter);

            expect(events.length).toBeGreaterThanOrEqual(8);

            // Verify we have all event types
            expect(events.some(e => e.type === Web3PGPEvents.KeyRegistered)).toBe(true);
            expect(events.some(e => e.type === Web3PGPEvents.SubkeyAdded)).toBe(true);
            expect(events.some(e => e.type === Web3PGPEvents.KeyUpdated)).toBe(true);
            expect(events.some(e => e.type === Web3PGPEvents.OwnershipChallenged)).toBe(true);
            expect(events.some(e => e.type === Web3PGPEvents.OwnershipProved)).toBe(true);
            expect(events.some(e => e.type === Web3PGPEvents.KeyCertified)).toBe(true);
            expect(events.some(e => e.type === Web3PGPEvents.KeyCertificationRevoked)).toBe(true);
            expect(events.some(e => e.type === Web3PGPEvents.KeyRevoked)).toBe(true);
        });
    });
});
