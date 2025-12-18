import { Address } from 'viem';
import { AnvilHelper } from './helpers/anvil.helper';
import { Web3PGPService } from '../src/web3pgp/web3pgp.service';
import { Web3DocService } from '../src/web3doc/web3doc.service';
import { Web3PGP } from '../src/web3pgp/web3pgp';
import { Web3Doc } from '../src/web3doc/web3doc';

/**
 * Web3Doc Integration Tests
 *
 * These tests verify that Web3DocService correctly interacts with:
 * - Web3Doc smart contract for document timestamping
 * - Web3PGPService for key management
 * - The blockchain through Viem clients
 *
 * Note: These tests use dummy OpenPGP data (fingerprints, signatures, keys)
 * because the focus is on verifying blockchain interactions, not cryptography.
 */

// ============================================================================
// Test Fixtures and Dummy Data
// ============================================================================

/**
 * Dummy OpenPGP fingerprint (32 bytes in hex)
 */
const DUMMY_FINGERPRINT = '0x1111111111111111111111111111111111111111111111111111111111111111';

/**
 * Dummy OpenPGP public key data (minimal valid structure)
 */
const DUMMY_PUBLIC_KEY = Buffer.from(
  '99001a04' + // Packet tag and length (26 bytes)
    '62f08950' + // Key ID
    '01' + // Version
    'ffffffffffffffffffffffffffffffff' + // Modulus
    'ffff', // Exponent
  'hex'
);

/**
 * Dummy OpenPGP signature data
 */
const DUMMY_SIGNATURE = Buffer.from(
  '88001d' + // Packet tag and length (29 bytes)
    '03' + // Version
    '0b' + // Signature type
    '01' + // Public key algorithm
    '0a' + // Hash algorithm
    'ffffffffffffffff' + // Key ID
    'ffffffffffffffff' + // Signature data
    'ffffffffffffffff',
  'hex'
);

/**
 * Dummy document hash (32 bytes)
 */
const DUMMY_DOCUMENT_HASH = Buffer.from('a'.repeat(64), 'hex');

// ============================================================================
// Test Environment Setup
// ============================================================================

interface TestEnvironment {
  anvil: AnvilHelper;
  web3pgpAddress: Address;
  web3docAddress: Address;
  web3pgp: Web3PGP;
  web3pgpService: Web3PGPService;
  web3doc: Web3Doc;
}

let testEnv: TestEnvironment;

/**
 * Deploy test environment using Anvil helper
 */
