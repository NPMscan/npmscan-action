# Contributing

Thanks for helping make npmscan-action better. Bug reports, false-positive
reports and pull requests are all welcome.

## Before you start

- **Security issues:** don't open an issue — follow [SECURITY.md](SECURITY.md).
- **Bigger changes** (new inputs, new output formats): open an issue first so
  we can agree on the shape before you write the code.

## How the action is built

| Path | What it does |
|---|---|
| `action.yml` | Inputs, outputs, and a single composite step that runs the script |
| `scripts/scan.sh` | Reads the dependency files, calls the npmscan API, writes outputs, annotations, the job summary and the PR comment |
| `scripts/render.jq` | Turns API results into findings, counts and the markdown report |
| `tests/run.sh` | Test suite: throwaway git repos with `gh` and `curl` stubbed |
| `tests/fixtures/` | Real npmscan API responses used by the tests |

The action is deliberately plain bash and jq — both are preinstalled on
GitHub's runners, there's nothing to download or build, and anyone can audit
the whole thing in a few minutes. Please keep it that way: no new runtime
dependencies, and no network calls other than the npmscan API and the GitHub
API.

## Running the checks

```bash
tests/run.sh                 # full suite, offline (~30s)
LIVE=1 tests/run.sh          # also calls the real npmscan.com API once
shellcheck scripts/scan.sh tests/run.sh tests/stubs/*
actionlint
```

CI runs the suite on Ubuntu and macOS, plus shellcheck, actionlint, and an
end-to-end job that runs the action on the pull request itself.

## Writing a change

- Add a test in `tests/run.sh` for every behaviour change. If you need a new
  API response, capture a real one:
  ```bash
  jq -n --rawfile before old.json --rawfile after new.json '{before: $before, after: $after}' \
    | curl -s -X POST https://npmscan.com/api/analysis/dependency-diff \
        -H 'Content-Type: application/json' --data-binary @- \
    | jq . > tests/fixtures/my-case.json
  ```
- Anything from the PR (package names, versions, script contents) is
  untrusted. Pass it through `clean`/`code`/`prose` in `render.jq` before it
  reaches markdown, and through `esc_data`/`esc_prop` before it reaches a
  workflow command.
- Keep the scan script compatible with bash 3.2 (macOS runners and local
  development): no associative arrays, `mapfile` or `${var,,}`.
- Update `README.md` and `action.yml` descriptions when inputs or outputs change.

## Pull requests

- One topic per PR, with a short description of what changes for users.
- CI must be green and a maintainer (see `.github/CODEOWNERS`) must approve.

## Releases (maintainers)

1. Merge to `main` with CI green.
2. Tag an immutable version and move the major tag:
   ```bash
   git tag v1.x.y && git tag -f v1
   git push origin v1.x.y && git push -f origin v1
   ```
3. Publish a GitHub Release for `v1.x.y` with "Publish this Action to the
   GitHub Marketplace" ticked.
4. Update https://npmscan.com/docs/github-action if inputs, outputs or the
   comment changed.

By contributing you agree that your contributions are licensed under the
[MIT License](LICENSE).
