import {
  ConfigError,
  ValidationError,
  BlockchainError,
} from '../../src/errors';

describe('Custom Errors', () => {
  it('should create ConfigError with correct name', () => {
    const error = new ConfigError('Test config error');
    expect(error.message).toBe('Test config error');
    expect(error.name).toBe('ConfigError');
  });

  it('should create ValidationError with correct name', () => {
    const error = new ValidationError('Test validation error');
    expect(error.message).toBe('Test validation error');
    expect(error.name).toBe('ValidationError');
  });

  it('should create BlockchainError with correct name', () => {
    const error = new BlockchainError('Test blockchain error');
    expect(error.message).toBe('Test blockchain error');
    expect(error.name).toBe('BlockchainError');
  });
});