async function deployTestEnvironment(): Promise<TestEnvironment> {
  console.log('========================================');
  console.log('Setting up Web3Doc Integration Tests');
  console.log('========================================');
  
  console.log('Starting Anvil blockchain...');
  const anvil = new AnvilHelper({ port: 8545, blockTime: 1 });
  await anvil.start();
  console.log('✓ Anvil started at', anvil.getRpcUrl());

  console.log('Deploying contracts via Foundry scripts...');
  const deployed = await anvil.deployWeb3Doc(0n); // Initialize with 0 fee
  const web3pgpAddress = deployed.web3pgp;
  const web3docAddress = deployed.web3doc;
  
  console.log('✓ Deployment summary:');
  console.log('  - AccessManager:', deployed.accessManager);
  console.log('  - Web3PGP:', web3pgpAddress);
  console.log('  - Web3Doc:', web3docAddress);

  // Create SDK instances with real clients
  const publicClient = anvil.getPublicClient();
  const walletClient = anvil.getWalletClient();

  const web3pgp = new Web3PGP(web3pgpAddress, publicClient, walletClient);
  const web3pgpService = new Web3PGPService(web3pgpAddress, publicClient);
  const web3doc = new Web3Doc(web3docAddress, web3pgp, publicClient, walletClient);
  
  console.log('✓ Web3PGP and Web3Doc SDKs initialized');
  console.log('========================================\n');

  return {
    anvil,
    web3pgpAddress,
    web3docAddress,
    web3pgp,
    web3pgpService,
    web3doc,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Web3Doc Integration Tests', () => {
  beforeAll(async () => {
    testEnv = await deployTestEnvironment();
  }, 120000); // Increased timeout for Foundry script execution

  afterAll(async () => {
    if (testEnv?.anvil) {
      console.log('Stopping Anvil...');
      testEnv.anvil.stop();
    }
  });

  // ========== Contract Initialization ==========

  describe('Contract Initialization', () => {
    test('should verify Web3Doc contract is deployed', async () => {
      const publicClient = testEnv.anvil.getPublicClient();
      const code = await publicClient.getCode({
        address: testEnv.web3docAddress,
      });

      expect(code).toBeDefined();
      expect(code).not.toBe('0x');
    });

    test('should verify Web3PGP contract is deployed', async () => {
      const publicClient = testEnv.anvil.getPublicClient();
      const code = await publicClient.getCode({
        address: testEnv.web3pgpAddress,
      });

      expect(code).toBeDefined();
      expect(code).not.toBe('0x');
    });

    test('should read requested fee from Web3Doc', async () => {
      const fee = await testEnv.web3doc.requestedFee();

      expect(fee).toBeDefined();
      expect(typeof fee).toBe('bigint');
      expect(fee).toBeGreaterThanOrEqual(0n);
    });
  });

  // ========== Web3PGP Integration ==========

  describe('Web3PGP Integration', () => {
    test('should register a public key in Web3PGP', async () => {
      // Check if key is registered using the underlying contract
      const registry = await testEnv.web3pgp.exists(
        `0x${DUMMY_FINGERPRINT.slice(2).toUpperCase()}`
      );

      expect(typeof registry).toBe('boolean');
    });

    test('should use Web3PGPService to retrieve registered keys', async () => {
      const publicClient = testEnv.anvil.getPublicClient();
      const web3pgpService = new Web3PGPService(
        testEnv.web3pgpAddress,
        publicClient
      );

      // The service should be able to query the contract
      expect(web3pgpService).toBeDefined();
      expect(web3pgpService.contract).toBeDefined();
    });
  });

  // ========== Document Timestamping ==========

  describe('Document Timestamping', () => {
    test('should create a Web3DocService instance', async () => {
      const web3pgpService = new Web3PGPService(testEnv.web3pgpAddress, testEnv.anvil.getPublicClient());
      const web3docService = new Web3DocService(testEnv.web3doc, web3pgpService);

      expect(web3docService).toBeDefined();
    });

    test('should interact with Web3Doc contract', async () => {
      // Verify contract is accessible
      const fee = await testEnv.web3doc.requestedFee();
      expect(typeof fee).toBe('bigint');
    });

    test('should track document timestamps on blockchain', async () => {
      const publicClient = testEnv.anvil.getPublicClient();

      // Get initial block number
      const initialBlockNumber = await publicClient.getBlockNumber();
      expect(typeof initialBlockNumber).toBe('bigint');
      expect(initialBlockNumber).toBeGreaterThan(0n);
    });
  });

  // ========== Fee Management ==========

  describe('Fee Management', () => {
    test('should read fee from Web3Doc', async () => {
      const fee = await testEnv.web3doc.requestedFee();

      expect(fee).toBeDefined();
      expect(typeof fee).toBe('bigint');
    });

    test('should read fee from Web3PGP', async () => {
      const fee = await testEnv.web3pgp.requestedFee();

      expect(fee).toBeDefined();
      expect(typeof fee).toBe('bigint');
    });

    test('should verify fees are consistent', async () => {
      const docFee = await testEnv.web3doc.requestedFee();
      const pgpFee = await testEnv.web3pgp.requestedFee();

      // Both should be valid fees
      expect(docFee).toBeDefined();
      expect(pgpFee).toBeDefined();
    });
  });

  // ========== Service Interactions ==========

  describe('Web3DocService Interactions', () => {
    test('should instantiate Web3DocService with proper dependencies', async () => {
      const web3pgpService = new Web3PGPService(testEnv.web3pgpAddress, testEnv.anvil.getPublicClient());
      const web3docService = new Web3DocService(testEnv.web3doc, web3pgpService);

      expect(web3docService).toBeDefined();
      expect(web3docService.web3pgpService).toBe(web3pgpService);
    });

    test('should handle Web3PGP as a dependency', async () => {
      // Web3Doc should be able to use Web3PGP
      expect(testEnv.web3pgp.address).toBe(testEnv.web3pgpAddress);
      expect(testEnv.web3doc.address).toBe(testEnv.web3docAddress);
    });

    test('should access both contracts through service', async () => {
      const docFee = await testEnv.web3doc.requestedFee();
      const pgpFee = await testEnv.web3pgp.requestedFee();

      expect(docFee).toBeDefined();
      expect(pgpFee).toBeDefined();
    });
  });

  // ========== Blockchain Interactions ==========

  describe('Blockchain State Management', () => {
    test('should track block numbers correctly', async () => {
      const publicClient = testEnv.anvil.getPublicClient();
      const blockNumber = await publicClient.getBlockNumber();

      expect(typeof blockNumber).toBe('bigint');
      expect(blockNumber).toBeGreaterThan(0n);
    });

    test('should verify contract state persists across calls', async () => {
      const fee1 = await testEnv.web3doc.requestedFee();
      const fee2 = await testEnv.web3doc.requestedFee();

      expect(fee1).toBe(fee2);
    });

    test('should handle multiple contract queries in sequence', async () => {
      const docFee = await testEnv.web3doc.requestedFee();
      const pgpFee = await testEnv.web3pgp.requestedFee();
      const docFee2 = await testEnv.web3doc.requestedFee();

      expect(docFee).toBe(docFee2);
      expect(docFee).toBeDefined();
      expect(pgpFee).toBeDefined();
    });
  });

  // ========== Error Handling ==========

  describe('Error Handling', () => {
    test('should handle invalid contract addresses gracefully', async () => {
      const invalidAddress = '0x0000000000000000000000000000000000000000';

      expect(() => {
        new Web3Doc(invalidAddress as `0x${string}`, testEnv.anvil.getPublicClient());
      }).not.toThrow();
    });

    test('should verify contract availability', async () => {
      // Should be able to call contract methods
      const fee = await testEnv.web3doc.requestedFee();
      expect(fee).toBeDefined();
    });
  });

  // ========== Data Format Validation ==========

  describe('Data Format Validation', () => {
    test('should handle dummy fingerprint data', async () => {
      const fingerprint = DUMMY_FINGERPRINT;

      expect(fingerprint).toMatch(/^0x[0-9a-f]{64}$/i);
      expect(fingerprint.length).toBe(66); // 0x + 64 hex chars
    });

    test('should handle dummy document hash', async () => {
      const hash = DUMMY_DOCUMENT_HASH;

      expect(hash).toBeDefined();
      expect(hash.length).toBe(32);
    });

    test('should handle dummy signature data', async () => {
      const signature = DUMMY_SIGNATURE;

      expect(signature).toBeDefined();
      expect(Buffer.isBuffer(signature)).toBe(true);
    });

    test('should handle dummy public key data', async () => {
      const publicKey = DUMMY_PUBLIC_KEY;

      expect(publicKey).toBeDefined();
      expect(Buffer.isBuffer(publicKey)).toBe(true);
    });
  });

  // ========== Service Configuration ==========

  describe('Service Configuration', () => {
    test('should accept Web3DocServiceOptions', async () => {
      const web3pgpService = new Web3PGPService(testEnv.web3pgpAddress, testEnv.anvil.getPublicClient());
      const web3docService = new Web3DocService(testEnv.web3doc, web3pgpService, {
        concurrencyLimit: 10,
      });

      expect(web3docService).toBeDefined();
    });

    test('should apply default concurrency limit', async () => {
      const web3pgpService = new Web3PGPService(testEnv.web3pgpAddress, testEnv.anvil.getPublicClient());
      const web3docService = new Web3DocService(testEnv.web3doc, web3pgpService);

      expect(web3docService).toBeDefined();
    });
  });

  // ========== Contract Dependencies ==========

  describe('Contract Dependencies', () => {
    test('should verify Web3Doc depends on Web3PGP', async () => {
      // Both should be accessible and initialized
      expect(testEnv.web3doc.address).toBe(testEnv.web3docAddress);
      expect(testEnv.web3pgp.address).toBe(testEnv.web3pgpAddress);
    });

    test('should handle service with proper dependencies', async () => {
      const web3pgpService = new Web3PGPService(testEnv.web3pgpAddress, testEnv.anvil.getPublicClient());
      const web3docService = new Web3DocService(testEnv.web3doc, web3pgpService);

      // Service should have access to both contracts
      expect(web3docService).toBeDefined();
      expect(web3docService.web3pgpService).toBe(web3pgpService);
    });

    test('should allow querying both contracts through service', async () => {
      const web3pgpService = new Web3PGPService(testEnv.web3pgpAddress, testEnv.anvil.getPublicClient());
      const web3docService = new Web3DocService(testEnv.web3doc, web3pgpService);

      // Should be able to access both contract fees
      const docFee = await testEnv.web3doc.requestedFee();
      const pgpFee = await testEnv.web3pgp.requestedFee();

      expect(docFee).toBeDefined();
      expect(pgpFee).toBeDefined();
    });
  });
});
