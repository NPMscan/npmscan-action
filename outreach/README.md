# npmscan-action Outreach Strategy

This directory tracks all outreach efforts for the `npmscan-action` project. The goal of this outreach is to gain traction by integrating `npmscan-action` into high-visibility, high-traffic TypeScript/Node.js repositories, thereby demonstrating its value as a PR-time supply-chain security check.

## Core Pitch
`npmscan` is positioned as a **PR-time supply-chain security check** that detects:
- **New or modified install scripts** (e.g., `postinstall`, `preinstall`).
- **Tarball swaps / checksum mismatches**.
- **Lockfile overrides** that might pull in malicious dependencies.

## Key Constraints & Guidelines
To minimize friction and maximize the likelihood of maintainers accepting our Pull Requests, we strictly adhere to the following rules:

1. **Non-Blocking (Warn Only):**
   Always configure the action with `mode: warn` and `fail-on-error: false`. This ensures we do not break a repository's CI pipeline, reducing the risk of immediate rejection.
2. **Immutable Action Versioning:**
   Pin the `NPMscan/npmscan-action` to a specific immutable commit SHA (e.g., `de14168f65640a4ed1f0e82ad3ad8c80483d360d`) rather than a floating tag like `@v1`. This builds trust by preventing unexpected changes in the action's behavior.
3. **Standalone Workflow:**
   Implement the check as a standalone workflow file (e.g., `.github/workflows/npmscan.yml`) rather than modifying existing, potentially complex CI files.
4. **Target Selection:**
   Prioritize high-traffic, visible TypeScript/Node.js repositories. Skip repositories using `bun.lock` for now, as `npmscan-action` does not yet officially support Bun lockfiles.
5. **Clean Local Environment:**
   Use SSH for all Git remotes to match the local environment settings and avoid authentication prompts. Keep temporary tracking info (e.g., local clones) outside the repository (e.g., `/tmp/npmscan-outreach`) to maintain project cleanliness.

## Organization
This `/outreach` folder serves as the central hub for all outreach activities:
- `README.md` - This strategy guide and index.
- `tracker.csv` - The master tracker for all repositories evaluated, contacted, and monitored.
- `wave-N-targets.md` - Research and notes for repositories targeted in a specific wave.
- `wave-N-prs.md` - Records and links for the PRs opened during a specific wave.

## Tracking & Follow-up
- We use a "wave" approach, batching our outreach into groups of repositories.
- PRs are actively monitored for maintainer feedback.
- If a maintainer replies, we engage promptly to address their concerns, focusing on the security benefits and the non-intrusive nature of the `warn` mode.
- Repositories that reject the PR or have strict AI/Bot policies are documented in `tracker.csv` to avoid duplicate efforts in the future.
