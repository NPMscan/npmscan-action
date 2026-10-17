# Outreach scripts

TypeScript CLIs that open npmscan-action PRs on other repos and keep [`../tracker.csv`](../tracker.csv) up to date. Node ≥ 22.18 runs the `.ts` files directly. There's no build step and nothing to install for running them (`npm install` here only adds `tsc` for type checking).

Run everything from the **repo root**. The scripts find the tracker relative to themselves, so this is only so the paths in this README work as written.

Prerequisites: `gh` logged in as the outreach account (`gh auth status`), and SSH push access to that account's forks.

**Identify yourself first.** Every command that writes the tracker needs the model name, and records it in the `agent` column:

```bash
export NPMSCAN_AGENT=claude-opus-5.5   # or gpt-5.1, gemini-2.5-pro, kimi-k2, ... ; "human" when a person runs it
```

`--agent <model>` on a single command does the same. The value must be a real lowercase model ID: generic names like `ai` or `agent` are rejected. Only `--dry-run` runs don't need it.

## Commands

| I want to... | Run |
|---|---|
| See which repos are ready, without touching anything | `node outreach/scripts/process-prs.ts --wave 12 --limit 20 --dry-run` |
| Open PRs for the next K ready repos | `node outreach/scripts/process-prs.ts --wave 12 --limit K` |
| Open PRs for specific repos | `node outreach/scripts/process-prs.ts --repo owner/name` (once per repo) |
| Retry rows that errored (timeouts, etc.) | add `--retry-failed` |
| Open one PR with a hand-written body (template / CLA repos the user approved) | `node outreach/scripts/process-prs.ts --repo owner/name --body /tmp/npmscan-outreach/name.md` |
| Update every PR's live state and list replies we owe | `node outreach/scripts/refresh.ts` (add `--dry-run` to preview, `--wave` / `--repo` to narrow) |
| Record a skip / hold / maintainer reply | `node outreach/scripts/mark.ts --repo owner/name --status skipped_policy --reason "bans bot PRs"` |
| Add a new candidate repo | `node outreach/scripts/mark.ts --repo owner/name --add --wave 13 [--notes "why this repo"]` |
| Type-check after editing | `cd outreach/scripts && npm run typecheck` |

`VERBOSE=1` prints every `git`/`gh` command. A real run waits 5 s between repos (`delayBetweenReposMs`). That's deliberate: bursts of PRs look like spam and get accounts flagged. Run large batches in the background rather than removing the delay.

### Typical session

```bash
export NPMSCAN_AGENT=<your-model>                                  # 0. who is working
node outreach/scripts/refresh.ts                                   # 1. who replied? (prints "Waiting on our reply")
node outreach/scripts/process-prs.ts --wave 12 --limit 20 --dry-run # 2. preview
# 3. show the user the ready / held lists, agree which to open
node outreach/scripts/process-prs.ts --wave 12 --limit 20          # 4. one real run, in the background
node outreach/scripts/mark.ts --repo x/y --status skipped_policy --reason "..."   # 5. record decisions on held repos
git add outreach/tracker.csv && git commit -m "chore(outreach): record wave 12 PRs" -m "Agent: <your-model>"  # 6. only if asked
```

## What `process-prs.ts` does per repo

It takes `not_contacted` rows in tracker order (plus `failed` with `--retry-failed`; with `--body`, also `needs_user_decision`):

