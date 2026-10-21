import { join } from 'node:path';

const OUTREACH_DIR = join(import.meta.dirname, '..', '..');

export const config = {
  trackerPath: join(OUTREACH_DIR, 'tracker.csv'),
  prBodyPath: join(import.meta.dirname, '..', 'templates', 'pr-body.md'),
  // Clones live outside the repo so the working tree stays clean.
  workDir: process.env.OUTREACH_WORK_DIR ?? '/tmp/npmscan-outreach',

  branch: 'ci/add-npmscan-warn-mode',
  actionSha: '83cb7d67204f8f2d1f76454ee9abf19c480dec26',
  actionTag: 'v1.4.0', // shown next to the SHA in the workflow; bump both together
  commitMessage: 'ci: add npmscan-action for dependency security',
  prTitle: 'ci: add npmscan dependency security check',

  apiUrl: 'https://npmscan.com/api/analysis/dependency-diff',
  maxLockfileBytes: 8 * 1024 * 1024,

  commandTimeoutMs: 5 * 60_000,
  // Shallow clones finish in seconds; a stalled SSH transfer should fail fast, not eat 5 minutes.
  gitTimeoutMs: 2 * 60_000,
  delayBetweenReposMs: 5_000,
} as const;

/** Supported lockfiles in order of preference, with an empty "before" document for the API check. */
export const LOCKFILES = {
  'pnpm-lock.yaml': "lockfileVersion: '9.0'\n",
  'yarn.lock': '# yarn lockfile v1\n\n',
  'package-lock.json': '{"lockfileVersion":3,"packages":{}}',
  'npm-shrinkwrap.json': '{"lockfileVersion":3,"packages":{}}',
} as const;

export type Lockfile = keyof typeof LOCKFILES;

export const UNSUPPORTED_LOCKFILES = ['bun.lock', 'bun.lockb'];
