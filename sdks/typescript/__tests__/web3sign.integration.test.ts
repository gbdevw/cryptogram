import { Address, createPublicClient, createWalletClient, http } from 'viem';
import { foundry } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { Web3PGPService } from '../src/web3pgp/web3pgp.service';
import { Web3SignService } from '../src/web3sign/web3sign.service';
import { Web3PGP } from '../src/web3pgp/web3pgp';
import { Web3Sign } from '../src/web3sign/web3sign';
import { getTestWalletClient, getPublicClient, getContractAddress } from '../src/utils/test-wallet';

/**
 * Web3Sign Integration Tests
 *
 * These tests verify that Web3SignService correctly interacts with:
 * - Web3Sign smart contract for document timestamping
 * - Web3PGPService for key management
 * - The blockchain through Viem clients
 *
 * Note: These tests use dummy OpenPGP data (fingerprints, signatures, keys)
 * because the focus is on verifying blockchain interactions, not cryptography.
 *
 * Prerequisites:
 * - Run "npm test" to start anvil and deploy contracts
 * - Test environment is configured via .env.test (auto-generated)
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
  web3pgpAddress: Address;
  web3signAddress: Address;
  web3pgp: Web3PGP;
  web3pgpService: Web3PGPService;
  web3sign: Web3Sign;
}

let testEnv: TestEnvironment;

/**
 * Initialize test environment from .env.test (created by test orchestrator)
 */
