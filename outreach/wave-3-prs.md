# Wave 3 PRs

Opened: 2026-10-13

## PRs

- `sequelize/sequelize`
  - PR: https://github.com/sequelize/sequelize/pull/18552
  - Fork branch: `salemalem/sequelize:ci/add-npmscan-warn-mode`
  - Commit: `c08f9714e36d8967398e8139b74202059db81526`

- `maplibre/maplibre-gl-js`
  - PR: https://github.com/maplibre/maplibre-gl-js/pull/8744
  - Fork branch: `salemalem/maplibre-gl-js:ci/add-npmscan-warn-mode`
  - Commit: `be214de4d96289192190e198a553f852f39d7bac`

- `stenciljs/core`
  - PR: https://github.com/stenciljs/core/pull/6953
  - Fork branch: `salemalem/core:ci/add-npmscan-warn-mode`
  - Commit: `acd29011438be3646fbb38bcd0d0d2111b07afdf`

## Blocked attempt

- `web3/web3.js`
  - Attempted branch: `salemalem/web3.js:ci/add-npmscan-warn-mode`
  - Commit: `f78dff16e2e583d22b38cc2761561773c7f7a0df`
  - Result: GitHub rejected PR creation with `Repository was archived so is read-only`

## Workflow shape used

- standalone `.github/workflows/npmscan.yml`
- `mode: warn`
- `fail-on-error: false`
- pinned `NPMscan/npmscan-action@de14168f65640a4ed1f0e82ad3ad8c80483d360d` (`v1.3.0`)
