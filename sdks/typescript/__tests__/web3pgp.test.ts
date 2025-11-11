import { Web3PGP } from '../src/web3pgp/web3pgp';
import { PublicClient, WalletClient, TransactionReceipt } from 'viem';
import { toBytes32 } from '../src/utils/0xstr';

// Mock viem clients
const createMockPublicClient = (): PublicClient => ({
    readContract: jest.fn(),
    simulateContract: jest.fn(),
    waitForTransactionReceipt: jest.fn(),
} as unknown as PublicClient);

const createMockWalletClient = (): WalletClient => ({
    account: { address: '0x1234567890123456789012345678901234567890' as `0x${string}` },
    writeContract: jest.fn(),
} as unknown as WalletClient);

describe('Web3PGP', () => {
    const contractAddress = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12' as `0x${string}`;
    let publicClient: PublicClient;
    let walletClient: WalletClient;
    let web3pgp: Web3PGP;

    // Test data
    const mockFingerprint = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as `0x${string}`;
    const mockFingerprint2 = '0xfedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321' as `0x${string}`;
    const mockOpenPGPMsg = '0xdeadbeef' as `0x${string}`;
    const mockRevocationCert = '0xcafebabe' as `0x${string}`;

    beforeEach(() => {
        jest.clearAllMocks();
        publicClient = createMockPublicClient();
        walletClient = createMockWalletClient();
        web3pgp = new Web3PGP(contractAddress, publicClient, walletClient);
    });

    describe('Constructor and Properties', () => {
        test('should initialize with correct address', () => {
            expect(web3pgp.address).toBe(contractAddress);
        });

        test('should expose static abi', () => {
            expect(Web3PGP.abi).toBeDefined();
            expect(Array.isArray(Web3PGP.abi)).toBe(true);
        });

        test('should allow getting and setting client', () => {
            const newClient = createMockPublicClient();
            web3pgp.client = newClient;
            expect(web3pgp.client).toBe(newClient);
        });

        test('should allow getting and setting walletClient', () => {
            const newWalletClient = createMockWalletClient();
            web3pgp.walletClient = newWalletClient;
            expect(web3pgp.walletClient).toBe(newWalletClient);
        });

        test('should allow undefined walletClient', () => {
            web3pgp.walletClient = undefined;
            expect(web3pgp.walletClient).toBeUndefined();
        });
    });

    describe('READ FUNCTIONS', () => {
        describe('exists', () => {
            test('should call readContract with correct parameters', async () => {
                (publicClient.readContract as jest.Mock).mockResolvedValue(true);

                const result = await web3pgp.exists(mockFingerprint);

                expect(publicClient.readContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    abi: Web3PGP.abi,
                    functionName: 'exists',
                    args: [toBytes32(mockFingerprint)],
                });
                expect(result).toBe(true);
            });

            test('should return false when key does not exist', async () => {
                (publicClient.readContract as jest.Mock).mockResolvedValue(false);

                const result = await web3pgp.exists(mockFingerprint);

                expect(result).toBe(false);
            });
        });

        describe('isSubKey', () => {
            test('should call readContract with correct parameters', async () => {
                (publicClient.readContract as jest.Mock).mockResolvedValue(true);

                const result = await web3pgp.isSubKey(mockFingerprint);

                expect(publicClient.readContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    abi: Web3PGP.abi,
                    functionName: 'isSubKey',
                    args: [toBytes32(mockFingerprint)],
                });
                expect(result).toBe(true);
            });
        });

        describe('parentOf', () => {
            test('should return parent fingerprint', async () => {
                (publicClient.readContract as jest.Mock).mockResolvedValue(mockFingerprint2);

                const result = await web3pgp.parentOf(mockFingerprint);

                expect(publicClient.readContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    abi: Web3PGP.abi,
                    functionName: 'parentOf',
                    args: [toBytes32(mockFingerprint)],
                });
                expect(result).toBe(mockFingerprint2);
            });

            test('should return zero bytes when no parent exists', async () => {
                const zeroBytes = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
                (publicClient.readContract as jest.Mock).mockResolvedValue(zeroBytes);

                const result = await web3pgp.parentOf(mockFingerprint);

                expect(result).toBe(zeroBytes);
            });
        });

        describe('getKeyPublicationBlock', () => {
            test('should return block number for published key', async () => {
                (publicClient.readContract as jest.Mock).mockResolvedValue(BigInt(12345));

                const result = await web3pgp.getKeyPublicationBlock(mockFingerprint);

                expect(publicClient.readContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    abi: Web3PGP.abi,
                    functionName: 'getKeyPublicationBlock',
                    args: [toBytes32(mockFingerprint)],
                });
                expect(result).toBe(BigInt(12345));
            });

            test('should return 0 for unpublished key', async () => {
                (publicClient.readContract as jest.Mock).mockResolvedValue(BigInt(0));

                const result = await web3pgp.getKeyPublicationBlock(mockFingerprint);

                expect(result).toBe(BigInt(0));
            });
        });

        describe('getKeyPublicationBlockBatch', () => {
            test('should return block numbers for multiple keys', async () => {
                const mockBlocks = [BigInt(100), BigInt(200), BigInt(0)];
                (publicClient.readContract as jest.Mock).mockResolvedValue(mockBlocks);

                const fingerprints = [mockFingerprint, mockFingerprint2, '0x' + '0'.repeat(64) as `0x${string}`];
                const result = await web3pgp.getKeyPublicationBlockBatch(fingerprints);

                expect(publicClient.readContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    abi: Web3PGP.abi,
                    functionName: 'getKeyPublicationBlock',
                    args: [fingerprints.map(fp => toBytes32(fp))],
                });
                expect(result).toEqual(mockBlocks);
            });

            test('should handle empty array', async () => {
                (publicClient.readContract as jest.Mock).mockResolvedValue([]);

                const result = await web3pgp.getKeyPublicationBlockBatch([]);

                expect(result).toEqual([]);
            });
        });

        describe('listRevocations', () => {
            test('should return revocation block numbers', async () => {
                const mockRevocations = [BigInt(1000), BigInt(2000)];
                (publicClient.readContract as jest.Mock).mockResolvedValue(mockRevocations);

                const result = await web3pgp.listRevocations(mockFingerprint, BigInt(0), BigInt(10));

                expect(publicClient.readContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    abi: Web3PGP.abi,
                    functionName: 'listRevocations',
                    args: [toBytes32(mockFingerprint), BigInt(0), BigInt(10)],
                });
                expect(result).toEqual(mockRevocations);
            });

            test('should handle pagination', async () => {
                const mockRevocations = [BigInt(3000)];
                (publicClient.readContract as jest.Mock).mockResolvedValue(mockRevocations);

                const result = await web3pgp.listRevocations(mockFingerprint, BigInt(2), BigInt(5));

                expect(publicClient.readContract).toHaveBeenCalledWith(
                    expect.objectContaining({
                        args: [toBytes32(mockFingerprint), BigInt(2), BigInt(5)],
                    })
                );
                expect(result).toEqual(mockRevocations);
            });

            test('should return empty array when no revocations', async () => {
                (publicClient.readContract as jest.Mock).mockResolvedValue([]);

                const result = await web3pgp.listRevocations(mockFingerprint, BigInt(0), BigInt(10));

                expect(result).toEqual([]);
            });
        });

        describe('listSubkeys', () => {
            test('should return subkey fingerprints', async () => {
                const mockSubkeys = [mockFingerprint, mockFingerprint2];
                (publicClient.readContract as jest.Mock).mockResolvedValue(mockSubkeys);

                const result = await web3pgp.listSubkeys(mockFingerprint, BigInt(0), BigInt(10));

                expect(publicClient.readContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    abi: Web3PGP.abi,
                    functionName: 'listSubkeys',
                    args: [toBytes32(mockFingerprint), BigInt(0), BigInt(10)],
                });
                expect(result).toEqual(mockSubkeys);
            });

            test('should handle pagination', async () => {
                const mockSubkeys = [mockFingerprint2];
                (publicClient.readContract as jest.Mock).mockResolvedValue(mockSubkeys);

                const result = await web3pgp.listSubkeys(mockFingerprint, BigInt(1), BigInt(5));

                expect(publicClient.readContract).toHaveBeenCalledWith(
                    expect.objectContaining({
                        args: [toBytes32(mockFingerprint), BigInt(1), BigInt(5)],
                    })
                );
                expect(result).toEqual(mockSubkeys);
            });

            test('should return empty array when no subkeys', async () => {
                (publicClient.readContract as jest.Mock).mockResolvedValue([]);

                const result = await web3pgp.listSubkeys(mockFingerprint, BigInt(0), BigInt(10));

                expect(result).toEqual([]);
            });
        });

        describe('requestedFee', () => {
            test('should return the requested fee', async () => {
                const mockFee = BigInt('1000000000000000000'); // 1 ETH in wei
                (publicClient.readContract as jest.Mock).mockResolvedValue(mockFee);

                const result = await web3pgp.requestedFee();

                expect(publicClient.readContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    abi: Web3PGP.abi,
                    functionName: 'requestedFee',
                });
                expect(result).toBe(mockFee);
            });

            test('should return 0 when no fee is required', async () => {
                (publicClient.readContract as jest.Mock).mockResolvedValue(BigInt(0));

                const result = await web3pgp.requestedFee();

                expect(result).toBe(BigInt(0));
            });
        });
    });

    describe('WRITE FUNCTIONS - Wallet Client Validation', () => {
        test('register should throw when walletClient is undefined', async () => {
            web3pgp.walletClient = undefined;

            await expect(web3pgp.register(mockFingerprint, [], mockOpenPGPMsg))
                .rejects.toThrow('WalletClient is required for write operations');
        });

        test('addSubkey should throw when walletClient is undefined', async () => {
            web3pgp.walletClient = undefined;

            await expect(web3pgp.addSubkey(mockFingerprint, mockFingerprint2, mockOpenPGPMsg))
                .rejects.toThrow('WalletClient is required for write operations');
        });

        test('revoke should throw when walletClient is undefined', async () => {
            web3pgp.walletClient = undefined;

            await expect(web3pgp.revoke(mockFingerprint, mockRevocationCert))
                .rejects.toThrow('WalletClient is required for write operations');
        });

        test('updateRequestedFee should throw when walletClient is undefined', async () => {
            web3pgp.walletClient = undefined;

            await expect(web3pgp.updateRequestedFee(BigInt(1000)))
                .rejects.toThrow('WalletClient is required for write operations');
        });

        test('withdrawFees should throw when walletClient is undefined', async () => {
            web3pgp.walletClient = undefined;

            await expect(web3pgp.withdrawFees('0x1234567890123456789012345678901234567890'))
                .rejects.toThrow('WalletClient is required for write operations');
        });

        test('initialize should throw when walletClient is undefined', async () => {
            web3pgp.walletClient = undefined;

            await expect(web3pgp.initialize(BigInt(1000), '0x1234567890123456789012345678901234567890'))
                .rejects.toThrow('WalletClient is required for write operations');
        });

        test('initializeUpgrade should throw when walletClient is undefined', async () => {
            web3pgp.walletClient = undefined;

            await expect(web3pgp.initializeUpgrade())
                .rejects.toThrow('WalletClient is required for write operations');
        });

        test('upgradeToAndCall should throw when walletClient is undefined', async () => {
            web3pgp.walletClient = undefined;

            await expect(web3pgp.upgradeToAndCall('0x1234567890123456789012345678901234567890', '0x'))
                .rejects.toThrow('WalletClient is required for write operations');
        });
    });

    describe('WRITE FUNCTIONS - Success Cases', () => {
        const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' as `0x${string}`;
        const mockReceipt: TransactionReceipt = {
            transactionHash: mockTxHash,
            blockHash: '0x' + '1'.repeat(64) as `0x${string}`,
            blockNumber: BigInt(12345),
            status: 'success',
            from: '0x1234567890123456789012345678901234567890' as `0x${string}`,
            to: contractAddress,
            contractAddress: null,
            gasUsed: BigInt(100000),
            cumulativeGasUsed: BigInt(100000),
            effectiveGasPrice: BigInt(1000000000),
            logs: [],
            logsBloom: '0x' as `0x${string}`,
            transactionIndex: 0,
            type: 'eip1559',
        };

        beforeEach(() => {
            (publicClient.readContract as jest.Mock).mockResolvedValue(BigInt(1000)); // Mock fee
            (publicClient.simulateContract as jest.Mock).mockResolvedValue({ request: {} });
            (walletClient.writeContract as jest.Mock).mockResolvedValue(mockTxHash);
            (publicClient.waitForTransactionReceipt as jest.Mock).mockResolvedValue(mockReceipt);
        });

        describe('register', () => {
            test('should register a primary key without subkeys', async () => {
                const result = await web3pgp.register(mockFingerprint, [], mockOpenPGPMsg);

                expect(publicClient.readContract).toHaveBeenCalledWith(
                    expect.objectContaining({ functionName: 'requestedFee' })
                );
                expect(publicClient.simulateContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    account: walletClient.account,
                    abi: Web3PGP.abi,
                    functionName: 'register',
                    args: [toBytes32(mockFingerprint), [], mockOpenPGPMsg],
                    value: BigInt(1000),
                });
                expect(walletClient.writeContract).toHaveBeenCalled();
                expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: mockTxHash });
                expect(result).toEqual(mockReceipt);
            });

            test('should register a primary key with subkeys', async () => {
                const subkeys = [mockFingerprint2];
                const result = await web3pgp.register(mockFingerprint, subkeys, mockOpenPGPMsg);

                expect(publicClient.simulateContract).toHaveBeenCalledWith(
                    expect.objectContaining({
                        functionName: 'register',
                        args: [
                            toBytes32(mockFingerprint),
                            subkeys.map(fp => toBytes32(fp)),
                            mockOpenPGPMsg
                        ],
                    })
                );
                expect(result).toEqual(mockReceipt);
            });

            test('should register with multiple subkeys', async () => {
                const subkeys = [mockFingerprint2, '0x' + 'aa'.repeat(32) as `0x${string}`];
                const result = await web3pgp.register(mockFingerprint, subkeys, mockOpenPGPMsg);

                expect(publicClient.simulateContract).toHaveBeenCalledWith(
                    expect.objectContaining({
                        args: expect.arrayContaining([
                            toBytes32(mockFingerprint),
                            expect.arrayContaining(subkeys.map(fp => toBytes32(fp))),
                        ]),
                    })
                );
                expect(result).toEqual(mockReceipt);
            });
        });

        describe('addSubkey', () => {
            test('should add a subkey to existing primary key', async () => {
                const result = await web3pgp.addSubkey(mockFingerprint, mockFingerprint2, mockOpenPGPMsg);

                expect(publicClient.simulateContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    account: walletClient.account,
                    abi: Web3PGP.abi,
                    functionName: 'addSubkey',
                    args: [
                        toBytes32(mockFingerprint),
                        toBytes32(mockFingerprint2),
                        mockOpenPGPMsg
                    ],
                    value: BigInt(1000),
                });
                expect(result).toEqual(mockReceipt);
            });
        });

        describe('revoke', () => {
            test('should revoke a key with revocation certificate', async () => {
                const result = await web3pgp.revoke(mockFingerprint, mockRevocationCert);

                expect(publicClient.simulateContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    account: walletClient.account,
                    abi: Web3PGP.abi,
                    functionName: 'revoke',
                    args: [toBytes32(mockFingerprint), mockRevocationCert],
                    value: BigInt(1000),
                });
                expect(result).toEqual(mockReceipt);
            });
        });

        describe('updateRequestedFee', () => {
            test('should update the requested fee', async () => {
                const newFee = BigInt(2000);
                const result = await web3pgp.updateRequestedFee(newFee);

                expect(publicClient.simulateContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    account: walletClient.account,
                    abi: Web3PGP.abi,
                    functionName: 'updateRequestedFee',
                    args: [newFee],
                });
                expect(result).toEqual(mockReceipt);
            });

            test('should update fee to zero', async () => {
                const newFee = BigInt(0);
                const result = await web3pgp.updateRequestedFee(newFee);

                expect(publicClient.simulateContract).toHaveBeenCalledWith(
                    expect.objectContaining({
                        args: [newFee],
                    })
                );
                expect(result).toEqual(mockReceipt);
            });
        });

        describe('withdrawFees', () => {
            test('should withdraw fees to specified address', async () => {
                const toAddress = '0x9876543210987654321098765432109876543210' as `0x${string}`;
                const result = await web3pgp.withdrawFees(toAddress);

                expect(publicClient.simulateContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    account: walletClient.account,
                    abi: Web3PGP.abi,
                    functionName: 'withdrawFees',
                    args: [toAddress],
                });
                expect(result).toEqual(mockReceipt);
            });
        });

        describe('initialize', () => {
            test('should initialize contract with fee and manager', async () => {
                const fee = BigInt(1000);
                const manager = '0x1111111111111111111111111111111111111111' as `0x${string}`;
                const result = await web3pgp.initialize(fee, manager);

                expect(publicClient.simulateContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    account: walletClient.account,
                    abi: Web3PGP.abi,
                    functionName: 'initialize',
                    args: [fee, manager],
                });
                expect(result).toEqual(mockReceipt);
            });
        });

        describe('initializeUpgrade', () => {
            test('should reinitialize contract after upgrade', async () => {
                const result = await web3pgp.initializeUpgrade();

                expect(publicClient.simulateContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    account: walletClient.account,
                    abi: Web3PGP.abi,
                    functionName: 'initializeUpgrade',
                    args: [],
                });
                expect(result).toEqual(mockReceipt);
            });
        });

        describe('upgradeToAndCall', () => {
            test('should upgrade to new implementation', async () => {
                const newImpl = '0x2222222222222222222222222222222222222222' as `0x${string}`;
                const data = '0x' as `0x${string}`;
                const result = await web3pgp.upgradeToAndCall(newImpl, data);

                expect(publicClient.simulateContract).toHaveBeenCalledWith({
                    address: contractAddress,
                    account: walletClient.account,
                    abi: Web3PGP.abi,
                    functionName: 'upgradeToAndCall',
                    args: [newImpl, data],
                });
                expect(result).toEqual(mockReceipt);
            });

            test('should upgrade with calldata', async () => {
                const newImpl = '0x2222222222222222222222222222222222222222' as `0x${string}`;
                const data = '0x1234abcd' as `0x${string}`;
                const result = await web3pgp.upgradeToAndCall(newImpl, data);

                expect(publicClient.simulateContract).toHaveBeenCalledWith(
                    expect.objectContaining({
                        args: [newImpl, data],
                    })
                );
                expect(result).toEqual(mockReceipt);
            });
        });
    });
});
