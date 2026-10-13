# Wave 6 Targets

Research date: 2026-10-13

This wave is intentionally broader than the earlier shortlists.

The goal here is **reach**, so this is not a "cut to 5" document. Anything with a supported lockfile and no hard blocker stays in the batch. The only hard skips are repos with unsupported lockfiles, no supported lockfile at all, or very direct overlap with an existing PR-time dependency-review workflow.

## Best immediate targets

### 1. `tanstack/query`

- active TypeScript monorepo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `main`
- workflow set includes `pr.yml` and `zizmor.yml`, but no obvious dedicated dependency-review workflow
- high-visibility package family, so traction upside is strong

Suggested workflow shape:

- root `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `packages/**/package.json`

### 2. `TanStack/router`

- active TypeScript monorepo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `main`
- workflow set includes `pr.yml`, `bundle-size.yml`, and `zizmor.yml`
- no obvious direct dependency-review workflow surfaced

Suggested workflow shape:

- root `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `packages/**/package.json`
- `examples/**/package.json`

### 3. `vitest-dev/vitest`

- active TypeScript monorepo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `main`
- visible security-related workflows include `semgrep.yml` and `zizmor.yml`
- still looks additive because no obvious PR dependency-diff review workflow surfaced

Suggested workflow shape:

- root `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `packages/**/package.json`

### 4. `colinhacks/zod`

- active TypeScript monorepo-style repo
- `pnpm-lock.yaml` present
- default branch: `main`
- workflow set is centered on tests and release automation
- no obvious dependency-review workflow surfaced

Suggested workflow shape:

- root `package.json`
- `pnpm-lock.yaml`
- `packages/**/package.json`

### 5. `honojs/hono`

- active TypeScript repo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `main`
- CI looks standard and understandable
- no obvious dedicated dependency-review workflow surfaced

Suggested workflow shape:

- root `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `src/**/package.json` only if needed after clone inspection

### 6. `unjs/nitro`

- active TypeScript monorepo-style repo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `main`
- workflow set is mostly standard CI and publish automation
- no obvious direct dependency-review workflow surfaced

Suggested workflow shape:

- root `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `examples/**/package.json`

### 7. `unjs/h3`

- active TypeScript repo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `main`
- lean workflow surface with CI and publish only
- very low-friction fit for a narrow warn-mode PR

Suggested workflow shape:

- root `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

### 8. `faker-js/faker`

- active TypeScript repo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `next`
- workflow set is active but not obviously overlapping with dependency-diff review
- strong visibility and package trust story

Suggested workflow shape:

- root `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

### 9. `react-hook-form/react-hook-form`

- active TypeScript monorepo-style repo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `master`
- has CodeQL, but no obvious dedicated dependency-review workflow surfaced
- very visible package with a good trust story

Suggested workflow shape:

- root `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `src/**/package.json` only if needed after clone inspection

### 10. `pmndrs/zustand`

- active TypeScript repo
- both `package-lock.json` and `pnpm-lock.yaml` are present
- default branch: `main`
- workflow set is focused on tests, docs, and releases
- simple candidate with a clean lockfile story

Suggested workflow shape:

- root `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

### 11. `reduxjs/redux-toolkit`

- active TypeScript monorepo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `master`
- workflow set is mostly tests, size checks, and release steps
- no obvious PR dependency-diff review workflow surfaced

Suggested workflow shape:

- root `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `packages/**/package.json`

### 12. `tinyhttp/tinyhttp`

- active TypeScript monorepo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `master`
- visible contributor signal: 2 open `good first issue` items when checked
- very light workflow surface makes it an easy outreach fit

Suggested workflow shape:

- root `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `packages/**/package.json`

## Keep going after the first 12

These are still viable for a reach-heavy wave, but they carry a bit more overlap or operational complexity.

### 13. `tldraw/tldraw`

- active TypeScript monorepo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `main`
- visible contributor signal: 7 open `good first issue` items when checked
- workflow surface is large, but no obvious dedicated dependency-review workflow was surfaced

### 14. `nestjs/nest`

- very visible TypeScript repo
- `package-lock.json` present
- default branch: `master`
- has CodeQL, but not an obvious PR dependency-diff review workflow
- strong traction upside if the PR stays extremely narrow

### 15. `date-fns/date-fns`

- active TypeScript monorepo-style repo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `main`
- workflow set looks mainly test-oriented
- clean fit for a standard pnpm workflow

### 16. `axios/axios`

- very visible JavaScript repo
- `package-lock.json` present
- default branch: `v1.x`
- has `lockfile-lint.yml`, which is adjacent but still not the same as `npmscan`
- good reach candidate if we keep the pitch focused on install scripts and tarball/source changes

### 17. `chakra-ui/chakra-ui`

- active TypeScript monorepo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `main`
- workflow set looks fairly light for the size of the repo
- no obvious dedicated dependency-review workflow surfaced

### 18. `solidjs/solid`

- active TypeScript monorepo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `main`
- has `cve-lite.yml`, so overlap is somewhat stronger
- still viable if we want broader reach and keep the pitch distinct from CVE-only scanning

### 19. `sveltejs/kit`

- active TypeScript monorepo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `main`
- has `audit.yml`, so overlap is somewhat stronger
- still viable because `npmscan` is broader than a basic audit step

### 20. `withastro/astro`

- active TypeScript monorepo
- `pnpm-lock.yaml` and `pnpm-workspace.yaml` present
- default branch: `main`
- has `diff-dependencies.yml`, so overlap is more noticeable
- still usable as a later-wave reach target, but not the first place I would start

## Hard skips from this pass

### `remotion-dev/remotion`

- skipped because the repo uses `bun.lock`

### `elysiajs/elysia`

- skipped because the repo uses `bun.lock`

### `sindresorhus/ky`

- skipped because no supported root lockfile was surfaced

### `nuxt/nuxt`

- skipped because it already has `dependency-review.yml`, which is too direct an overlap for the current pitch

## Recommended execution order

Since the goal is maximum reach, the right move is not to trim this wave down. Instead:

1. open PRs for the first 12
2. keep going into the next 8 if the workflow additions stay clean
3. only pause when we hit overlap objections, archived repos, or lockfile support blockers

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
