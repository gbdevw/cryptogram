import { createWeb3PGPService } from '../../../src/services/web3pgpServiceFactory';
import { MergedConfig } from '../../../src/config/types';
import { ConfigError } from '../../../src/errors';
import { DEFAULT_CONFIG } from '../../../src/config/defaults';
import { WalletType } from '../../../src/config/types';
import { createMockLogger } from '../../jest.setup';

/**
 * Mock Web3PGP service
 */
jest.mock('dexes', () => ({
  Web3PGP: jest.fn(function (address, publicClient, walletClient) {
    this.address = address;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    return this;
  }),
  Web3PGPService: jest.fn(function (contract) {
    this.contract = contract;
  }),
}));

describe('Web3PGPServiceFactory', () => {
  const mockLogger = createMockLogger();

  describe('createWeb3PGPService', () => {
    it('should create service with valid config containing default RPC endpoints', async () => {
      const config = { ...DEFAULT_CONFIG };

      const service = await createWeb3PGPService(config, mockLogger as any);

      expect(service).toBeDefined();
      expect(service).toHaveProperty('contract');
    });

    it('should throw ConfigError when no RPC endpoints configured', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          chain: 99999, // Unknown chain ID
          rpc: undefined, // No RPC endpoints provided
        },
      };

      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow(ConfigError);
      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow(
        'No RPC endpoints available',
      );
    });

    it('should throw ConfigError for unsupported chain ID', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          chain: 88888, // Different unknown chain
          rpc: undefined, // No RPC endpoints provided
        },
      };

      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow(ConfigError);
      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow('No RPC endpoints available');
    });

    it('should create service in read-only mode when wallet type not configured', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          wallet: {
            type: undefined as unknown as WalletType,
          },
        },
      };

      const service = await createWeb3PGPService(config, mockLogger as any);

      expect(service).toBeDefined();
      // Service should be created but without wallet client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any).contract.walletClient).toBeUndefined();
    });

    it('should create service in read-only mode when wallet type set but private key missing', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          wallet: {
            type: WalletType.PrivateKey,
            privateKey: undefined,
          },
        },
      };

      const service = await createWeb3PGPService(config, mockLogger as any);

      expect(service).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any).contract.walletClient).toBeUndefined();
    });

    it('should create service with WalletClient when private key is valid', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          wallet: {
            type: WalletType.PrivateKey,
            privateKey: ('0x' + '1'.repeat(64)) as `0x${string}`,
          },
        },
      };

      const service = await createWeb3PGPService(config, mockLogger as any);

      expect(service).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any).contract.walletClient).toBeDefined();
    });

    it('should throw ConfigError when private key does not start with 0x', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          wallet: {
            type: WalletType.PrivateKey,
            privateKey: ('1'.repeat(64)) as `0x${string}`,
          },
        },
      };

      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow(ConfigError);
      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow('start with "0x"');
    });

    it('should throw ConfigError when private key has wrong length', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          wallet: {
            type: WalletType.PrivateKey,
            privateKey: ('0x' + '1'.repeat(32)) as `0x${string}`,
          },
        },
      };

      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow(ConfigError);
      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow('exactly 64 hex characters');
    });

    it('should throw ConfigError when private key contains non-hex characters', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          wallet: {
            type: WalletType.PrivateKey,
            privateKey: ('0x' + 'z'.repeat(64)) as `0x${string}`,
          },
        },
      };

      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow(ConfigError);
      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow('0x-prefixed hex string');
    });

    it('should throw ConfigError when contract address format is invalid (no 0x)', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        web3pgp: {
          contract: 'notvalidformat' as `0x${string}`,
        },
      };

      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow(ConfigError);
      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow('Invalid contract address format');
    });

    it('should throw ConfigError when contract address format is invalid (wrong length)', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        web3pgp: {
          contract: ('0x' + 'a'.repeat(30)) as `0x${string}`,
        },
      };

      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow(ConfigError);
      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow('Invalid contract address format');
    });

    it('should create service with valid contract address', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        web3pgp: {
          contract: ('0x' + 'a'.repeat(40)) as `0x${string}`,
        },
      };

      const service = await createWeb3PGPService(config, mockLogger as any);

      expect(service).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((service as any).contract.address).toBe('0x' + 'a'.repeat(40));
    });

    it('should handle multiple RPC endpoints with priority ordering', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          rpc: {
            endpoints: [
              { url: 'https://rpc1.example.com', priority: 2 },
              { url: 'https://rpc2.example.com', priority: 1 },
              { url: 'https://rpc3.example.com', priority: 3 },
            ],
          },
        },
      };

      const service = await createWeb3PGPService(config, mockLogger as any);

      expect(service).toBeDefined();
      // Service should be created with endpoints ordered by priority
    });

    it('should support Sepolia chain (11155111)', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          chain: 'sepolia',
          rpc: {
            endpoints: [{ url: 'https://sepolia.infura.io/v3/...', priority: 1 }],
          },
        },
      };

      const service = await createWeb3PGPService(config, mockLogger as any);

      expect(service).toBeDefined();
    });

    it('should support mainnet chain (1)', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          chain: 'mainnet',
          rpc: {
            endpoints: [{ url: 'https://mainnet.infura.io/v3/...', priority: 1 }],
          },
        },
      };

      const service = await createWeb3PGPService(config, mockLogger as any);

      expect(service).toBeDefined();
    });

    it('should wrap unexpected errors as ConfigError', async () => {
      // Try to cause an error by using an invalid config structure
      const config = {
        ethereum: {
          chainId: 'not a number' as unknown as number,
          rpc: { endpoints: [] },
          wallet: { type: undefined },
        },
        web3pgp: { contract: '0x' + 'a'.repeat(40) as `0x${string}` },
        monitoring: { logging: { level: 'info' } },
      } as unknown as MergedConfig;

      await expect(createWeb3PGPService(config, mockLogger as any)).rejects.toThrow(ConfigError);
    });
  });

  describe('Private Key Validation', () => {
    it('should validate all lowercase hex characters', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          wallet: {
            type: WalletType.PrivateKey,
            privateKey: ('0x' + 'abcdef'.repeat(10) + '1234') as `0x${string}`,
          },
        },
      };

      const service = await createWeb3PGPService(config, mockLogger as any);
      expect(service).toBeDefined();
    });

    it('should validate all uppercase hex characters', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          wallet: {
            type: WalletType.PrivateKey,
            privateKey: ('0x' + 'ABCDEF'.repeat(10) + '1234') as `0x${string}`,
          },
        },
      };

      const service = await createWeb3PGPService(config, mockLogger as any);
      expect(service).toBeDefined();
    });

    it('should validate mixed case hex characters', async () => {
      const config: MergedConfig = {
        ...DEFAULT_CONFIG,
        ethereum: {
          ...DEFAULT_CONFIG.ethereum,
          wallet: {
            type: WalletType.PrivateKey,
            privateKey: ('0x' + 'aBcDeF'.repeat(10) + '1234') as `0x${string}`,
          },
        },
      };

      const service = await createWeb3PGPService(config, mockLogger as any);
      expect(service).toBeDefined();
    });
  });
});
