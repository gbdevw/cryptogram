#!/usr/bin/env node

import { argv } from 'process';

function printHelp() {
  console.log('dexes - Cryptogram DEX helper CLI');
  console.log('Usage: dexes <command>');
  console.log('Commands:');
  console.log('  list      List supported DEXes (placeholder)');
  console.log('  version   Print CLI version');
}

async function listDexes() {
  // Placeholder: in the real CLI this would query registries or config
  const known = [
    { id: 'uniswap', description: 'Uniswap-like AMM' },
    { id: 'sushiswap', description: 'SushiSwap-like AMM' },
  ];
  console.log('Known DEXes:');
  for (const d of known) console.log(` - ${d.id}: ${d.description}`);
}

async function main() {
  const cmd = argv[2];
  if (!cmd) return printHelp();
  if (cmd === 'list') return listDexes();
  if (cmd === 'version') {
    // read package.json version
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json');
    console.log(pkg.version);
    return;
  }
  printHelp();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
