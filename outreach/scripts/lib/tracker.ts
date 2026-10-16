import { readFileSync, rmSync, writeFileSync } from 'node:fs';

export const COLUMNS = [
  'wave', 'repo', 'status', 'priority', 'default_branch', 'lockfile', 'pr_url', 'fork_branch',
  'commit_sha', 'next_action', 'notes', 'outcome', 'maintainer', 'reason', 'last_checked', 'agent',
] as const;

export type Column = (typeof COLUMNS)[number];
export type Row = Record<Column, string>;

/** Where the repo is in the pipeline. Grouped by meaning; keep new values in the matching group. */
export const STATUSES = [
  // Not contacted yet
  'not_contacted', 'candidate_backup', 'candidate_low_confidence', 'candidate_incident',
  // Waiting on a person or a different approach
  'needs_user_decision', 'needs_issue_first', 'issue_commented',
  // Contacted
  'pr_opened', 'pr_closed', 'pr_merged',
  // Will not contact (reason column says why)
  'skipped', 'skipped_no_supported_lockfile', 'skipped_unsupported_lockfile', 'skipped_policy',
  'skipped_bot_detection', 'skipped_inactive_external', 'blocked_policy', 'blocked_pr_creation',
  'deprioritized_overlap',
  // The automation errored; retry with --retry-failed
  'failed',
] as const;

/** How the maintainers responded. Empty until there is something to say. */
export const OUTCOMES = [
  '', 'not_contacted', 'awaiting_review', 'awaiting_maintainer', 'engaged', 'stale', 'blocked_requirement',
  'merged', 'rejected', 'rejected_spam', 'closed_no_comment', 'auto_closed_bot_flag',
  'blocked_pr_creation', 'archived',
] as const;

/**
 * Who did the work, e.g. claude-opus-5.5, gpt-5.1, gemini-2.5-pro, kimi-k2, or
 * human. Comes from --agent or NPMSCAN_AGENT; every command that writes rows
 * requires it.
 */
export function resolveAgent(flag: string | undefined): string {
  const agent = (flag ?? process.env.NPMSCAN_AGENT ?? '').trim().toLowerCase();
  const example = 'e.g. --agent claude-opus-5.5, gpt-5.1, gemini-2.5-pro, kimi-k2, or human';
  if (!agent) throw new Error(`Say which model you are: pass --agent or set NPMSCAN_AGENT (${example})`);
  if (!/^[a-z][a-z0-9.+-]{1,40}$/.test(agent) || GENERIC_AGENTS.has(agent)) {
    throw new Error(`--agent '${agent}' is not a model name (${example})`);
  }
  return agent;
}

const GENERIC_AGENTS = new Set(['ai', 'agent', 'llm', 'bot', 'assistant', 'model', 'unknown', 'me']);

const isStatus = (v: string) => (STATUSES as readonly string[]).includes(v);
const isOutcome = (v: string) => (OUTCOMES as readonly string[]).includes(v);

/** RFC 4180 parser: handles quoted fields containing commas, quotes and newlines. */
function parseCsv(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { record.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += c;
  }
  if (field || record.length) { record.push(field); records.push(record); }

  return records.filter((r) => r.some((f) => f !== ''));
}

const escape = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);

export class Tracker {
  readonly rows: Row[];
  private readonly path: string;
  private readonly readOnly: boolean;
  private readonly agent: string;

  /**
   * Takes a lock unless readOnly, so two runs can't overwrite each other's rows.
   * agent is stamped on every row written unless update() gets { stamp: false }
   * (refresh.ts does that for rows whose state didn't change).
   */
  constructor(path: string, { readOnly = false, agent = '' } = {}) {
    this.path = path;
    this.readOnly = readOnly;
    this.agent = agent;
    const [header, ...parsed] = parseCsv(readFileSync(path, 'utf-8'));
    // Trackers from before the agent column get an empty one.
    const legacy = header?.join(',') === COLUMNS.slice(0, -1).join(',');
    if (!legacy && header?.join(',') !== COLUMNS.join(',')) {
      throw new Error(`Unexpected tracker header in ${path}: ${header?.join(',')}`);
    }
    const records = legacy ? parsed.map((r) => [...r, '']) : parsed;
    // Refuse to load malformed rows: saving would silently drop or shift fields.
    const bad = records.findIndex((r) => r.length !== COLUMNS.length);
    if (bad !== -1) {
      throw new Error(`${path}: row ${bad + 2} has ${records[bad].length} fields, expected ${COLUMNS.length}: ${records[bad].join(',')}`);
    }
    this.rows = records.map((r) => Object.fromEntries(COLUMNS.map((c, i) => [c, r[i]])) as Row);
    this.rows.forEach((r, i) => validate(r, `${path}: row ${i + 2} (${r.repo})`));
    if (!readOnly) lock(path);
  }

  find(repo: string): Row | undefined {
    return this.rows.find((r) => r.repo.toLowerCase() === repo.toLowerCase());
  }

  update(row: Row, changes: Partial<Row>, { stamp = true } = {}): void {
    if (this.readOnly) throw new Error('Tracker was opened read-only');
    validate({ ...row, ...changes }, row.repo);
    Object.assign(row, changes, { last_checked: today() }, stamp ? { agent: this.requireAgent() } : {});
    this.save();
  }

  private requireAgent(): string {
    if (!this.agent) throw new Error('Tracker opened without an agent; pass resolveAgent(...) to the constructor');
    return this.agent;
  }

  add(values: Partial<Row> & Pick<Row, 'wave' | 'repo'>): Row {
    if (this.readOnly) throw new Error('Tracker was opened read-only');
    if (this.find(values.repo)) throw new Error(`${values.repo} is already in the tracker`);
    const row = { ...Object.fromEntries(COLUMNS.map((c) => [c, ''])), status: 'not_contacted', ...values } as Row;
    validate(row, row.repo);
    row.last_checked = today();
    row.agent = this.requireAgent();
    this.rows.push(row);
    this.save();
    return row;
  }

  /** Written after every row so an interrupted run keeps its progress. */
  save(): void {
    const lines = [COLUMNS.join(','), ...this.rows.map((r) => COLUMNS.map((c) => escape(r[c])).join(','))];
    writeFileSync(this.path, lines.join('\n') + '\n');
  }
}

function validate(row: Row, where: string): void {
  if (!isStatus(row.status)) throw new Error(`${where}: unknown status '${row.status}' (allowed: ${STATUSES.join(', ')})`);
  if (!isOutcome(row.outcome)) throw new Error(`${where}: unknown outcome '${row.outcome}' (allowed: ${OUTCOMES.join(', ') || "''"})`);
}

/** A pid file next to the tracker. A lock left by a dead process is taken over. */
function lock(path: string): void {
  const lockPath = `${path}.lock`;
  try {
    writeFileSync(lockPath, String(process.pid), { flag: 'wx' });
  } catch {
    const pid = Number(readFileSync(lockPath, 'utf-8'));
    if (pid && isAlive(pid)) throw new Error(`${lockPath} is held by running process ${pid}; wait for it to finish`);
    writeFileSync(lockPath, String(process.pid));
  }
  const release = () => rmSync(lockPath, { force: true });
  process.on('exit', release);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => process.exit(130));
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export const today = () => new Date().toISOString().slice(0, 10);
