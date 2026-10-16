#!/usr/bin/env node
/**
 * Pulls live PR state from GitHub into tracker.csv: open/closed/merged, who
 * replied, and whether a maintainer is waiting on us. Use this instead of
 * checking PRs one by one.
 *
 *   node outreach/scripts/refresh.ts --agent <model> [--wave 12] [--repo owner/name] [--dry-run]
 *
 * Updates status, outcome, maintainer, next_action and last_checked. Never
 * touches reason or notes: those hold what maintainers actually said. Only rows
 * whose state changed get this run's agent; the rest keep theirs.
 */
import { parseArgs } from 'node:util';
import { config } from './lib/config.ts';
import { currentUser } from './lib/github.ts';
import { runAsync } from './lib/shell.ts';
import { resolveAgent, Tracker, type Row } from './lib/tracker.ts';

const { values: args } = parseArgs({
  options: {
    wave: { type: 'string' },
    repo: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    agent: { type: 'string' },
  },
});

const STALE_AFTER_DAYS = 7;
const CONCURRENCY = 8;
// Outcomes a person set on purpose; refresh keeps them while the PR state allows.
const KEEP_WHEN_CLOSED = new Set(['rejected', 'rejected_spam', 'auto_closed_bot_flag', 'closed_no_comment']);
const KEEP_WHEN_OPEN = new Set(['blocked_requirement']);

interface Activity { login: string; type: string; association: string; at: string }

// Comments from accounts with no tie to the repo (association NONE) are mostly
// email auto-replies from watchers ("your mail was received"), not maintainers.
const REPO_ROLES = new Set(['OWNER', 'MEMBER', 'COLLABORATOR', 'CONTRIBUTOR']);
interface PrState { state: string; merged: boolean; createdAt: string; activity: Activity[] }

async function fetchPr(url: string): Promise<PrState> {
  const m = url.match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (!m) throw new Error(`not a PR URL: ${url}`);
  const [, repo, n] = m;
  const who = '{login: .user.login, type: .user.type, association: .author_association, at: (.submitted_at // .created_at)}';
  const [pr, comments, reviews, inline] = await Promise.all([
    runAsync('gh', ['api', `repos/${repo}/pulls/${n}`, '--jq', '{state, merged: (.merged_at != null), createdAt: .created_at}']),
    runAsync('gh', ['api', '--paginate', `repos/${repo}/issues/${n}/comments`, '--jq', `.[] | ${who}`]),
    runAsync('gh', ['api', '--paginate', `repos/${repo}/pulls/${n}/reviews`, '--jq', `.[] | ${who}`]),
    runAsync('gh', ['api', '--paginate', `repos/${repo}/pulls/${n}/comments`, '--jq', `.[] | ${who}`]),
  ]);
  const lines = (s: string) => s.split('\n').filter(Boolean).map((l) => JSON.parse(l) as Activity);
  return { ...JSON.parse(pr), activity: [...lines(comments), ...lines(reviews), ...lines(inline)] };
}

function classify(row: Row, pr: PrState, me: string): Partial<Row> {
  const isMe = (a: Activity) => a.login.toLowerCase() === me.toLowerCase();
  const people = pr.activity
    .filter((a) => a.type !== 'Bot' && !a.login.endsWith('[bot]'))
    .filter((a) => isMe(a) || REPO_ROLES.has(a.association))
    .sort((a, b) => a.at.localeCompare(b.at));
  const maintainers = people.filter((a) => !isMe(a));
  const last = people.at(-1);
  // Review bots (CodeRabbit, Greptile, Socket, ...) never count as a reply.
  const maintainer = maintainers.at(-1)?.login ?? '';

  if (pr.merged) return { status: 'pr_merged', outcome: 'merged', maintainer, next_action: 'none' };
  if (pr.state === 'closed') {
    const outcome = KEEP_WHEN_CLOSED.has(row.outcome) ? row.outcome : maintainers.length ? 'rejected' : 'closed_no_comment';
    return { status: 'pr_closed', outcome, maintainer, next_action: 'none' };
  }

  const theyReplied = last !== undefined && !isMe(last);
  const next_action = theyReplied ? 'reply_to_maintainer' : 'monitor_pr';
  if (KEEP_WHEN_OPEN.has(row.outcome)) return { status: 'pr_opened', maintainer, next_action };
  if (maintainers.length === 0) {
    const ageDays = (Date.now() - Date.parse(pr.createdAt)) / 86_400_000;
    return { status: 'pr_opened', outcome: ageDays > STALE_AFTER_DAYS ? 'stale' : 'awaiting_review', maintainer, next_action };
  }
  return { status: 'pr_opened', outcome: theyReplied ? 'engaged' : 'awaiting_maintainer', maintainer, next_action };
}

/** Runs fn over items with at most `limit` in flight. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]).then(
        (value) => ({ status: 'fulfilled', value }) as const,
        (reason) => ({ status: 'rejected', reason }) as const,
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main(): Promise<void> {
  const dryRun = args['dry-run'];
  const agent = dryRun ? '' : resolveAgent(args.agent);
  const tracker = new Tracker(config.trackerPath, { readOnly: dryRun, agent });
  const rows = tracker.rows
    .filter((r) => r.pr_url.startsWith('https://github.com/'))
    .filter((r) => !args.wave || r.wave === args.wave)
    .filter((r) => !args.repo || r.repo.toLowerCase() === args.repo.toLowerCase());
  if (rows.length === 0) {
    console.log('No PRs to refresh.');
    return;
  }

  const me = currentUser();
  console.log(`${dryRun ? '[dry run] ' : ''}Refreshing ${rows.length} PR(s) as ${me}\n`);
  const results = await pool(rows, CONCURRENCY, (r) => fetchPr(r.pr_url));

  const needReply: string[] = [];
  const counts = new Map<string, number>();
  for (const [i, row] of rows.entries()) {
    const result = results[i];
    if (result.status === 'rejected') {
      console.log(`  ! ${row.repo}: ${(result.reason as Error).message}`);
      continue;
    }
    const changes = classify(row, result.value, me);
    const diff = Object.entries(changes).filter(([k, v]) => row[k as keyof Row] !== v);
    if (diff.length) console.log(`  ${row.repo}: ${diff.map(([k, v]) => `${k} ${row[k as keyof Row] || '∅'} → ${v}`).join(', ')}`);
    const outcome = changes.outcome ?? row.outcome;
    counts.set(outcome || '∅', (counts.get(outcome || '∅') ?? 0) + 1);
    if (changes.next_action === 'reply_to_maintainer') needReply.push(`${row.pr_url} (${changes.maintainer})`);
    if (!dryRun) tracker.update(row, changes, { stamp: diff.length > 0 });
  }

  console.log(`\nOutcomes: ${[...counts].map(([k, v]) => `${k} ${v}`).join(', ')}`);
  if (needReply.length) console.log(`\nWaiting on our reply:\n${needReply.map((u) => `  ${u}`).join('\n')}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
