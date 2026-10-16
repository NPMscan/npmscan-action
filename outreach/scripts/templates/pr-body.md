### What does this PR do?
Adds a standalone `.github/workflows/npmscan.yml` that runs [npmscan-action](https://github.com/NPMscan/npmscan-action) on pull requests. It diffs the lockfile between the PR base and head and flags supply-chain red flags in the changed dependencies: newly added install scripts (`preinstall`/`install`/`postinstall`), repointed or swapped tarballs (URL/integrity changes), added or changed `overrides`/`resolutions`, and known vulnerabilities in newly introduced versions.

### Why?
Malicious package versions usually arrive through lockfile changes in otherwise ordinary PRs, where a reviewer rarely reads the lockfile diff. This check summarises what changed so those entries stand out.

### Configuration notes
- **Non-blocking:** `mode: warn` and `fail-on-error: false`, so it reports findings but never fails CI.
- **Pinned:** the action is pinned to a full commit SHA, not a floating tag.
- **Scoped:** one new file; no existing workflows are touched. The job only needs `contents: read` (plus `pull-requests: write` to post a single summary comment; on fork PRs the token is read-only, so findings go to annotations and the job summary instead).

### Disclosure
I maintain npmscan and npmscan-action, so I have an interest in this. If it isn't a fit for the project, please feel free to close; no hard feelings.
