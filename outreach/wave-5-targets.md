# Wave 5 Targets

Research date: 2026-10-13

This wave focuses on fresh repos not already used in earlier outreach waves, with an emphasis on:

- active JavaScript or TypeScript projects
- visible contributor-friendly signals
- standard npm, yarn, or pnpm lockfiles
- no obvious dedicated PR-time dependency review workflow

## Best new targets

### 1. `codex-team/editor.js`

- active TypeScript repo
- `yarn.lock` present
- very strong contributor signal: 41 open `good first issue` items
- visible workflows cover linting, Cypress, publishing, and release automation
- no obvious dedicated dependency-review or audit workflow surfaced

Why it fits:

- large install base gives good traction upside
- CI is still simple enough that a narrow warn-mode `npmscan` PR feels reasonable

### 2. `dethcrypto/TypeChain`

- active TypeScript repo
- `pnpm-lock.yaml` present
- contributor-friendly signal: 4 open `good first issue` items
- CI is standard pnpm build, test, lint, and examples
- no obvious separate dependency-review workflow surfaced

Why it fits:

- Ethereum tooling has a natural supply-chain-security story
- lockfile, source-change, and install-script checks are easy to justify here

### 3. `isomorphic-git/isomorphic-git`

- active JavaScript repo
- `package-lock.json` present
- contributor-friendly signal: 3 open `good first issue` items
- CI is broad, but focused on build, test, browser coverage, and publishing
- uses Dependabot config, but no obvious PR dependency-diff review workflow

Why it fits:

- tooling users care about trust and reproducibility
- a root-lockfile PR check is easy to explain without changing policy

### 4. `plopjs/plop`

- active JavaScript monorepo-style repo
- `yarn.lock` present
- contributor-friendly signal: 9 open `good first issue` items
- test workflow is straightforward
- no obvious dedicated dependency-review or audit workflow surfaced

Why it fits:

- package generator/tooling repos are good candidates for supply-chain messaging
- low-friction workflow addition should be understandable to maintainers

### 5. `tradingview/lightweight-charts`

- active TypeScript repo
- `pnpm-lock.yaml` present
- contributor-friendly signal: 5 open `good first issue` items
- package layout is clear and monorepo-friendly
- has `zizmor`, but no obvious dependency-review workflow surfaced

Why it still fits:

- `zizmor` covers workflow hygiene, not lockfile dependency diff review
- strong visibility makes it a good upside play if the pitch is careful

## Possible but lower-priority

### `josdejong/mathjs`

- active and visible
- `package-lock.json` present
- CI is standard npm build/test/lint/coverage

Reason to deprioritize:

- still viable, but less obviously contributor-friendly than the top group

### `MichalLytek/type-graphql`

- active and visible
- `package-lock.json` present
- already has Dependabot and CodeQL

Reason to deprioritize:

- not blocked, but the repo already signals stronger security coverage and has fewer contributor cues

### `swagger-api/swagger-ui`

- large and visible
- `package-lock.json` present
- already has `security-scan.yml`, CodeQL, and Dependabot workflows

Reason to deprioritize:

- the overlap objection is much stronger here

## Recommended order

1. `codex-team/editor.js`
2. `dethcrypto/TypeChain`
3. `isomorphic-git/isomorphic-git`
4. `plopjs/plop`
5. `tradingview/lightweight-charts`

## Suggested workflow shapes

- `editor.js`: root `package.json` plus `yarn.lock`
- `TypeChain`: root `package.json`, `pnpm-lock.yaml`, and workspace package manifests
- `isomorphic-git`: root `package.json` plus `package-lock.json`
- `plop`: root `package.json` plus `yarn.lock`
- `lightweight-charts`: root `package.json`, `pnpm-lock.yaml`, and `packages/**/package.json`

## Pitch reminder

Keep the message narrow:

- PR-time review for new install scripts
- source or tarball changes in lockfiles
- changed overrides or resolutions
- malware advisories

Keep the maintainer cost low:

- `mode: warn`
- only trigger on manifest and lockfile changes
- pin to a full SHA
- `fail-on-error: false`
