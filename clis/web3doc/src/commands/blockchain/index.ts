import { Command } from 'commander';
import { Logger } from 'pino';
import { createGenerateKeyCommand } from './generateKey';
import { createKeccak256Command } from './keccak256';
import { createTimestampCommand } from './timestamp';
import { createVerifyCommand } from './verify';

export interface BlockchainCommandsDeps {
  logger: Logger;
  web3docService?: any; // Type from SDK
}

/**
 * Create all blockchain commands as direct subcommands
 */
export function createBlockchainCommands(deps: BlockchainCommandsDeps): Command[] {
  return [
    createGenerateKeyCommand({ logger: deps.logger }),
    createKeccak256Command({ logger: deps.logger }),
    ...(deps.web3docService ? [
      createTimestampCommand({ logger: deps.logger, web3docService: deps.web3docService }),
      createVerifyCommand({ logger: deps.logger, web3docService: deps.web3docService })
    ] : []),
  ];
}
