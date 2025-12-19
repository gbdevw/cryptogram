/**
 * Early setup module that runs before any other code
 * Patches console methods to capture SDK logs
 */

// Store references to original methods
const originalConsoleDebug = console.debug;
const originalConsoleWarn = console.warn;

// Track if logger has been setup
let loggerRef: any = null;

/**
 * Initialize console patching with a logger
 * Call this as soon as the logger is created
 */
export function initializeConsolePatch(logger: any): void {
  loggerRef = logger;

  console.debug = function (...args: unknown[]) {
    if (loggerRef) {
      const message = args.map(arg =>
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      loggerRef.debug(message);
    } else {
      originalConsoleDebug.apply(console, args);
    }
  };

  console.warn = function (...args: unknown[]) {
    if (loggerRef) {
      const message = args.map(arg =>
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      loggerRef.warn(message);
    } else {
      originalConsoleWarn.apply(console, args);
    }
  };
}

/**
 * Restore console methods to originals
 */
export function restoreConsole(): void {
  console.debug = originalConsoleDebug;
  console.warn = originalConsoleWarn;
}
