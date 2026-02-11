import fs from 'fs';
import path from 'path';
import os from 'os';
import { loadConfig } from '../../src/config/loader';
import { WalletType } from '../../src/config/types';

describe('Configuration Loader', () => {
  const tempDir = path.join(os.tmpdir(), 'web3pgp-config-test');

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('loadConfig', () => {
    it('should load defaults when no config provided', () => {
      // Pass empty env vars to prevent DEXES_LOG_LEVEL override from process.env
      const config = loadConfig({ configPath: '/nonexistent/path', envVars: {} });
      expect(config.ethereum.chain).toBe('sepolia');
      expect(config.web3pgp.contract).toBe('0xce66927a2E6171056a9c2464CFe83b813215A905');
      expect(config.monitoring.logging.level).toBe('info');
    });

    it('should load and merge config from file', () => {
      const configPath = path.join(tempDir, 'config.yaml');
      const configContent = `
ethereum:
  chain: 57073
  rpc:
    endpoints:
      - url: https://custom-rpc.example.com
        priority: 1
  wallet:
    type: private-key
web3pgp:
  contract: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12"
monitoring:
  logging:
    level: debug
`;
      fs.writeFileSync(configPath, configContent);

      const config = loadConfig({ configPath });
      expect(config.ethereum.chain).toBe(57073);
      expect(config.web3pgp.contract).toBe('0xABCDEF1234567890ABCDEF1234567890ABCDEF12');
      expect(config.monitoring.logging.level).toBe('debug');
    });

    it('should override file config with environment variables', () => {
      const configPath = path.join(tempDir, 'config.yaml');
      const configContent = `
ethereum:
  chain: 57073
  rpc:
    endpoints:
      - url: https://file-rpc.example.com
        priority: 1
  wallet:
    type: private-key
web3pgp:
  contract: "0x1111111111111111111111111111111111111111"
monitoring:
  logging:
    level: debug
`;
      fs.writeFileSync(configPath, configContent);

      const config = loadConfig({
        configPath,
        envVars: {
          DEXES_CHAIN_ID: '763373',
          DEXES_RPC_URL: 'https://env-rpc.example.com',
        },
      });

      // Env vars should override file config
      expect(config.ethereum.chain).toBe(763373);
      expect(config.ethereum.rpc?.endpoints[0].url).toBe('https://env-rpc.example.com');
    });

    it('should override with CLI flags', () => {
      const config = loadConfig({
        configPath: '/nonexistent/path',
        envVars: {},
        cliFlags: {
          ethereum: {
            chain: 999,
            rpc: { endpoints: [] },
            wallet: { type: WalletType.PrivateKey },
          },
        },
      });

      expect(config.ethereum.chain).toBe(999);
    });

    it('should parse DEXES_RPC_ENDPOINTS JSON array', () => {
      const config = loadConfig({
        configPath: '/nonexistent/path',
        envVars: {
          DEXES_RPC_ENDPOINTS: JSON.stringify([
            { url: 'https://rpc1.example.com', priority: 1 },
            { url: 'https://rpc2.example.com', priority: 2 },
          ]),
        },
      });

      expect(config.ethereum.rpc?.endpoints).toHaveLength(2);
      expect(config.ethereum.rpc?.endpoints[0].url).toBe('https://rpc1.example.com');
      expect(config.ethereum.rpc?.endpoints[1].url).toBe('https://rpc2.example.com');
    });

    it('should set wallet private key from env var', () => {
      const config = loadConfig({
        configPath: '/nonexistent/path',
        envVars: {
          DEXES_WALLET_PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234', // pragma: allowlist secret
        },
      });

      expect(config.ethereum.wallet?.privateKey).toBe(
        '0x1234567890123456789012345678901234567890123456789012345678901234'
      );
    });

    it('should set log level from env var', () => {
      const config = loadConfig({
        configPath: '/nonexistent/path',
        envVars: {
          DEXES_LOG_LEVEL: 'error',
        },
      });

      expect(config.monitoring.logging.level).toBe('error');
    });

    it('should expand env vars in config file', () => {
      const configPath = path.join(tempDir, 'config.yaml');
      const configContent = `
ethereum:
  chain: ink-sepolia
  rpc:
    endpoints:
      - url: https://rpc.example.com
        priority: 1
  wallet:
    type: private-key
    privateKey: "\${DEXES_WALLET_PRIVATE_KEY}"
web3pgp:
  contract: "0x1234567890123456789012345678901234567890"
monitoring:
  logging:
    level: info
`;
      fs.writeFileSync(configPath, configContent);

      const config = loadConfig({
        configPath,
        envVars: {
          DEXES_WALLET_PRIVATE_KEY: '0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234', // pragma: allowlist secret
        },
      });

      expect(config.ethereum.wallet?.privateKey).toBe(
        '0xABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234ABCD1234'
      );
    });

    it('should maintain priority: defaults < file < env < flags', () => {
      const configPath = path.join(tempDir, 'config.yaml');
      const configContent = `
ethereum:
  chain: 111
  rpc:
    endpoints:
      - url: https://file.example.com
        priority: 1
  wallet:
    type: private-key
web3pgp:
  contract: "0x1111111111111111111111111111111111111111"
monitoring:
  logging:
    level: warn
`;
      fs.writeFileSync(configPath, configContent);

      const config = loadConfig({
        configPath,
        envVars: {
          DEXES_LOG_LEVEL: 'debug',
        },
        cliFlags: {
          ethereum: {
            chain: 222,
            rpc: { endpoints: [] },
            wallet: { type: WalletType.PrivateKey },
          },
        },
      });

      // CLI flags override everything
      expect(config.ethereum.chain).toBe(222);
      // Env vars override file and defaults
      expect(config.monitoring.logging.level).toBe('debug');
      // File overrides defaults
      expect(config.web3pgp.contract).toBe('0x1111111111111111111111111111111111111111');
    });
  });
});
