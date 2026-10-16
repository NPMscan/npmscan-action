import { execFileSync } from 'node:child_process';
import { config } from './config.ts';

export interface RunOptions {
  cwd?: string;
  /** Return null instead of throwing when the command exits non-zero. */
  allowFailure?: boolean;
}

/**
 * Runs a command without a shell, so repo names and paths are never
 * interpreted. Returns trimmed stdout.
 */
export function run(cmd: string, args: string[], opts: RunOptions & { allowFailure: true }): string | null;
export function run(cmd: string, args: string[], opts?: RunOptions): string;
export function run(cmd: string, args: string[], { cwd, allowFailure = false }: RunOptions = {}): string | null {
  if (process.env.VERBOSE) console.log(`  $ ${cmd} ${args.join(' ')}`);
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: config.commandTimeoutMs,
      maxBuffer: 64 * 1024 * 1024, // `git show` of a large lockfile
    }).trim();
  } catch (err) {
    if (allowFailure) return null;
    throw new CommandError(cmd, args, err);
  }
}

export class CommandError extends Error {
  readonly stderr: string;

  constructor(cmd: string, args: string[], cause: unknown) {
    const e = cause as { stderr?: string; signal?: string };
    const stderr = (e.stderr ?? '').trim();
    const why = e.signal === 'SIGTERM' ? 'timed out' : stderr.split('\n').at(-1) || String(cause);
    super(`${cmd} ${args[0] ?? ''}: ${why}`);
    this.stderr = stderr;
  }
}
