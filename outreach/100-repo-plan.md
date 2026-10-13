# 100-Repo Outreach Plan

Updated: 2026-10-13

## Goal

Open high-quality `npmscan-action` PRs to as many as 100 suitable JavaScript and TypeScript repositories without turning outreach into spam or creating too much maintainer friction.

## What counts as success

- 100 researched candidates
- 60 to 80 PR-ready candidates after filtering
- 30 to 50 actual opened PRs if acceptance quality stays healthy
- maintain a high signal-to-noise ratio instead of forcing all 100

## Core rules

- use `mode: warn`
- use `fail-on-error: false`
- pin `NPMscan/npmscan-action` to `de14168f65640a4ed1f0e82ad3ad8c80483d360d`
- skip repos using `bun.lock` until support is official
- prefer repos with standard `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`
- prefer repos without obvious overlapping PR-time dependency review workflows
- only open narrow PRs that trigger on manifest and lockfile changes

## Target shape

Prioritize repositories that are:

- active Node.js, JavaScript, or TypeScript projects
- visible enough to create traction
- contributor-friendly
- using standard GitHub Actions CI
- not archived, read-only, or heavily locked down

## Scoring model

Score each candidate from 0 to 10:

- `+3` strong visibility or ecosystem relevance
- `+2` clear lockfile compatibility
- `+2` contributor-friendly signals such as `good first issue`
- `+1` simple CI layout
- `+1` no obvious competing dependency-review workflow
- `+1` clear PR base branch and standard repo structure

Auto-skip when any of these are true:

- archived or read-only
- `bun.lock` only
- no supported lockfile
- already has a very similar PR-time dependency review check
- repo is not mainly JS or TS

## Execution plan

### Phase 1: Build the 100-repo pool

Create a longlist of 100 candidates across these buckets:

- framework and tooling
- SDKs and developer platforms
- build tools and CLIs
- testing tools
- frontend component libraries
- backend and full-stack frameworks
- blockchain and infra tooling
- package ecosystem utilities

Target about:

- 20 top-tier, high-visibility repos
- 30 mid-sized active repos
- 30 niche but trusted tooling repos
- 20 backup candidates

### Phase 2: Triage down to 60 to 80

For each repo, verify:

- default branch
- lockfile type
- existing security and CI workflows
- contributor friendliness
- whether a minimal `npmscan.yml` is easy to justify

Record one-line rationale for every keep, skip, or deprioritize decision.

### Phase 3: Ship in controlled waves

Do not blast 100 repos at once. Use waves of 5 to 10 repos:

1. Wave 6: 5 repos
2. Wave 7: 5 repos
3. Wave 8: 10 repos
4. Waves 9-14: 10 repos each
5. Hold back 10 to 20 reserve repos for replacements

This keeps review quality high and gives us room to adapt the pitch based on maintainer feedback.

### Phase 4: Learn from feedback

After every wave, review:

- merge rate
- objections
- ignored PR rate
- requests for narrower triggers
- requests for different wording

Then adjust the next wave before opening more PRs.

## Repo workflow templates

Use only three basic templates:

### npm

- trigger on `package.json` and `package-lock.json`
- scan `package-lock.json`

### yarn

- trigger on `package.json` and `yarn.lock`
- scan `yarn.lock`

### pnpm monorepo

- trigger on root manifest, `pnpm-lock.yaml`, workspace file, and relevant package manifests
- scan `pnpm-lock.yaml`

## Outreach cadence

Recommended pace:

- research 15 to 20 repos at a time
- open 5 to 10 PRs per wave
- pause after each wave to review responses
- keep no more than 20 to 25 open outreach PRs at once

That avoids spreading follow-up work too thin.

## Tracking structure

Keep using the `outreach/` folder:

- `wave-N-targets.md` for researched candidates
- `wave-N-prs.md` for opened PRs
- `README.md` as the index

Add one new meta file:

- `100-repo-plan.md` for the overall campaign strategy

## Quality bar for each PR

Before opening a PR, confirm:

- workflow triggers only on relevant files
- action is pinned to the full SHA
- `mode: warn` is set
- `fail-on-error: false` is set
- base branch is correct
- no existing branch collision
- PR body explains the low-friction value clearly

## Practical rollout

Best approach from here:

1. Build a wave-6 target list of 15 to 20 candidates
2. Filter it down to the best 5 to 10
3. Open the next wave
4. Repeat until we either reach 100 researched repos or the signal quality drops

## Recommendation

Plan for **100 researched repos**, not necessarily 100 opened PRs.

That is the right scale target because it gives us:

- enough room to skip bad fits
- enough backups when repos are archived or incompatible
- better acceptance quality
- less chance of noisy outreach
