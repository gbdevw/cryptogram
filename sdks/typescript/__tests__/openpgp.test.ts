import * as openpgp from 'openpgp';
import { OpenPGPUtils } from '../src/utils/openpgp';

/*********************************************************************************************************************/
/* FIXTURES                                                                                                          */
/*********************************************************************************************************************/

// Add this helper function to generate a real OpenPGP key fixture on demand
async function generateTestKeyPair(): Promise<[privateKey: openpgp.PrivateKey, publicKey: openpgp.PublicKey, revocationCertificate: string]> {
  const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'nistP256',
    userIDs: [{ name: 'Test User', email: 'test@example.com' }],
    format: 'object',
    subkeys: [
      { curve: 'nistP256', keyExpirationTime: 0, type: 'ecc', sign: true },
      { curve: 'nistP256', keyExpirationTime: 0, type: 'ecc', sign: false }
    ],
  });
  return [privateKey, publicKey, revocationCertificate];
}

describe('OpenPGPUtils', () => {

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('sanitizePrimaryKey', () => {
    test('successfully sanitizes primary key', async () => {
      const [privateKey] = await generateTestKeyPair();
      const result = await OpenPGPUtils.sanitizePrimaryKey(privateKey);
      // Check that the original key remains unchanged and is still private
      expect(privateKey.isPrivate()).toBe(true);
      expect(privateKey.getSubkeys().length).toBeGreaterThan(0);
      // Check that the result is a public key without subkeys and has the same user IDs
      expect(result.isPrivate()).toBe(false);
      expect(result.getSubkeys()).toHaveLength(0);
      expect(result.users.length).toEqual(privateKey.users.length);
      expect(await result.getExpirationTime()).toEqual(await privateKey.getExpirationTime());
    });
  });

  describe('sanitizeSubkey', () => {
    test('successfully sanitizes existing subkey', async () => {
      const [privateKey] = await generateTestKeyPair();
      const result = await OpenPGPUtils.sanitizeSubkey(privateKey, privateKey.getSubkeys()[0]!.getFingerprint() as `0x${string}`);
      // Check that the original key remains unchanged and is still private
      expect(privateKey.isPrivate()).toBe(true);
      expect(privateKey.getSubkeys().length).toBeGreaterThan(0);
      // Check the key has been sanitized to only include the specified subkey
      expect(result.isPrivate()).toBe(false);
      expect(result.getSubkeys()).toHaveLength(1);
      expect(result.getSubkeys()[0]!.getFingerprint()).toBe(privateKey.getSubkeys()[0]!.getFingerprint());
    });

    test('throws error for non-existent subkey', async () => {
      const fingerprint = '0x1234567890abcdef' as `0x${string}`;
      const [privateKey] = await generateTestKeyPair();
      await expect(async () => {
        await OpenPGPUtils.sanitizeSubkey(privateKey, fingerprint);
      }).rejects.toThrow(/.*0x1234567890abcdef.*found.*/);
    });
  });

  describe('isSubkeyRevoked', () => {

    test('returns false when subkey has no revocation signatures', async () => {
      const [privateKey] = await generateTestKeyPair();
      const result = await OpenPGPUtils.isSubkeyRevoked(privateKey.getSubkeys()[0]!, privateKey);
      expect(result).toBe(false);
    });

    test('returns true when a subkey has been revoked', async () => {
      const [privateKey] = await generateTestKeyPair();
      const revokedSubkey = await privateKey.getSubkeys()[0]!.revoke(privateKey.keyPacket as openpgp.SecretKeyPacket);
      const result = await OpenPGPUtils.isSubkeyRevoked(revokedSubkey, privateKey);
      expect(result).toBe(true);
      // Curiosity: check if the subkey from privateKey is also considered revoked
      // Response: The subkey from privateKey is not revoked
      const resultFromOriginal = await OpenPGPUtils.isSubkeyRevoked(privateKey.getSubkeys()[0]!, privateKey);
      expect(resultFromOriginal).toBe(false);
    });

    test('throws an error when revocation signature verification fails', async () => {
      const [privateKey1] = await generateTestKeyPair();
      const [privateKey2] = await generateTestKeyPair();
      // Revoke a subkey in privateKey1 and verify
      const revokedSubkey = await privateKey1.getSubkeys()[0]!.revoke(privateKey1.keyPacket as openpgp.SecretKeyPacket);
      const result = await OpenPGPUtils.isSubkeyRevoked(revokedSubkey, privateKey1);
      expect(result).toBe(true);
      // Let's use a different primary key to verify the signature and expect an Error to be thrown
      // because the subkey does not belong to the primary key.
      expect(async () => {
        await OpenPGPUtils.isSubkeyRevoked(revokedSubkey, privateKey2);
      }).rejects.toThrow('The provided primary key does not own the specified subkey');
    });

    test('uses provided date for verification', async () => {
      const testDate = new Date('2023-01-01');
      const [privateKey] = await generateTestKeyPair();
      // Revoke subkey with now as date for the revocation
      const revokedSubkey = await privateKey.getSubkeys()[0]!.revoke(privateKey.keyPacket as openpgp.SecretKeyPacket, undefined, new Date());
      // Call isSubkeyRevoked with the test date
      const result = await OpenPGPUtils.isSubkeyRevoked(revokedSubkey, privateKey, testDate);
      expect(result).toBe(false); // Should be false since revocation is after testDate
    });

    test('returns true when the primary key is revoked', async () => {
      const [privateKey, _, revocationCertificate] = await generateTestKeyPair();
      // Apply the revocation certificate to revoke the primary key
      const revoked = await openpgp.revokeKey({
        key: privateKey,
        revocationCertificate: revocationCertificate,
        format: 'object'
      });
      // Check the key is revoked
      expect(await revoked.privateKey.isRevoked()).toBe(true);
      expect(await revoked.publicKey.isRevoked()).toBe(true);
      expect(await privateKey.isRevoked()).toBe(false);
      // Now check if the subkey is considered revoked due to primary key revocation
      const result = await OpenPGPUtils.isSubkeyRevoked(revoked.privateKey.getSubkeys()[0]!, revoked.privateKey);
      expect(result).toBe(true);
    });
  });

  describe('containsPrivateKeyMaterial', () => {
    test('returns true for private key', async () => {
      const [privateKey] = await generateTestKeyPair();
      expect(OpenPGPUtils.containsPrivateKeyMaterial(privateKey)).toBe(true);
    });

    test('returns false for public key without private subkeys', async () => {
      const [_, publicKey] = await generateTestKeyPair();
      expect(OpenPGPUtils.containsPrivateKeyMaterial(publicKey)).toBe(false);
    });

    test('returns true for public key with private subkeys', async () => {
      const [privateKey, publicKey] = await generateTestKeyPair();
      publicKey.subkeys = privateKey.subkeys;
      expect(OpenPGPUtils.containsPrivateKeyMaterial(publicKey)).toBe(true);
    });
  });

  describe('listPrivateKeyFingerprints', () => {
    test('lists all private key fingerprints', async () => {
      const [privateKey] = await generateTestKeyPair();
      const result = OpenPGPUtils.listPrivateKeyFingerprints(privateKey);
      expect(result).toEqual([privateKey.getFingerprint(), privateKey.getSubkeys().map(sub => sub.getFingerprint())].flat());
    });

    test('returns empty array for public key without private subkeys', async () => {
      const [_, publicKey] = await generateTestKeyPair();
      const result = OpenPGPUtils.listPrivateKeyFingerprints(publicKey);
      expect(result).toEqual([]);
    });

    test('returns subkey fingerprints in case primary is public and has private subkeys', async () => {
      const [privateKey, publicKey] = await generateTestKeyPair();
      publicKey.subkeys = privateKey.subkeys;
      const result = OpenPGPUtils.listPrivateKeyFingerprints(publicKey);
      expect(result).toEqual(publicKey.getSubkeys().map(sub => sub.getFingerprint()));
    });
  });

  describe('listAllFingerprints', () => {
    test('returns primary key and all subkey fingerprints', async () => {
      const [privateKey] = await generateTestKeyPair();
      const result = OpenPGPUtils.listAllFingerprints(privateKey);
      expect(result).toEqual([privateKey.getFingerprint(), privateKey.getSubkeys().map(sub => sub.getFingerprint())].flat());
    });
  });
});
