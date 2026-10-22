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

- One new file, `.github/workflows/npmscan.yml`, that runs on `pull_request` only when `package.json`, the lockfile or the workflow itself changes (so it runs once on our PR and reviewers see it work). No existing workflow is touched.
- `mode: warn` and `fail-on-error: false`, so it can never break the repo's CI. `comment: on-findings` keeps clean PRs quiet, and `timeout-minutes: 15` covers the action's own API time cap.
- Scans the lockfile and `package.json` (root install scripts and overrides live only there).
- Least privilege: workflow-level `permissions: {}`, job-level `contents: read` + `pull-requests: write`, checkout with `persist-credentials: false`. The action and `actions/checkout` are both pinned to full commit SHAs.
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

## Finding new repos

- **Don't search only in English.** Many active JS/TS projects track issues in Chinese, Russian, Japanese, Korean, Portuguese, Spanish and other languages, and English-only searches have mostly surfaced big, already-contacted repos. Search issues in several languages, for example:

  | Language | Example queries |
  |---|---|
  | Chinese | `npm 供应链攻击`, `npm 恶意包`, `依赖投毒`, `依赖 安全扫描 npm` |
  | Russian / Ukrainian | `вредоносный пакет npm`, `npm атака цепочки поставок`, `npm атака ланцюга постачання` |
  | Japanese | `npm サプライチェーン攻撃`, `npm 悪意のあるパッケージ` |
  | Korean | `npm 공급망 공격`, `npm 악성 패키지` |
  | Portuguese / Spanish | `pacote malicioso npm`, `paquete malicioso npm`, `ataque cadena de suministro npm` |
  | Any | incident names such as `Shai-Hulud`, and the package names from incidents (`plain-crypto-js`, `color-convert@3.1.1`, `"@asyncapi/specs" compromised`), which find repos whose dependencies were hit whatever language they write in |

  Searching the long tail (Hindi, Bengali, Tamil, Urdu, Polish, Czech, Hungarian, Romanian, Greek, the Nordic and Baltic languages, Arabic, Hebrew, Thai and others, October 2026) returned almost nothing from repos with traction: those developers file issues in English. Spend the effort on the languages in the table, plus French, German and Turkish.
- **Search Discussions too.** Issue search doesn't cover them, and many "are we affected?" threads live there. Use GraphQL: `gh api graphql -f q='<query>' -f query='query($q:String!){search(query:$q,type:DISCUSSION,first:100){nodes{... on Discussion{title url repository{nameWithOwner}}}}}'`.

- The best source so far is incident reports in any language: issue titles like `"Malicious files on the default branch"`, `"Malicious release"`, `"is compromised"` or `被投毒`. Most other non-English hits are bot reports or personal repos, so keep only JS/TS repos with roughly 150+ stars and a push in the last three months.
- The second-best source is PRs that add protections: `minimumReleaseAge` / `min-release-age`, `ignore-scripts`, "harden against supply chain attacks", or replacing the compromised `actions-cool/*` actions. Those repos already cover release age or install scripts, so lead with what's left (same-version tarball and integrity swaps, override changes) or skip. Routine config PRs (moving `onlyBuiltDependencies`, Renovate tweaks) aren't a signal.
- Add `language:TypeScript` / `language:JavaScript` / `language:Vue` to busy queries; issue search filters by the repo's language. Rank what's left by how many recently merged PRs came from outside contributors: repos that never merge outside PRs won't merge ours.
- `gh search issues "<query>" --state open --limit 30 --json repository,title,url,createdAt`. Search allows about 30 requests a minute, so pause a few seconds between queries.
- Read the issue before calling it warm: many hits are about something else (news feeds, trusted publishing, release age). Then run the usual checks (lockfile, contribution docs, existing scanning) and add the repo with `mark.ts --add --wave N --notes "..."`, linking the issue in the notes.
- If the maintainers write in another language, write the PR body or issue in that language too (keep the npmscan disclosure).

## Follow-up

Run `node outreach/scripts/refresh.ts` to update every PR's state. It lists the PRs where a maintainer replied and we owe an answer. Reply in the PR, then record the gist with `mark.ts --repo x/y --reason "..."` (and `--outcome rejected` or similar when it's final).
