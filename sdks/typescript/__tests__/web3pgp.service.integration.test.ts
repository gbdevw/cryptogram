import { Web3PGP } from '../src/web3pgp/web3pgp';
import { Web3PGPService, Web3PGPServiceValidationError } from '../src/web3pgp/web3pgp.service';
import { AnvilHelper } from './helpers/anvil.helper';
import { Address, toHex } from 'viem';
import * as openpgp from 'openpgp';
import { OpenPGPUtils } from '../src/utils/openpgp';
import { BYTES32_ZERO, to0x, toBytes32 } from '../src/utils/0xstr';
import { KeyRegisteredLog, SubkeyAddedLog } from '../src/web3pgp/types/types';

/**
 * Integration tests for Web3PGPService using real OpenPGP keys and blockchain (Anvil)
 * 
 * These tests:
 * - Start a local Anvil blockchain
 * - Deploy real Web3PGP contracts
 * - Generate and use real OpenPGP keys
 * - Execute actual transactions
 * - Verify on-chain state and key reconstruction
 * 
 * Unlike unit tests, these DO NOT use mocks and test the full stack with real cryptographic operations.
 */
describe('Web3PGPService Integration Tests', () => {
    let anvil: AnvilHelper;
    let web3pgp: Web3PGP;
    let service: Web3PGPService;
    let contractAddress: Address;

    // OpenPGP test keys will be generated in tests
    let primaryKey: openpgp.PrivateKey;
    let publicKey: openpgp.PublicKey;

    beforeAll(async () => {
        console.log('Starting Anvil blockchain...');
        anvil = new AnvilHelper({ port: 8545, blockTime: 1 });
        await anvil.start();

        console.log('Deploying Web3PGP contract...');
        const deployment = await anvil.deployWeb3PGP();
        contractAddress = deployment.web3pgp;

        console.log('Creating Web3PGP and Web3PGPService instances...');
        web3pgp = new Web3PGP(
            contractAddress,
            anvil.getPublicClient(),
            anvil.getWalletClient()
        );
        service = new Web3PGPService(web3pgp);

        console.log('Setup complete!');
    }, 120000); // 2 minute timeout for setup

    afterAll(async () => {
        console.log('Stopping Anvil...');
        await anvil.stop();
    });

    describe('Key Registration', () => {
        test('should register a primary key without subkeys', async () => {
            // 1. Generate OpenPGP key pair
            const [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Sanitize the public key (remove private key material)
            const pk = await OpenPGPUtils.sanitizePrimaryKey(publicKey);
            // 3. Register the key on-chain
            const receipt = await service.register(pk);
            throw new Error('Not Implemented');
        });

        test('should register a primary key with subkeys', async () => {
            throw new Error('Not Implemented');
        });

        test('should fail to register an already registered key', async () => {
            throw new Error('Not Implemented');
        });

        test('should register a key with certification signature', async () => {
            throw new Error('Not Implemented');
        });

        test('should register a key with user attributes', async () => {
            throw new Error('Not Implemented');
        });
    });

    describe('Subkey Management', () => {
        test('should add a subkey to an existing primary key', async () => {
            throw new Error('Not Implemented');
        });

        test('should fail to add a subkey to unregistered primary key', async () => {
            throw new Error('Not Implemented');
        });

        test('should fail to add an already registered subkey', async () => {
            throw new Error('Not Implemented');
        });

        test('should add a subkey with specific key capabilities', async () => {
            throw new Error('Not Implemented');
        });
    });

    describe('Key Revocation', () => {
        test('should revoke a primary key using a revoked key object', async () => {
            throw new Error('Not Implemented');
        });

        test('should revoke a primary key using an armored revocation certificate', async () => {
            throw new Error('Not Implemented');
        });

        test('should revoke a subkey using a revoked key object', async () => {
            throw new Error('Not Implemented');
        });

        test('should revoke a subkey using an armored revocation certificate', async () => {
            throw new Error('Not Implemented');
        });

        test('should fail to revoke with invalid certificate', async () => {
            throw new Error('Not Implemented');
        });

        test('should fail to revoke an unregistered key', async () => {
            throw new Error('Not Implemented');
        });

        test('should apply multiple revocations correctly', async () => {
            throw new Error('Not Implemented');
        });
    });

    describe('Key Retrieval', () => {
        test('should retrieve a registered primary key', async () => {
            throw new Error('Not Implemented');
        });

        test('should retrieve a primary key with its subkeys', async () => {
            throw new Error('Not Implemented');
        });

        test('should retrieve a subkey by its fingerprint', async () => {
            throw new Error('Not Implemented');
        });

        test('should reconstruct key with added subkeys', async () => {
            throw new Error('Not Implemented');
        });

        test('should retrieve key with revocations applied', async () => {
            throw new Error('Not Implemented');
        });

        test('should fail to retrieve an unregistered key', async () => {
            throw new Error('Not Implemented');
        });

        test('should verify retrieved key matches original fingerprint', async () => {
            throw new Error('Not Implemented');
        });

        test('should handle keys with multiple user IDs', async () => {
            throw new Error('Not Implemented');
        });
    });

    describe('Complex Scenarios', () => {
        test('should handle complete key lifecycle: register -> add subkey -> revoke', async () => {
            throw new Error('Not Implemented');
        });

        test('should reconstruct key with multiple subkeys added separately', async () => {
            throw new Error('Not Implemented');
        });

        test('should handle partial revocations (some subkeys revoked)', async () => {
            throw new Error('Not Implemented');
        });

        test('should retrieve key after multiple updates', async () => {
            throw new Error('Not Implemented');
        });

        test('should handle keys with expired subkeys', async () => {
            throw new Error('Not Implemented');
        });

        test('should validate key fingerprints throughout reconstruction', async () => {
            throw new Error('Not Implemented');
        });
    });

    describe('Error Handling', () => {
        test('should throw Web3PGPServiceValidationError for malformed key data', async () => {
            throw new Error('Not Implemented');
        });

        test('should throw Web3PGPServiceCriticalError on blockchain failures', async () => {
            throw new Error('Not Implemented');
        });

        test('should skip invalid revocation certificates gracefully', async () => {
            throw new Error('Not Implemented');
        });

        test('should handle missing subkeys in retrieved data', async () => {
            throw new Error('Not Implemented');
        });
    });

    describe('Performance and Pagination', () => {
        test('should handle key with many subkeys efficiently', async () => {
            throw new Error('Not Implemented');
        });

        test('should paginate through large revocation lists', async () => {
            throw new Error('Not Implemented');
        });

        test('should handle concurrent key operations', async () => {
            throw new Error('Not Implemented');
        });
    });

    describe('Log Extraction and Validation', () => {
        describe('extractFromKeyRegisteredLog', () => {
            test('should extract valid public key from KeyRegisteredLog', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Forge the KeyRegisteredLog with minimal required fields
                //
                // Include the key with all its subkeys and declare alll of them
                let log: KeyRegisteredLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    subkeyFingerprints: publicKey.subkeys.map(subkey => toBytes32(to0x(subkey.getFingerprint()))),
                    openPGPMsg: toHex(publicKey.write())
                };
                // 3. Extract and validate using the service
                let extractedKey = await service.extractFromKeyRegisteredLog(log);
                // 4. Verify extracted key matches original
                expect(extractedKey.getFingerprint()).toBe(publicKey.getFingerprint());
                expect(extractedKey.subkeys.length).toBe(publicKey.subkeys.length);
                for (let i = 0; i < publicKey.subkeys.length; i++) {
                    expect(extractedKey.subkeys[i]!.getFingerprint()).toBe(publicKey.subkeys[i]!.getFingerprint());
                }
            });

            test('should remove extra subkeys', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Forge the KeyRegisteredLog with minimal required fields
                //
                // Include the key with all its subkeys but declare only one of them
                let log: KeyRegisteredLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    subkeyFingerprints: [toBytes32(to0x(publicKey.subkeys[0]!.getFingerprint()))],
                    openPGPMsg: toHex(publicKey.write())
                };
                // 3. Extract and validate using the service
                let extractedKey = await service.extractFromKeyRegisteredLog(log);
                // 4. Verify extracted key matches original and has the extra subkeey pruned
                expect(extractedKey.getFingerprint()).toBe(publicKey.getFingerprint());
                expect(extractedKey.subkeys.length).toBe(publicKey.subkeys.length-1);
                expect(extractedKey.subkeys[0]!.getFingerprint()).toBe(publicKey.subkeys[0]!.getFingerprint());
            });

            test('should throw if the declared fingerprint does not match the fingerprint computed from the public key', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Forge the KeyRegisteredLog with minimal required fields
                //
                // Include the key with all its subkeys but declare only one of them
                let log: KeyRegisteredLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: BYTES32_ZERO, // Invalid fingerprint
                    subkeyFingerprints: [toBytes32(to0x(publicKey.subkeys[0]!.getFingerprint()))],
                    openPGPMsg: toHex(publicKey.write())
                };
                // 3. Extract and validate using the service - EXPECT ERROR
                await expect(service.extractFromKeyRegisteredLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
            });

            test('should throw if the openPGP message is corrupted', async () => {
                // Forge log with corrupted OpenPGP message
                let log: KeyRegisteredLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: BYTES32_ZERO,
                    subkeyFingerprints: [],
                    openPGPMsg: '0xDEADBEEF' // Corrupted data
                };
                await expect(service.extractFromKeyRegisteredLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
            });

            test('should throw if one of the declared subkey is missing in the key data', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Forge the KeyRegisteredLog with minimal required fields
                //
                // Include the key with only one subkey but declare two subkeys
                let log: KeyRegisteredLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    subkeyFingerprints: [
                        toBytes32(to0x(publicKey.subkeys[0]!.getFingerprint())),
                        BYTES32_ZERO // Non-existent subkey
                    ],
                    openPGPMsg: toHex(publicKey.write())
                };
                await expect(service.extractFromKeyRegisteredLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
            });

            test('should return a public key even though a private key was registered', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Forge the KeyRegisteredLog with minimal required fields
                let log: KeyRegisteredLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: toBytes32(to0x(privateKey.getFingerprint())),
                    subkeyFingerprints: privateKey.subkeys.map(subkey => toBytes32(to0x(subkey.getFingerprint()))),
                    openPGPMsg: toHex(privateKey.write())
                };
                // 3. Extract and validate using the service
                let extractedKey = await service.extractFromKeyRegisteredLog(log);
                // 4. Verify extracted key matches original public key
                expect(extractedKey.getFingerprint()).toBe(publicKey.getFingerprint());
                expect(extractedKey.subkeys.length).toBe(publicKey.subkeys.length);
                for (let i = 0; i < publicKey.subkeys.length; i++) {
                    expect(extractedKey.subkeys[i]!.getFingerprint()).toBe(publicKey.subkeys[i]!.getFingerprint());
                }
                expect(extractedKey.isPrivate()).toBe(false);
            });

            test('should throw if a declared subkey fails verification in case verifications are enabled', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Remove binding signatures from the published subkey
                publicKey.subkeys[0]!.bindingSignatures = [];

                // 3. Forge the KeyRegisteredLog with minimal required fields
                let log: KeyRegisteredLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    subkeyFingerprints: [toBytes32(to0x(publicKey.subkeys[0]!.getFingerprint()))],
                    openPGPMsg: toHex(publicKey.write())
                };
                // 4. Extract and validate using the service - EXPECT ERROR
                await expect(service.extractFromKeyRegisteredLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
                // 5. Now extract with verifications disabled
                await expect(service.extractFromKeyRegisteredLog(log, true)).resolves.not.toThrow();
            });

            test('should throw if the primary key is revoked and verifications are enabled', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Revoke the primary key
                let pk = await openpgp.revokeKey({
                    key: privateKey,
                    format: 'object',
                });
                expect(await pk.publicKey.isRevoked()).toBe(true);

                // 3. Forge the KeyRegisteredLog with minimal required fields
                let log: KeyRegisteredLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    subkeyFingerprints: [toBytes32(to0x(publicKey.subkeys[0]!.getFingerprint()))],
                    openPGPMsg: toHex(pk.publicKey.write())
                };
                // 4. Extract and validate using the service - EXPECT ERROR
                await expect(service.extractFromKeyRegisteredLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
                // 5. Now extract with verifications disabled
                await expect(service.extractFromKeyRegisteredLog(log, true)).resolves.not.toThrow();
            });
        });

        describe('extractFromSubkeyAddedLog', () => {
            test('should extract valid subkey from SubkeyAddedLog and prune the extra ones', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Forge the SubkeyAddedLog with minimal required fields
                let log: SubkeyAddedLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    subkeyFingerprint: toBytes32(to0x(publicKey.subkeys[0]!.getFingerprint())),
                    openPGPMsg: toHex(publicKey.write())
                };
                // 3. Extract and validate using the service
                let extractedSubkey = await service.extractFromSubkeyAddedLog(log);
                // 4. Verify extracted subkey matches original
                expect(extractedSubkey.getFingerprint()).toBe(publicKey.getFingerprint());
                expect(extractedSubkey.subkeys.length).toBe(1);
                expect(extractedSubkey.subkeys[0]!.getFingerprint()).toBe(publicKey.subkeys[0]!.getFingerprint());
            });

            test('should throw if the primary key fingerprint does not matches the one declared in the log', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Forge the SubkeyAddedLog with minimal required fields
                let log: SubkeyAddedLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: BYTES32_ZERO, // Invalid fingerprint
                    subkeyFingerprint: toBytes32(to0x(publicKey.subkeys[0]!.getFingerprint())),
                    openPGPMsg: toHex(publicKey.write())
                };
                // 3. Extract and validate using the service - EXPECT ERROR
                await expect(service.extractFromSubkeyAddedLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
            });

            test('should throw if the subkey is missing from the key data', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Prune the subkeys to simulate missing subkey
                publicKey.subkeys = [];
                // 3. Forge the SubkeyAddedLog with minimal required fields
                let log: SubkeyAddedLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    subkeyFingerprint: BYTES32_ZERO, // Non-existent subkey
                    openPGPMsg: toHex(publicKey.write())
                };
                // 4. Extract and validate using the service - EXPECT ERROR
                await expect(service.extractFromSubkeyAddedLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
            });

            test('should throw if the subkey does not match the declared subkey fingerprint', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Forge the SubkeyAddedLog with minimal required fields
                let log: SubkeyAddedLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    subkeyFingerprint: BYTES32_ZERO, // Invalid fingerprint
                    openPGPMsg: toHex(publicKey.write())
                };
                // 3. Extract and validate using the service - EXPECT ERROR
                await expect(service.extractFromSubkeyAddedLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
            });

            test('should throw if the openPGP message is not valid', async () => {
                // 1. Forge log with corrupted OpenPGP message
                let log: SubkeyAddedLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: BYTES32_ZERO,
                    subkeyFingerprint: BYTES32_ZERO,
                    openPGPMsg: '0xDEADBEEF' // Corrupted data
                };
                // 2. Extract and validate using the service - EXPECT ERROR
                await expect(service.extractFromSubkeyAddedLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
            });

            test('should throw an error if the subkey does not have a valid binding signature', async () => {
                
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Remove binding signatures from the published subkey
                publicKey.subkeys[0]!.bindingSignatures = [];

                // 3. Forge the SubkeyAddedLog with minimal required fields
                let log: SubkeyAddedLog = {
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockDate: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    primaryKeyFingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    subkeyFingerprint: toBytes32(to0x(publicKey.subkeys[0]!.getFingerprint())),
                    openPGPMsg: toHex(publicKey.write())
                };
                // 4. Extract and validate using the service - EXPECT ERROR
                await expect(service.extractFromSubkeyAddedLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
                // 5. Now extract with verifications disabled
                await expect(service.extractFromSubkeyAddedLog(log, true)).resolves.not.toThrow();
            });
        });

        // RESUME HERE - ADD p-limit to limit service overshootting requests
        // Add tests for revocation and the rest of the service methods

        describe('extractFromKeyRevokedLog', () => {
            test('should extract revoked key certificate from KeyRevokedLog', async () => {
                throw new Error('Not Implemented');
            });

            test('should extract standalone revocation certificate from KeyRevokedLog', async () => {
                throw new Error('Not Implemented');
            });

            test('should validate primary key revocation is effective', async () => {
                throw new Error('Not Implemented');
            });

            test('should validate subkey revocation is effective', async () => {
                throw new Error('Not Implemented');
            });

            test('should sanitize revoked primary key correctly', async () => {
                throw new Error('Not Implemented');
            });

            test('should sanitize revoked subkey correctly', async () => {
                throw new Error('Not Implemented');
            });

            test('should throw ValidationError for missing fingerprint', async () => {
                throw new Error('Not Implemented');
            });

            test('should throw ValidationError for missing revocationCertificate', async () => {
                throw new Error('Not Implemented');
            });

            test('should throw ValidationError if key is not revoked', async () => {
                throw new Error('Not Implemented');
            });

            test('should throw ValidationError for corrupted OpenPGP message', async () => {
                throw new Error('Not Implemented');
            });

            test('should handle both armored and binary revocation formats', async () => {
                throw new Error('Not Implemented');
            });
        });

        describe('Integration with blockchain logs', () => {
            test('should extract key from real KeyRegistered event', async () => {
                throw new Error('Not Implemented');
            });

            test('should extract subkey from real SubkeyAdded event', async () => {
                throw new Error('Not Implemented');
            });

            test('should extract revocation from real KeyRevoked event', async () => {
                throw new Error('Not Implemented');
            });

            test('should process multiple logs in sequence', async () => {
                throw new Error('Not Implemented');
            });

            test('should handle malformed logs gracefully', async () => {
                throw new Error('Not Implemented');
            });
        });
    });
});

/*********************************************************************************************************************/
/* HELPERS                                                                                                           */
/*********************************************************************************************************************/

/**
 * Creates OpenPGP keys for Alice with primary key and two subkeys (signing and encryption).
 * 
 * @returns A promise that resolves to a tuple containing:
 *          - Alice's PrivateKey
 *          - Alice's PublicKey
 *          - Alice's Revocation Certificate (armored string)
 */
async function createAliceOpenPGPKeys(): Promise<[openpgp.PrivateKey, openpgp.PublicKey, string]> {
    const keys = await openpgp.generateKey({
        format: 'object',
        type: 'rsa',
        rsaBits: 4096,
        userIDs: [{ name: 'Alice', email: 'alice@example.com' }],
        subkeys: [
            { 
                type: 'rsa', 
                rsaBits: 4096, 
                sign: true,
                keyExpirationTime: 365 * 24 * 60 * 60 // 1 year
            },
            { 
                type: 'rsa', 
                rsaBits: 4096, 
                keyExpirationTime: 365 * 24 * 60 * 60 // 1 year
            }
        ],
    });
    return [keys.privateKey, keys.publicKey, keys.revocationCertificate];
}
