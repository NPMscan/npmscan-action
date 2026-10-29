import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from './config.ts';

export interface RunOptions {
  cwd?: string;
  /** Return null instead of throwing when the command exits non-zero. */
  allowFailure?: boolean;
  timeoutMs?: number;
  /** Replaces the inherited environment. */
  env?: NodeJS.ProcessEnv;
}

/**
 * Runs a command without a shell, so repo names and paths are never
 * interpreted. Returns trimmed stdout.
 */
export function run(cmd: string, args: string[], opts: RunOptions & { allowFailure: true }): string | null;
export function run(cmd: string, args: string[], opts?: RunOptions): string;
export function run(cmd: string, args: string[], { cwd, allowFailure = false, timeoutMs = config.commandTimeoutMs, env }: RunOptions = {}): string | null {
  if (process.env.VERBOSE) console.log(`  $ ${cmd} ${args.join(' ')}`);
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024, // `git show` of a large lockfile
      env,
    }).trim();
  } catch (err) {
    if (allowFailure) return null;
    throw new CommandError(cmd, args, err);
  }
}

const execFileAsync = promisify(execFile);

/** Async run() for commands that can go in parallel (read-only gh API calls). */
export async function runAsync(cmd: string, args: string[]): Promise<string> {
  if (process.env.VERBOSE) console.log(`  $ ${cmd} ${args.join(' ')}`);
  try {
    const { stdout } = await execFileAsync(cmd, args, {
      encoding: 'utf-8',
      timeout: config.commandTimeoutMs,
      maxBuffer: 64 * 1024 * 1024,
    });
    return stdout.trim();
  } catch (err) {
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
