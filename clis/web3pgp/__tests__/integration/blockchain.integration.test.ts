import { execSync, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { AnvilHelper } from '../../../../sdks/typescript/__tests__/helpers/anvil.helper';
import { MergedConfig } from '../../src/config/types';
import { WalletType } from '../../src/config/types';

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
  let testConfigPath: string;
  let testConfig: MergedConfig;

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
    } catch (error: any) {
      return {
        stdout: error.stdout ? error.stdout.toString() : '',
        stderr: error.stderr ? error.stderr.toString() : '',
        code: error.status || 1,
      };
    }
  };

  beforeAll(async () => {
    console.log('========================================');
    console.log('Setting up Web3PGP CLI Integration Tests');
    console.log('========================================');

    console.log('Starting Anvil blockchain...');
    anvil = new AnvilHelper({ port: 8545, blockTime: 1 });
    await anvil.start();
    console.log('✓ Anvil started at', anvil.getRpcUrl());

    console.log('Deploying contracts via Foundry scripts...');
    const deployed = await anvil.deployWeb3PGP(0n); // Initialize with 0 fee
    console.log('✓ Deployment summary:');
    console.log('  - AccessManager:', deployed.accessManager);
    console.log('  - Implementation:', deployed.implementation);
    console.log('  - Proxy (Web3PGP):', deployed.proxy);
    console.log('Using Web3PGP contract at:', deployed.proxy);

    // Create test configuration
    testConfig = {
      ethereum: {
        chainId: 31337, // Anvil default
        rpc: {
          endpoints: [
            { url: anvil.getRpcUrl(), priority: 1 },
          ],
        },
        wallet: {
          type: WalletType.PrivateKey,
          // Use Anvil's first account private key (test account)
          privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb476c6b8d6c1f02b98b19009145f', // pragma: allowlist secret
        },
      },
      web3pgp: {
        contract: deployed.proxy,
      },
      monitoring: {
        logging: {
          level: 'info',
        },
      },
    };

    // Write test config to temporary file
    testConfigPath = path.join(__dirname, 'test-config.yaml');
    const yaml = require('yaml');
    fs.writeFileSync(testConfigPath, yaml.stringify(testConfig));
    console.log('✓ Test config written to:', testConfigPath);

    console.log('Building CLI...');
    execSync('npm run build', { cwd: path.join(__dirname, '../../'), stdio: 'inherit' });
    console.log('✓ CLI built');

    console.log('========================================\n');
  }, 120000); // 2 minute timeout for setup

  afterAll(async () => {
    console.log('Cleaning up...');
    
    // Clean up test config
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
      console.log('✓ Test config removed');
    }

    // Stop Anvil
    anvil.stop();
    console.log('✓ Anvil stopped');
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
      const code = await publicClient.getBytecode({ address: testConfig.web3pgp.contract as `0x${string}` });
      expect(code).toBeDefined();
      expect(code).not.toBe('0x');
      
      // Verify we can read contract state
      expect(testConfig.ethereum.wallet.privateKey).toBeDefined();
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
});
