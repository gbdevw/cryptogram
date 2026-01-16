#!/bin/bash
set -e

echo "🚀 Preparing Cryptogram packages for npm publication v0.0.0"
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Update SDK version
echo -e "${YELLOW}Step 1: Updating SDK version${NC}"
node -e "
const fs = require('fs');
const file = 'sdks/typescript/package.json';
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.version = '0.0.0';
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log('  ✓ SDK version updated to 0.0.0');
"
echo ""

# Step 2: Update web3doc-cli
echo -e "${YELLOW}Step 2: Updating web3doc-cli version and dependencies${NC}"
node -e "
const fs = require('fs');
const file = 'clis/web3doc/package.json';
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.version = '0.0.0';
pkg.dependencies['@cryptogram/dexes'] = '0.0.0';
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log('  ✓ web3doc-cli version and dependencies updated');
"
echo ""

# Step 3: Update web3pgp-cli
echo -e "${YELLOW}Step 3: Updating web3pgp-cli version and dependencies${NC}"
node -e "
const fs = require('fs');
const file = 'clis/web3pgp/package.json';
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.version = '0.0.0';
pkg.dependencies['@cryptogram/dexes'] = '0.0.0';
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
console.log('  ✓ web3pgp-cli version and dependencies updated');
"
echo ""

# Step 4: Build all packages
echo -e "${YELLOW}Step 4: Building packages${NC}"
echo "  Building SDK..."
cd sdks/typescript
npm run build > /dev/null 2>&1
echo -e "    ${GREEN}✓ SDK built${NC}"
cd - > /dev/null

echo "  Building web3doc-cli..."
cd clis/web3doc
npm run build > /dev/null 2>&1
echo -e "    ${GREEN}✓ web3doc-cli built${NC}"
cd - > /dev/null

echo "  Building web3pgp-cli..."
cd clis/web3pgp
npm run build > /dev/null 2>&1
echo -e "    ${GREEN}✓ web3pgp-cli built${NC}"
cd - > /dev/null
echo ""

# Step 5: Verification
echo -e "${YELLOW}Step 5: Verification${NC}"
echo "  Verifying versions..."

SDK_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('sdks/typescript/package.json')).version)")
WEB3DOC_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('clis/web3doc/package.json')).version)")
WEB3PGP_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('clis/web3pgp/package.json')).version)")

if [ "$SDK_VERSION" = "0.0.0" ]; then
  echo -e "    ${GREEN}✓ SDK version: 0.0.0${NC}"
else
  echo -e "    ${RED}✗ SDK version mismatch${NC}"
  exit 1
fi

if [ "$WEB3DOC_VERSION" = "0.0.0" ]; then
  echo -e "    ${GREEN}✓ web3doc-cli version: 0.0.0${NC}"
else
  echo -e "    ${RED}✗ web3doc-cli version mismatch${NC}"
  exit 1
fi

if [ "$WEB3PGP_VERSION" = "0.0.0" ]; then
  echo -e "    ${GREEN}✓ web3pgp-cli version: 0.0.0${NC}"
else
  echo -e "    ${RED}✗ web3pgp-cli version mismatch${NC}"
  exit 1
fi

echo "  Verifying dependencies..."
WEB3DOC_DEP=$(node -e "console.log(JSON.parse(require('fs').readFileSync('clis/web3doc/package.json')).dependencies['@cryptogram/dexes'])")
WEB3PGP_DEP=$(node -e "console.log(JSON.parse(require('fs').readFileSync('clis/web3pgp/package.json')).dependencies['@cryptogram/dexes'])")

if [ "$WEB3DOC_DEP" = "0.0.0" ]; then
  echo -e "    ${GREEN}✓ web3doc-cli dependency: @cryptogram/dexes@0.0.0${NC}"
else
  echo -e "    ${RED}✗ web3doc-cli dependency not updated${NC}"
  exit 1
fi

if [ "$WEB3PGP_DEP" = "0.0.0" ]; then
  echo -e "    ${GREEN}✓ web3pgp-cli dependency: @cryptogram/dexes@0.0.0${NC}"
else
  echo -e "    ${RED}✗ web3pgp-cli dependency not updated${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ All packages are ready for npm publication!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Verify the changes:"
echo "   git diff sdks/typescript/package.json"
echo "   git diff clis/web3doc/package.json"
echo "   git diff clis/web3pgp/package.json"
echo ""
echo "2. Commit the changes:"
echo "   git add sdks/typescript/package.json clis/web3doc/package.json clis/web3pgp/package.json"
echo "   git commit -m 'chore: prepare v0.0.0 for npm publication'"
echo ""
echo "3. Login to npm:"
echo "   npm login"
echo ""
echo "4. Publish in order:"
echo "   cd sdks/typescript && npm publish"
echo "   # Wait 1-2 minutes"
echo "   cd ../../clis/web3doc && npm publish"
echo "   cd ../web3pgp && npm publish"
echo ""
