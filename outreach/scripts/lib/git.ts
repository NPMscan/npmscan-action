import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.ts';
import { run } from './shell.ts';

const gitOpts = { timeoutMs: config.gitTimeoutMs };

/**
 * The IDE injects GIT_COMMITTER_NAME/EMAIL pointing at the assistant, which
 * would leak into every commit we push to a fork. Drop them so the commit is
 * attributed to the account that owns the fork.
 */
const gitEnv = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  delete env.GIT_COMMITTER_NAME;
  delete env.GIT_COMMITTER_EMAIL;
  return env;
};

/** A local clone of the fork with the upstream default branch fetched as `upstream/<branch>`. */
export class Checkout {
  readonly path: string;
  readonly base: string;

  private constructor(path: string, base: string) {
    this.path = path;
    this.base = base;
  }

  static prepare(repo: string, fork: string, defaultBranch: string): Checkout {
    mkdirSync(config.workDir, { recursive: true });
    // Owner in the dir name so same-named repos from different owners don't collide.
    const path = join(config.workDir, repo.replace('/', '__'));

    if (!existsSync(join(path, '.git'))) {
      // Shallow blobless clone: only the tip is read and one commit goes on top of it.
      run('git', ['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', `git@github.com:${fork}.git`, path], gitOpts);
    }
    const git = (...args: string[]) => run('git', args, { cwd: path, ...gitOpts, env: gitEnv() });
    // A dry run clones upstream as origin; repoint it so pushes always go to the fork.
    git('remote', 'set-url', 'origin', `git@github.com:${fork}.git`);

    if (run('git', ['remote', 'get-url', 'upstream'], { cwd: path, allowFailure: true }) === null) {
      git('remote', 'add', 'upstream', `git@github.com:${repo}.git`);
    } else {
      git('remote', 'set-url', 'upstream', `git@github.com:${repo}.git`);
    }
    git('fetch', '--depth', '1', '--filter=blob:none', 'upstream', defaultBranch);
    // A blobless clone fetches every missing blob one at a time on checkout, which
    // times out on big repos. We only ever touch .github, so check out nothing else.
    git('sparse-checkout', 'init', '--cone');
    git('sparse-checkout', 'set', '.github');
    return new Checkout(path, `upstream/${defaultBranch}`);
  }

  git(...args: string[]): string {
    return run('git', args, { cwd: this.path, ...gitOpts, env: gitEnv() });
  }

  /** Every tracked path on the upstream default branch. */
  files(): string[] {
    return this.git('ls-tree', '-r', '--name-only', this.base).split('\n');
  }

  read(file: string): string {
    return this.git('show', `${this.base}:${file}`);
  }

  /** Recreates the outreach branch from a clean upstream tip. */
  resetBranch(): void {
    this.git('checkout', '--force', '-B', config.branch, this.base);
    this.git('clean', '-fdx');
  }

  commitAndPush(file: string, { signoff = false, agent = '' } = {}): void {
    // --force: some repos ignore dotfiles (tedious has `.*` in .gitignore) and track .github/ anyway.
    this.git('add', '--force', file);
    const trailer = agent ? `\n\nAgent: ${agent}` : '';
    this.git('commit', ...(signoff ? ['--signoff'] : []), '-m', `${config.commitMessage}${trailer}`);
    this.git('push', '--force', '-u', 'origin', config.branch);
  }
}
