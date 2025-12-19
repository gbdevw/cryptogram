import { Command } from 'commander';
import { createRootLogger } from '../../utils/logger';
import { createConfigDisplayCommand } from './display';
import { createConfigGenerateCommand } from './generate';
import { createConfigValidateCommand } from './validate';

/**
 * Create all configuration commands and add them to a group
 */
export function createConfigurationCommands(): Command {
  const logger = createRootLogger('info');
  const group = new Command('configuration').description('Configuration management (generate, display, validate)');

  // Add configuration commands
  group.addCommand(createConfigDisplayCommand({ logger }));
  group.addCommand(createConfigGenerateCommand({ logger }));
  group.addCommand(createConfigValidateCommand({ logger }));

  return group;
}
