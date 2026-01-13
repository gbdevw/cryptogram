import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService } from '@cryptogram/dexes';
import { createGetPublicKeyCommand } from './getPublicKey';
import { createRegisterCommand } from './register';
import { createAddSubkeyCommand } from './addSubkey';
import { createRevokeCommand } from './revoke';
import { createSyncCommand } from './sync';
import { createGenerateKeyCommand } from './generateKey';
import { createUpdateCommand } from './update';
import { createCertifyCommand } from './certify';
import { createRevokeCertificationCommand } from './revoke-certification';
import { createChallengeCommand } from './challenge';
import { createProveCommand } from './prove';

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
    createUpdateCommand(deps),
    createAddSubkeyCommand(deps),
    createRevokeCommand(deps),
    createCertifyCommand(deps),
    createRevokeCertificationCommand(deps),
    createSyncCommand(deps),
    createGenerateKeyCommand({ logger: deps.logger }),
    createChallengeCommand(deps),
    createProveCommand(deps),
  ];
}