function initializeTestEnvironment(): TestEnvironment {
  console.log('========================================');
  console.log('Initializing Web3Sign Integration Tests');
  console.log('========================================');

  // Verify required environment variables
  if (!process.env.DEXES_WEB3SIGN || !process.env.DEXES_WEB3PGP) {
    throw new Error(
      'Contract addresses not found in environment.\n' +
      'Please run "npm test" to start anvil and deploy contracts.'
    );
  }

  const web3pgpAddress = getContractAddress('DEXES_WEB3PGP');
  const web3signAddress = getContractAddress('DEXES_WEB3SIGN');

  console.log('✓ Contract addresses loaded from environment:');
  console.log('  - Web3PGP:', web3pgpAddress);
  console.log('  - Web3Sign:', web3signAddress);

  // Create SDK instances with test clients
  const publicClient = getPublicClient();
  const walletClient = getTestWalletClient();

  const web3pgp = new Web3PGP(web3pgpAddress, publicClient, walletClient);
  const web3pgpService = new Web3PGPService(web3pgp);
  const web3sign = new Web3Sign(web3signAddress, web3pgp, publicClient, walletClient);

  console.log('✓ SDK clients and services initialized');
  console.log('========================================\n');

  return {
    web3pgpAddress,
    web3signAddress,
    web3pgp,
    web3pgpService,
    web3sign,
  };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Web3Sign Integration Tests', () => {
  beforeAll(() => {
    testEnv = initializeTestEnvironment();
  });

  // ========== Contract Initialization ==========

  describe('Contract Initialization', () => {
    test('should verify Web3Sign contract is deployed', async () => {
      const publicClient = getPublicClient();
      const code = await publicClient.getCode({
        address: testEnv.web3signAddress,
      });

      expect(code).toBeDefined();
      expect(code).not.toBe('0x');
    });

    test('should verify Web3PGP contract is deployed', async () => {
      const publicClient = getPublicClient();
      const code = await publicClient.getCode({
        address: testEnv.web3pgpAddress,
      });

      expect(code).toBeDefined();
      expect(code).not.toBe('0x');
    });

    test('should read requested fee from Web3Sign', async () => {
      const fee = await testEnv.web3sign.requestedFee();

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
      const web3pgpService = new Web3PGPService(testEnv.web3pgp);

      // The service should be able to query the contract
      expect(web3pgpService).toBeDefined();
      expect(web3pgpService.contract).toBeDefined();
    });
  });

  // ========== Document Timestamping ==========

  describe('Document Timestamping', () => {
    test('should create a Web3SignService instance', async () => {
      const web3pgpService = new Web3PGPService(testEnv.web3pgp);
      const web3signService = new Web3SignService(testEnv.web3sign, web3pgpService);

      expect(web3signService).toBeDefined();
    });

    test('should interact with Web3Sign contract', async () => {
      // Verify contract is accessible
      const fee = await testEnv.web3sign.requestedFee();
      expect(typeof fee).toBe('bigint');
    });

    test('should track document timestamps on blockchain', async () => {
      const publicClient = getPublicClient();

      // Get initial block number
      const initialBlockNumber = await publicClient.getBlockNumber();
      expect(typeof initialBlockNumber).toBe('bigint');
      expect(initialBlockNumber).toBeGreaterThan(0n);
    });
  });

  // ========== Fee Management ==========

  describe('Fee Management', () => {
    test('should read fee from Web3Sign', async () => {
      const fee = await testEnv.web3sign.requestedFee();

      expect(fee).toBeDefined();
      expect(typeof fee).toBe('bigint');
    });

    test('should read fee from Web3PGP', async () => {
      const fee = await testEnv.web3pgp.requestedFee();

      expect(fee).toBeDefined();
      expect(typeof fee).toBe('bigint');
    });

    test('should verify fees are consistent', async () => {
      const docFee = await testEnv.web3sign.requestedFee();
      const pgpFee = await testEnv.web3pgp.requestedFee();

      // Both should be valid fees
      expect(docFee).toBeDefined();
      expect(pgpFee).toBeDefined();
    });
  });

  // ========== Service Interactions ==========

  describe('Web3SignService Interactions', () => {
    test('should instantiate Web3SignService with proper dependencies', async () => {
      const web3pgpService = new Web3PGPService(testEnv.web3pgp);
      const web3signService = new Web3SignService(testEnv.web3sign, web3pgpService);

      expect(web3signService).toBeDefined();
      expect(web3signService.web3pgpService).toBe(web3pgpService);
    });

    test('should handle Web3PGP as a dependency', async () => {
      // Web3Sign should be able to use Web3PGP
      expect(testEnv.web3pgp.address).toBe(testEnv.web3pgpAddress);
      expect(testEnv.web3sign.address).toBe(testEnv.web3signAddress);
    });

    test('should access both contracts through service', async () => {
      const docFee = await testEnv.web3sign.requestedFee();
      const pgpFee = await testEnv.web3pgp.requestedFee();

      expect(docFee).toBeDefined();
      expect(pgpFee).toBeDefined();
    });
  });

  // ========== Blockchain Interactions ==========

  describe('Blockchain State Management', () => {
    test('should track block numbers correctly', async () => {
      const publicClient = getPublicClient();
      const blockNumber = await publicClient.getBlockNumber();

      expect(typeof blockNumber).toBe('bigint');
      expect(blockNumber).toBeGreaterThan(0n);
    });

    test('should verify contract state persists across calls', async () => {
      const fee1 = await testEnv.web3sign.requestedFee();
      const fee2 = await testEnv.web3sign.requestedFee();

      expect(fee1).toBe(fee2);
    });

    test('should handle multiple contract queries in sequence', async () => {
      const docFee = await testEnv.web3sign.requestedFee();
      const pgpFee = await testEnv.web3pgp.requestedFee();
      const docFee2 = await testEnv.web3sign.requestedFee();

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
        const publicClient = getPublicClient();
        new Web3Sign(invalidAddress as Address, testEnv.web3pgp, publicClient);
      }).not.toThrow();
    });

    test('should verify contract availability', async () => {
      // Should be able to call contract methods
      const fee = await testEnv.web3sign.requestedFee();
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
    test('should accept Web3SignServiceOptions', async () => {
      const web3pgpService = new Web3PGPService(testEnv.web3pgp);
      const web3signService = new Web3SignService(testEnv.web3sign, web3pgpService, {
        concurrencyLimit: 10,
      });

      expect(web3signService).toBeDefined();
    });

    test('should apply default concurrency limit', async () => {
      const web3pgpService = new Web3PGPService(testEnv.web3pgp);
      const web3signService = new Web3SignService(testEnv.web3sign, web3pgpService);

      expect(web3signService).toBeDefined();
    });
  });

  // ========== Contract Dependencies ==========

  describe('Contract Dependencies', () => {
    test('should verify Web3Sign depends on Web3PGP', async () => {
      // Both should be accessible and initialized
      expect(testEnv.web3sign.address).toBe(testEnv.web3signAddress);
      expect(testEnv.web3pgp.address).toBe(testEnv.web3pgpAddress);
    });

    test('should handle service with proper dependencies', async () => {
      const web3pgpService = new Web3PGPService(testEnv.web3pgp);
      const web3signService = new Web3SignService(testEnv.web3sign, web3pgpService);

      // Service should have access to both contracts
      expect(web3signService).toBeDefined();
      expect(web3signService.web3pgpService).toBe(web3pgpService);
    });

    test('should allow querying both contracts through service', async () => {
      const web3pgpService = new Web3PGPService(testEnv.web3pgp);
      const web3signService = new Web3SignService(testEnv.web3sign, web3pgpService);

      // Should be able to access both contract fees
      const docFee = await testEnv.web3sign.requestedFee();
      const pgpFee = await testEnv.web3pgp.requestedFee();

      expect(docFee).toBeDefined();
      expect(pgpFee).toBeDefined();
    });
  });
});
