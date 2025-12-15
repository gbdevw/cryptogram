import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService } from 'dexes';
import { createGetPublicKeyCommand } from './getPublicKey';
import { createRegisterCommand } from './register';
import { createAddSubkeyCommand } from './addSubkey';
import { createRevokeCommand } from './revoke';
import { createSyncCommand } from './sync';
import { createGenerateKeyCommand } from './generateKey';

export interface BlockchainCommandsDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

/**
 * Create all blockchain commands as direct subcommands
 */
export function createBlockchainCommands(deps: BlockchainCommandsDeps): Command[] {
  return [
    createGetPublicKeyCommand(deps),
    createRegisterCommand(deps),
    createAddSubkeyCommand(deps),
    createRevokeCommand(deps),
    createSyncCommand(deps),
    createGenerateKeyCommand({ logger: deps.logger }),
  ];
}
