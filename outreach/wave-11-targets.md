# Wave 11 Targets

This wave targets highly popular and high-traffic Node.js / TypeScript repositories to integrate `npmscan-action` as a PR-time supply-chain security check.

| Repo | Stars | Default Branch | Lockfile |
| :--- | :---: | :--- | :--- |
| `vercel/next.js` | 143k | `canary` | `pnpm-lock.yaml` |
| `webpack/webpack` | 65k | `main` | `yarn.lock` |
| `prettier/prettier` | 52k | `main` | `yarn.lock` |
| `serverless/serverless` | 46k | `main` | `package-lock.json` |
| `louislam/uptime-kuma` | 92k | `master` | `package-lock.json` |

## Notes
- These repositories have massive reach and are critical pieces of the Node.js ecosystem.
- `vercel/next.js` is a huge pnpm workspace, making it a great stress test for our action.
- Ensure to use `mode: warn` and `fail-on-error: false` to minimize friction.
