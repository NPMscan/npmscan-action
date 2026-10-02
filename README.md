# npmscan Dependency Check

Flags vulnerable packages, newly added install scripts, and changed package
sources whenever a pull request changes `package.json` or a lockfile.
Posts the result as a PR comment and fails the check if anything is flagged.

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

## Inputs

| Input | Default | Description |
|---|---|---|
| `file` | `package-lock.json` | `package.json`, `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml` |
| `fail-on-flagged` | `true` | Fail the check when any package is flagged |

Powered by [npmscan.com](https://npmscan.com).
