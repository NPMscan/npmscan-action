#!/usr/bin/env node
/**
 * Moves the npmscan-action pin in our outreach PRs to config.actionSha and
 * config.actionTag, e.g. after a security release.
 *
 *   node outreach/scripts/bump-pin.ts --agent <model> [--repo owner/name] [--skip a/b,c/d] [--dry-run]
 *   node outreach/scripts/bump-pin.ts --agent <model> --merged [--repo owner/name] [--dry-run]
 *
 * Open PRs (status pr_opened) get one commit on the PR branch, pushed without
 * --force. It is signed off only when the PR's existing commits are (DCO repos).
 * --merged handles repos that already merged our workflow (status pr_merged):
 * they get a follow-up PR from its own branch, and its URL goes in the row's notes.
 *
 * Files are only changed where an `npmscan/npmscan-action@<sha>` pin appears in
 * .github/workflows. Rows already on config.actionSha are skipped. Put repos
 * that need a special push path in --skip (kunchenguid/lavish-axi only accepts
 * `git push no-mistakes`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { config } from './lib/config.ts';
import { Checkout } from './lib/git.ts';
import { currentUser, ensureFork, repoInfo } from './lib/github.ts';
import { run } from './lib/shell.ts';
import { resolveAgent, Tracker, type Row } from './lib/tracker.ts';

const { values: args } = parseArgs({
  options: {
    repo: { type: 'string' },
    skip: { type: 'string', default: '' },
    merged: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    agent: { type: 'string' },
  },
});

const dryRun = args['dry-run'];
const skip = new Set(args.skip.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
const FOLLOW_UP_BRANCH = 'ci/bump-npmscan-action';
const RELEASE_URL = `https://github.com/NPMscan/npmscan-action/releases/tag/${config.actionTag}`;
const PIN = /(npmscan\/npmscan-action@)[0-9a-f]{40}(?:[ \t]*#[ \t]*v[\d.]+)?/gi;

const commitMessage = `ci: bump npmscan-action to ${config.actionTag}

${config.actionTag} reads dependency files from git and never follows symlinks.
Earlier versions copied the PR's lockfile with cp, so a PR could replace
it with a symlink to another file on the runner and have that file
uploaded. Release notes: ${RELEASE_URL}`;

const followUpBody = `Bumps the pinned \`NPMscan/npmscan-action\` to [${config.actionTag}](${RELEASE_URL}). The only change is the commit SHA and the version comment next to it.

${config.actionTag} fixes a security issue in all earlier versions: the action copied the PR's dependency file with \`cp\`, which follows symlinks. A PR could commit the lockfile as a symlink to another file on the runner, and the action would upload that file to npmscan.com instead of a lockfile. The new version reads both sides from git and never follows symlinks.

Disclosure: I maintain npmscan and npmscan-action. Thanks for adopting it, and sorry for the extra PR.`;

interface PrView {
  state: string;
  headRefName: string;
  baseRefName: string;
  fork: string;
  signedOff: boolean;
}

function viewPr(url: string): PrView {
  const raw = run('gh', [
    'pr', 'view', url, '--json', 'state,headRefName,baseRefName,headRepository,headRepositoryOwner,commits',
    '--jq', '{state, headRefName, baseRefName, fork: (.headRepositoryOwner.login + "/" + .headRepository.name), signedOff: ([.commits[].messageBody | test("Signed-off-by:")] | any)}',
  ]);
  return JSON.parse(raw) as PrView;
}

/** Rewrites every pin under .github/workflows in the checkout; returns the changed paths. */
function rewritePins(checkout: Checkout): string[] {
  const files = checkout.git('ls-tree', '-r', '--name-only', 'HEAD', '--', '.github/workflows')
    .split('\n').filter((f) => /\.ya?ml$/.test(f));
  const changed: string[] = [];
  for (const file of files) {
    const path = join(checkout.path, file);
    const before = readFileSync(path, 'utf-8');
    const after = before.replace(PIN, (_m, prefix: string) => `${prefix}${config.actionSha} # ${config.actionTag}`);
    if (after === before) continue;
    if (!dryRun) writeFileSync(path, after);
    changed.push(file);
  }
  return changed;
}

function commit(checkout: Checkout, files: string[], signoff: boolean): void {
  checkout.git('add', '--force', ...files);
  // No Agent trailer: these commits land in other people's repos.
  checkout.git('commit', ...(signoff ? ['--signoff'] : []), '-m', commitMessage);
}

