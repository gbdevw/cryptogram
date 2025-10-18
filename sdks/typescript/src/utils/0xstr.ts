import { isHex, pad, padHex } from "viem"

/**
 * Normalize a hex fingerprint into a valid bytes32.
 * Pads left with zeros if it's shorter than 32 bytes.
 * 
 * @param hex The hex string to normalize.
 * @returns The normalized bytes32 hex string.
 * @throws If the input hex string is longer than 32 bytes.
 */
export function toBytes32(hex: `0x${string}`): `0x${string}` {
  if (!isHex(hex, {strict: true}) || hex.length > 66) { // 2 for "0x" + 64 for 32 bytes
    throw new Error(`Hex string too long to fit in bytes32: "${hex}"`)
  }
  return padHex(hex, { dir: "left", size: 32 })
}

/**
 * Converts a hex string to a 0x-prefixed hex string.
 * 
 * @param hexstr The hex string to convert.
 * @returns The 0x-prefixed hex string.
 * @throws If the input is not a valid hex string.
 */
export function to0x(hexstr: string): `0x${string}` {
  const s = hexstr.trim().toLowerCase().startsWith("0x")
    ? hexstr.trim().toLowerCase()
    : ("0x" + hexstr.trim().toLowerCase());
  if (!isHex(s, { strict: true })) {
    throw new Error(`Invalid hex string: "${hexstr}"`);
  }
  return s as `0x${string}`;
}
