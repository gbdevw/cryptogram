#!/usr/bin/env bash
set -euo pipefail

# Run detect-secrets scan and produce a new baseline for interactive audit.
# Usage: ./scripts/audit-secrets.sh

if ! command -v detect-secrets >/dev/null 2>&1; then
  echo "detect-secrets not found. Installing to user site-packages..."
  python3 -m pip install --user detect-secrets
  export PATH="$HOME/.local/bin:$PATH"
fi

OUT=.secrets.baseline.new
echo "Scanning repository for secrets..."
detect-secrets scan > "$OUT"

echo "Baseline written to $OUT"

echo "Run 'detect-secrets audit $OUT' to interactively review findings."
echo "If you accept the baseline, move it into place with: mv $OUT .secrets.baseline"

echo "Done."
