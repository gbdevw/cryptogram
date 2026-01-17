import * as openpgp from 'openpgp';
import * as fs from 'fs';
import * as path from 'path';
import { Web3Doc, Web3DocService, Web3PGP, Web3PGPService, to0x } from '@jibidieuw/dexes';
import { createWalletClient, fallback, http, createPublicClient, PublicClient, keccak256, toBytes, toHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { inkSepolia } from 'viem/chains'

function loadResource(filename: string): string {
    // In development (tsx)
    const devPath = path.join(__dirname, '..', 'src', 'resources', filename);
    if (fs.existsSync(devPath)) {
        return fs.readFileSync(devPath, 'utf-8');
    }

    // After build (node dist/)
    const prodPath = path.join(__dirname, 'resources', filename);
    return fs.readFileSync(prodPath, 'utf-8');
}

async function main() {

    /*****************************************************************************************************************/
    /* SETUP PHASE                                                                                                   */
    /*****************************************************************************************************************/

    // 1. Load the encrypted certification key from resource file
    //
    // The certification key will be used to sign key signing documents. That way, the verification frontend
    // can verify that the documents were indeed signed by the owner of the certification key.
    console.log('Script started...');
    console.log('Loading the certification key from resource file...');
    const armoredKey = loadResource('certifier.asc');
    const decryptedKey = await openpgp.decryptKey({
        privateKey: await openpgp.readPrivateKey({ armoredKey }),
        passphrase: "123456789", // In a real script, never hardcode the passphrase
    });
    const certPrimaryUser = await decryptedKey.getPrimaryUser();
    console.log('OpenPGP key loaded:', decryptedKey.getFingerprint(), certPrimaryUser.user.userID?.userID);
    // 2. Create a key to sign the document (eg, the customer key)
    console.log('Creating a new key to sign the document (customer key)...');
    const customerKey = await openpgp.generateKey({
        type: 'rsa',
        rsaBits: 4096,
        userIDs: [{ name: 'Customer', email: 'customer@example.com' }],
        format: 'object',
        // passphrase: '987654321', // Here, we do not encrypt the key for simplicity
    });
    // 3. Create the wallet client needed to interact with the blockchain and sign transactions
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('Please set the PRIVATE_KEY environment variable to a valid private key.');
    }
    const account = privateKeyToAccount(to0x(privateKey));
    const batchConfig = { batchSize: 100, wait: 50 }
    const fallbackTransport = fallback(
        [
            // 1. Gelato (Primary)
            http('https://rpc-gel-sepolia.inkonchain.com', { batch: batchConfig }),
            // 2. Tenderly (Backup 1)
            http('https://rpc-ten-sepolia.inkonchain.com', { batch: batchConfig }),
            // 3. QuickNode (Backup 2)
            http('https://rpc-qnd-sepolia.inkonchain.com', { batch: batchConfig }),
            // 4. dRPC (Backup 3 - with stricter batch settings for safety)
            http('https://ink-sepolia.drpc.org', { batch: batchConfig }),
        ],
        {
            // rank: false (default) - Use simple round-robin without continuous health checks
            // This prevents unnecessary net_listening calls
            retryCount: 3,
            retryDelay: 500,
        }
    )
    const publicClient = createPublicClient({
        chain: inkSepolia,
        transport: fallbackTransport,
    });
    const walletClient = createWalletClient({
        account,
        chain: inkSepolia,
        transport: fallbackTransport,
    });

    // 4. Create the services to interact with the blockchain
    // a. Create the low level Web3PGP (= basic interaction with the smart contract)
    const web3pgp = new Web3PGP(
        '0x72d02B94317ac899B34459a4e6685eFe12Ac17a8', // The address of the deployed Web3PGP contract on Kraken Ink testnet
        publicClient as PublicClient,
        walletClient,
    );
    // Smoke test: check if the certification key exists on-chain
    const key = await web3pgp.exists('0xECC5951FABB59E48E58BCC11D78A6D54E2CBF5CE')
    if (!key) {
        throw new Error('Certification key does not exist on-chain.');
    }
    // b. Create the high level Web3PGPService (= convenience methods on top of Web3PGP and OpenPGP.js)
    const web3pgpService = new Web3PGPService(web3pgp);
    // c. Create the Web3Doc client
    const web3doc = new Web3Doc(
        '0x5C09E831276ADCec4D5C94645F34500D3deA8E8A',
        web3pgp,
        publicClient as PublicClient,
        walletClient,
    );
    // d. Create the Web3Doc service which relies on the Web3PGP service
    const web3docService = new Web3DocService(web3doc, web3pgpService);

    // 5. Register the customer key with the Web3PGP contract
    console.log('Registering the customer key on-chain...');
    await web3pgpService.register(customerKey.publicKey);
    console.log('Customer key registered.');
    // Sleep 5 seconds to ensure all nodes are in sync
    // The SDK waits the transaction to be mined, but some nodes may still be out of sync for a short while
    await new Promise((resolve) => setTimeout(resolve, 5000));
    let exists = await web3pgp.exists(to0x(customerKey.publicKey.getFingerprint()));
    if (!exists) {
        throw new Error('Customer key registration failed.');
    }
    // 6. Certify the customer key with the certifier's key and register the certification on-chain
    console.log('Certifying the customer key with the certification key...');
    const customerUserID = customerKey.publicKey.users[0];
    // FIX: Create a config which forces preferredHashAlgorithm to solve the following error when calling aliceUserID.certify(...)
    // TypeError: Cannot read properties of undefined (reading 'preferredHashAlgorithm')
    const config = openpgp.config;
    config.preferredHashAlgorithm = openpgp.enums.hash.sha256;
    customerKey.publicKey.users[0] = await customerUserID.certify([decryptedKey], new Date(), config);
    await web3pgpService.certify(decryptedKey.toPublic(), customerKey.publicKey);
    console.log('Customer key certified.');

    /*****************************************************************************************************************/
    /* DOCUMENT SIGNING PHASE                                                                                        */
    /*****************************************************************************************************************/

    // 1. Create a document to be signed
    console.log('Creating a document to be signed...');
    const documentContent = `This is a sample document to be signed on ${new Date().toISOString()} and stored on-chain via DEXES.`;
    const documentName = `sample_document_${Date.now()}.txt`;
    fs.writeFileSync(documentName, documentContent, 'utf-8');
    console.log('Document created and stored locally:', documentName);
    // 2. Hash the document
    console.log('Hashing the document...');
    const documentHash = await keccak256(new TextEncoder().encode(documentContent));
    console.log('Document hashed:', documentHash);
    // 3. Create a binary detached signature over the bytes of the document hash with the customer key
    console.log('Signing the document hash with the customer key...');
    const signature = await openpgp.sign({
        message: await openpgp.createMessage({ binary: toBytes(documentHash) }),
        signingKeys: customerKey.privateKey,
        detached: true,
        format: 'armored',
    });
    console.log('Document signed', signature);
    // 4. Store the document hash and signature on-chain via Web3Doc service
    console.log('Storing the document hash and signature on-chain via Web3Doc service...');
    const result = await web3docService.timestamp(
        toBytes(documentHash), // The hash of the document
        await openpgp.readSignature({ armoredSignature: signature }), // The detached signature
        to0x(customerKey.publicKey.getFingerprint()), // Emitter is the customer who has signed the document 
    );
    console.log('Document timestamped on-chain with the following ID:', result[0].toString());
    // 5. Verify the stored document via Web3Doc service
    // Sleep 5 seconds to ensure all nodes are in sync
    // The SDK waits the transaction to be mined, but some nodes may still be out of sync for a short while
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('Verifying the stored document via Web3Doc service...');
    const verification = await web3docService.verifyTimestamp(result[0]);
    console.log('Valid timestamp found at tx:', verification.tx);
    if (documentHash !== toHex(verification.documentHash)) {
        throw new Error('Document hash does not match!');
    }
    console.log('Document hash matches. Verification successful.');
    console.log('Script completed successfully.');
}

main().catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
});
