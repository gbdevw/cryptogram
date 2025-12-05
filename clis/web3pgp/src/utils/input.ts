import fs from 'fs';

/**
 * Read input from a file
 */
export function readInputFromFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Read input from stdin with timeout
 */
export async function readInputFromStdin(timeoutMs: number = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';

    const timeout = setTimeout(() => {
      reject(new Error('stdin read timeout'));
    }, timeoutMs);

    process.stdin.setEncoding('utf-8');
    process.stdin.on('readable', () => {
      let chunk: string | null;
      while ((chunk = process.stdin.read()) !== null) {
        data += chunk;
      }
    });

    process.stdin.on('end', () => {
      clearTimeout(timeout);
      resolve(data);
    });

    process.stdin.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}
