import { Command } from 'commander';
import { Logger } from 'pino';
import { createGenerateKeyCommand } from './generateKey';

export interface BlockchainCommandsDeps {
  logger: Logger;
}

/**
 * Create all blockchain commands as direct subcommands
 */
export function createBlockchainCommands(deps: BlockchainCommandsDeps): Command[] {
  return [
    createGenerateKeyCommand({ logger: deps.logger }),
  ];
}
