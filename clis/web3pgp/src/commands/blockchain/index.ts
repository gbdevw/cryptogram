import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService } from 'dexes';
import { createGetPublicKeyCommand } from './getPublicKey';
import { createRegisterCommand } from './register';
import { createAddSubkeyCommand } from './addSubkey';
import { createRevokeCommand } from './revoke';
import { createListenCommand } from './listen';

export interface BlockchainCommandsDeps {
  logger: Logger;
  service: IWeb3PGPService;
}

/**
 * Create all blockchain commands as direct subcommands
 * Excludes listen command (to be added later)
 */
export function createBlockchainCommands(deps: BlockchainCommandsDeps): Command[] {
  return [
    createGetPublicKeyCommand(deps),
    createRegisterCommand(deps),
    createAddSubkeyCommand(deps),
    createRevokeCommand(deps),
    // createListenCommand(deps), // TODO: Add listen command later
  ];
}
