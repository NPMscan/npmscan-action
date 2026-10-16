# Action runtime

These two files are the whole of `NPMscan/npmscan-action`. [`action.yml`](../action.yml) has one composite step that runs `scan.sh`. Nothing is built or downloaded: bash, jq, git, curl and gh are already on GitHub's runners.

Outreach tooling doesn't belong here. It lives in [`outreach/scripts/`](../outreach/scripts/README.md).

| File | Job |
|---|---|
| [`scan.sh`](scan.sh) | Validates inputs, gets the base version of each dependency file, calls the npmscan API, then writes outputs, annotations, the job summary and the PR comment, and sets the exit code |
| [`render.jq`](render.jq) | A pure function: turns the per-file API results into counts, findings, the markdown report and annotation records. It does no I/O |

## How a run works

```
action.yml inputs ──env──▶ scan.sh
  1. parse INPUT_* (mode, fail-on-*, file/files) and fail fast on bad config
  2. for each file: before = git show $BASE_SHA:file (or an empty placeholder if the PR adds it)
                    after  = working tree
                    skip if unchanged, error if > 8 MB
                    POST {before, after} → https://npmscan.com/api/analysis/dependency-diff
                    append {file, status, isNew, reason, result} to entries.jsonl
  3. jq -s -f render.jq entries.jsonl  →  report.json {scanned, errors, flagged, blocking, markdown, annotations}
  4. GITHUB_OUTPUT: flagged-count, blocking-count, error-count
  5. ::warning / ::error annotations, placed on the lockfile line where possible (find_line)
  6. job summary, plus one PR comment that's edited in place (found by an HTML marker that includes the file list)
  7. exit 1 only if mode=block and blocking > 0, or fail-on-error=true and the scan errored
```

Supported files: `package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock` (v1 and berry) and `pnpm-lock.yaml`. Bun lockfiles aren't supported. The npmscan.com API does the parsing; this code only picks the "empty before" placeholder per format (`placeholder()` in `scan.sh`).

### What counts as a finding (render.jq `package_findings`)

| Signal | API field | Blocks when |
|---|---|---|
| Known vulnerability | `isVulnerable`, `highestSeverity` | severity ≥ `fail-on-severity` |
| Malware | a `vulnerabilities[].isMalware` | always, whatever the severity threshold |
| Install script | `installScriptIntroduced`, or a new package with `hasInstallScript` | `fail-on-install-script` |
| Source change | `sourceIntegrityChanged` or `identityMismatch` | `fail-on-source-change` |
| Root lifecycle script changes | `projectLifecycleChanges` | `fail-on-install-script` |
| `overrides` / `resolutions` changes | `overridesChanges` | `fail-on-source-change` |

A finding is **blocking** if it meets those thresholds. It only fails the check in `mode: block`; in `mode: warn` the same findings are reported as "would block".

## Working on it

```bash
tests/run.sh                 # offline suite: throwaway git repos, gh/curl stubbed (tests/stubs), real API fixtures (tests/fixtures)
LIVE=1 tests/run.sh          # also one call to the real npmscan.com API
shellcheck scripts/scan.sh tests/run.sh tests/stubs/*
actionlint
```

Test cases are `t "description"` blocks in [`tests/run.sh`](../tests/run.sh). `run_scan VAR=value...` runs `scan.sh` and sets `OUT`, `CODE`, `OUTPUT`, `SUMMARY`, `COMMENT` and `GHLOG` for assertions. To add an API case, capture a real response into `tests/fixtures/` (the command is in [CONTRIBUTING.md](../CONTRIBUTING.md#writing-a-change)). Don't hand-write fixtures.

CI ([`.github/workflows/test.yml`](../.github/workflows/test.yml)) runs the suite on Ubuntu and macOS, shellcheck and actionlint, plus an e2e job that runs `uses: ./` on the PR itself with a deliberately vulnerable `tests/e2e/package.json`.

### Rules

- **bash 3.2:** macOS runners and local dev use it. No associative arrays, `mapfile`, `${var,,}` or `|&`.
- **No new dependencies or network calls** beyond the npmscan API and the GitHub API. The point is that anyone can audit the action in a few minutes.
- **Untrusted input:** package names, versions, script bodies and URLs all come from the PR.
  - In jq, pass them through `clean`, `code`, `prose` or `link` before they reach markdown.
  - In bash, pass them through `esc_data`/`esc_prop` before they reach a `::workflow command::`.
  - Links are only rendered to `https://npmscan.com/...`.
- **Keep `render.jq` pure.** All I/O stays in `scan.sh`, so new behaviour can be tested from fixtures.
- **Output contract:** `flagged-count` stays empty when nothing was scanned (documented). There is one comment per step (the marker includes the file list). The table shows at most 50 packages per file, and `scan.sh` truncates the comment at 60,000 characters as a backstop.
- If you change an input or output, update `action.yml`, the inputs table in the root [`README.md`](../README.md) and npmscan.com/docs/github-action.

### Releasing

Follow [CONTRIBUTING.md → Releases](../CONTRIBUTING.md#releases-maintainers): tag `v1.x.y`, move `v1`, then publish the GitHub Release to the Marketplace. Outreach PRs pin the action by commit SHA (`actionSha` in [`outreach/scripts/lib/config.ts`](../outreach/scripts/lib/config.ts)). Bump it there after a release so new outreach PRs use it.
