# Wave 2 PRs

Opened: 2026-10-13

## PRs

- `ghostfolio/ghostfolio`
  - PR: https://github.com/ghostfolio/ghostfolio/pull/8153
  - Fork branch: `salemalem/ghostfolio:ci/add-npmscan-warn-mode`

- `modelcontextprotocol/typescript-sdk`
  - PR: https://github.com/modelcontextprotocol/typescript-sdk/pull/3009
  - Fork branch: `salemalem/typescript-sdk:ci/add-npmscan-warn-mode`

- `VoltAgent/voltagent`
  - PR: https://github.com/VoltAgent/voltagent/pull/1449
  - Fork branch: `salemalem/voltagent:ci/add-npmscan-warn-mode`

## Workflow shape used

- standalone `.github/workflows/npmscan.yml`
- `mode: warn`
- `fail-on-error: false`
- pinned `NPMscan/npmscan-action@de14168f65640a4ed1f0e82ad3ad8c80483d360d` (`v1.3.0`)
