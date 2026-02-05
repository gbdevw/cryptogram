import { Web3PGP } from '../src/web3pgp/web3pgp';
import { Web3PGPService, Web3PGPServiceError, Web3PGPServiceValidationError } from '../src/web3pgp/web3pgp.service';
import { getPublicClient, getTestWalletClient, getContractAddress } from '../src/utils/test-wallet';
import { Address, ContractFunctionExecutionError, toHex } from 'viem';
import * as openpgp from 'openpgp';
import { OpenPGPUtils } from '../src/utils/openpgp';
import { BYTES32_ZERO, to0x, toBytes32 } from '../src/utils/0xstr';
import { KeyRegisteredLog, KeyRevokedLog, SubkeyAddedLog, Web3PGPEvents } from '../src/web3pgp/types/types';
import { forma } from 'viem/chains';

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
    let web3pgp: Web3PGP;
    let service: Web3PGPService;
    let contractAddress: Address;

    // OpenPGP test keys will be generated in tests
    let primaryKey: openpgp.PrivateKey;
    let publicKey: openpgp.PublicKey;

    beforeAll(async () => {
        console.log('========================================');
        console.log('Initializing Web3PGPService Integration Tests');
        console.log('========================================');

        // Verify required environment variables
        if (!process.env.DEXES_WEB3PGP) {
            throw new Error(
                'Contract addresses not found in environment.\n' +
                'Please run "npm test" to start anvil and deploy contracts.'
            );
        }

        contractAddress = getContractAddress('DEXES_WEB3PGP');
        console.log('✓ Web3PGP address loaded:', contractAddress);

        console.log('Creating Web3PGP and Web3PGPService instances...');
        web3pgp = new Web3PGP(
            contractAddress,
            getPublicClient(),
            getTestWalletClient()
        );
        service = new Web3PGPService(web3pgp);
        console.log('✓ SDK instances initialized');
        console.log('========================================\n');
    }, 120000); // 2 minute timeout

    describe('Key Registration', () => {
        test('should register a primary key without subkeys', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Sanitize the public key (remove private key material)
            let pk = await OpenPGPUtils.sanitizePrimaryKey(publicKey);
            // 3. Register the key on-chain
            let receipt = await service.register(pk);
            // 4. Use the low level bindings and information fom the receipt to extract the KeyRegisteredLog from the blockchain
            let log = await service.contract.getKeyRegisteredLog(toBytes32(to0x(publicKey.getFingerprint())), receipt.blockNumber);
            // 5. Extract the key from the log and verify it matches the original
            let extractedKey = await service.extractFromKeyRegisteredLog(log);
            expect(extractedKey.getFingerprint()).toBe(publicKey.getFingerprint());
            expect(extractedKey.subkeys.length).toBe(0);
        });

        test('should register a primary key with subkeys', async () => {
            // 1. Generate OpenPGP key pair with subkeys
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key with its subkeys on-chain
            let receipt = await service.register(publicKey);
            // 3. Use the low level bindings and information fom the receipt to extract the KeyRegisteredLog from the blockchain
            let log = await service.contract.getKeyRegisteredLog(toBytes32(to0x(publicKey.getFingerprint())), receipt.blockNumber);
            // 4. Extract the key from the log and verify it matches the original
            let extractedKey = await service.extractFromKeyRegisteredLog(log);
            expect(extractedKey.getFingerprint()).toBe(publicKey.getFingerprint());
            expect(extractedKey.subkeys.length).toBe(publicKey.subkeys.length);
            for (let i = 0; i < publicKey.subkeys.length; i++) {
                expect(extractedKey.subkeys[i]!.getFingerprint()).toBe(publicKey.subkeys[i]!.getFingerprint());
            }
        });

        test('should fail to register an already registered key', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key on-chain
            await service.register(publicKey);
            // 3. Attempt to register the same key again - EXPECT ERROR
            await expect(service.register(publicKey)).rejects.toThrow(ContractFunctionExecutionError);
        });

        test('should fail to register a revoked key', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Revoke the key locally
            let revoked = await openpgp.revokeKey({ key: privateKey, format: 'object' });
            expect(await revoked.publicKey.isRevoked()).toBe(true);
            // 3. Attempt to register the revoked key - EXPECT ERROR
            await expect(service.register((revoked.publicKey))).rejects.toThrow(Web3PGPServiceError);
        });

        test('should fail to register a key with a revoked subkey', async () => {
            // 1. Generate OpenPGP key pair with subkeys
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Revoke one of the subkeys locally
            publicKey.subkeys[0] = await publicKey.subkeys[0]!.revoke(privateKey.keyPacket as openpgp.SecretKeyPacket);
            expect(await OpenPGPUtils.isSubkeyRevoked(publicKey.subkeys[0]!, publicKey)).toBe(true);
            // 3. Attempt to register the key - EXPECT ERROR
            await expect(service.register(publicKey)).rejects.toThrow(Web3PGPServiceError);   
        });

        test('should fail to register a malformed key', async () => {
            // 1. Create a malformed public key by removing binding signatures from one subkey
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            publicKey.subkeys[0]!.bindingSignatures = [];
            // 2. Attempt to register the malformed key - EXPECT ERROR
            await expect(service.register(publicKey)).rejects.toThrow(Web3PGPServiceError);   
        });
    });

    describe('Key Updates', () => {
        test('should update the on-chain key when a new self-signature is added', async () => {
            // 1. Generate OpenPGP key pair with subkeys
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key with its subkeys on-chain
            await expect(service.register(publicKey)).resolves.not.toThrow();
            // 3. Modify the key by adding a new user ID
            const originalUser = await privateKey.getPrimaryUser()
            const localUpdatedKey = await openpgp.reformatKey({
                privateKey: privateKey,
                userIDs: [originalUser.user.userID!, { name: 'Alice Updated', email: 'alice.updated@example.com' }],
                format: 'object'
            })
            expect(localUpdatedKey.publicKey.getUserIDs().length).toBe(2);
            expect(localUpdatedKey.publicKey.getFingerprint()).toBe(publicKey.getFingerprint());
            // 4. Revoke the original user ID to simulate an update
            expect(localUpdatedKey.privateKey.users[0].userID!.name).toBe(originalUser.user.userID!.name); // Ensure the new user ID is in place
            localUpdatedKey.privateKey.users[0] = await localUpdatedKey.privateKey.users[0].revoke(privateKey.keyPacket as openpgp.SecretKeyPacket);
            expect(await localUpdatedKey.privateKey.users[0].isRevoked(localUpdatedKey.privateKey.users[0].revocationSignatures[0], localUpdatedKey.publicKey.keyPacket)).toBe(true);
            // 4. Update the on-chain key
            const receipt = await service.update(localUpdatedKey.privateKey.toPublic());
            // 5. Use getPublicKey to retrieve the updated key
            let retrievedKey = await service.getPublicKey(to0x(localUpdatedKey.publicKey.getFingerprint()));
            // 6. Verify the retrieved key matches the locally updated key
            expect(retrievedKey.subkeys.length).toBe(localUpdatedKey.publicKey.subkeys.length);
            expect(retrievedKey.getFingerprint()).toBe(localUpdatedKey.publicKey.getFingerprint());
            expect(retrievedKey.getUserIDs().length).toBe(2);
            expect(retrievedKey.users[1].userID?.name).toBe('Alice Updated');
            expect(retrievedKey.users[1].userID?.email).toBe('alice.updated@example.com');
            expect(await retrievedKey.users[0].isRevoked(retrievedKey.users[0].revocationSignatures[0], retrievedKey.keyPacket)).toBe(true);
            // 7. Inspect the receipt's logs
            const logs = await service.contract.extractKeyUpdatedLog(receipt);
            expect(logs.length).toBe(1);
            const extractedKey = await service.extractFromKeyUpdatedLog(logs[0]);
            expect(extractedKey.getFingerprint()).toBe(localUpdatedKey.publicKey.getFingerprint());
            expect(extractedKey.getUserIDs().length).toBe(2);
            expect(extractedKey.users[1].userID?.name).toBe('Alice Updated');
            expect(extractedKey.users[1].userID?.email).toBe('alice.updated@example.com');
            expect(await extractedKey.users[0].isRevoked(extractedKey.users[0].revocationSignatures[0], extractedKey.keyPacket)).toBe(true);
            expect(extractedKey.subkeys.length).toBe(0); // The client should not send subkeys in updates
        });

        test('should fail to update an unregistered key', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            await expect(service.update(publicKey)).rejects.toThrow(ContractFunctionExecutionError);
        });
    });

    describe('Subkey Management', () => {
        test('should add a subkey to an existing primary key', async () => {
            // 1. Generate OpenPGP key pair for primary key
            let [primaryPrivateKey, primaryPublicKey, primaryRevocationCert] = await createAliceOpenPGPKeys();
            // 2. Create a copy of the subkeys
            let subkeys = primaryPublicKey.subkeys
            // Remove all subkeys from the primary key
            primaryPublicKey.subkeys = [];
            // 3. Register the primary key without subkeys
            await service.register(primaryPublicKey);
            // 4. Add a subkey to the registered primary key
            primaryPublicKey.subkeys = subkeys;
            let receipt = await service.addSubkey(primaryPublicKey, to0x(primaryPublicKey.subkeys[0]!.getFingerprint()));
            // 5. Use the low level bindings and information fom the receipt to extract the SubkeyAddedLog from the blockchain
            let log = await service.contract.getSubkeyAddedLog(
                to0x(primaryPublicKey.getFingerprint()), 
                to0x(primaryPublicKey.subkeys[0]!.getFingerprint()), 
                receipt.blockNumber
            );
            // 6. Extract the key from the log and verify it matches the original subkey
            let extractedKey = await service.extractFromSubkeyAddedLog(log);
            expect(extractedKey.getFingerprint()).toBe(primaryPublicKey.getFingerprint());
            expect(extractedKey.subkeys.length).toBe(1);
            expect(extractedKey.subkeys[0]!.getFingerprint()).toBe(primaryPublicKey.subkeys[0]!.getFingerprint());
        });

        test('should fail to add a subkey to unregistered primary key', async () => {
            // 1. Generate OpenPGP key pair for primary key
            let [primaryPrivateKey, primaryPublicKey, primaryRevocationCert] = await createAliceOpenPGPKeys();
            // 2. Attempt to add a subkey to the unregistered primary key - EXPECT ERROR
            await expect(service.addSubkey(primaryPublicKey, to0x(primaryPublicKey.subkeys[0]!.getFingerprint()))).rejects.toThrow(ContractFunctionExecutionError);
        });

        test('should fail to add an already registered subkey', async () => {
            // 1. Generate OpenPGP key pair for primary key
            let [primaryPrivateKey, primaryPublicKey, primaryRevocationCert] = await createAliceOpenPGPKeys();
            // 2. Create a copy of the subkeys
            let subkeys = primaryPublicKey.subkeys
            // Remove all subkeys from the primary key
            primaryPublicKey.subkeys = [];
            // 3. Register the primary key without subkeys
            await service.register(primaryPublicKey);
            // 4. Add a subkey to the registered primary key
            primaryPublicKey.subkeys = subkeys;
            let receipt = await service.addSubkey(primaryPublicKey, to0x(primaryPublicKey.subkeys[0]!.getFingerprint()));
            // 5. Attempt to add the same subkey again - EXPECT ERROR
            await expect(service.addSubkey(primaryPublicKey, to0x(primaryPublicKey.subkeys[0]!.getFingerprint()))).rejects.toThrow(ContractFunctionExecutionError);
        });

        test('should fail if a subkey without a valid binding signature is added', async () => {
            // 1. Create Alice's keys and store subkeys aside
            let [alicePrivateKey, alicePublicKey, aliceRevocationCert] = await createAliceOpenPGPKeys();
            let aliceSubkeys = alicePublicKey.subkeys;
            alicePublicKey.subkeys = [];
            // 2. Register Alice's primary key
            await service.register(alicePublicKey);
            // 3. Restore Alice's subkeys and remove binding signatures from the one that will be published
            alicePublicKey.subkeys = aliceSubkeys;
            alicePublicKey.subkeys[0]!.bindingSignatures = [];
            // 4. Attempt to add Bob's subkey to Alice's primary key - EXPECT ERROR
            await expect(service.addSubkey(alicePublicKey, to0x(alicePublicKey.subkeys[0]!.getFingerprint()))).rejects.toThrow(Web3PGPServiceError);
        });

        test('should fail if a revoked subkey is added', async () => {
            // 1. Create Alice's keys
            let [alicePrivateKey, alicePublicKey, aliceRevocationCert] = await createAliceOpenPGPKeys();
            // 2. Register Alice's primary key
            await expect(service.register(alicePublicKey)).resolves.not.toThrow();
            // 3. Create a new subkey and revoke it
            alicePrivateKey = await alicePrivateKey.addSubkey({
                type: 'rsa',
                rsaBits: 8192,
                sign: true,
            });
            alicePrivateKey.subkeys[alicePrivateKey.subkeys.length - 1] = await alicePrivateKey.subkeys[alicePrivateKey.subkeys.length - 1]!.revoke(alicePrivateKey.keyPacket as openpgp.SecretKeyPacket);
            expect(await OpenPGPUtils.isSubkeyRevoked(alicePrivateKey.subkeys[alicePrivateKey.subkeys.length - 1]!, alicePrivateKey.toPublic())).toBe(true);
            // 4. Attempt to add the revoked subkey to Alice's primary key - EXPECT ERROR
            await expect(service.addSubkey(alicePrivateKey.toPublic(), to0x(alicePrivateKey.subkeys[alicePrivateKey.subkeys.length - 1]!.getFingerprint()))).rejects.toThrow(Web3PGPServiceError);
        });

        test('should fail if a subkey that do not belong to the primary key is added', async () => {
            // 1. Create Alice's and Bob's keys
            let [alicePrivateKey, alicePublicKey, aliceRevocationCert] = await createAliceOpenPGPKeys();
            let [bobPrivateKey, bobPublicKey, bobRevocationCert] = await createBobOpenPGPKeys();
            // 2. Register Alice's primary key
            await expect(service.register(alicePublicKey)).resolves.not.toThrow();
            // 3. Attempt to add Bob's subkey to Alice's primary key - EXPECT ERROR
            await expect(service.addSubkey(alicePublicKey, to0x(bobPublicKey.subkeys[0]!.getFingerprint()))).rejects.toThrow(Web3PGPServiceError);
        });
    });

    describe('Key Revocation', () => {
        test('should publish a key revocation certificate for the primary key', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key on-chain
            await service.register(publicKey);
            // 3. Revoke the key locally
            let revoked = await openpgp.revokeKey({ key: privateKey, format: 'object' });
            expect(await revoked.publicKey.isRevoked()).toBe(true);
            // 3. Publish the revocation certificate
            let receipt = await service.revoke(revoked.publicKey, to0x(revoked.publicKey.getFingerprint()));
            // 4. Use the low level bindings and information fom the receipt to extract the KeyRevokedLog from the blockchain
            let logs = await service.contract.searchKeyRevokedLogs(toBytes32(to0x(publicKey.getFingerprint())), receipt.blockNumber, receipt.blockNumber);
            // 5. Extract the revocation certificate from the log and verify it matches the original
            expect(logs.length).toBe(1);
            let [revokedKey, cert] = await service.extractFromKeyRevokedLog(logs[0]);
            expect(cert).toBeUndefined; // Full key revocation does not have a standalone certificate
            expect(revokedKey).toBeDefined();
            expect(revokedKey!.getFingerprint()).toBe(publicKey.getFingerprint());
            expect(revokedKey!.subkeys.length).toBe(0);
            expect(await revokedKey!.isRevoked()).toBe(true);
        });

        test('should publish a standalone armored revocation certificate', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key on-chain
            await service.register(publicKey);
            // 3. Publish the standalone revocation certificate
            let receipt = await service.revoke(revocationCert, to0x(publicKey.getFingerprint()));
            // 4. Use the low level bindings and information fom the receipt to extract the KeyRevokedLog from the blockchain
            let logs = await service.contract.searchKeyRevokedLogs(toBytes32(to0x(publicKey.getFingerprint())), receipt.blockNumber, receipt.blockNumber);
            // 5. Extract the key revocation certificate from the log and verify it matches the original
            // NOTE: revoke, when used with a standalone subkey revocation, publishes the full primary key with the revoked subkey
            expect(logs.length).toBe(1);
            let [revokedKey, cert] = await service.extractFromKeyRevokedLog(logs[0]);
            expect(cert).toBeUndefined(); 
            expect(revokedKey).toBeDefined();
            expect(await revokedKey!.isRevoked()).toBe(true);
        });

        test('should publish a key revocation certificate with a revoked subkey', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key on-chain
            await service.register(publicKey);
            // 3. Revoke one of the subkeys locally
            publicKey.subkeys[0] = await publicKey.subkeys[0]!.revoke(privateKey.keyPacket as openpgp.SecretKeyPacket);
            expect(await OpenPGPUtils.isSubkeyRevoked(publicKey.subkeys[0]!, publicKey)).toBe(true);
            // 4. Publish the revocation certificate for the subkey
            let receipt = await service.revoke(publicKey, to0x(publicKey.subkeys[0]!.getFingerprint()));
            // 5. Use the low level bindings and information fom the receipt to extract the KeyRevokedLog from the blockchain
            let logs = await service.contract.searchKeyRevokedLogs(toBytes32(to0x(publicKey.subkeys[0]!.getFingerprint())), receipt.blockNumber, receipt.blockNumber);
            expect(logs.length).toBe(1);
            // 6. Extract the key certificate from the log and verify it matches the original
            let [revokedKey, cert] = await service.extractFromKeyRevokedLog(logs[0]);
            expect(cert).toBeUndefined(); // Full key revocation does not have a standalone certificate
            expect(revokedKey).toBeDefined();
            expect(revokedKey!.getFingerprint()).toBe(publicKey.getFingerprint());
            expect(revokedKey!.subkeys.length).toBe(1);
            expect(revokedKey!.subkeys[0]!.getFingerprint()).toBe(publicKey.subkeys[0]!.getFingerprint());
            expect(await OpenPGPUtils.isSubkeyRevoked(revokedKey!.subkeys[0]!, revokedKey!)).toBe(true);
        });

        test('should fail if the target key is not revoked', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key on-chain
            await service.register(publicKey);
            // 3. Attempt to publish a revocation for a non-revoked key - EXPECT ERROR
            await expect(service.revoke(publicKey, to0x(publicKey.getFingerprint()))).rejects.toThrow(Web3PGPServiceValidationError);
        });

        test('should fail if the target subkey is not revoked', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key on-chain
            await service.register(publicKey);
            // 3. Attempt to publish a revocation for a non-revoked subkey - EXPECT ERROR
            await expect(service.revoke(publicKey, to0x(publicKey.subkeys[0]!.getFingerprint()))).rejects.toThrow(Error);
        });

        test('should apply multiple revocations correctly', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key on-chain
            await service.register(publicKey);
            // 3. Revoke the primary key locally
            let revokedKey = await openpgp.revokeKey({ key: privateKey, format: 'object' });
            expect(await revokedKey.publicKey.isRevoked()).toBe(true);
            // 4. Publish the primary key revocation
            await expect(service.revoke(revokedKey.publicKey, to0x(revokedKey.publicKey.getFingerprint()))).resolves.not.toThrow();
            // 5. Do it again
            await expect(service.revoke(revokedKey.publicKey, to0x(revokedKey.publicKey.getFingerprint()))).resolves.not.toThrow();
        });

        test('should fail if the target key is not registered', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Locally revoke the key
            let revoked = await openpgp.revokeKey({ key: privateKey, format: 'object' });
            expect(await revoked.publicKey.isRevoked()).toBe(true);
            // 3. Attempt to publish the revocation for the unregistered key - EXPECT ERROR
            await expect(service.revoke(revoked.publicKey, to0x(revoked.publicKey.getFingerprint()))).rejects.toThrow(ContractFunctionExecutionError);
        });

        test('should fail if the revocation certificate is malformed', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key on-chain
            await service.register(publicKey);
            // 3. Create a malformed revocation certificate
            let malformedCert = revocationCert.slice(0, revocationCert.length - 10) + 'AAAAAAAAAA';
            // 4. Attempt to publish the malformed revocation certificate - EXPECT ERROR
            await expect(service.revoke(malformedCert, to0x(publicKey.getFingerprint()))).rejects.toThrow();
        });

        test('should fail if athe provided fingerprint does not match the any provided key', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key on-chain
            await service.register(publicKey);
            // 3. Attempt to publish the revocation with a mismatched fingerprint - EXPECT ERROR
            await expect(service.revoke(revocationCert, BYTES32_ZERO)).rejects.toThrow(Web3PGPServiceError);
        });
    });

    describe('Key Retrieval', () => {
        test('should retrieve a registered primary key without subkeys', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Remove the subkeys to register only the primary key
            let pk = await OpenPGPUtils.sanitizePrimaryKey(publicKey);
            // 3. Register the key on-chain
            await service.register(pk);
            // 4. Retrieve the key using the service
            let retrievedKey = await service.getPublicKey(to0x(publicKey.getFingerprint()));
            // 5. Verify the retrieved key matches the original
            expect(retrievedKey.getFingerprint()).toBe(publicKey.getFingerprint());
            expect(retrievedKey.subkeys.length).toBe(0);
        });

        test('should retrieve a primary key registered with its subkeys', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key with its subkeys on-chain
            await service.register(publicKey);
            // 3. Retrieve the key using the service
            let retrievedKey = await service.getPublicKey(to0x(publicKey.getFingerprint()));
            // 4. Verify the retrieved key matches the original
            expect(retrievedKey.getFingerprint()).toBe(publicKey.getFingerprint());
            expect(retrievedKey.subkeys.length).toBe(publicKey.subkeys.length);
            for (let i = 0; i < publicKey.subkeys.length; i++) {
                expect(retrievedKey.subkeys[i]!.getFingerprint()).toBe(publicKey.subkeys[i]!.getFingerprint());
            }
        });

        test('should retrieve a revoked public key with its subkeys - key revocation certificate', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key with its subkeys on-chain
            await service.register(publicKey);
            // 3. Revoke the key locally
            let revoked = await openpgp.revokeKey({ key: privateKey, format: 'object' });
            expect(await revoked.publicKey.isRevoked()).toBe(true);
            // 4. Publish the revocation certificate
            await service.revoke(revoked.publicKey, to0x(revoked.publicKey.getFingerprint()));
            // 5. Retrieve the key using the service
            let retrievedKey = await service.getPublicKey(to0x(publicKey.getFingerprint()));
            // 6. Verify the retrieved key matches the original and is marked as revoked
            expect(retrievedKey.getFingerprint()).toBe(publicKey.getFingerprint());
            expect(retrievedKey.subkeys.length).toBe(publicKey.subkeys.length);
            expect(await retrievedKey.isRevoked()).toBe(true);
            for (let i = 0; i < publicKey.subkeys.length; i++) {
                expect(retrievedKey.subkeys[i]!.getFingerprint()).toBe(publicKey.subkeys[i]!.getFingerprint());
                // Subkeys are considered as revoked because the primary key is revoked
                expect(await OpenPGPUtils.isSubkeyRevoked(retrievedKey.subkeys[i]!, retrievedKey)).toBe(true);
            }
        });

        test('should retrieve a revoked public key with its subkeys - standalone revocation certificate', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key with its subkeys on-chain
            await service.register(publicKey);
            // 3. Publish the standalone revocation certificate
            await service.revoke(revocationCert, to0x(publicKey.getFingerprint()));
            // 5. Retrieve the key using the service
            let retrievedKey = await service.getPublicKey(to0x(publicKey.getFingerprint()));
            // 6. Verify the retrieved key matches the original and is marked as revoked
            expect(retrievedKey.getFingerprint()).toBe(publicKey.getFingerprint());
            expect(retrievedKey.subkeys.length).toBe(publicKey.subkeys.length);
            expect(await retrievedKey.isRevoked()).toBe(true);
            for (let i = 0; i < publicKey.subkeys.length; i++) {
                expect(retrievedKey.subkeys[i]!.getFingerprint()).toBe(publicKey.subkeys[i]!.getFingerprint());
                // Subkeys are considered as revoked because the primary key is revoked
                expect(await OpenPGPUtils.isSubkeyRevoked(retrievedKey.subkeys[i]!, retrievedKey)).toBe(true);
            }
        });

        test('should retrieve a public key with one of its subkeys revoked', async () => {
            // 1. Generate OpenPGP key pair
            let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the key with its subkeys on-chain
            await service.register(publicKey);
            // 3. Revoke one of the subkeys locally
            let targetSubkeyFingerprint = publicKey.subkeys[0]!.getFingerprint();
            publicKey.subkeys[0] = await publicKey.subkeys[0]!.revoke(privateKey.keyPacket as openpgp.SecretKeyPacket);
            expect(await OpenPGPUtils.isSubkeyRevoked(publicKey.subkeys[0]!, publicKey)).toBe(true);
            // 4. Publish the revocation certificate for the subkey
            await service.revoke(publicKey, to0x(publicKey.subkeys[0]!.getFingerprint()));
            // 5. Retrieve the key using the service
            let retrievedKey = await service.getPublicKey(to0x(publicKey.getFingerprint()));
            // 6. Verify the retrieved key matches the original and the subkey is marked as revoked
            expect(retrievedKey.getFingerprint()).toBe(publicKey.getFingerprint());
            expect(retrievedKey.subkeys.length).toBe(2);
            let revokedFound = false;
            for (let i = 0; i < retrievedKey.subkeys.length; i++) {
                if (await OpenPGPUtils.isSubkeyRevoked(retrievedKey.subkeys[i]!, retrievedKey)) {
                    revokedFound = true;
                    break;
                }
            }
            expect(revokedFound).toBe(true);
        });

        test('should reconstruct key with added subkeys from a subkey fingerprint', async () => {
            // 1. Generate OpenPGP key pair for primary key
            let [primaryPrivateKey, primaryPublicKey, primaryRevocationCert] = await createAliceOpenPGPKeys();
            // 2. Register the primary key with subkeys
            await service.register(primaryPublicKey);
            // 3. Add a new subkey to the primary key
            primaryPrivateKey = await primaryPrivateKey.addSubkey({
                type: 'rsa',
                rsaBits: 4096,
                sign: true,
            });
            primaryPublicKey = primaryPrivateKey.toPublic();
            expect(primaryPublicKey.subkeys.length).toBe(3);
            expect(primaryPublicKey.subkeys[2]).toBeDefined();
            let targetFingerprint = toBytes32(to0x(primaryPublicKey.subkeys[2]!.getFingerprint()));
            // 4. Add a subkey to the registered primary key
            await service.addSubkey(primaryPublicKey, targetFingerprint);
            // 5. Retrieve the key using the service and the fingerprint of the newly added subkey
            let retrievedKey = await service.getPublicKey(targetFingerprint);
            // 6. Verify the retrieved key matches the original with the added subkey
            expect(retrievedKey.getFingerprint()).toBe(primaryPublicKey.getFingerprint());
            expect(retrievedKey.subkeys.length).toBe(primaryPrivateKey.subkeys.length);
            expect(retrievedKey.subkeys[2]).toBeDefined();
            expect(toBytes32(to0x(retrievedKey.subkeys[2]!.getFingerprint()))).toBe(targetFingerprint);
        });

        test('register multiple keys, subkeys and revocation certificates and reconstruct them', async () => {
            // 1. Generate Alice's and Bob's OpenPGP key pairs
            let [alicePrivateKey, alicePublicKey, aliceRevocationCert] = await createAliceOpenPGPKeys();    
            let [bobPrivateKey, bobPublicKey, bobRevocationCert] = await createBobOpenPGPKeys();
            // 2. Register both keys on-chain
            await service.register(alicePublicKey);
            await service.register(bobPublicKey);
            // 3. Add a subkey to Alice's key and publish it
            alicePrivateKey = await alicePrivateKey.addSubkey({
                type: 'rsa',
                rsaBits: 4096,
                sign: true,
            });
            alicePublicKey = alicePrivateKey.toPublic();
            await service.addSubkey(alicePublicKey, to0x(alicePublicKey.subkeys[2]!.getFingerprint()));
            // 4. Revoke Alice's added subkey locally and publish the revocation
            alicePublicKey = alicePrivateKey.toPublic();
            alicePublicKey.subkeys[0] = await alicePublicKey.subkeys[0]!.revoke(alicePrivateKey.keyPacket as openpgp.SecretKeyPacket);
            expect(await OpenPGPUtils.isSubkeyRevoked(alicePublicKey.subkeys[0]!, alicePublicKey)).toBe(true);
            await service.revoke(alicePublicKey, to0x(alicePublicKey.subkeys[0]!.getFingerprint()));
            // 4. Revoke Bob's primary key by publishing the standalone revocation certificate
            await service.revoke(bobRevocationCert, to0x(bobPublicKey.getFingerprint()));
            // 5. Retrieve and verify Alice's key
            let retrievedAlice = await service.getPublicKey(to0x(alicePublicKey.getFingerprint()));
            expect(retrievedAlice.getFingerprint()).toBe(alicePublicKey.getFingerprint());
            expect(retrievedAlice.subkeys.length).toBe(3);
            expect(await OpenPGPUtils.isSubkeyRevoked(retrievedAlice.subkeys[0]!, retrievedAlice)).toBe(true);
            // 6. Retrieve and verify Bob's key
            let retrievedBob = await service.getPublicKey(to0x(bobPublicKey.getFingerprint()));
            expect(retrievedBob.getFingerprint()).toBe(bobPublicKey.getFingerprint());
            expect(retrievedBob.subkeys.length).toBe(bobPublicKey.subkeys.length);
            expect(await retrievedBob.isRevoked()).toBe(true);
            for (let i = 0; i < bobPublicKey.subkeys.length; i++) {
                expect(retrievedBob.subkeys[i]!.getFingerprint()).toBe(bobPublicKey.subkeys[i]!.getFingerprint());
                expect(await OpenPGPUtils.isSubkeyRevoked(retrievedBob.subkeys[i]!, retrievedBob)).toBe(true);
            }
        });

        test('should fail to retrieve an unregistered key', async () => {
            await expect(service.getPublicKey(BYTES32_ZERO)).rejects.toThrow(Web3PGPServiceError);
        });

        test('should prevent malicious subkey injection by pruning subkeys that do not belong to the primary key', async () => {
            // 1. Create Alice's and Bob's OpenPGP key pairs
            let [alicePrivateKey, alicePublicKey, aliceRevocationCert] = await createAliceOpenPGPKeys();    
            let [bobPrivateKey, bobPublicKey, bobRevocationCert] = await createBobOpenPGPKeys();
            // 2. Register Alice's primary key on-chain
            await service.register(alicePublicKey);
            // 3. Add one of Bob's subkeys to Alice's primary key using low level client
            // NOTE: The high level service method would prevent this as tests above have shown
            await expect(web3pgp.addSubkey(
                toBytes32(to0x(alicePublicKey.getFingerprint())),
                toBytes32(to0x(bobPublicKey.subkeys[0]!.getFingerprint())),
                toHex(bobPublicKey.write())
            )).resolves.not.toThrow();
            // 4. Retrieve Alice's key using the service
            let retrievedKey = await service.getPublicKey(to0x(alicePublicKey.getFingerprint()));
            // 5. Verify the retrieved key matches Alice's primary key but does not include Bob's subkey
            expect(retrievedKey.getFingerprint()).toBe(alicePublicKey.getFingerprint());
            expect(retrievedKey.subkeys.length).toBe(alicePublicKey.subkeys.length);
            for (let i = 0; i < alicePublicKey.subkeys.length; i++) {
                expect(retrievedKey.subkeys[i]!.getFingerprint()).toBe(alicePublicKey.subkeys[i]!.getFingerprint());
            }
        });

        test('should prevent malicious revocation certificate injection by ignoring invalid standalone revocation certificates', async () => {
            // 1. Generate Alice's and Bob's OpenPGP key pair
            let [alicePrivateKey, alicePublicKey, aliceRevocationCert] = await createAliceOpenPGPKeys();
            let [bobPrivateKey, bobPublicKey, bobRevocationCert] = await createBobOpenPGPKeys();
            // 2. Register Alice's primary key on-chain
            await expect(service.register(alicePublicKey)).resolves.not.toThrow();
            // 3. Use the low level client to publish Bob's standalone revocation certificate as if it belonged to Alice's key
            let rcert = await openpgp.unarmor(bobRevocationCert);
            await expect(service.contract.revoke(
                toBytes32(to0x(alicePublicKey.getFingerprint())),
                toHex(rcert.data)
            )).resolves.not.toThrow();
            // 4. Retrieve Alice's key using the service
            let retrievedKey = await service.getPublicKey(to0x(alicePublicKey.getFingerprint()));
            // 5. Verify Alice's key is not marked as revoked
            expect(retrievedKey.getFingerprint()).toBe(alicePublicKey.getFingerprint());
            expect(retrievedKey.subkeys.length).toBe(alicePublicKey.subkeys.length);
            expect(await retrievedKey.isRevoked()).toBe(false);
            for (let i = 0; i < alicePublicKey.subkeys.length; i++) {
                expect(retrievedKey.subkeys[i]!.getFingerprint()).toBe(alicePublicKey.subkeys[i]!.getFingerprint());
                expect(await OpenPGPUtils.isSubkeyRevoked(retrievedKey.subkeys[i]!, retrievedKey)).toBe(false);
            }
        });

        test('should prevent malicious revocation certificate injection by ignoring invalid key revocation certificates', async () => {
            // 1. Generate Alice's and Bob's OpenPGP key pair
            let [alicePrivateKey, alicePublicKey, aliceRevocationCert] = await createAliceOpenPGPKeys();
            let [bobPrivateKey, bobPublicKey, bobRevocationCert] = await createBobOpenPGPKeys();
            // 2. Register Alice's primary key on-chain
            await expect(service.register(alicePublicKey)).resolves.not.toThrow();
            // 3. revoke Bob's key 
            let revokedBob = await openpgp.revokeKey({ key: bobPrivateKey, format: 'object' });
            expect(await revokedBob.publicKey.isRevoked()).toBe(true);
            // 4. Use the low level client to publish Bob's key revocation certificate as if it belonged to Alice's key
            await expect(service.contract.revoke(
                toBytes32(to0x(alicePublicKey.getFingerprint())),
                toHex(revokedBob.publicKey.write())
            )).resolves.not.toThrow();
            // 5. Retrieve Alice's key using the service
            let retrievedKey = await service.getPublicKey(to0x(alicePublicKey.getFingerprint()));
            // 6. Verify Alice's key is not marked as revoked
            expect(retrievedKey.getFingerprint()).toBe(alicePublicKey.getFingerprint());
            expect(retrievedKey.subkeys.length).toBe(alicePublicKey.subkeys.length);
            expect(await retrievedKey.isRevoked()).toBe(false);
            for (let i = 0; i < alicePublicKey.subkeys.length; i++) {
                expect(retrievedKey.subkeys[i]!.getFingerprint()).toBe(alicePublicKey.subkeys[i]!.getFingerprint());
                expect(await OpenPGPUtils.isSubkeyRevoked(retrievedKey.subkeys[i]!, retrievedKey)).toBe(false);
            }
        });
    });

    describe('Key certification and certification revocation', () => {
        
        test('should publish a key certification signature', async () => {
            // 1. Generate OpenPGP key pairs for Alice (certifier), Bob (target) and Cecil (2nd certifier)
            let [alicePrivateKey, alicePublicKey, aliceRevocationCert] = await createAliceOpenPGPKeys();
            let [bobPrivateKey, bobPublicKey, bobRevocationCert] = await createBobOpenPGPKeys();
            let [cecilPrivateKey, cecilPublicKey, cecilRevocationCert] = await createCecilOpenPGPKeys();
            // FIX: Create a config which forces preferredHashAlgorithm to solve the following error when calling aliceUserID.certify(...)
            // TypeError: Cannot read properties of undefined (reading 'preferredHashAlgorithm')
            const config = openpgp.config;
            config.preferredHashAlgorithm = openpgp.enums.hash.sha256;
            // 2. Register Bob's, Alice's and Cecil's keys on-chain
            await expect(service.register(bobPublicKey)).resolves.not.toThrow();
            await expect(service.register(alicePublicKey)).resolves.not.toThrow();
            await expect(service.register(cecilPublicKey)).resolves.not.toThrow();
            // 3. Use Bob's key to sign Alice's public key
            const aliceUserID = alicePublicKey.users[0];
            alicePublicKey.users[0] = await aliceUserID.certify([bobPrivateKey], new Date(), config);
            expect(alicePublicKey.users[0].otherCertifications.length).toBe(1);
            expect(await alicePublicKey.users[0].verifyCertificate(alicePublicKey.users[0].otherCertifications[0]!, [bobPublicKey])).toBe(true);
            // 4. Use Cecil's key to sign Alice's public key (to verify multiple certifications are preserved)
            alicePublicKey.users[0] = await alicePublicKey.users[0].certify([cecilPrivateKey], new Date(), config);
            expect(alicePublicKey.users[0].otherCertifications.length).toBe(2);
            // Cecil's certification is the first one, not the second one (prepended)
            expect(await alicePublicKey.users[0].verifyCertificate(alicePublicKey.users[0].otherCertifications[0]!, [cecilPublicKey])).toBe(true);
            // 4. Publish the Bob's certification signature
            let receipt = await service.certify(bobPublicKey, alicePublicKey);
            // 5. Use the low level client to extract the KeyCertifiedLog logs from the receipt
            let logs = await service.contract.extractKeyCertifiedLog(receipt);
            expect(logs.length).toBe(1);
            expect(logs[0].fingerprint).toBe(toBytes32(to0x(alicePublicKey.getFingerprint())));
            expect(logs[0].issuerFingerprint).toBe(toBytes32(to0x(bobPublicKey.getFingerprint())));
            // 6. Extract the public key with the certification and verify it striclty contains bob's certification
            let extractedKey = await service.extractFromKeyCertifiedLog(logs[0]);
            expect(extractedKey.getFingerprint()).toBe(alicePublicKey.getFingerprint());
            expect(extractedKey.subkeys.length).toBe(0);
            expect(extractedKey.users[0].otherCertifications.length).toBe(1);
            const verifiedFromReceiptLogs = await extractedKey.users[0].verifyCertificate(extractedKey.users[0].otherCertifications[0]!, [bobPublicKey]);
            expect(verifiedFromReceiptLogs).not.toBeNull();
            expect(verifiedFromReceiptLogs).toBe(true);
            // 7. Retrieve Alice's key using the service and verify the certification is present
            let retrievedKey = await service.getPublicKey(to0x(alicePublicKey.getFingerprint()));
            expect(retrievedKey.getFingerprint()).toBe(alicePublicKey.getFingerprint());
            expect(retrievedKey.users[0].otherCertifications.length).toBe(1);
            const verifiedFromRetrievedKey = await retrievedKey.users[0].verifyCertificate(retrievedKey.users[0].otherCertifications[0]!, [bobPublicKey]);
            expect(verifiedFromRetrievedKey).not.toBeNull();
            expect(verifiedFromRetrievedKey).toBe(true);
        });

        test('should publish a key certification revocation signature', async () => {
            // 1. Generate OpenPGP key pairs for Alice (certifier), Bob (target) and Cecil (2nd certifier)
            let [alicePrivateKey, alicePublicKey, aliceRevocationCert] = await createAliceOpenPGPKeys();
            let [bobPrivateKey, bobPublicKey, bobRevocationCert] = await createBobOpenPGPKeys();
            let [cecilPrivateKey, cecilPublicKey, cecilRevocationCert] = await createCecilOpenPGPKeys();
            // FIX: Create a config which forces preferredHashAlgorithm to solve the following error when calling aliceUserID.certify(...)
            // TypeError: Cannot read properties of undefined (reading 'preferredHashAlgorithm')
            const config = openpgp.config;
            config.preferredHashAlgorithm = openpgp.enums.hash.sha256;
            // 2. Register Bob's, Alice's and Cecil's keys on-chain
            await expect(service.register(bobPublicKey)).resolves.not.toThrow();
            await expect(service.register(alicePublicKey)).resolves.not.toThrow();
            await expect(service.register(cecilPublicKey)).resolves.not.toThrow();
            // 3. Use Bob's and Cecil's keys to sign Alice's public key
            const aliceUserID = alicePublicKey.users[0];
            alicePublicKey.users[0] = await aliceUserID.certify([bobPrivateKey], new Date(), config);
            expect(alicePublicKey.users[0].otherCertifications.length).toBe(1);
            expect(await alicePublicKey.users[0].verifyCertificate(alicePublicKey.users[0].otherCertifications[0]!, [bobPublicKey])).toBe(true);
            alicePublicKey.users[0] = await alicePublicKey.users[0].certify([cecilPrivateKey], new Date(), config);
            expect(alicePublicKey.users[0].otherCertifications.length).toBe(2);
            expect(await alicePublicKey.users[0].verifyCertificate(alicePublicKey.users[0].otherCertifications[0], [cecilPublicKey])).toBe(true);
            // 4. Publish Bob's and Cecil's certification signatures
            await expect(service.certify(bobPublicKey, alicePublicKey)).resolves.not.toThrow();
            await expect(service.certify(cecilPublicKey, alicePublicKey)).resolves.not.toThrow();
            // 5. Use Bob's key to revoke the certification on Alice's public key
            const bobKeyPacket = bobPrivateKey.getKeys(alicePublicKey.users[0].otherCertifications[1]!.issuerKeyID)
            expect(bobKeyPacket.length).toBe(1);
            console.debug('Bob key packet for certification revocation:', bobKeyPacket[0].getFingerprint());
            console.debug('Bob public key fingerprint:', bobPublicKey.getFingerprint());
            alicePublicKey.users[0] = await alicePublicKey.users[0].revoke(bobKeyPacket[0].keyPacket as openpgp.SecretKeyPacket);
            expect(alicePublicKey.users[0].otherCertifications.length).toBe(2);
            // expect(alicePublicKey.users[0].otherCertifications[0].revoked).toBe(true); - The revoked flag is not directly set by OpenPGP
            expect(alicePublicKey.users[0].revocationSignatures.length).toBe(1);
            expect(await alicePublicKey.users[0].isRevoked(alicePublicKey.users[0].otherCertifications[1]!, bobKeyPacket[0].keyPacket)).toBe(true);
            // 6. Publish the certification revocation
            let receipt = await service.revokeCertification(bobPublicKey, alicePublicKey);
            // BUGFIX - TODO: The following assertions are incorrect because the service.revokeCertification impacts the provided alicePublicKey object directly
            //expect(alicePublicKey.users[0].otherCertifications.length).toBe(2);
            //expect(alicePublicKey.users[0].revocationSignatures.length).toBe(1);
            // 7. Use the low level client to extract the KeyCertificationRevokedLog logs from the receipt
            let logs = await service.contract.extractKeyCertificationRevokedLog(receipt);
            expect(logs.length).toBe(1);
            expect(logs[0].fingerprint).toBe(toBytes32(to0x(alicePublicKey.getFingerprint())));
            expect(logs[0].issuerFingerprint).toBe(toBytes32(to0x(bobPublicKey.getFingerprint())));
            // 8. Extract the public key with the certification revocation and verify it strictly contains bob's certification revocation
            let extractedKey = await service.extractFromKeyCertificationRevokedLog(logs[0]);
            expect(extractedKey.getFingerprint()).toBe(alicePublicKey.getFingerprint());
            expect(extractedKey.subkeys.length).toBe(0);
            expect(extractedKey.users[0].otherCertifications.length).toBe(1);
            expect(extractedKey.users[0].revocationSignatures.length).toBe(1);
            // 9. Retrieve Alice's key using the service and verify the certification revocation is present
            let retrievedKey = await service.getPublicKey(to0x(alicePublicKey.getFingerprint()));
            expect(retrievedKey.getFingerprint()).toBe(alicePublicKey.getFingerprint());
            expect(retrievedKey.users[0].otherCertifications.length).toBe(2);
            expect(retrievedKey.users[0].revocationSignatures.length).toBe(1);
            // Note: Bob's certification is not marked as revoked since OpenPGP.js does not set any revoked flag directly
            // Verification of the revocation would require checking the revocation signatures using Bob's public key
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
                    type: Web3PGPEvents.KeyRegistered,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.KeyRegistered,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.KeyRegistered,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.KeyRegistered,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.KeyRegistered,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.KeyRegistered,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.KeyRegistered,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.KeyRegistered,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.SubkeyAdded,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.SubkeyAdded,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.SubkeyAdded,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.SubkeyAdded,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.SubkeyAdded,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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
                    type: Web3PGPEvents.SubkeyAdded,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
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

        describe('extractFromKeyRevokedLog', () => {
            test('should extract a valid revoked key certificate for the primary key from KeyRevokedLog', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Revoke the primary key to get the revoked key object
                let revokedKey = await openpgp.revokeKey({
                    key: privateKey,
                    format: 'object',
                });
                expect(await revokedKey.publicKey.isRevoked()).toBe(true);
                // 3. Forge the KeyRevokedLog with minimal required fields
                let log: KeyRevokedLog = {
                    type: Web3PGPEvents.KeyRevoked,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    fingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    revocationCertificate: toHex(revokedKey.publicKey.write())
                };
                // 4. Extract and validate using the service
                let [revoked, cert] = await service.extractFromKeyRevokedLog(log);
                // 5. Verify extracted revoked key matches original revoked key
                expect(cert).toBeUndefined(); // No standalone cert expected here
                expect(revoked).toBeDefined();
                expect(revoked!.getFingerprint()).toBe(revokedKey.publicKey.getFingerprint());
                expect(await revoked!.isRevoked()).toBe(true);
                expect(revokedKey.publicKey.subkeys.length).toBeGreaterThan(0); // Check subkeys are intact
                expect(revoked!.subkeys.length).toBe(0); // Check subkeys are pruned when the primary key is revoked
            });

            test('should extract a standalone revocation certificate for the primary key from KeyRevokedLog', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Unarmor the revocation certificate
                let revocationCertObj = await openpgp.unarmor(revocationCert);
                // 3. Forge the KeyRevokedLog with minimal required fields
                let log: KeyRevokedLog = {
                    type: Web3PGPEvents.KeyRevoked,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    fingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    revocationCertificate: toHex(revocationCertObj.data)
                };
                // 4. Extract and validate using the service
                let [revoked, cert] = await service.extractFromKeyRevokedLog(log);
                // 5. Verify extracted revoked key matches original public key and is revoked
                expect(revoked).toBeUndefined(); // No revoked key object expected here
                expect(cert).toBeDefined();
                // 6. Apply the revocation cert to the public key and verify it's revoked
                let pkWithRevocation = await openpgp.revokeKey({
                    key: publicKey,
                    format: 'object',
                    revocationCertificate: cert!
                });
                expect(pkWithRevocation.publicKey.subkeys.length).toBe(publicKey.subkeys.length);
                expect(pkWithRevocation.publicKey.getFingerprint()).toBe(publicKey.getFingerprint());
                expect(await pkWithRevocation.publicKey.isRevoked()).toBe(true);
                // 7. Bonus: Verify subkeys are revoked as well when the primary is revoked
                for (let subkey of pkWithRevocation.publicKey.subkeys) {
                    expect(await OpenPGPUtils.isSubkeyRevoked(subkey, pkWithRevocation.publicKey)).toBe(true);
                }
            });

            test('should extract a valid revoked key certificate for a subkey from KeyRevokedLog', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Revoke a subkey to get the revoked key object
                let date = new Date();
                publicKey.subkeys[0] = await publicKey.subkeys[0]!.revoke(privateKey.keyPacket as openpgp.SecretKeyPacket, undefined, date);
                expect(await OpenPGPUtils.isSubkeyRevoked(publicKey.subkeys[0]!, publicKey, date)).toBe(true);
                // 3. Forge the KeyRevokedLog with minimal required fields
                let log: KeyRevokedLog = {
                    type: Web3PGPEvents.KeyRevoked,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: date,
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    fingerprint: toBytes32(to0x(publicKey.subkeys[0]!.getFingerprint())),
                    revocationCertificate: toHex(publicKey.write())
                };
                // 4. Extract and validate using the service
                let [revoked, cert] = await service.extractFromKeyRevokedLog(log);
                // 5. Verify extracted revoked key matches original revoked subkey
                expect(cert).toBeUndefined(); // No standalone cert expected here
                expect(revoked).toBeDefined();
                expect(revoked!.getFingerprint()).toBe(publicKey.getFingerprint());
                expect(revoked!.subkeys.length).toBe(1);
                expect(revoked!.subkeys[0]!.getFingerprint()).toBe(publicKey.subkeys[0]!.getFingerprint());
                expect(await OpenPGPUtils.isSubkeyRevoked(revoked!.subkeys[0]!, revoked!)).toBe(true);
            });

            test('should throw if the key revocation certificate targetting the primary key does not revoke the key', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Forge the KeyRevokedLog with minimal required fields
                let log: KeyRevokedLog = {
                    type: Web3PGPEvents.KeyRevoked,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    fingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    revocationCertificate: toHex(publicKey.write()) // Does not revoke the key
                };
                // 3. Extract and validate using the service - EXPECT ERROR
                await expect(service.extractFromKeyRevokedLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
                // 4. Now extract with verifications disabled
                await expect(service.extractFromKeyRevokedLog(log, true)).resolves.not.toThrow();
            });

            test('should throw if the key revocation certificate targetting the subkey does not revoke the subkey', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Forge the KeyRevokedLog with minimal required fields
                let log: KeyRevokedLog = {
                    type: Web3PGPEvents.KeyRevoked,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    fingerprint: toBytes32(to0x(publicKey.subkeys[0]!.getFingerprint())),
                    revocationCertificate: toHex(publicKey.write()) // Does not have revoked subkeys
                };
                // 3. Extract and validate using the service - EXPECT ERROR
                await expect(service.extractFromKeyRevokedLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
                // 4. Now extract with verifications disabled
                await expect(service.extractFromKeyRevokedLog(log, true)).resolves.not.toThrow();
            });

            test('should throw ValidationError for missing revocationCertificate', async () => {
                // 1. Forge the KeyRevokedLog with missing revocationCertificate
                let log: KeyRevokedLog = {
                    type: Web3PGPEvents.KeyRevoked,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    fingerprint: BYTES32_ZERO,
                    revocationCertificate: '0x' // Missing data
                };
                // 2. Extract and validate using the service - EXPECT ERROR
                await expect(service.extractFromKeyRevokedLog(log)).rejects.toThrow(Web3PGPServiceValidationError);
            });

            test('test what happens if an armored key certificate is provided and unarmored before being put on-chain', async () => {
                // 1. Generate OpenPGP key pair
                let [privateKey, publicKey, revocationCert] = await createAliceOpenPGPKeys();
                // 2. Revoke the primary key and return the armored revocation certificate
                let revokedKey = await openpgp.revokeKey({
                    key: privateKey,
                    format: 'armored',
                });
                // 3. Unarmor the revocation certificate
                let unarmoredRevocation = await openpgp.unarmor(revokedKey.publicKey);
                // 4. Forge the KeyRevokedLog with minimal required fields
                let log: KeyRevokedLog = {
                    type: Web3PGPEvents.KeyRevoked,
                    logIndex: 0,
                    blockNumber: 0n,
                    blockHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    blockTimestamp: new Date(),
                    transactionHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
                    fingerprint: toBytes32(to0x(publicKey.getFingerprint())),
                    revocationCertificate: toHex(unarmoredRevocation.data)
                };
                // 5. Extract and validate using the service
                let [revoked, cert] = await service.extractFromKeyRevokedLog(log);
                // 6. Verify extracted revoked key matches original revoked key
                expect(cert).toBeUndefined(); // No standalone cert expected here
                expect(revoked).toBeDefined();
                expect(revoked!.getFingerprint()).toBe(publicKey.getFingerprint());
                expect(await revoked!.isRevoked()).toBe(true);
                expect(publicKey.subkeys.length).toBeGreaterThan(0); // Check subkeys are intact
                expect(revoked!.subkeys.length).toBe(0); // Check subkeys are pruned when the primary key is revoked
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
    let keys = await openpgp.generateKey({
        format: 'object',
        type: 'rsa',
        rsaBits: 4096,
        config: {
            preferredHashAlgorithm: openpgp.enums.hash.sha256
        },
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

/**
 * Creates OpenPGP keys for Bob with primary key and two subkeys (signing and encryption).
 * 
 * @returns A promise that resolves to a tuple containing:
 *          - Bob's PrivateKey
 *          - Bob's PublicKey
 *          - Bob's Revocation Certificate (armored string)
 */
async function createBobOpenPGPKeys(): Promise<[openpgp.PrivateKey, openpgp.PublicKey, string]> {
    let keys = await openpgp.generateKey({
        format: 'object',
        type: 'ecc',
        curve: 'nistP256',
        userIDs: [{ name: 'Bob', email: 'bob@example.com' }],
        subkeys: [
            { 
                type: 'ecc', 
                curve: 'nistP256', 
                sign: true,
                keyExpirationTime: 180 * 24 * 60 * 60 // 6 months
            },
            { 
                type: 'ecc', 
                curve: 'nistP256', 
                keyExpirationTime: 180 * 24 * 60 * 60 // 6 months
            }
        ],
        config: {
            preferredHashAlgorithm: openpgp.enums.hash.sha256
        },
    });
    return [keys.privateKey, keys.publicKey, keys.revocationCertificate];
}

/**
 * Creates OpenPGP keys for Cecil with primary key and two subkeys (signing and encryption).
 * 
 * @returns A promise that resolves to a tuple containing:
 *          - Cecil's PrivateKey
 *          - Cecil's PublicKey
 *          - Cecil's Revocation Certificate (armored string)
 */
async function createCecilOpenPGPKeys(): Promise<[openpgp.PrivateKey, openpgp.PublicKey, string]> {
    let keys = await openpgp.generateKey({
        format: 'object',
        type: 'ecc',
        curve: 'nistP256',
        userIDs: [{ name: 'Cecil', email: 'cecil@example.com' }],
        subkeys: [
            { 
                type: 'ecc', 
                curve: 'nistP256', 
                sign: true,
                keyExpirationTime: 180 * 24 * 60 * 60 // 6 months
            },
            { 
                type: 'ecc', 
                curve: 'nistP256', 
                keyExpirationTime: 180 * 24 * 60 * 60 // 6 months
            }
        ],
        config: {
            preferredHashAlgorithm: openpgp.enums.hash.sha256
        },
    });
    return [keys.privateKey, keys.publicKey, keys.revocationCertificate];
}