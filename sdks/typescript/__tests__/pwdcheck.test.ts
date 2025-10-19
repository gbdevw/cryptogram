import { validatePassword } from '../src/utils/pwdcheck';

describe('validatePassword', () => {
  test('returns true for valid password', () => {
    const validPasswords = [
      'Password1!',
      'MySecure123@',
      'Test#456Pass',
      'Abc123!@#',
      'Valid$789Word'
    ];

    validPasswords.forEach(password => {
      expect(validatePassword(password)).toBe(true);
    });
  });

  test('returns false for password shorter than 8 characters', () => {
    const shortPasswords = [
      'Pass1!',
      'Abc123!',
      'Test#1',
      'A1!',
      ''
    ];

    shortPasswords.forEach(password => {
      expect(validatePassword(password)).toBe(false);
    });
  });

  test('returns false for password without letters', () => {
    const noLetterPasswords = [
      '12345678!',
      '987654321@',
      '111222333#',
      '000000000$'
    ];

    noLetterPasswords.forEach(password => {
      expect(validatePassword(password)).toBe(false);
    });
  });

  test('returns false for password without numbers', () => {
    const noNumberPasswords = [
      'Password!',
      'SecurePass@',
      'TestPassword#',
      'MyPassword$'
    ];

    noNumberPasswords.forEach(password => {
      expect(validatePassword(password)).toBe(false);
    });
  });

  test('returns false for password without special characters', () => {
    const noSpecialPasswords = [
      'Password1',
      'Secure123',
      'Test456Pass',
      'My789Word'
    ];

    noSpecialPasswords.forEach(password => {
      expect(validatePassword(password)).toBe(false);
    });
  });

  test('returns false for password missing multiple requirements', () => {
    const invalidPasswords = [
      'pass',           // too short, no number, no special
      'password',       // no number, no special
      '12345678',       // no letter, no special
      'Password',       // no number, no special
      '123!@#',         // no letter
      'Password!',      // no number
      'Pass1',          // too short, no special
      'P1!',            // too short
      '!'               // too short, no letter, no number
    ];

    invalidPasswords.forEach(password => {
      expect(validatePassword(password)).toBe(false);
    });
  });

  test('handles edge cases', () => {
    // Exactly 8 characters
    expect(validatePassword('Pass123!')).toBe(true);

    // Special characters from the allowed set
    expect(validatePassword('Test123!')).toBe(true);
    expect(validatePassword('Test123@')).toBe(true);
    expect(validatePassword('Test123#')).toBe(true);
    expect(validatePassword('Test123$')).toBe(true);
    expect(validatePassword('Test123%')).toBe(true);
    expect(validatePassword('Test123^')).toBe(true);
    expect(validatePassword('Test123&')).toBe(true);
    expect(validatePassword('Test123*')).toBe(true);
    expect(validatePassword('Test123(')).toBe(true);
    expect(validatePassword('Test123)')).toBe(true);
    expect(validatePassword('Test123,')).toBe(true);
    expect(validatePassword('Test123.')).toBe(true);
    expect(validatePassword('Test123?')).toBe(true);
    expect(validatePassword('Test123"')).toBe(true);
    expect(validatePassword('Test123:')).toBe(true);
    expect(validatePassword('Test123{')).toBe(true);
    expect(validatePassword('Test123}')).toBe(true);
    expect(validatePassword('Test123|')).toBe(true);
    expect(validatePassword('Test123<')).toBe(true);
    expect(validatePassword('Test123>')).toBe(true);
  });
});