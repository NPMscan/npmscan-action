#!/usr/bin/env node
/**
 * Opens npmscan-action PRs for tracker rows that haven't been contacted yet.
 *
 * For each row: check the repo is live, clone the fork, run preflight
 * (lockfile, contribution policies, npmscan API parse check), then add the
 * workflow, push and open the PR. Every outcome is written back to tracker.csv.
 *
 *   node outreach/scripts/process-prs.ts [--wave 12] [--limit 5] [--repo owner/name] [--retry-failed] [--dry-run]
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { config } from './lib/config.ts';
import { Checkout } from './lib/git.ts';
import { createPr, currentUser, ensureFork, findOpenPr, repoInfo } from './lib/github.ts';
import { preflight } from './lib/preflight.ts';
import { Tracker, type Row } from './lib/tracker.ts';
import { WORKFLOW_PATH, writeWorkflow } from './lib/workflow.ts';

const { values: args } = parseArgs({
  options: {
    wave: { type: 'string' },
    limit: { type: 'string', default: '5' },
    repo: { type: 'string' },
    'retry-failed': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

const dryRun = args['dry-run'];
const pending = new Set(['not_contacted', ...(args['retry-failed'] ? ['failed'] : [])]);

async function processRow(tracker: Tracker, row: Row): Promise<string> {
  const record = (changes: Partial<Row>) => (dryRun ? undefined : tracker.update(row, changes));
  const { repo } = row;

  const info = repoInfo(repo);
  if (info.isArchived) {
    record({ status: 'blocked_pr_creation', outcome: 'archived', reason: 'repository is archived' });
    return 'archived';
  }

  // A dry run reads upstream directly so it never creates forks.
  const fork = dryRun ? repo : ensureFork(repo);
  const checkout = Checkout.prepare(repo, fork, info.defaultBranch);

  const check = await preflight(checkout);
  if (!check.ok) {
    const { status, reason, changes } = check.hold;
    record({ ...changes, status, reason, default_branch: info.defaultBranch });
    return `${status}: ${reason}`;
  }
  if (dryRun) return `ready (${check.lockfile})`;

  const existing = findOpenPr(repo);
  if (!existing) {
    checkout.resetBranch();
    writeWorkflow(checkout.path, check.lockfile);
    checkout.commitAndPush(WORKFLOW_PATH);
  }
  const prUrl = existing ?? createPr(repo, info.defaultBranch, config.prBodyPath);

  record({
    status: 'pr_opened',
    default_branch: info.defaultBranch,
    lockfile: check.lockfile,
    pr_url: prUrl,
    fork_branch: `${fork}:${config.branch}`,
    commit_sha: config.actionSha,
    next_action: 'monitor_pr',
    outcome: 'awaiting_review',
    reason: '',
  });
  return existing ? `PR already open: ${prUrl}` : `opened ${prUrl}`;
}

async function main(): Promise<void> {
  const tracker = new Tracker(config.trackerPath);
  const limit = Number(args.limit);

  const queue = tracker.rows
    .filter((r) => pending.has(r.status))
    .filter((r) => !args.wave || r.wave === args.wave)
    .filter((r) => !args.repo || r.repo.toLowerCase() === args.repo.toLowerCase())
    .slice(0, limit);

  if (queue.length === 0) {
    console.log('Nothing to process.');
    return;
  }
  console.log(`${dryRun ? '[dry run] ' : ''}Processing ${queue.length} repo(s) as ${currentUser()}\n`);

  let opened = 0;
  for (const [i, row] of queue.entries()) {
    let result: string;
    try {
      result = await processRow(tracker, row);
    } catch (err) {
      const message = (err as Error).message.replace(/\s+/g, ' ').slice(0, 200);
      if (!dryRun) tracker.update(row, { status: 'failed', reason: message });
      result = `failed: ${message}`;
    }
    console.log(`[${i + 1}/${queue.length}] ${row.repo} — ${result}`);
    if (result.startsWith('opened')) opened++;

    if (!dryRun && i < queue.length - 1) await sleep(config.delayBetweenReposMs);
  }

  console.log(`\nDone. ${opened} PR(s) opened.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
