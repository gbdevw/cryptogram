import { Command } from 'commander';
import { Logger } from 'pino';
import { createRootLogger } from '../../utils/logger';
import { createConfigDisplayCommand } from './display';

/**
 * Create all configuration commands and add them to a group
 */
export function createConfigurationCommands(): Command {
  const logger = createRootLogger('info');
  const group = new Command('configuration').description('Configuration management (generate, display, validate)');

  // Add display command
  group.addCommand(createConfigDisplayCommand({ logger }));

  return group;
}
