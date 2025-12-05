import { Command } from 'commander';
import { Logger } from 'pino';
import { IWeb3PGPService } from 'dexes';
import { MergedConfig } from '../config/types';

/**
 * Dependencies injected into command handlers
 */
export interface CommandDeps {
  config: MergedConfig;
  logger: Logger;
  service?: IWeb3PGPService; // Optional, created for blockchain commands that need it
}

/**
 * Create a subcommand group for blockchain operations
 */
export function createBlockchainCommandGroup(): Command {
  const group = new Command('blockchain')
    .description('Blockchain operations (register keys, revoke, listen for events)');

  // Commands will be added by caller
  return group;
}

/**
 * Create a subcommand group for configuration operations
 */
export function createConfigurationCommandGroup(): Command {
  const group = new Command('configuration')
    .description('Configuration management (generate, display, validate)');

  // Commands will be added by caller
  return group;
}

/**
 * Helper to format and output JSON to stdout
 */
export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Helper to output error to stderr and exit with code
 */
export function exitWithError(message: string, exitCode: number = 1): never {
  console.error(JSON.stringify({ error: message }, null, 2));
  process.exit(exitCode);
}

/**
 * Mask sensitive data for display (show first 4 and last 4 chars)
 */
export function maskSensitiveData(data: string, showChars: number = 4): string {
  if (data.length <= showChars * 2) return '****';
  return `${data.substring(0, showChars)}...${data.substring(data.length - showChars)}`;
}
