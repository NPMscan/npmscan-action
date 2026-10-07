<p align="center">
  <img src="https://npmscan.com/npmscan.icon.darkmode.jpg" width="120" alt="npmscan logo">
</p>

<h1 align="center">npmscan Dependency Check</h1>

<p align="center">
  <strong>Catch risky npm dependency changes before they merge.</strong><br>
  No API key · No account · Free, including private repos
</p>

<p align="center">
  <a href="https://github.com/NPMscan/npmscan-action/actions/workflows/test.yml"><img src="https://github.com/NPMscan/npmscan-action/actions/workflows/test.yml/badge.svg" alt="test"></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/NPMscan/npmscan-action"><img src="https://api.scorecard.dev/projects/github.com/NPMscan/npmscan-action/badge" alt="OpenSSF Scorecard"></a>
  <a href="https://github.com/marketplace/actions/npmscan-dependency-check"><img src="https://img.shields.io/badge/marketplace-npmscan-blue?logo=github" alt="GitHub Marketplace"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License"></a>
</p>

<p align="center">
  📖 <a href="https://npmscan.com/docs/github-action"><strong>Documentation</strong></a>
</p>

---

Every pull request that changes `package.json` or a lockfile is checked for:

- **Known vulnerabilities and known malware** from OSV.dev and GitHub Advisories
- **New install scripts**: a dependency that suddenly runs code on `npm install`, the usual sign of a hijacked package
- **Repointed lockfile entries**: the same version now downloading a different tarball, an entry whose tarball is actually a different package, or an upgrade that switches to an unknown server. CVE scanners don't check for this.
- **Changes to your own install scripts and overrides**, which can run code or force a version without touching the dependency list

npmscan posts one PR comment, marks each finding on its line in **Files changed**, and fails the check when something meets your thresholds.

## Quick start

Add `.github/workflows/npmscan.yml`:

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

That's it. Using pnpm or Yarn? Add `with: { file: pnpm-lock.yaml }` (or `yarn.lock`).
Want to try it before it blocks anything? Add `with: { mode: warn }`.

## What the PR comment looks like

A real comment from a PR that downgrades `lodash` to a vulnerable version (here in `mode: warn`):

<p align="center">
  <img src="https://raw.githubusercontent.com/NPMscan/npmscan-action/main/.github/assets/pr-comment.png" alt="npmscan PR comment flagging lodash 4.17.15 with a HIGH severity vulnerability" width="760">
</p>

The comment is edited in place on every push, and the same report goes to the job summary.

## What it flags

| Finding | Blocks by default | To stop it blocking |
|---|---|---|
| Known malware (a malicious-package advisory) | always | only `mode: warn` |
| Known vulnerability | any severity | `fail-on-severity: high` (or `critical`, `none`) |
| A dependency gains a `preinstall` / `install` / `postinstall` script, or a new dependency has one | yes | `fail-on-install-script: false` |
| Your own root `preinstall` / `install` / `postinstall` / `prepare` script is added or changed | yes | `fail-on-install-script: false` |
| The same version now resolves to a different tarball URL or integrity hash, the tarball is a different package or version than the lockfile declares, or an upgrade moves to a different host | yes | `fail-on-source-change: false` |
| An `overrides` / `resolutions` entry is added or changed | yes | `fail-on-source-change: false` |

Findings below your thresholds are still reported. They just don't fail the check.
Ordinary upgrades (new version, new tarball from the same registry) are not flagged as source changes.
A dependency's `prepare` script is not counted: npm never runs it when the package is installed from the registry.
Known malware blocks even with `fail-on-severity: none`: these advisories are often rated only HIGH, and no threshold should let one through.

## Why npmscan

- **Private repos are free.** GitHub's own Dependency Review action only runs on private repositories that have [GitHub Code Security or Advanced Security](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/about-dependency-review). npmscan needs neither.
- **It looks beyond CVEs.** New install scripts and repointed tarballs are how npm supply-chain attacks usually work, and they have no CVE until someone notices.
- **There's no secret to configure,** so it also works on Dependabot PRs and PRs from forks, where repository secrets aren't available.
- **You can read all of it in five minutes.** It's a short bash script and a jq template, with nothing to download or build at run time.

## Inputs

