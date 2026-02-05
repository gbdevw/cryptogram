#!/bin/bash
# Run integration tests one file at a time to avoid Anvil timeout during compilation

set -e

echo "=========================================="
echo "Running Integration Tests (One at a Time)"
echo "=========================================="

TEST_FILES=(
  "__tests__/web3sign.integration.test.ts"
  "__tests__/web3pgp.integration.test.ts"
  "__tests__/web3pgp.service.integration.test.ts"
)

TOTAL_PASSED=0
TOTAL_FAILED=0

for TEST_FILE in "${TEST_FILES[@]}"; do
  echo ""
  echo "=========================================="
  echo "Running: $TEST_FILE"
  echo "=========================================="
  
  if node scripts/test-orchestrator.js -- --testPathPatterns="${TEST_FILE##*/__tests__/}" 2>&1 | tail -20; then
    TOTAL_PASSED=$((TOTAL_PASSED + 1))
  else
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
  fi
done

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "Passed: $TOTAL_PASSED"
echo "Failed: $TOTAL_FAILED"
echo "=========================================="

exit $TOTAL_FAILED
