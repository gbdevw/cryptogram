import fs from 'fs';
import * as openpgp from 'openpgp';

/**
 * Read input from a file as Buffer (preserves binary data)
 */
export function readInputFromFile(filePath: string): Buffer {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Read input from stdin with timeout
 * Handles both text and binary data by returning Buffer which can be converted to string or used directly
 */
export async function readInputFromStdin(timeoutMs: number = 30000): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const timeout = setTimeout(() => {
      reject(new Error('stdin read timeout'));
    }, timeoutMs);

    // Don't set encoding - keep as Buffer to preserve binary data
    process.stdin.on('readable', () => {
      let chunk: Buffer | null;
      while ((chunk = process.stdin.read()) !== null) {
        chunks.push(chunk);
      }
    });

    process.stdin.on('end', () => {
      clearTimeout(timeout);
      resolve(Buffer.concat(chunks));
    });

    process.stdin.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Try to read a key using armor format first, then binary format
 * @param data Buffer or string containing key data
 * @returns Parsed key object
 */
export async function readKeyData(
  data: Buffer | string
): Promise<openpgp.PublicKey | openpgp.PrivateKey> {
  // Convert to string for armor format attempt
  const dataStr = typeof data === 'string' ? data : data.toString('utf-8');
  
  // Try armor format first (preferred)
  try {
    return await openpgp.readKey({ armoredKey: dataStr });
  } catch (armorError) {
    // Fallback to binary format
    try {
      const binaryData = typeof data === 'string' ? Buffer.from(data, 'binary') : data;
      return await openpgp.readKey({ binaryKey: binaryData });
    } catch (binaryError) {
      throw new Error(
        `Failed to parse key data. ` +
        `Armor format error: ${armorError instanceof Error ? armorError.message : String(armorError)}`
      );
    }
  }
}
