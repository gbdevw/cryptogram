import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService, to0x, toBytes32 } from '@jibidieuw/dexes';
import { toHex } from 'viem';
import { outputJson, exitWithError } from '../factory';

export interface ChallengeDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

/**
 * Challenge the ownership of a key on the blockchain
 * Usage: web3pgp challenge <fingerprint> <hash>
 */
export function createChallengeCommand(deps: ChallengeDeps): Command {
  const { logger, service } = deps;
  const cmdLogger = logger.child({ command: 'challenge' });

  return new Command('challenge')
    .description('Challenge the owner of the target key to sign the bytes of the keccak256 hash of a random challenge on the blockchain')
    .argument('<fingerprint>', 'Hex string fingerprint of the challenged key')
    .argument('<hash>', 'Keccak256 hash of the challenge as hex string')
    .action(async (fingerprint: string, hash: string) => {
      try {
        // Process fingerprint - remove whitespaces and convert to bytes32
        const fp = toBytes32(to0x(fingerprint.replaceAll(/\s/g, '')));
        cmdLogger.debug({ fingerprint: fp }, 'Fingerprint processed');

        // Process hash - convert hex string to proper format
        const challengeHash = toHex(hash);
        cmdLogger.debug({ hash: challengeHash }, 'Challenge hash processed');

        cmdLogger.info(
          {
            fingerprint: fp,
            hash: challengeHash,
          },
          'Submitting challenge'
        );

        // Challenge the ownership on the blockchain
        const result = await service.challengeOwnership(fp, challengeHash);

        cmdLogger.info(
          {
            fingerprint: fp,
            transactionHash: result.transactionHash,
            blockNumber: result.blockNumber,
          },
          'Key ownership challenge submitted successfully'
        );

        // Output result as JSON
        outputJson({
          success: true,
          message: 'Key ownership challenge submitted successfully',
          fingerprint: fp,
          hash: challengeHash,
          transaction: {
            hash: result.transactionHash,
            blockNumber: result.blockNumber.toString(),
          },
        });

        process.exit(0);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        cmdLogger.error({ error: msg }, 'Failed to submit challenge');
        exitWithError(msg);
      }
    });
}
