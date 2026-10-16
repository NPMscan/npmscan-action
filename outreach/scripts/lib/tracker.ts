import { readFileSync, writeFileSync } from 'node:fs';

export const COLUMNS = [
  'wave', 'repo', 'status', 'priority', 'default_branch', 'lockfile', 'pr_url', 'fork_branch',
  'commit_sha', 'next_action', 'notes', 'outcome', 'maintainer', 'reason', 'last_checked',
] as const;

export type Column = (typeof COLUMNS)[number];
export type Row = Record<Column, string>;

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

  constructor(path: string) {
    this.path = path;
    const [header, ...records] = parseCsv(readFileSync(path, 'utf-8'));
    if (header?.join(',') !== COLUMNS.join(',')) {
      throw new Error(`Unexpected tracker header in ${path}: ${header?.join(',')}`);
    }
    // Refuse to load malformed rows: saving would silently drop or shift fields.
    const bad = records.findIndex((r) => r.length !== COLUMNS.length);
    if (bad !== -1) {
      throw new Error(`${path}: row ${bad + 2} has ${records[bad].length} fields, expected ${COLUMNS.length}: ${records[bad].join(',')}`);
    }
    this.rows = records.map((r) => Object.fromEntries(COLUMNS.map((c, i) => [c, r[i]])) as Row);
  }

  update(row: Row, changes: Partial<Row>): void {
    Object.assign(row, changes, { last_checked: today() });
    this.save();
  }

  /** Written after every row so an interrupted run keeps its progress. */
  save(): void {
    const lines = [COLUMNS.join(','), ...this.rows.map((r) => COLUMNS.map((c) => escape(r[c])).join(','))];
    writeFileSync(this.path, lines.join('\n') + '\n');
  }
}

export const today = () => new Date().toISOString().slice(0, 10);