function bumpOpenPr(tracker: Tracker, row: Row): string {
  const pr = viewPr(row.pr_url);
  if (pr.state !== 'OPEN') return `skipped: PR is ${pr.state.toLowerCase()}`;
  const checkout = Checkout.prepare(row.repo, pr.fork, pr.baseRefName);
  checkout.git('fetch', '--depth', '1', '--filter=blob:none', 'origin', pr.headRefName);
  checkout.git('checkout', '--force', '-B', pr.headRefName, 'FETCH_HEAD');
  const changed = rewritePins(checkout);
  if (changed.length === 0) return 'skipped: no npmscan-action pin found on the PR branch';
  if (dryRun) return `would bump ${changed.join(', ')}${pr.signedOff ? ' (signed off)' : ''}`;
  commit(checkout, changed, pr.signedOff);
  checkout.git('push', 'origin', `HEAD:refs/heads/${pr.headRefName}`);
  tracker.update(row, { commit_sha: config.actionSha });
  return `bumped ${changed.join(', ')}${pr.signedOff ? ' (signed off)' : ''}`;
}

function bumpMerged(tracker: Tracker, row: Row): string {
  const existing = run('gh', [
    'pr', 'list', '--repo', row.repo, '--author', '@me', '--state', 'open',
    '--head', FOLLOW_UP_BRANCH, '--json', 'url', '--jq', '.[0].url // ""',
  ], { allowFailure: true });
  if (existing) return `skipped: follow-up already open ${existing}`;
  const info = repoInfo(row.repo);
  if (info.isArchived) return 'skipped: repo is archived';
  const fork = ensureFork(row.repo);
  const checkout = Checkout.prepare(row.repo, fork, info.defaultBranch);
  checkout.git('checkout', '--force', '-B', FOLLOW_UP_BRANCH, checkout.base);
  const changed = rewritePins(checkout);
  if (changed.length === 0) return `skipped: no npmscan-action pin on ${info.defaultBranch}`;
  const signedOff = /Signed-off-by:/.test(run('gh', ['pr', 'view', row.pr_url, '--json', 'commits', '--jq', '[.commits[].messageBody] | join("\\n")']));
  if (dryRun) return `would open a follow-up PR for ${changed.join(', ')}${signedOff ? ' (signed off)' : ''}`;
  commit(checkout, changed, signedOff);
  checkout.git('push', '--force', '-u', 'origin', FOLLOW_UP_BRANCH);
  const bodyFile = join(config.workDir, `bump-pin-body-${row.repo.replace('/', '__')}.md`);
  writeFileSync(bodyFile, followUpBody);
  const out = run('gh', [
    'pr', 'create', '--repo', row.repo, '--base', info.defaultBranch,
    '--head', `${currentUser()}:${FOLLOW_UP_BRANCH}`,
    '--title', `ci: bump npmscan-action to ${config.actionTag} (security fix)`, '--body-file', bodyFile,
  ]);
  const url = out.split('\n').find((l) => l.startsWith('https://github.com/')) ?? out;
  const note = `follow-up PR ${url} (${config.actionTag} pin)`;
  tracker.update(row, { notes: row.notes ? `${row.notes}; ${note}` : note });
  return `opened ${url}`;
}

async function main(): Promise<void> {
  const agent = dryRun ? '' : resolveAgent(args.agent);
  const tracker = new Tracker(config.trackerPath, { readOnly: dryRun, agent });
  const status = args.merged ? 'pr_merged' : 'pr_opened';
  const queue = tracker.rows
    .filter((r) => r.status === status && r.pr_url)
    .filter((r) => !args.repo || r.repo.toLowerCase() === args.repo.toLowerCase())
    .filter((r) => !skip.has(r.repo.toLowerCase()))
    .filter((r) => args.merged || r.commit_sha !== config.actionSha);

  if (queue.length === 0) {
    console.log('Nothing to bump.');
    return;
  }
  console.log(`${dryRun ? '[dry run] ' : ''}Bumping ${queue.length} ${args.merged ? 'merged repo(s)' : 'open PR(s)'} to ${config.actionTag} as ${currentUser()}\n`);

  for (const [i, row] of queue.entries()) {
    let result: string;
    try {
      result = args.merged ? bumpMerged(tracker, row) : bumpOpenPr(tracker, row);
    } catch (err) {
      // Not written to the tracker: the PR itself is fine, only the bump failed.
      result = `failed: ${(err as Error).message.replace(/\s+/g, ' ').slice(0, 200)}`;
    }
    console.log(`[${i + 1}/${queue.length}] ${row.repo} — ${result}`);
    if (!dryRun && i < queue.length - 1) await sleep(config.delayBetweenReposMs);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
