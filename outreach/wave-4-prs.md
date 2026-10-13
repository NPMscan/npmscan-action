# Wave 4 PRs

Opened: 2026-10-13

## PRs

- `lukeautry/tsoa`
  - PR: https://github.com/lukeautry/tsoa/pull/1890
  - Fork branch: `salemalem/tsoa:ci/add-npmscan-warn-mode`
  - Commit: `dfa9a38ab14cd3dee7e34163016d0f8183cb9096`

- `LuanRT/YouTube.js`
  - PR: https://github.com/LuanRT/YouTube.js/pull/1296
  - Fork branch: `salemalem/YouTube.js:ci/add-npmscan-warn-mode`
  - Commit: `e0f872e3dcd309c782cd8a3fdef306c7a8acef66`

- `Ironclad/rivet`
  - PR: https://github.com/Ironclad/rivet/pull/551
  - Fork branch: `salemalem/rivet:ci/add-npmscan-warn-mode`
  - Commit: `e0b1da0a3aaf4050d9380f8014615c16fa251b0a`

## Skipped target

- `acacode/swagger-typescript-api`
  - Reason: the current `npmscan-action` docs only support `package.json`, `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, and `pnpm-lock.yaml`
  - The repo uses `bun.lock`, so it was skipped for this PR wave instead of opening a workflow with unclear lockfile support

## Workflow shape used

- standalone `.github/workflows/npmscan.yml`
- `mode: warn`
- `fail-on-error: false`
- pinned `NPMscan/npmscan-action@de14168f65640a4ed1f0e82ad3ad8c80483d360d` (`v1.3.0`)
