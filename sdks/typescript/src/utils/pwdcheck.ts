/**
 * Password validation utilities
 */

/**
 * Validate password according to policy:
 * - 8+ characters
 * - At least 1 letter
 * - At least 1 number
 * - At least 1 special character
 *
 * @param password The password to validate
 * @returns True if the password is valid, false otherwise
 */
export function validatePassword(password: string): boolean {
  if (password.length < 8) {
    return false;
  }

  if (!/[a-zA-Z]/.test(password)) {
    return false;
  }

  if (!/[0-9]/.test(password)) {
    return false;
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return false;
  }

  return true;
}