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
  const fork = `${currentUser()}/${repo.split('/')[1]}`;
  const parentOf = () =>
    run('gh', ['repo', 'view', fork, '--json', 'parent', '--jq', '.parent.owner.login + "/" + .parent.name'], {
      allowFailure: true,
    });

  if (parentOf() === null) run('gh', ['repo', 'fork', repo, '--clone=false', '--default-branch-only']);
  const parent = parentOf();
  if (parent?.toLowerCase() !== repo.toLowerCase()) {
    throw new Error(`${fork} is not a fork of ${repo} (parent: ${parent ?? 'none'})`);
  }
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
