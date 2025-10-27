import * as openpgp from 'openpgp';
import { OpenPGPUtils, SubkeyNotFoundError, KeySanitizationError, RevocationVerificationResult } from '../src/utils/openpgp';

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
      const result = OpenPGPUtils.sanitizePrimaryKey(privateKey);
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

    test('throws SubkeyNotFoundError for non-existent subkey', async () => {
      const fingerprint = '0x1234567890abcdef' as `0x${string}`;
      const [privateKey] = await generateTestKeyPair();
      expect(() => {
        OpenPGPUtils.sanitizeSubkey(privateKey, fingerprint);
      }).toThrow(SubkeyNotFoundError);
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
      // Let's use a different primary key to verify the signature and expect an InvalidSignature error
      expect(async () => {
        await OpenPGPUtils.isSubkeyRevoked(revokedSubkey, privateKey2);
      }).rejects.toThrow('InvalidSignature');
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

  describe('verifyRevocationCertificate', () => {
    test('returns empty array for signature with no packets', async () => {
      const [privateKey] = await generateTestKeyPair();
      const emptySignature = new openpgp.Signature(new openpgp.PacketList(0));
      const result = await OpenPGPUtils.verifyRevocationCertificate(privateKey, emptySignature);
      expect(result).toEqual([]);
    });

    test('verifies primary key revocation successfully', async () => {
      const [privateKey, _, revocationCertificate] = await generateTestKeyPair();
      const revocationSig = await openpgp.readSignature({ armoredSignature: revocationCertificate });
      const result = await OpenPGPUtils.verifyRevocationCertificate(privateKey, revocationSig, new Date());
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        isValid: true,
        revokedKeyFingerprint: privateKey.getFingerprint(),
        invalidReason: ''
      });
    });

    test('verifies primary key revocation successfully with date', async () => {
      const [privateKey] = await generateTestKeyPair();
      /// TODO: revoker la cle
      const revocationCertificate = await privateKey.getRevocationCertificate(new Date('2023-01-01'));
      const revocationSig = await openpgp.readSignature({ binarySignature: revocationCertificate });
      const result = await OpenPGPUtils.verifyRevocationCertificate(privateKey, revocationSig, new Date());
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        isValid: true, // Revocation is after the provided date
        revokedKeyFingerprint: privateKey.getFingerprint(),
        invalidReason: ''
      });
    });

    test('verification fails because the certificate creation date is older than the date provided to the function', async () => {
      const [privateKey] = await generateTestKeyPair();
      const revocationCertificate = await privateKey.getRevocationCertificate(new Date('2023-01-01'));
      const revocationSig = await openpgp.readSignature({ binarySignature: revocationCertificate });
      const result = await OpenPGPUtils.verifyRevocationCertificate(privateKey, revocationSig, new Date('2022-12-31'));
      expect(result).toHaveLength(1);
      expect(result[0]?.isValid).toBeFalsy();
      expect(result[0]?.invalidReason).toBe('revocation certificate is not valid at the provided date');
      expect(result[0]?.revokedKeyFingerprint).toBe(privateKey.getFingerprint());
    });

    test('verifies subkey revocation successfully', async () => {
      const [privateKey] = await generateTestKeyPair();
      const revokedSubkey = await privateKey.getSubkeys()[0]!.revoke(privateKey.keyPacket as openpgp.SecretKeyPacket);
      const result = await OpenPGPUtils.verifyRevocationCertificate(privateKey, revokedSubkey.revocationSignatures);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        isValid: true,
        revokedKeyFingerprint: revokedSubkey.getFingerprint(),
        invalidReason: ''
      });
    });

    test('handles verification failure', async () => {
      const [privateKey1] = await generateTestKeyPair();
      const [privateKey2] = await generateTestKeyPair();
      const revoked = await privateKey1.revoke();
      const revocationCertificate = await revoked.getRevocationCertificate();
      const revocationSig = await openpgp.readSignature({ armoredSignature: revocationCertificate });
      const result = await OpenPGPUtils.verifyRevocationCertificate(privateKey2, revocationSig, new Date());

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        isValid: false,
        revokedKeyFingerprint: '',
        invalidReason: 'revocation certificate verification failed'
      });
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

