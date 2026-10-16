import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config, type Lockfile } from './config.ts';

export const WORKFLOW_PATH = '.github/workflows/npmscan.yml';

// The action defaults to package-lock.json, so `file` must name the repo's lockfile.
const render = (lockfile: Lockfile) => `name: NPMscan

on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write

jobs:
  npmscan:
    name: Dependency Security Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run NPMscan
        uses: NPMscan/npmscan-action@${config.actionSha}
        with:
          file: ${lockfile}
          mode: warn
          fail-on-error: false
`;

export function writeWorkflow(repoPath: string, lockfile: Lockfile): void {
  const target = join(repoPath, WORKFLOW_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, render(lockfile));
}
