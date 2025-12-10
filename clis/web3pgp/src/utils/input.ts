import fs from 'fs';
import * as openpgp from 'openpgp';

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

/**
 * Try to read a key in armored format first, then binary format
 * Returns the parsed key object
 */
export async function readKeyData(
  data: string
): Promise<openpgp.PublicKey | openpgp.PrivateKey> {
  // Try armored format first
  try {
    return await openpgp.readKey({ armoredKey: data });
  } catch (armoredError) {
    // If armored fails, try binary format
    try {
      const binaryData = Buffer.from(data, 'binary');
      return await openpgp.readKey({ binaryKey: binaryData });
    } catch (binaryError) {
      // Both formats failed, throw a helpful error
      throw new Error(
        `Failed to parse key data as either armored or binary format. ` +
        `Armored error: ${armoredError instanceof Error ? armoredError.message : String(armoredError)}`
      );
    }
  }
}
