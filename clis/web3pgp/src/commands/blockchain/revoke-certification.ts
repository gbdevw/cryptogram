import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService, to0x, toBytes32 } from '@cryptogram/dexes';
import * as openpgp from 'openpgp';
import { outputJson, exitWithError } from '../factory';
import { readInputFromFile, readInputFromStdin, readKeyData } from '../../utils/input';

export interface RevokeCertificationDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

/**
 * Revoke a certification on the blockchain
 * Usage: web3pgp revoke-certification <issuerFingerprint> --key <path> | read from stdin
 */
export function createRevokeCertificationCommand(deps: RevokeCertificationDeps): Command {
  const { logger, service } = deps;
  const cmdLogger = logger.child({ command: 'revoke-certification' });

  return new Command('revoke-certification')
    .description('Revoke an issued key certification on the blockchain')
    .argument('<issuerFingerprint>', 'Hex string fingerprint of the issuer')
    .option('--key <path>', 'Path to PGP public key file to revoke certification (armored or binary)')
    .action(async (issuerFingerprint: string, options: { key?: string }) => {
      try {
        // Convert issuer fingerprint to bytes32 format
        const issuerFp = toBytes32(to0x(issuerFingerprint.replaceAll(/\s/g, '')));
        cmdLogger.info({ issuerFp }, 'Fetching issuer public key');

        let keyData: Buffer | string;

        // Determine source and read input
        if (options.key) {
          cmdLogger.info({ path: options.key }, 'Reading PGP key to revoke certification from file');
          keyData = readInputFromFile(options.key);
        } else {
          cmdLogger.info('Reading PGP key to revoke certification from stdin');
          keyData = await readInputFromStdin();
        }

        cmdLogger.debug({ dataLength: keyData.length }, 'Key data received');

        // Parse key - tries armor format first, then binary
        cmdLogger.info('Parsing and validating PGP key');
        const certifiedKey = (await readKeyData(keyData)) as openpgp.PublicKey;

        cmdLogger.debug(
          { fingerprint: certifiedKey.getFingerprint() },
          'Key parsed successfully'
        );

        // Fetch issuer's public key from blockchain
        const issuerPk = await service.getPublicKey(issuerFp);
        cmdLogger.debug(
          { issuerFingerprint: issuerPk.getFingerprint() },
          'Issuer public key retrieved'
        );

        // Revoke certification on the blockchain
        const result = await service.revokeCertification(issuerPk, certifiedKey);

        cmdLogger.info(
          {
            issuerFingerprint: issuerPk.getFingerprint(),
            certifiedFingerprint: certifiedKey.getFingerprint(),
            transactionHash: result.transactionHash,
            blockNumber: result.blockNumber,
          },
          'Certification revocation successful'
        );

        // Output result as JSON
        outputJson({
          success: true,
          message: 'Certification revoked successfully',
          issuer: {
            fingerprint: issuerFp,
          },
          certified: {
            fingerprint: certifiedKey.getFingerprint(),
            subkeys: certifiedKey.getSubkeys().map((sk) => sk.getFingerprint()),
          },
          transaction: {
            hash: result.transactionHash,
            blockNumber: result.blockNumber.toString(),
          },
        });

        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to revoke certification');
        exitWithError(msg);
      }
    });
}
