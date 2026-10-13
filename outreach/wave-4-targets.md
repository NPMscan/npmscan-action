# Wave 4 Targets

Research date: 2026-10-13

This wave focuses on fresh repos not already used in earlier waves, with an emphasis on:

- active JavaScript or TypeScript projects
- visible contributor-friendly signals
- clear lockfile/package-manifest triggers
- no obvious dedicated PR-time dependency review workflow

## Best new targets

### 1. `acacode/swagger-typescript-api`

- active TypeScript project
- `bun.lock` present
- contributor-friendly signal: 5 open `good first issue` items
- main CI is straightforward build and test with Bun
- visible workflow set does not show a dedicated dependency-review or audit workflow

Why it fits:

- generator/tooling repo, so supply-chain trust is easy to justify
- `npmscan` would be additive rather than duplicating an obvious existing security gate

### 2. `lukeautry/tsoa`

- active TypeScript repo
- `yarn.lock` present
- contributor-friendly signal: 16 open `good first issue` items
- build workflow is broad, but no separate dependency-review workflow surfaced

Why it fits:

- API tooling maintainers usually understand lockfile and install-script risk quickly
- a PR-time warn-mode rollout is easy to explain here

### 3. `LuanRT/YouTube.js`

- active TypeScript repo
- `package-lock.json` present
- contributor-friendly signal: 6 open `good first issue` items
- test workflow is simple `npm ci` plus tests
- has Dependabot, but no obvious PR-time dependency-diff review workflow

Why it fits:

- package trust matters for a widely installed client library
- maintainer cost is low if scoped to root manifest and lockfile changes

### 4. `Ironclad/rivet`

- active TypeScript repo
- `yarn.lock` present
- contributor-friendly signal: 5 open `good first issue` items
- build workflow is standard install, build, test, lint, prettier
- no obvious dedicated dependency-review or audit workflow surfaced

Why it fits:

- fast-moving AI tooling repo with dependency churn
- a narrow PR-time supply-chain check is a believable addition

### 5. `codex-team/editor.js`

- large, active TypeScript repo
- `yarn.lock` present
- very strong contributor signal: 41 open `good first issue` items
- visible workflows cover linting, Cypress, releases, and publishing
- no obvious dedicated dependency-review or audit workflow surfaced

Why it fits:

- big install base gives decent traction upside
- workflow surface is still simple enough for a low-friction `npmscan` PR

## Possible but less attractive

### `dsherret/ts-morph`

- active and contributor-friendly
- CI is Deno-centric
- no obvious root JS lockfile surfaced during inspection

Reason to deprioritize:

- still possible, but it is a weaker fit for the current `npmscan` GitHub Action story than more standard npm/yarn/bun repos

### `NativeScript/NativeScript`

- active and large
- `package-lock.json` present
- already has `dependency-review.yml`, `ossf-scorecard.yml`, and Dependabot

Reason to deprioritize:

- strong security workflow coverage already exists, so the overlap objection gets much stronger

### `get-convex/convex-backend`

- active and visible
- mixed Rust plus npm monorepo shape
- package surface is large and more operationally complex

Reason to deprioritize:

- likely higher-friction than the cleaner JS/TS-only repos above

## Recommended order

1. `acacode/swagger-typescript-api`
2. `lukeautry/tsoa`
3. `LuanRT/YouTube.js`
4. `Ironclad/rivet`
5. `codex-team/editor.js`

## Suggested workflow shapes

- `swagger-typescript-api`: Bun lockfile trigger
- `tsoa`: root `package.json` plus `yarn.lock`
- `YouTube.js`: root `package.json` plus `package-lock.json`
- `rivet`: root `package.json` plus `yarn.lock`
- `editor.js`: root `package.json` plus `yarn.lock`

## Pitch reminder

Keep the message narrow:

- PR-time review for new install scripts
- source or tarball changes in lockfiles
- changed overrides or resolutions
- malware advisories

Keep maintainer cost low:

- `mode: warn`
- only trigger on manifest and lockfile changes
- pin to a full SHA
- `fail-on-error: false`
