import { Command } from 'commander';
import { Logger } from 'pino';
import { createGenerateKeyCommand } from './generateKey';
import { createKeccak256Command } from './keccak256';
import { createTimestampCommand } from './timestamp';
import { createVerifyCommand } from './verify';

export interface BlockchainCommandsDeps {
  logger: Logger;
  web3signService?: any; // Type from SDK
}

/**
 * Create all blockchain commands as direct subcommands
 */
export function createBlockchainCommands(deps: BlockchainCommandsDeps): Command[] {
  return [
    createGenerateKeyCommand({ logger: deps.logger }),
    createKeccak256Command({ logger: deps.logger }),
    ...(deps.web3signService ? [
      createTimestampCommand({ logger: deps.logger, web3signService: deps.web3signService }),
      createVerifyCommand({ logger: deps.logger, web3signService: deps.web3signService })
    ] : []),
  ];
}
