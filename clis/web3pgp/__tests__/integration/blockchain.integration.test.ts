/// <reference types="jest" />
/// <reference types="node" />
import { execSync, spawn } from 'child_process';
import * as path from 'path';
import * as openpgp from 'openpgp';
import { Address } from 'viem';
import { AnvilHelper } from '../../../../sdks/typescript/__tests__/helpers/anvil.helper';
import { Web3PGP, Web3PGPService } from 'dexes';

/**
 * Integration tests for Web3PGP CLI using real blockchain (Anvil)
 *
 * These tests:
 * - Start a local Anvil blockchain
 * - Deploy real contracts via Foundry
 * - Execute CLI commands
 * - Verify on-chain state
 *
 * Unlike unit tests, these DO NOT use mocks and test the full CLI stack.
 */
describe('Web3PGP CLI Integration Tests', () => {
  let anvil: AnvilHelper;
  let contractAddress: Address;
  let service: Web3PGPService;

  /**
   * Execute a CLI command and capture output
   */
  const runCli = (args: string[]): { stdout: string; stderr: string; code: number } => {
    try {
      const cwd = path.join(__dirname, '../../');
      const stdout = execSync(`node dist/index.js ${args.join(' ')}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return { stdout, stderr: '', code: 0 };
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; status?: number };
      return {
        stdout: err.stdout ? err.stdout.toString() : '',
        stderr: err.stderr ? err.stderr.toString() : '',
        code: err.status || 1,
      };
    }
  };

  /**
   * Execute a CLI command with stdin input and capture output
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const runCliWithStdin = (
    args: string[],
    stdinData: string
  ): Promise<{ stdout: string; stderr: string; code: number }> => {
    return new Promise((resolve) => {
      const cwd = path.join(__dirname, '../../');
      const child = spawn('node', ['dist/index.js', ...args], {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null) => {
        resolve({ stdout, stderr, code: code || 0 });
      });

      // Send stdin data and close
      child.stdin?.write(stdinData);
      child.stdin?.end();
    });
  };

  beforeAll(async () => {
    console.log('========================================');
    console.log('Setting up Web3PGP CLI Integration Tests');
    console.log('========================================');

    // Step 1: Start Anvil blockchain
    console.log('Starting Anvil blockchain...');
    anvil = new AnvilHelper({ port: 8545, blockTime: 1 });
    await anvil.start();
    console.log(`✓ Anvil started at ${anvil.getRpcUrl()}`);

    // Step 2: Deploy contracts via Foundry scripts
    console.log('Deploying contracts via Foundry scripts...');
    const deployed = await anvil.deployWeb3PGP(0n); // Initialize with 0 fee
    contractAddress = deployed.web3pgp;

    console.log('✓ Deployment summary:');
    console.log(`  - AccessManager: ${deployed.accessManager}`);
    console.log(`  - Implementation: ${deployed.implementation}`);
    console.log(`  - Proxy (Web3PGP): ${deployed.proxy}`);
    console.log('  - Roles: ADMIN(0), UPGRADE_MANAGER(1), TREASURER(2)');
    console.log(`Using Web3PGP contract at: ${contractAddress}`);

    // Step 3: Create service instance (using AnvilHelper's properly configured clients)
    console.log('Initializing Web3PGP service...');
    const publicClient = anvil.getPublicClient();
    const walletClient = anvil.getWalletClient();
    const web3pgp = new Web3PGP(contractAddress, publicClient, walletClient);
    service = new Web3PGPService(web3pgp);
    console.log('✓ Web3PGP service initialized');

    // Step 4: Build CLI
    console.log('Building CLI...');
    execSync('npm run build', { cwd: path.join(__dirname, '../../'), stdio: 'inherit' });
    console.log('✓ CLI built');

    console.log('========================================\n');
  });

  afterAll(async () => {
    console.log('Cleaning up Web3PGP CLI Integration Tests');
    anvil.stop();
  });

  describe('CLI Setup & Configuration', () => {
    test('should display help without errors', () => {
      const result = runCli(['--help']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Web3PGP CLI');
      expect(result.stdout).toContain('register');
      expect(result.stdout).toContain('get-public-key');
      expect(result.stdout).toContain('configuration');
    });

    test('should display version', () => {
      const result = runCli(['--version']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('0.1.0');
    });

    test('should verify blockchain setup is correct', async () => {
      // Verify Anvil is running
      expect(anvil).toBeDefined();
      
      // Verify contract is deployed
      const publicClient = anvil.getPublicClient();
      const code = await publicClient.getBytecode({ address: contractAddress });
      expect(code).toBeDefined();
      expect(code).not.toBe('0x');
      
      // Verify service is initialized
      expect(service).toBeDefined();
    });
  });

  describe('Blockchain Commands Help', () => {
    test('should display register command help', () => {
      const result = runCli(['register', '--help']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Register a public key on the blockchain');
      expect(result.stdout).toContain('--key');
      expect(result.stdout).toContain('--stdin');
    });

    test('should display get-public-key command help', () => {
      const result = runCli(['get-public-key', '--help']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Retrieve a public key from the blockchain by fingerprint');
    });

    test('should display revoke command help', () => {
      const result = runCli(['revoke', '--help']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Revoke a public key on the blockchain');
    });
  });

  describe('Configuration Commands', () => {
    test('should display configuration command help', () => {
      const result = runCli(['configuration', '--help']);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Configuration management');
      expect(result.stdout).toContain('generate');
      expect(result.stdout).toContain('display');
      expect(result.stdout).toContain('validate');
    });
  });

  describe('Blockchain Register Command', () => {
    test('should register a public key', async () => {
      // Generate a test PGP keypair
      const keyPair = await openpgp.generateKey({
        format: 'object',
        type: 'rsa',
        rsaBits: 2048,
        userIDs: [{ name: 'Test User', email: 'testuser@example.com' }],
      });

      // Extract public key for registration
      const publicKey = keyPair.publicKey;

      // Register via service (tests blockchain integration)
      const receipt = await service.register(publicKey);

      expect(receipt.status).toBe('success');
      expect(receipt.blockNumber).toBeGreaterThan(0n);

      // Verify on-chain state
      const fingerprint = publicKey.getFingerprint();
      const exists = await service.contract.exists(`0x${fingerprint}`);
      expect(exists).toBe(true);
    });

    test('should reject duplicate public key registration', async () => {
      // Generate a test PGP keypair
      const keyPair = await openpgp.generateKey({
        format: 'object',
        type: 'rsa',
        rsaBits: 2048,
        userIDs: [{ name: 'Duplicate User', email: 'duplicateuser@example.com' }],
      });

      // Extract public key for registration
      const publicKey = keyPair.publicKey;

      // First registration should succeed
      const firstReceipt = await service.register(publicKey);
      expect(firstReceipt.status).toBe('success');

      // Second registration should fail
      await expect(service.register(publicKey)).rejects.toThrow();
    });

    test('should reject revoked public key', async () => {
      // Generate a test PGP keypair
      const keyPair = await openpgp.generateKey({
        format: 'object',
        type: 'rsa',
        rsaBits: 2048,
        userIDs: [{ name: 'Revoked User', email: 'revokeduser@example.com' }],
      });

      // Revoke the key locally
      const revoked = await openpgp.revokeKey({
        format: 'object',
        key: keyPair.privateKey,
        revocationCertificate: keyPair.revocationCertificate,
      });
      expect(await revoked.privateKey.isRevoked()).toBe(true);

      // Attempt to register the revoked key
      await expect(service.register(revoked.publicKey)).rejects.toThrow();
    }); 

    test('should reject expired public keys', async () => {
      // Generate a test PGP keypair
      const keyPair = await openpgp.generateKey({
        format: 'object',
        type: 'rsa',
        rsaBits: 2048,
        keyExpirationTime: 1, // Expires in 1 second
        userIDs: [{ name: 'Revoked User', email: 'revokeduser@example.com' }],
      });

      // Wait for key to expire
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Attempt to register the revoked key
      await expect(service.register(keyPair.publicKey)).rejects.toThrow();
    }); 
  });
});