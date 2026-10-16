### What does this PR do?
Integrates `npmscan-action` as a non-blocking supply-chain security check on Pull Requests.

`npmscan` checks incoming PRs for:
- Lockfile overrides that could pull in malicious transitive dependencies
- Unexpected new `postinstall` scripts
- Tarball swaps and checksum mismatches

### Why?
Supply-chain attacks (like the recent ChainDrop and malicious axios typosquats) often sneak in via lockfile updates in otherwise benign PRs. This check helps reviewers spot those anomalies automatically.

### Configuration Notes
- **Non-blocking**: Configured with `mode: warn` and `fail-on-error: false`. It will only post a warning annotation if an issue is found and will **never fail the CI build**, ensuring it doesn't disrupt your workflow.
- **Immutable Action**: The action is pinned to a specific commit SHA (`de14168f65640a4ed1f0e82ad3ad8c80483d360d`) rather than a floating tag, following security best practices.

### Disclosure
I maintain npmscan and npmscan-action. If this isn't a fit for the project, feel free to close; no hard feelings.
