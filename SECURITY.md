# Security policy

npmscan-action runs inside other people's CI with a token that can comment on
their pull requests, so we treat security reports as our top priority.

## Reporting a vulnerability

**Please don't open a public issue.** Report privately through either:

- GitHub: [Report a vulnerability](https://github.com/NPMscan/npmscan-action/security/advisories/new) (preferred), or
- Email: **shyngys@blockhacks.io** with "npmscan-action security" in the subject.

Include what you found, how to reproduce it, and the impact you expect. A
proof-of-concept workflow or PR is the most useful thing you can send.

## What to expect

| Step | Target |
|---|---|
| Acknowledge your report | within 2 business days |
| Confirm the issue and share a severity assessment | within 5 business days |
| Release a fix for critical or high severity issues | within 14 days of confirmation |
| Release a fix for moderate or low severity issues | within 30 days, or the next release |

We'll keep you updated, credit you in the advisory unless you'd rather we
didn't, and agree on a disclosure date with you. Fixes ship as a new
`v1.x.y` release and the `v1` tag is moved to it.

## Supported versions

| Version | Supported |
|---|---|
| `v1` (latest `v1.x.y`) | ✅ |
| `v0.1` | ❌ — please move to `v1` |

## Scope

In scope:

- This action's code (`action.yml`, `scripts/`): command injection, token
  misuse, writing to comments or files it shouldn't, markdown or annotation
  injection from PR-controlled content, anything that lets a malicious PR
  escape the step.
- The npmscan.com dependency-diff API the action calls
  (`https://npmscan.com/api/analysis/dependency-diff`): data retention, or
  results that let a malicious change pass as clean.

Out of scope here:

- A package npmscan failed to flag, or flagged wrongly. Please open a
  [false positive / false negative issue](https://github.com/NPMscan/npmscan-action/issues/new/choose)
  instead, unless the miss is caused by a bug someone could exploit on purpose.
- Vulnerabilities in npm packages themselves — report those to the package
  maintainer or through [GitHub Advisories](https://github.com/advisories).

## Using the action safely

- Pin it to a full commit SHA if your policy requires it — see
  [Pinning](README.md#pinning-for-security-conscious-teams) in the README.
- Trigger it on `pull_request`, never `pull_request_target`.
- Grant only `contents: read` and `pull-requests: write`.
