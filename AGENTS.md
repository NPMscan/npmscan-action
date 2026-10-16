# Instructions for AI agents

Read this before changing anything. It applies to every assistant (Claude, ChatGPT/Codex, Gemini, Cursor, ...).
`CLAUDE.md` and `GEMINI.md` only import this file, so edit this one.

This repo holds two separate things. Work out which one the task is about first, then read that README.

| Task is about | Code | Read first |
|---|---|---|
| **The GitHub Action** (scanning, PR comment, inputs, tests, releases) | `action.yml`, `scripts/`, `tests/` | [`scripts/README.md`](scripts/README.md), [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| **Outreach** (opening PRs on other repos, tracking replies) | `outreach/` | [`outreach/README.md`](outreach/README.md), [`outreach/scripts/README.md`](outreach/scripts/README.md) |

Never mix the two in one change. Outreach code never goes in `scripts/`, and action code never goes in `outreach/`.

## Rules for every task

- **Don't add files nobody asked for.** No plans, notes, summaries, `wave-N-*.md`, `TODO.md`, reports or JSON dumps in the repo. Put scratch files in `/tmp/npmscan-outreach/` or your own temp dir, and give your summary in chat.
- **Use the tools that exist.** If a script can do the job, run it. If it can't, extend it in the same language (see below). Never write a throwaway script that does the same job a second way.
- **Commit only when asked.** One topic per commit, Conventional Commit style (`fix(outreach): ...`, `feat: ...`, `chore(outreach): ...`). Never push to `main` without being asked, and never force-push it.
- **Report honestly.** If something failed or you skipped a step, say so. Don't describe a dry run as "PRs opened".

## Rules for the action (`action.yml`, `scripts/`, `tests/`)

- Plain **bash + jq** only, compatible with **bash 3.2** (no associative arrays, `mapfile`, `${var,,}`). No Node, Python or new runtime dependencies. The only network calls allowed are to the npmscan API and the GitHub API.
- Every behaviour change needs a test in `tests/run.sh`. Run `tests/run.sh`, `shellcheck scripts/scan.sh tests/run.sh tests/stubs/*` and `actionlint` before you say you're done.
- Anything that comes from a PR is untrusted. It must go through `clean`/`code`/`prose` (render.jq) or `esc_data`/`esc_prop` (scan.sh).
- When inputs or outputs change, update `action.yml` descriptions and `README.md` too.

## Rules for outreach (`outreach/`)

`outreach/` contains exactly `README.md`, `tracker.csv` and `scripts/`. Don't add anything else there.

1. **TypeScript only.** Scripts are `.ts` files that Node ≥ 22.18 runs directly. There is no build step, and no `.js`, `.mjs`, `.py` or shell scripts. Don't add npm dependencies. Run `npm run typecheck` in `outreach/scripts/` after any change.
2. **Never edit `tracker.csv` by hand**: no sed, awk, Python, spreadsheet export or your own CSV writer. Hand edits have corrupted rows before (see commit `4e918c0`). Go through the scripts:
   - open PRs → `process-prs.ts`
   - record a skip, hold, reply or new repo → `mark.ts`
   - update live PR state → `refresh.ts`

   They validate statuses and outcomes, and they take a lock so two agents can't overwrite each other.
3. **Fast path for "open some PRs":** run one dry run (`--wave N --limit K --dry-run`), show the user the result, then run the same command without `--dry-run` **once**, in the background. Don't fork, clone, commit or `gh pr create` by hand, and don't do repos one at a time unless a repo needs a hand-written body.
4. **Fast path for "check the PRs":** run `refresh.ts`. Don't run `gh pr view` per repo.
5. **Respect the holds.** The automation stops at `blocked_policy`, `needs_issue_first` and `needs_user_decision` for a reason: an AI policy, issue-first rules, a CLA/DCO or a PR template. Report these to the user. Only open such a PR after the user says so, and then use `process-prs.ts --repo X --body file.md` with a body that follows the repo's template.
6. **PR bodies stay honest.**
   - Always keep the disclosure that the author maintains npmscan.
   - Never tick a checklist box that isn't true (tests added, issue linked, docs updated). Leave it unticked with "n/a".
   - Don't name incidents or features that you haven't checked against the action's [`README.md`](README.md).
7. **Skip a repo, don't push through, when its contribution docs:**
   - ban AI-generated or unsolicited PRs
   - only accept security fixes
   - require an approved issue first
   - already run a PR-time dependency review (e.g. `actions/dependency-review-action`)

   Record why with `mark.ts`.
8. **Never push to an upstream repo.** Pushes only go to the `salemalem/<repo>` fork. If a push or PR creation fails, record it (`failed` / `blocked_pr_creation`) and move on. Don't retry in a loop.
9. If a script is wrong or missing a feature, **fix it in `outreach/scripts/`** (see that README's "Changing the scripts") and say so. Don't work around it.