1. **Archived?** If so, record `blocked_pr_creation` / `archived`.
2. **Fork and clone.** `gh repo fork` to the outreach account, then a blobless clone into `/tmp/npmscan-outreach/<owner>__<repo>` with upstream's default branch fetched. `origin` is always reset to the fork. A dry run reads upstream and never forks.
3. **Preflight** ([`lib/preflight.ts`](lib/preflight.ts)), where the first failing check decides the result:

   | Check | Result |
   |---|---|
   | Already has `.github/workflows/npmscan.yml` | `skipped` |
   | No root `pnpm-lock.yaml` / `yarn.lock` / `package-lock.json` / `npm-shrinkwrap.json` | `skipped_no_supported_lockfile`, or `skipped_unsupported_lockfile` if bun-only |
   | A workflow already uses `actions/dependency-review-action` | `deprioritized_overlap` |
   | CONTRIBUTING / AI policy / PR template mentions AI tools | `blocked_policy` (don't contact) |
   | ...asks for an issue first | `needs_issue_first` |
   | ...requires DCO or a CLA | `needs_user_decision` |
   | Has any PR template | `needs_user_decision` (fill it by hand, then use `--body`) |
   | npmscan API rejects the lockfile | `skipped_unsupported_lockfile` (don't ship a broken check) |

   `--body` skips the four policy rows, but the lockfile and API checks always run.

4. **Open the PR.** Write [`lib/workflow.ts`](lib/workflow.ts)'s workflow (`mode: warn`, `fail-on-error: false`, action pinned to `config.actionSha`, `file:` set to the lockfile), commit on `ci/add-npmscan-warn-mode`, force-push to the fork, and `gh pr create` with [`templates/pr-body.md`](templates/pr-body.md) or `--body`. If an open PR from that branch already exists, it's recorded rather than duplicated.
5. **Record it.** `pr_opened` / `awaiting_review` with the PR URL. Any exception records `failed` with the error.

The regexes in preflight are a first filter, not a full policy review. Before writing a `--body`, read the repo's CONTRIBUTING and template yourself. Some repos (for example jQuery) say in prose that unsolicited, tool-driven PRs get closed or banned, and the regex won't catch that.

### Writing a `--body`

- Start from [`templates/pr-body.md`](templates/pr-body.md) and fit it into the repo's template headings.
- Keep the **Disclosure** section.
- Leave checkboxes unticked with "n/a" when they don't apply (tests, docs, linked issue). Never tick one that isn't true.
- Only claim features listed in the action's [README](../../README.md).
- Save it under `/tmp/npmscan-outreach/`, not in the repo.

## What `refresh.ts` does

For every row with a `pr_url` it fetches the PR, issue comments, reviews and inline review comments, 8 PRs at a time. Bots (`type == Bot` or a `[bot]` login, e.g. CodeRabbit, Greptile, Socket) are ignored. So are people with no role in the repo (`author_association` NONE), which filters out watchers' email auto-replies. Only OWNER, MEMBER, COLLABORATOR or CONTRIBUTOR comments count as a maintainer reply. Then it sets:

| PR state | status | outcome | next_action |
|---|---|---|---|
| merged | `pr_merged` | `merged` | `none` |
| closed | `pr_closed` | kept if already `rejected*` / `auto_closed_bot_flag` / `closed_no_comment`; otherwise `rejected` if a human commented, else `closed_no_comment` | `none` |
| open, no human comments | `pr_opened` | `awaiting_review`, or `stale` after 7 days | `monitor_pr` |
| open, a human commented last | `pr_opened` | `engaged` | `reply_to_maintainer` |
| open, we commented last | `pr_opened` | `awaiting_maintainer` | `monitor_pr` |

`blocked_requirement` (e.g. waiting on a CLA) is kept while the PR is open. `maintainer` is the last human who isn't us. `reason` and `notes` are never touched, and `agent` is only set on rows whose state changed: after reading a maintainer's reply, write the gist there with `mark.ts --reason "..."`.

## Tracker

[`../tracker.csv`](../tracker.csv) is the single source of truth. There's one row per repo, and rows are never deleted.

| Column | Meaning |
|---|---|
| `wave` | Batch the repo was added in |
| `repo` | `owner/name` upstream |
| `status` | Pipeline state (see below) |
| `priority` | `primary`, `secondary`, `backup`, `skip` |
| `default_branch`, `lockfile` | Filled in by preflight |
| `pr_url`, `fork_branch`, `commit_sha` | Filled in when a PR opens (`commit_sha` is the pinned action SHA) |
| `next_action` | What to do next: `monitor_pr`, `reply_to_maintainer`, `open_issue_first`, `none`, ... (free text, but reuse existing values) |
| `notes` | Why this repo was picked or anything worth remembering |
| `outcome` | How the maintainers responded (see below) |
| `maintainer` | Last human maintainer who replied |
| `reason` | Why it was skipped, or what the maintainer said |
| `last_checked` | Set automatically on every write |
| `agent` | Model that last worked on the row (`claude-opus-5.5`, `gpt-5.1`, `gemini-2.5-pro`, `human`, ...). Set automatically from `--agent` / `NPMSCAN_AGENT`; empty on rows from before October 17, 2026 |

Allowed **status** and **outcome** values are defined in `STATUSES` / `OUTCOMES` in [`lib/tracker.ts`](lib/tracker.ts). Loading or writing anything else throws. Use the most specific existing value, and only add a new one there if nothing fits.

While a script writes, it holds `tracker.csv.lock` (gitignored). A second writer fails with "held by running process N" until the first finishes. A lock left by a crashed process is taken over automatically.

## Changing the scripts

| File | Role |
|---|---|
| [`process-prs.ts`](process-prs.ts) | Opens PRs (the per-repo pipeline above) |
| [`refresh.ts`](refresh.ts) | Live PR state → tracker |
| [`mark.ts`](mark.ts) | Manual tracker edits and new rows |
| [`lib/config.ts`](lib/config.ts) | Branch name, pinned action SHA, PR title/commit message, paths, timeouts, supported lockfiles |
| [`lib/tracker.ts`](lib/tracker.ts) | CSV parse/write, allowed values, `resolveAgent`, lock. **The only code that writes `tracker.csv`** |
| [`lib/preflight.ts`](lib/preflight.ts) | Lockfile detection, policy regexes, npmscan API parse check |
| [`lib/github.ts`](lib/github.ts) | `gh` wrappers: repo info, fork, find/create PR |
| [`lib/git.ts`](lib/git.ts) | Clone/fetch/branch/commit/push in `/tmp/npmscan-outreach` |
| [`lib/workflow.ts`](lib/workflow.ts) | The `npmscan.yml` written into target repos |
| [`lib/shell.ts`](lib/shell.ts) | `run` / `runAsync`: run commands without a shell, with timeouts |
| [`templates/pr-body.md`](templates/pr-body.md) | Default PR body |

- **New capability → new flag or a new top-level `.ts` CLI here** that reuses `lib/`, plus a row in the Commands table above. Don't add a parallel script in another language or another folder.
- Run commands through `run`/`runAsync` (argument arrays, no shell strings). Go through `Tracker` for CSV access.
- A new command that writes rows takes an `agent` option and passes `resolveAgent(args.agent)` to `new Tracker(...)`. Pass `{ stamp: false }` to `update` only when the row didn't really change (as `refresh.ts` does).
- Keep to Node built-ins (`node:fs`, `node:child_process`, `fetch`). TypeScript must be erasable syntax only (no `enum`, no `namespace`); `tsconfig.json` enforces this.
- After a new action release, bump `actionSha` in `lib/config.ts`.
- `npm run typecheck` must pass. Test changes with `--dry-run` or a single `--repo` before a batch.
