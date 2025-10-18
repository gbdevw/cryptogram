# CI / Security checks — Local run & interpretation

This document explains how to run the repository's CI/security checks locally, where the reports live, and how to validate the pipeline behaviour before pushing changes.

## Quick overview
- CI workflow: `.github/workflows/ci.yml` — path-aware, runs lint, tests, secret scans, Slither and CodeQL (nightly/full).
- Pre-commit: `.pre-commit-config.yaml` (detect-secrets + basic hygiene).
- Dependabot: `.github/dependabot.yml` keeps dependencies updated weekly.

## Run the same checks locally (commands)

NOTE: Commands assume a Linux/macOS environment and standard tools installed (curl, python3, node/npm). Adjust for your platform.

1) Linters & JS/TS checks

```bash
# from repo root
# install deps (if present)
npm ci
# run lint and typecheck (where configured)
npm run lint --if-present
npm run test --if-present
npx tsc --noEmit --project tsconfig.json || true
```

2) Foundry (Solidity) build & tests

```bash
# install foundry (if not installed)
curl -L https://foundry.paradigm.xyz | bash
source $HOME/.bashrc || true
foundryup
# build and run tests
cd contracts
forge build
forge test -v
# run coverage (slow)
forge coverage --report summary
```

3) Secret scan (gitleaks)

```bash
# install gitleaks (or use the binary from releases)
curl -sSfL https://raw.githubusercontent.com/zricethezav/gitleaks/master/install.sh | bash
# run detector
gitleaks detect --source . --report-path gitleaks-report.json
# view results
jq . gitleaks-report.json
```

4) Slither (Solidity SAST)

```bash
# Install (python/pip)
pip3 install slither-analyzer
# run slither from repo root
slither contracts/src --json contracts/.slither-report.json || true
# view summary / open JSON
jq . contracts/.slither-report.json
```

5) CodeQL (quick local checks)

CodeQL is more convenient via GitHub Actions. Running CodeQL locally requires installing the CodeQL CLI and database. See: https://codeql.github.com/docs.

## Interpreting reports

- gitleaks JSON keys: `description`, `rule`, `offender`, `file`, `line` — treat any finding as a potential secret and rotate/expunge if confirmed.
- Slither JSON: look for `severity` and `check` fields. Prioritize `high`/`critical` issues. Many low-confidence findings can be moved to nightly/triage.
- Coverage (lcov / forge coverage): `contracts/lcov.info` and coverage summary printed by `forge coverage`. Use these to find untested branches.
- CodeQL: review the results in the CodeQL Alerts tab on GitHub; locally it's less straightforward.

## Testing pipeline correctness (how to validate CI behavior)

1) Run checks locally (fast feedback)

- Run the exact commands above to validate each tool locally. This verifies the toolchain and report formats.

2) Use `act` to run workflows locally (optional)

`act` (https://github.com/nektos/act) lets you run GitHub Actions jobs locally. Install `act` and then run a job. Example:

```bash
# install act (homebrew / binary)
# run the default workflow for a pull_request event
act pull_request -j filter --env GITHUB_TOKEN=xxxxx
# or run a full workflow locally (may need docker)
act -j contracts-build
```

Notes:
- `act` has some differences and may require adjusting the workflow (e.g., using smaller runners or installing missing tools inside the job). Use it for quick validation, not perfect parity.

3) Test on a branch/PR (recommended)

- Create a feature branch and make a small change that should only trigger some jobs (for example, update a file in `sdks/` to trigger only JS jobs).
- Push the branch and open a Pull Request. Inspect the `Actions` tab and confirm only the relevant jobs ran (the `filter` job in CI sets conditional outputs).

4) Force-run jobs on GitHub

- For workflows that run on `push`/`pull_request`, you can also add a temporary commit that touches files in the path group you want to trigger. Example: commit an empty change to `contracts/` to trigger contract jobs.

5) Nightly / heavy jobs

- The `security-full` job runs on schedule or on `main`. To validate it without waiting, merge a test branch to `main` in a non-production copy of the repo, or add a temporary `workflow_dispatch` trigger to run it manually (remove after testing).

## Triage guidance

- High/critical secret or SAST findings: block merge, rotate secrets immediately, and follow the incident runbook.
- Medium/low findings: create an issue and assign to the security maintainer. Tune rules to avoid noisy failures on PRs.

## detect-secrets pre-commit baseline (audit & update)

This repository uses `detect-secrets` via `.pre-commit-config.yaml` to block commits that introduce high-confidence secrets. The pre-commit hook uses the `.secrets.baseline` file to record known/allowed findings.

How to audit and update the baseline:

1. Run a fresh scan and audit interactive prompts:

```bash
python3 -m pip install --user detect-secrets
detect-secrets scan > .secrets.baseline.new
detect-secrets audit .secrets.baseline.new
# inspect and confirm, then move into place:
mv .secrets.baseline.new .secrets.baseline
git add .secrets.baseline && git commit -m "chore(secrets): update detect-secrets baseline"
```

2. Or use the helper script `scripts/audit-secrets.sh` which runs the scan and prints next steps.

Notes:
- Only add findings to the baseline after manually confirming they are not real secrets (e.g., test fixtures, intentionally included keys).
- If you accidentally commit a secret, rotate it immediately and follow the incident runbook.

## Additions / next steps

- If you'd like, I can add a `workflow_dispatch` entry to the daily security workflow for manual trigger. I can also add a short `scripts/ci-local.sh` to wrap the above local commands for convenience.

---
If you want, I can now add the optional `workflow_dispatch` trigger to the security job and create a small `scripts/ci-local.sh` helper to run local checks in a single command. Which would you prefer?
