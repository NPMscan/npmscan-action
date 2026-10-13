# Wave 2 Targets

Research date: 2026-10-13

## Best second-wave targets

### 1. `ghostfolio/ghostfolio`

- active TypeScript app
- `package-lock.json` present
- main PR workflow is straightforward build/lint/test
- strong contributor signal: 14 open `good first issue` items

### 2. `sequelize/sequelize`

- large, active TypeScript monorepo
- `yarn.lock` present
- CI is deep, but no obvious dedicated dependency review step surfaced
- strong contributor signal: 12 open `good first issue` items

### 3. `modelcontextprotocol/typescript-sdk`

- active TypeScript SDK
- `pnpm-lock.yaml` present
- strong contributor signal: 5 open `good first issue` items
- current CI appears focused on build, tests, and examples

### 4. `VoltAgent/voltagent`

- active TypeScript monorepo
- `pnpm-lock.yaml` present
- broad PR workflow, but no separate dependency audit workflow found
- contributor signal: 3 open `good first issue` items

### 5. `web3/web3.js`

- large active TypeScript repo
- `yarn.lock` present
- visible workflow set did not show a dedicated dependency review or audit workflow

### 6. `maplibre/maplibre-gl-js`

- active TypeScript repo
- `package-lock.json` present
- contributor signal: 2 open `good first issue` items

### 7. `stenciljs/core`

- active TypeScript project
- `package-lock.json` present
- broad workflow set, but no obvious separate dependency review workflow surfaced

## Possible but lower-priority

- `FuelLabs/fuels-ts`
- `cucumber/cucumber-js`
- `mermaid-js/mermaid`

## Recommended order

1. `ghostfolio/ghostfolio`
2. `modelcontextprotocol/typescript-sdk`
3. `VoltAgent/voltagent`
4. `sequelize/sequelize`
5. `web3/web3.js`
6. `maplibre/maplibre-gl-js`
7. `stenciljs/core`

## Pitch

Same positioning as wave 1:

- not "another CVE scanner"
- instead PR-time review for:
  - new install scripts
  - lockfile source or tarball changes
  - changed overrides or resolutions
  - malware advisories

Keep it low-friction:

- `mode: warn`
- trigger only on `package.json` and lockfile changes
- pin to a full SHA
- keep `fail-on-error: false`
