# Wave 5 PRs

Opened: 2026-10-13

## PRs

- `codex-team/editor.js`
  - PR: https://github.com/codex-team/editor.js/pull/3036
  - Fork branch: `salemalem/editor.js:ci/add-npmscan-warn-mode`
  - Commit: `c1bce2a5e018407bffe50be27e5fbd0502dbf8bb`

- `dethcrypto/TypeChain`
  - PR: https://github.com/dethcrypto/TypeChain/pull/926
  - Fork branch: `salemalem/TypeChain:ci/add-npmscan-warn-mode`
  - Commit: `5899b7e139677d5cb615ab40f38b36571d72d390`

- `isomorphic-git/isomorphic-git`
  - PR: https://github.com/isomorphic-git/isomorphic-git/pull/2459
  - Fork branch: `salemalem/isomorphic-git:ci/add-npmscan-warn-mode`
  - Commit: `f71edeee41e9ee70c0181d15170914aa6b5a2ddc`

## Workflow shape used

- standalone `.github/workflows/npmscan.yml`
- `mode: warn`
- `fail-on-error: false`
- pinned `NPMscan/npmscan-action@de14168f65640a4ed1f0e82ad3ad8c80483d360d` (`v1.3.0`)
