import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config, type Lockfile } from './config.ts';

export const WORKFLOW_PATH = '.github/workflows/npmscan.yml';

// actions/checkout v4.2.2, pinned like the action itself.
const CHECKOUT_SHA = '11bd71901bbe5b1630ceea73d27597364c9af683';

// Scans the lockfile plus package.json (root install scripts and overrides live only there).
// `paths` is the scanned files plus this workflow, so it also runs once on the PR that adds it.
// The comment only appears when something is flagged, and the timeout covers the action's
// own API time cap (~4.5 min per file) with slack.
const render = (lockfile: Lockfile) => `name: NPMscan

on:
  pull_request:
    types: [opened, synchronize, reopened]
    paths: [package.json, ${lockfile}, ${WORKFLOW_PATH}]

permissions: {}

jobs:
  npmscan:
    name: Dependency Security Scan
    runs-on: ubuntu-latest
    timeout-minutes: 15
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@${CHECKOUT_SHA} # v4.2.2
        with:
          persist-credentials: false
      - name: Run NPMscan
        uses: NPMscan/npmscan-action@${config.actionSha} # ${config.actionTag}
        with:
          files: |
            ${lockfile}
            package.json
          mode: warn
          comment: on-findings
          fail-on-error: false
`;

export function writeWorkflow(repoPath: string, lockfile: Lockfile): void {
  const target = join(repoPath, WORKFLOW_PATH);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, render(lockfile));
}
