import { setTimeout as sleep } from 'node:timers/promises';
import { config, LOCKFILES, UNSUPPORTED_LOCKFILES, type Lockfile } from './config.ts';
import type { Checkout } from './git.ts';
import type { Row } from './tracker.ts';
import { WORKFLOW_PATH } from './workflow.ts';

/** Why a repo should not get an automated PR, written straight into the tracker. */
export interface Hold {
  status: string;
  reason: string;
  changes?: Partial<Row>;
}

export type Preflight = { ok: true; lockfile: Lockfile } | { ok: false; hold: Hold };

const hold = (status: string, reason: string, changes?: Partial<Row>): Preflight => ({
  ok: false,
  hold: { status, reason, changes },
});

// Contribution docs at the root, in .github/ or docs/.
const POLICY_FILE = /^(\.github\/|docs\/)?[^/]*(contributing|ai[-_]?policy|pull_request_template)[^/]*$/i;
const PR_TEMPLATE_DIR = /^(\.github\/|docs\/)?pull_request_template\/[^/]+$/i;

// Ordered: the first matching rule decides the status.
const POLICY_RULES: { pattern: RegExp; status: string; reason: string }[] = [
  {
    pattern: /\b(AI|LLM|GenAI)\b[^.\n]{0,80}\b(generated|assisted|tools?|agents?|contributions?|polic(y|ies))\b|\b(ChatGPT|Copilot|Claude)\b/i,
    status: 'blocked_policy',
    reason: 'contribution docs mention an AI policy',
  },
  {
    pattern: /\b(open|create|file)\s+an?\s+issue\s+(first|before)|discuss(ed)?\b[^.\n]{0,60}\bbefore\b[^.\n]{0,40}\b(pull request|PR)\b/i,
    status: 'needs_issue_first',
    reason: 'contribution docs ask for an issue first',
  },
  { pattern: /\bDCO\b|Signed-off-by|--signoff|\bsign[- ]off\b/i, status: 'needs_user_decision', reason: 'requires DCO sign-off' },
  { pattern: /\bCLA\b|Contributor License Agreement/i, status: 'needs_user_decision', reason: 'requires a CLA' },
];

/**
 * skipPolicy: someone has already read the contribution docs and written a PR
 * body to match (process-prs --body), so only the lockfile checks run.
 */
export async function preflight(checkout: Checkout, { skipPolicy = false } = {}): Promise<Preflight> {
  const files = checkout.files();
  const root = new Set(files.filter((f) => !f.includes('/')));

  if (files.includes(WORKFLOW_PATH)) return hold('skipped', `already has ${WORKFLOW_PATH}`);

  const lockfile = (Object.keys(LOCKFILES) as Lockfile[]).find((f) => root.has(f));
  if (!lockfile) {
    const bun = UNSUPPORTED_LOCKFILES.find((f) => root.has(f));
    return bun
      ? hold('skipped_unsupported_lockfile', `only ${bun}`, { lockfile: bun, next_action: 'revisit_after_support' })
      : hold('skipped_no_supported_lockfile', 'no supported lockfile at repo root');
  }

  // A PR-time dependency review already covers what npmscan-action does.
  const workflows = files.filter((f) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(f));
  const reviewer = workflows.find((f) => /actions\/dependency-review-action/.test(checkout.read(f)));
  if (reviewer) return hold('deprioritized_overlap', `already runs dependency-review-action (${reviewer})`, { lockfile });

  if (!skipPolicy) {
    const policyFiles = files.filter((f) => POLICY_FILE.test(f) || PR_TEMPLATE_DIR.test(f));
    const policyText = policyFiles.map((f) => checkout.read(f)).join('\n');
    for (const rule of POLICY_RULES) {
      if (rule.pattern.test(policyText)) return hold(rule.status, rule.reason, { lockfile });
    }
    const template = policyFiles.find((f) => /pull_request_template/i.test(f));
    if (template) {
      return hold('needs_user_decision', `PR template to fill by hand: ${template}`, { lockfile });
    }
  }

  const apiError = await checkLockfileParses(lockfile, checkout.read(lockfile));
  if (apiError) {
    return hold('skipped_unsupported_lockfile', `npmscan API: ${apiError}`, { lockfile, next_action: 'revisit_after_support' });
  }

  return { ok: true, lockfile };
}

/**
 * Sends the lockfile as a fresh addition to the API, as the action would.
 * Returns the API's rejection (the lockfile isn't supported) or null.
 * A network error, 429 or 5xx says nothing about the lockfile, so it's retried
 * once and then thrown: process-prs records the row as `failed` (rerun with
 * --retry-failed) instead of as an unsupported lockfile.
 */
async function checkLockfileParses(lockfile: Lockfile, content: string): Promise<string | null> {
  if (Buffer.byteLength(content) > config.maxLockfileBytes) return `${lockfile} exceeds the 8 MiB limit`;
  for (let attempt = 1; ; attempt++) {
    let unavailable: string;
    try {
      const res = await fetch(config.apiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': 'npmscan-outreach' },
        body: JSON.stringify({ before: LOCKFILES[lockfile], after: content }),
        signal: AbortSignal.timeout(config.commandTimeoutMs),
      });
      if (res.ok) return null;
      const detail = `HTTP ${res.status} ${(await res.text()).slice(0, 120)}`;
      if (res.status !== 429 && res.status < 500) return detail;
      unavailable = detail;
    } catch (err) {
      unavailable = (err as Error).message;
    }
    if (attempt >= 2) throw new Error(`npmscan API unavailable, lockfile not checked: ${unavailable}`);
    await sleep(5_000);
  }
}
