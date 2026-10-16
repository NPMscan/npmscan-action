# Outreach

Opening PRs that add `npmscan-action` (in warn mode) to popular JS/TS repos, and tracking how maintainers respond.

This folder holds exactly three things:

| Path | What |
|---|---|
| `README.md` | This file: strategy and lessons |
| [`tracker.csv`](tracker.csv) | Every repo we've evaluated or contacted, what happened, and which agent (Claude, GPT, Gemini, Kimi, a human, ...) did the work. The only record |
| [`scripts/`](scripts/README.md) | The CLIs that open PRs, refresh state and edit the tracker. **How-to lives there** |

Don't add per-wave markdown, notes or JSON files here. Everything goes into `tracker.csv` through the scripts, and anything temporary goes in `/tmp/npmscan-outreach/`. AI assistants: read [`../AGENTS.md`](../AGENTS.md) first.

## What a PR looks like

- One new file, `.github/workflows/npmscan.yml`, that runs on `pull_request`. No existing workflow is touched.
- `mode: warn` and `fail-on-error: false`, so it can never break the repo's CI.
- The action is pinned to a full commit SHA, and `actions/checkout@v4` is used to match what most repos already run.
- The body explains what's checked (install scripts, tarball swaps, override changes, vulnerabilities) and **always discloses that the author maintains npmscan**.

## Which repos to pick

Lessons from waves 1–12 (as of October 2026: ~80 PRs, 0 merged):

- **Cold PRs to big repos mostly get closed.** Reasons given: "we don't want another third-party action in CI", "we have our own tooling", or flagged as spam/bot. Vite and Vitest auto-closed them because the account was flagged by agentscan. Faker labelled one spam and asked for disclosure.
- **Warm leads do better.** Pick repos with an open issue asking for supply-chain scanning, or repos hit by an npm incident. For those, open an issue first that shows a concrete finding from the repo's own lockfile, and only then a PR.
- **Skip outright:**
  - archived repos
  - bun-only lockfiles
  - repos that already run a PR-time dependency review (e.g. `dependency-review.yml`)
  - repos whose contribution docs ban AI or unsolicited PRs (e.g. jQuery, OpenTelemetry), require human-written first PRs, or only accept security fixes (Yarn classic)
  - repos that restrict PR creation to collaborators
- **Fill PR templates honestly.** Answer the maintainers' "why?" questions promptly. A few tailored PRs beat a batch of identical ones.
- Small batches with the built-in delay. Never burst.

## Follow-up

Run `node outreach/scripts/refresh.ts` to update every PR's state. It lists the PRs where a maintainer replied and we owe an answer. Reply in the PR, then record the gist with `mark.ts --repo x/y --reason "..."` (and `--outcome rejected` or similar when it's final).
