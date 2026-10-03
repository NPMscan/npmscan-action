<p align="center">
  <img src="https://npmscan.com/npmscan.icon.darkmode.jpg" width="120" alt="npmscan logo">
</p>

# NPMscan Dependency Check

Flags vulnerable packages, newly added install scripts, and changed package
sources whenever a pull request changes `package.json` or a lockfile.
Posts the result as a PR comment, annotates the changed lines, and fails the
check if anything risky is found. No API key, no account.

📖 **Full documentation:** [npmscan.com/docs/github-action](https://npmscan.com/docs/github-action)

## Usage

Add `.github/workflows/npmscan.yml` to your repo:

```yaml
name: npmscan
on:
  pull_request:
    paths: [package.json, package-lock.json, yarn.lock, pnpm-lock.yaml]
permissions:
  contents: read
  pull-requests: write
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: npmscan/npmscan-action@v1
```

## What it flags

| Finding | Blocks by default | Turn off with |
|---|---|---|
| Known vulnerability (OSV.dev, GitHub Advisories) | any severity | `fail-on-severity: high` (or `critical`, `none`) |
| A dependency gains an install script, or a new dependency has one | yes | `fail-on-install-script: false` |
| Your own root `preinstall` / `install` / `postinstall` / `prepare` script is added or changed | yes | `fail-on-install-script: false` |
| A lockfile entry's tarball URL or integrity hash changes | yes | `fail-on-source-change: false` |
| An `overrides` / `resolutions` entry is added or changed | yes | `fail-on-source-change: false` |

Findings below your thresholds are still reported — they just don't fail the check.

## Inputs

| Input | Default | Description |
|---|---|---|
| `file` | `package-lock.json` | `package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock` or `pnpm-lock.yaml`, relative to the repo root |
| `files` | | Several files, one per line or comma-separated. Overrides `file`. |
| `mode` | `block` | `block` fails the check on findings that meet the thresholds; `warn` only reports |
| `fail-on-severity` | `low` | Lowest severity that blocks: `low`, `moderate`, `high`, `critical`, or `none` |
| `fail-on-install-script` | `true` | Block on new install scripts (see table above) |
| `fail-on-source-change` | `true` | Block on changed tarball sources/integrity and overrides |
| `fail-on-error` | `false` | Fail when the scan itself can't run (npmscan.com unreachable, file over 8 MB). By default this is only a warning, so an outage never blocks your merges. |
| `github-token` | `${{ github.token }}` | Token used to post the PR comment |
| `fail-on-flagged` | `true` | Deprecated: `false` is the same as `mode: warn` |

## Outputs

| Output | Description |
|---|---|
| `flagged-count` | Findings across all scanned files (empty if nothing was scanned) |
| `blocking-count` | Findings that meet the thresholds — these fail the check in `mode: block` |
| `error-count` | Files that could not be scanned |

## Recipes

### Try it without blocking anything

```yaml
      - uses: npmscan/npmscan-action@v1
        with:
          mode: warn
```

The comment shows what *would* have blocked. Switch to `mode: block` when you're happy with it.

### Only block serious vulnerabilities

```yaml
      - uses: npmscan/npmscan-action@v1
        with:
          fail-on-severity: high
```

### Monorepos

```yaml
on:
  pull_request:
    paths: ['**/package.json', '**/package-lock.json']
# ...
      - uses: npmscan/npmscan-action@v1
        with:
          files: |
            package-lock.json
            packages/web/package-lock.json
            packages/api/package-lock.json
```

All files are reported in one PR comment. Files the PR doesn't change are skipped
without an API call. Separate npmscan steps each keep their own comment.

### Dependabot and Renovate PRs

npmscan works as a security reviewer for dependency-bot PRs. Dependabot PRs run
with a read-only token unless the workflow asks for more, so keep the explicit
`permissions` block from the usage example:

```yaml
permissions:
  contents: read
  pull-requests: write
```

Renovate PRs come from a branch in your repo and need nothing extra.

### PRs from forks

Fork PRs get a read-only token, so there is no PR comment — the full report is in
the job summary, and findings still appear as annotations and fail the check.

## What leaves your runner

Only the dependency file being scanned — its version on the PR's base branch and
its version in the PR — is sent to `https://npmscan.com/api/analysis/dependency-diff`.
No source code, secrets or other files. The files are processed for the comparison
and not stored. The API is limited to 30 requests per minute per IP and 8 MB per file.

Powered by [npmscan.com](https://npmscan.com) · [Docs](https://npmscan.com/docs/github-action)
