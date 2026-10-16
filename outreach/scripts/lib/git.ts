import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.ts';
import { run } from './shell.ts';

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
      // Blobless clone: full history is cheap, blobs are fetched on demand.
      run('git', ['clone', '--filter=blob:none', '--no-checkout', `git@github.com:${fork}.git`, path]);
    }
    const git = (...args: string[]) => run('git', args, { cwd: path });

    if (run('git', ['remote', 'get-url', 'upstream'], { cwd: path, allowFailure: true }) === null) {
      git('remote', 'add', 'upstream', `https://github.com/${repo}.git`);
    }
    git('fetch', '--filter=blob:none', 'upstream', defaultBranch);
    return new Checkout(path, `upstream/${defaultBranch}`);
  }

  git(...args: string[]): string {
    return run('git', args, { cwd: this.path });
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

  commitAndPush(file: string): void {
    this.git('add', file);
    this.git('commit', '-m', config.commitMessage);
    this.git('push', '--force', '-u', 'origin', config.branch);
  }
}
