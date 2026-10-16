#!/usr/bin/env node
/**
 * Records a decision in tracker.csv without hand-editing it: a skip, a hold,
 * a maintainer reply, or a new candidate repo.
 *
 *   node outreach/scripts/mark.ts --agent <model> --repo owner/name --status skipped_policy --reason "bans bot PRs"
 *   node outreach/scripts/mark.ts --agent <model> --repo owner/name --outcome engaged --maintainer alice --reason "asked for docs link"
 *   node outreach/scripts/mark.ts --agent <model> --repo owner/name --add --wave 13 [--priority primary] [--notes "..."]
 *
 * Values for --status and --outcome are checked against lib/tracker.ts.
 * --agent (or NPMSCAN_AGENT) names the model making the change.
 */
import { parseArgs } from 'node:util';
import { config } from './lib/config.ts';
import { COLUMNS, resolveAgent, Tracker, type Row } from './lib/tracker.ts';

const { values: args } = parseArgs({
  options: {
    repo: { type: 'string' },
    add: { type: 'boolean', default: false },
    wave: { type: 'string' },
    priority: { type: 'string' },
    status: { type: 'string' },
    outcome: { type: 'string' },
    reason: { type: 'string' },
    notes: { type: 'string' },
    maintainer: { type: 'string' },
    'next-action': { type: 'string' },
    'pr-url': { type: 'string' },
    agent: { type: 'string' },
  },
});

if (!args.repo || !/^[\w.-]+\/[\w.-]+$/.test(args.repo)) throw new Error('--repo owner/name is required');

const changes: Partial<Row> = {};
const set = (column: (typeof COLUMNS)[number], value: string | undefined) => {
  if (value !== undefined) changes[column] = value;
};
set('status', args.status);
set('outcome', args.outcome);
set('reason', args.reason);
set('notes', args.notes);
set('maintainer', args.maintainer);
set('next_action', args['next-action']);
set('pr_url', args['pr-url']);
set('priority', args.priority);

const tracker = new Tracker(config.trackerPath, { agent: resolveAgent(args.agent) });
let row: Row;
if (args.add) {
  if (!args.wave) throw new Error('--add needs --wave');
  row = tracker.add({ wave: args.wave, repo: args.repo, priority: 'primary', ...changes });
  console.log(`added ${row.repo} to wave ${row.wave} (${row.status})`);
} else {
  const found = tracker.find(args.repo);
  if (!found) throw new Error(`${args.repo} is not in the tracker; use --add --wave N to add it`);
  if (Object.keys(changes).length === 0) throw new Error('nothing to change: pass --status, --outcome, --reason, ...');
  tracker.update(found, changes);
  row = found;
  console.log(`${row.repo}: ${Object.entries(changes).map(([k, v]) => `${k}=${v}`).join(', ')}`);
}
