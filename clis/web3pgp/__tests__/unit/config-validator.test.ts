import { validateConfigFormat, validateYamlFormat, validateYamlStructure } from '../../src/config/validator';
import { ConfigError } from '../../src/errors';

describe('Configuration Validator', () => {
  describe('validateYamlFormat', () => {
    it('should accept valid YAML', () => {
      const yaml = `
ethereum:
  chainId: 763373
`;
      expect(() => validateYamlFormat(yaml)).not.toThrow();
    });

    it('should reject malformed YAML', () => {
      const yaml = `
ethereum:
  chainId: 763373
  invalid: [
`;
      expect(() => validateYamlFormat(yaml)).toThrow(ConfigError);
    });

    it('should reject YAML with invalid syntax', () => {
      // This is actually valid YAML, so we need a truly invalid example
      const invalidYaml = `
ethereum:
  chainId: 763373
    bad_indent:
`;
      expect(() => validateYamlFormat(invalidYaml)).toThrow(ConfigError);
    });
  });

  describe('validateYamlStructure', () => {
    it('should accept valid structure', () => {
      const data = {
        ethereum: {
          chainId: 763373,
          rpc: {
            endpoints: [
              { url: 'https://rpc.example.com', priority: 1 },
            ],
          },
          wallet: {
            type: 'private-key',
          },
        },
        web3pgp: {
          contract: '0x1234567890123456789012345678901234567890',
        },
        monitoring: {
          logging: {
            level: 'info',
          },
        },
      };
      expect(() => validateYamlStructure(data)).not.toThrow();
    });

    it('should reject missing ethereum field', () => {
      const data = {
        web3pgp: { contract: '0x...' },
        monitoring: { logging: { level: 'info' } },
      };
      expect(() => validateYamlStructure(data)).toThrow(
        new ConfigError('Missing required field: ethereum')
      );
    });

    it('should reject missing web3pgp field', () => {
      const data = {
        ethereum: {
          chainId: 763373,
          rpc: { endpoints: [] },
          wallet: { type: 'private-key' },
        },
        monitoring: { logging: { level: 'info' } },
      };
      expect(() => validateYamlStructure(data)).toThrow(
        new ConfigError('Missing required field: web3pgp')
      );
    });

    it('should reject missing monitoring field', () => {
      const data = {
        ethereum: {
          chainId: 763373,
          rpc: { endpoints: [] },
          wallet: { type: 'private-key' },
        },
        web3pgp: { contract: '0x...' },
      };
      expect(() => validateYamlStructure(data)).toThrow(
        new ConfigError('Missing required field: monitoring')
      );
    });

    it('should reject invalid wallet type', () => {
      const data = {
        ethereum: {
          chainId: 763373,
          rpc: {
            endpoints: [{ url: 'https://rpc.example.com', priority: 1 }],
          },
          wallet: {
            type: 'invalid-type',
          },
        },
        web3pgp: { contract: '0x...' },
        monitoring: { logging: { level: 'info' } },
      };
      expect(() => validateYamlStructure(data)).toThrow(ConfigError);
    });

    it('should reject non-object config', () => {
      expect(() => validateYamlStructure('not an object')).toThrow(
        new ConfigError('Configuration must be an object')
      );
    });

    it('should reject missing rpc.endpoints', () => {
      const data = {
        ethereum: {
          chainId: 763373,
          rpc: {},
          wallet: { type: 'private-key' },
        },
        web3pgp: { contract: '0x...' },
        monitoring: { logging: { level: 'info' } },
      };
      expect(() => validateYamlStructure(data)).toThrow(
        new ConfigError('Missing required field: ethereum.rpc.endpoints')
      );
    });

    it('should reject non-array endpoints', () => {
      const data = {
        ethereum: {
          chainId: 763373,
          rpc: { endpoints: 'not an array' },
          wallet: { type: 'private-key' },
        },
        web3pgp: { contract: '0x...' },
        monitoring: { logging: { level: 'info' } },
      };
      expect(() => validateYamlStructure(data)).toThrow(
        new ConfigError('ethereum.rpc.endpoints must be an array')
      );
    });
  });

  describe('validateConfigFormat', () => {
    it('should validate complete YAML config', () => {
      const yaml = `
ethereum:
  chainId: 763373
  rpc:
    endpoints:
      - url: https://rpc.example.com
        priority: 1
  wallet:
    type: private-key
web3pgp:
  contract: "0x1234567890123456789012345678901234567890"
monitoring:
  logging:
    level: info
`;
      expect(() => validateConfigFormat(yaml)).not.toThrow();
    });

    it('should reject invalid YAML and provide error', () => {
      const yaml = `
ethereum:
  chainId: 763373
  invalid: [
`;
      expect(() => validateConfigFormat(yaml)).toThrow(ConfigError);
    });
  });
});
