# Wave 1 Targets

Research date: 2026-10-13

## Best targets first

### 1. `openapi-ts/openapi-typescript`

- active TypeScript repo
- `pnpm-lock.yaml` present
- CI is straightforward
- contributor-friendly signal: 12 open `good first issue` items when checked
- no obvious dedicated dependency audit workflow surfaced in the workflow set

### 2. `typeorm/typeorm`

- very visible TypeScript package with large install base
- `pnpm-lock.yaml` present
- active repo
- contributor-friendly signal: 11 open `good first issue` items
- visible PR workflow and CodeQL, but no obvious dedicated PR dependency diff scan

### 3. `payloadcms/payload`

- large active TypeScript repo
- `pnpm-lock.yaml` present
- already has a dependency audit workflow, but it is scheduled rather than clearly PR diff-focused

### 4. `medusajs/medusa`

- active TypeScript repo with very high package surface area
- `yarn.lock` present
- contributor-friendly signal: 22 open `good first issue` items
- visible Dependabot and security triage automation

### 5. `Budibase/budibase`

- active TypeScript-heavy monorepo
- `yarn.lock` present
- visible CI depth, but no obvious dedicated dependency audit workflow in the inspected file

### 6. `kysely-org/kysely`

- active TypeScript infra library
- `pnpm-lock.yaml` present
- contributor-friendly signal: 4 open `good first issue` items
- already runs `pnpm audit` and `zizmor`

## Lower-probability targets

- `calcom/cal.com`
- `novuhq/novu`
- `directus/directus`
- `strapi/strapi`
- `expo/expo`

## Special leverage bet

`t3-oss/create-t3-app` is better as a docs or template recipe than as a default CI-check ask.

## Recommended order

1. `openapi-ts/openapi-typescript`
2. `typeorm/typeorm`
3. `medusajs/medusa`
4. `Budibase/budibase`
5. `payloadcms/payload`
6. `kysely-org/kysely`
7. `t3-oss/create-t3-app`

## Pitch

Position `npmscan` as PR-time supply-chain review for:

- new install scripts
- tarball or source changes in lockfiles
- changed overrides or resolutions
- malware advisories

Keep the ask low-friction:

- `mode: warn`
- trigger only on `package.json` and lockfile changes
- pin to a full SHA
- keep `fail-on-error: false`