describe('getSubkeyRevocationCertificate', () => {
  test('returns revocation certificate for revoked subkey in armored format', async () => {
    const [privateKey] = await generateTestKeyPair();
    const revocationCert = await OpenPGPUtils.getSubkeyRevocationCertificate(privateKey, privateKey.getSubkeys()[0]!, 'armored');
    const revocationSig = await openpgp.readSignature({ armoredSignature: revocationCert });
    // Verify the revocation certificate
    const verified = await OpenPGPUtils.verifyRevocationCertificate(privateKey, revocationSig);
    expect(verified).toHaveLength(1);
    expect(verified[0]?.isValid).toBe(true);
    expect(verified[0]?.revokedKeyFingerprint).toBe(privateKey.getSubkeys()[0]!.getFingerprint());
    // Apply the revocation to the subkey
    const revoked = await openpgp.revokeKey({key: privateKey, revocationCertificate: revocationCert, format: 'object'});
    const result = await OpenPGPUtils.isSubkeyRevoked(revoked.privateKey.getSubkeys()[0]!, revoked.privateKey);
    expect(result).toBe(true);
  });

  test('returns revocation certificate for revoked subkey in binary format', async () => {
    const [privateKey] = await generateTestKeyPair();
    const revocationCert = await OpenPGPUtils.getSubkeyRevocationCertificate(privateKey, privateKey.getSubkeys()[0]!, 'binary');
    const revokedKey = await openpgp.readKey({ binaryKey: revocationCert });
    
    const revocationSig = await openpgp.readSignature({ binarySignature: revocationCert });
    // Verify the revocation certificate
    const verified = await OpenPGPUtils.verifyRevocationCertificate(privateKey, revocationSig);
    expect(verified).toHaveLength(1);
    expect(verified[0]?.isValid).toBe(true);
    expect(verified[0]?.revokedKeyFingerprint).toBe(privateKey.getSubkeys()[0]!.getFingerprint());
    // Apply the revocation to the subkey
    const revoked = await openpgp.revokeKey({key: privateKey, revocationCertificate: revocationSig.armor(), format: 'object'});
    const result = await OpenPGPUtils.isSubkeyRevoked(revoked.privateKey.getSubkeys()[0]!, revoked.privateKey);
    expect(result).toBe(true);
  });

  test('test with the wrong primary key', async () => {
    const [privateKey1] = await generateTestKeyPair();
    const [privateKey2] = await generateTestKeyPair();
    const revocationCert = await OpenPGPUtils.getSubkeyRevocationCertificate(privateKey1, privateKey1.getSubkeys()[0]!, 'armored');
    expect(async () => {
      await openpgp.revokeKey({key: privateKey2, revocationCertificate: revocationCert, format: 'object'});
    }).rejects.toThrow();
  });
});

describe('Error Classes', () => {
  describe('SubkeyNotFoundError', () => {
    test('creates error with correct message', () => {
      const fingerprint = 'ABC123';
      const error = new SubkeyNotFoundError(fingerprint);
      expect(error.message).toBe(`Subkey with fingerprint ${fingerprint} not found in the provided key`);
      expect(error.name).toBe('SubkeyNotFoundError');
    });
  });

  describe('KeySanitizationError', () => {
    test('creates error with message', () => {
      const message = 'Sanitization failed';
      const error = new KeySanitizationError(message);
      expect(error.message).toBe(message);
      expect(error.name).toBe('KeySanitizationError');
    });

    test('creates error with message and input', () => {
      const message = 'Sanitization failed';
      const input = 'invalid-key';
      const error = new KeySanitizationError(message, input);
      expect(error.message).toBe(message);
    });
  });
});

describe('RevocationVerificationResult Interface', () => {
  test('has correct structure', () => {
    const result: RevocationVerificationResult = {
      isValid: true,
      revokedKeyFingerprint: 'ABC123',
      invalidReason: ''
    };

    expect(result.isValid).toBe(true);
    expect(result.revokedKeyFingerprint).toBe('ABC123');
    expect(result.invalidReason).toBe('');
  });
});