import { toBytes32, to0x } from '../src/utils/0xstr';

describe('toBytes32', () => {
  test('pads short hex to 32 bytes', () => {
    const input = '0x1234';
    const expected = '0x0000000000000000000000000000000000000000000000000000000000001234';
    expect(toBytes32(input)).toBe(expected);
  });

  test('returns 32-byte hex unchanged', () => {
    const input = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    expect(toBytes32(input)).toBe(input);
  });

  test('throws for hex longer than 32 bytes', () => {
    const input = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';
    expect(() => toBytes32(input)).toThrow('Hex string too long to fit in bytes32');
  });

  test('throws for invalid hex', () => {
    const input = '0xgggg';
    expect(() => toBytes32(input)).toThrow('Hex string too long to fit in bytes32');
  });
});

describe('to0x', () => {
  test('adds 0x prefix to hex without prefix', () => {
    const input = '1234abcd';
    const expected = '0x1234abcd';
    expect(to0x(input)).toBe(expected);
  });

  test('returns hex with 0x prefix unchanged', () => {
    const input = '0x1234abcd';
    expect(to0x(input)).toBe(input);
  });

  test('handles uppercase and trims', () => {
    const input = '  ABCD  ';
    const expected = '0xabcd';
    expect(to0x(input)).toBe(expected);
  });

  test('throws for invalid hex', () => {
    const input = 'gggg';
    expect(() => to0x(input)).toThrow('Invalid hex string');
  });

  test('throws for hex with invalid characters', () => {
    const input = '0x123g';
    expect(() => to0x(input)).toThrow('Invalid hex string');
  });
});