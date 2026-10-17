import { config } from './config.ts';
import { run } from './shell.ts';

export interface RepoInfo {
  defaultBranch: string;
  isArchived: boolean;
}

let login: string | undefined;
export function currentUser(): string {
  return (login ??= run('gh', ['api', 'user', '--jq', '.login']));
}

export function repoInfo(repo: string): RepoInfo {
  const raw = run('gh', ['repo', 'view', repo, '--json', 'defaultBranchRef,isArchived']);
  const json = JSON.parse(raw) as { defaultBranchRef: { name: string }; isArchived: boolean };
  return { defaultBranch: json.defaultBranchRef.name, isArchived: json.isArchived };
}

/** Creates the fork if needed and returns its "owner/name". */
export function ensureFork(repo: string): string {
  const [owner, name] = repo.split('/');
  const parentOf = (fork: string) =>
    run('gh', ['repo', 'view', fork, '--json', 'parent', '--jq', '.parent.owner.login + "/" + .parent.name'], {
      allowFailure: true,
    });

  // Same-named repos from different owners (airbnb/javascript, TheAlgorithms/JavaScript)
  // can't share a fork name, so fall back to "<owner>-<name>".
  let fork = '';
  for (const candidate of [`${currentUser()}/${name}`, `${currentUser()}/${owner}-${name}`]) {
    let parent = parentOf(candidate);
    if (parent === null) {
      const forkName = candidate.split('/')[1];
      run('gh', ['repo', 'fork', repo, '--clone=false', '--default-branch-only', '--fork-name', forkName]);
      parent = parentOf(candidate);
    }
    if (parent?.toLowerCase() === repo.toLowerCase()) {
      fork = candidate;
      break;
    }
  }
  if (!fork) throw new Error(`no fork of ${repo} under ${currentUser()} (names taken by other repos)`);
  // The clone is shallow, so the fork must already hold upstream's tip for the push to go through.
  run('gh', ['repo', 'sync', fork], { allowFailure: true });
  return fork;
}

export function findOpenPr(repo: string): string | null {
  const url = run('gh', [
    'pr', 'list', '--repo', repo, '--author', '@me', '--state', 'open',
    '--head', config.branch, '--json', 'url', '--jq', '.[0].url // ""',
  ], { allowFailure: true });
  return url || null;
}

export function createPr(repo: string, base: string, bodyFile: string): string {
  const out = run('gh', [
    'pr', 'create', '--repo', repo, '--base', base,
    '--head', `${currentUser()}:${config.branch}`,
    '--title', config.prTitle, '--body-file', bodyFile,
  ]);
  const url = out.split('\n').find((l) => l.startsWith('https://github.com/'));
  if (!url) throw new Error(`gh pr create returned no URL: ${out}`);
  return url;
}
