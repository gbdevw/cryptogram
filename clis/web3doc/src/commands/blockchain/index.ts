import { Command } from 'commander';
import { Logger } from 'pino';
import { createGenerateKeyCommand } from './generateKey';
import { createKeccak256Command } from './keccak256';

export interface BlockchainCommandsDeps {
  logger: Logger;
}

/**
 * Create all blockchain commands as direct subcommands
 */
export function createBlockchainCommands(deps: BlockchainCommandsDeps): Command[] {
  return [
    createGenerateKeyCommand({ logger: deps.logger }),
    createKeccak256Command({ logger: deps.logger }),
  ];
}
