# Wave 1 PRs

Opened: 2026-10-13

## PRs

- `openapi-ts/openapi-typescript`
  - PR: https://github.com/openapi-ts/openapi-typescript/pull/2879
  - Fork branch: `salemalem/openapi-typescript:ci/add-npmscan-warn-mode`

- `typeorm/typeorm`
  - PR: https://github.com/typeorm/typeorm/pull/12965
  - Fork branch: `salemalem/typeorm:ci/add-npmscan-warn-mode`

- `medusajs/medusa`
  - PR: https://github.com/medusajs/medusa/pull/17264
  - Fork branch: `salemalem/medusa:ci/add-npmscan-warn-mode`

## Workflow shape used

- standalone `.github/workflows/npmscan.yml`
- `mode: warn`
- `fail-on-error: false`
- pinned `NPMscan/npmscan-action@de14168f65640a4ed1f0e82ad3ad8c80483d360d` (`v1.3.0`)