| Input | Default | Description |
|---|---|---|
| `file` | `package-lock.json` | `package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock` (classic or Berry) or `pnpm-lock.yaml`, relative to the repo root |
| `files` | | Several files, one per line or comma-separated. Overrides `file`. |
| `mode` | `block` | `block` fails the check on findings that meet the thresholds; `warn` only reports them |
| `fail-on-severity` | `low` | Lowest severity that blocks: `low`, `moderate`, `high`, `critical`, or `none`. Known malware blocks regardless. |
| `fail-on-install-script` | `true` | Block on new install scripts (see the table above) |
| `fail-on-source-change` | `true` | Block on repointed or swapped tarballs and changed overrides |
| `fail-on-error` | `false` | Fail when the scan itself can't run (npmscan.com unreachable, file over 8 MB). By default this is a warning, so an outage never blocks your merges. |
| `github-token` | `${{ github.token }}` | Token used to post the PR comment |
| `fail-on-flagged` | `true` | Deprecated: `false` is the same as `mode: warn` |

## Outputs

| Output | Description |
|---|---|
| `flagged-count` | Findings across all scanned files (empty if nothing was scanned) |
| `blocking-count` | Findings that meet the thresholds. These fail the check in `mode: block`. |
| `error-count` | Files that could not be scanned |

## Recipes

### Try it for a week without blocking anything

```yaml
      - uses: npmscan/npmscan-action@v1
        with:
          mode: warn
```

The comment marks what *would* have blocked. Switch to `mode: block` when you trust it.

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

All files are reported in one comment, and files the PR doesn't touch are skipped without an API call.
Separate npmscan steps each keep their own comment.

### Dependabot and Renovate PRs

npmscan works as a security reviewer for dependency-bot PRs. Dependabot PRs run with a read-only token
unless the workflow asks for more, so keep the `permissions` block from the quick start:

```yaml
permissions:
  contents: read
  pull-requests: write
```

Renovate PRs come from a branch in your repo and need nothing extra.

### PRs from forks

Fork PRs always get a read-only token, so npmscan can't comment. The full report is in the job summary,
and findings still show up as annotations and still fail the check.

### Use the result in a later step

```yaml
      - id: npmscan
        uses: npmscan/npmscan-action@v1
        with:
          mode: warn
      - if: fromJSON(steps.npmscan.outputs.blocking-count || '0') > 0
        run: echo "npmscan found ${{ steps.npmscan.outputs.blocking-count }} blocking finding(s)"
```

## Pinning for security-conscious teams

`@v1` always points to the latest `v1.x.y` release, so you get fixes automatically. If your policy
requires immutable references, pin to the full commit SHA of a release instead:

```yaml
      - uses: npmscan/npmscan-action@9345a37fdf1a21a8ee1e9d5832b58fc8766c02ca # v1.2.0
```

Pick the SHA of the [latest release](https://github.com/NPMscan/npmscan-action/releases), or print it with
`git ls-remote https://github.com/NPMscan/npmscan-action refs/tags/v1.2.0`. To keep a pinned SHA up to date,
let Dependabot do it:

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
```

## What leaves your runner

- **Only the dependency file being scanned**, as it is on the base branch and in the PR, is sent over HTTPS to
  `https://npmscan.com/api/analysis/dependency-diff`.
- **Never** your source code, other files, environment variables, secrets, or the GitHub token.
- **Nothing is stored.** The files are used to compute the diff and then discarded.
- To check vulnerabilities and install scripts, npmscan looks up the **package names and versions** from that
  diff on the public npm registry and OSV.dev. For private packages, this means their names reach those services.

Requests share a public rate limit of 30 per minute per IP. Files can be up to 8 MB, and up to 100 changed
packages per run are checked in depth. See the [privacy policy](https://npmscan.com/privacy) and
[security policy](SECURITY.md).

## Contributing and security

- Found a bug or a wrong result? [Open an issue](https://github.com/NPMscan/npmscan-action/issues/new/choose).
- Want to change something? See [CONTRIBUTING.md](CONTRIBUTING.md).
- Found a vulnerability? Please report it privately. See [SECURITY.md](SECURITY.md).

[MIT License](LICENSE) · Made by [BlockHacks.io](https://blockhacks.io) · Powered by [npmscan.com](https://npmscan.com)
