#!/bin/bash
set -e

echo "🔄 Renaming packages to @jibidieuw scope"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Update SDK name
echo -e "${YELLOW}Step 1: Updating SDK package name${NC}"
node -e "
const fs = require('fs');
const file = 'sdks/typescript/package.json';
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.name = '@jibidieuw/dexes';
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log('  ✓ SDK renamed to @jibidieuw/dexes');
"
echo ""

# Step 2: Update web3doc-cli name and dependency
echo -e "${YELLOW}Step 2: Updating web3doc-cli package name and dependencies${NC}"
node -e "
const fs = require('fs');
const file = 'clis/web3doc/package.json';
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.name = '@jibidieuw/web3doc-cli';
pkg.dependencies['@cryptogram/dexes'] = '@jibidieuw/dexes';
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log('  ✓ web3doc-cli renamed to @jibidieuw/web3doc-cli');
console.log('  ✓ dependency updated to @jibidieuw/dexes');
"
echo ""

# Step 3: Update web3pgp-cli name and dependency
echo -e "${YELLOW}Step 3: Updating web3pgp-cli package name and dependencies${NC}"
node -e "
const fs = require('fs');
const file = 'clis/web3pgp/package.json';
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.name = '@jibidieuw/web3pgp-cli';
pkg.dependencies['@cryptogram/dexes'] = '@jibidieuw/dexes';
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log('  ✓ web3pgp-cli renamed to @jibidieuw/web3pgp-cli');
console.log('  ✓ dependency updated to @jibidieuw/dexes');
"
echo ""

# Step 4: Verification
echo -e "${YELLOW}Step 4: Verification${NC}"
SDK_NAME=$(node -e "console.log(JSON.parse(require('fs').readFileSync('sdks/typescript/package.json')).name)")
WEB3DOC_NAME=$(node -e "console.log(JSON.parse(require('fs').readFileSync('clis/web3doc/package.json')).name)")
WEB3PGP_NAME=$(node -e "console.log(JSON.parse(require('fs').readFileSync('clis/web3pgp/package.json')).name)")

echo "  Package names:"
echo -e "    ${GREEN}✓${NC} SDK: $SDK_NAME"
echo -e "    ${GREEN}✓${NC} web3doc-cli: $WEB3DOC_NAME"
echo -e "    ${GREEN}✓${NC} web3pgp-cli: $WEB3PGP_NAME"

WEB3DOC_DEP=$(node -e "console.log(JSON.parse(require('fs').readFileSync('clis/web3doc/package.json')).dependencies['@jibidieuw/dexes'])")
WEB3PGP_DEP=$(node -e "console.log(JSON.parse(require('fs').readFileSync('clis/web3pgp/package.json')).dependencies['@jibidieuw/dexes'])")

echo "  Dependencies:"
echo -e "    ${GREEN}✓${NC} web3doc-cli: @jibidieuw/dexes@$WEB3DOC_DEP"
echo -e "    ${GREEN}✓${NC} web3pgp-cli: @jibidieuw/dexes@$WEB3PGP_DEP"

echo ""
echo -e "${GREEN}✅ All packages renamed to @jibidieuw scope!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify the changes:"
echo "   git diff sdks/typescript/package.json"
echo "   git diff clis/web3doc/package.json"
echo "   git diff clis/web3pgp/package.json"
echo ""
echo "2. Commit the changes:"
echo "   git add sdks/typescript/package.json clis/web3doc/package.json clis/web3pgp/package.json"
echo "   git commit -m 'chore: rename packages to @jibidieuw scope'"
echo ""
echo "3. Publish in order:"
echo "   cd sdks/typescript && npm publish"
echo "   # Wait 1-2 minutes"
echo "   cd ../../clis/web3doc && npm publish"
echo "   cd ../web3pgp && npm publish"
echo ""
