import pino, { Logger as PinoLogger } from 'pino';
import { LogLevel } from '../types';

/**
 * Create root logger for the CLI
 */
export function createRootLogger(level: LogLevel = 'info'): PinoLogger {
  return pino({
    level,
    transport: {
      target: 'pino/file',
      options: {
        destination: 2, // stderr (fd 2)
        sync: false,
      },
    },
  });
}

/**
 * Create child logger with additional context
 */
export function createChildLogger(
  parent: PinoLogger,
  context: Record<string, unknown>
): PinoLogger {
  return parent.child(context);
}

export type Logger = PinoLogger;
