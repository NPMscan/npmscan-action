#!/usr/bin/env bash
# Diffs dependency files against the PR base with npmscan.com, posts one PR
# comment, writes the job summary and annotations, and decides the exit status.
# Configuration arrives through the environment set in action.yml.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_URL="${NPMSCAN_API_URL:-https://npmscan.com/api/analysis/dependency-diff}"
USER_AGENT="npmscan-action/1"
MAX_BYTES=8388608 # API limit per file

config_error() { echo "::error title=npmscan configuration::$1"; exit 1; }
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
trim() { local s=$1; s="${s#"${s%%[![:space:]]*}"}"; s="${s%"${s##*[![:space:]]}"}"; printf '%s' "$s"; }

parse_bool() { # name value -> REPLY
  case "$(lower "$(trim "$2")")" in
    true|yes|on|1) REPLY=true ;;
    false|no|off|0) REPLY=false ;;
    *) config_error "Input '$1' must be true or false, got '$2'" ;;
  esac
}

# Workflow-command escaping (https://github.com/actions/toolkit/blob/main/packages/core/src/command.ts)
esc_data() { local s=$1; s=${s//'%'/%25}; s=${s//$'\r'/%0D}; s=${s//$'\n'/%0A}; printf '%s' "$s"; }
esc_prop() { local s; s=$(esc_data "$1"); s=${s//:/%3A}; s=${s//,/%2C}; printf '%s' "$s"; }

# --- Inputs -----------------------------------------------------------------

MODE=$(lower "$(trim "${INPUT_MODE:-block}")")
case "$MODE" in
  block|warn) ;;
  *) config_error "Input 'mode' must be 'block' or 'warn', got '$MODE'" ;;
esac
parse_bool fail-on-flagged "${INPUT_FAIL_ON_FLAGGED:-true}"
if [ "$REPLY" = false ]; then MODE=warn; fi # deprecated alias for mode: warn

SEVERITY=$(lower "$(trim "${INPUT_FAIL_ON_SEVERITY:-low}")")
case "$SEVERITY" in
  medium) SEVERITY=moderate ;;
  low|moderate|high|critical|none) ;;
  *) config_error "Input 'fail-on-severity' must be low, moderate, high, critical or none, got '$SEVERITY'" ;;
esac
parse_bool fail-on-install-script "${INPUT_FAIL_ON_INSTALL_SCRIPT:-true}"; FAIL_INSTALL=$REPLY
parse_bool fail-on-source-change "${INPUT_FAIL_ON_SOURCE_CHANGE:-true}"; FAIL_SOURCE=$REPLY
parse_bool fail-on-error "${INPUT_FAIL_ON_ERROR:-false}"; FAIL_ON_ERROR=$REPLY

RAW_FILES=${INPUT_FILES:-}
if [ -z "$(trim "$RAW_FILES")" ]; then RAW_FILES=${INPUT_FILE:-package-lock.json}; fi
FILES=()
while IFS= read -r f; do
  f=$(trim "$f"); f=${f#./}
  [ -n "$f" ] || continue
  case "$f" in
    /*|..|../*|*/..|*/../*) config_error "Dependency file paths must be relative to the repository root: '$f'" ;;
  esac
  FILES+=("$f")
done < <(printf '%s\n' "$RAW_FILES" | tr ',' '\n')
[ ${#FILES[@]} -gt 0 ] || config_error "No dependency files given in 'file' or 'files'"

[ -n "${PR:-}" ] || config_error "npmscan-action only runs on pull_request events"
command -v jq >/dev/null || config_error "jq is required on the runner"
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || config_error "Run actions/checkout before npmscan/npmscan-action"
cd "$(git rev-parse --show-toplevel)"

WORK=$(mktemp -d "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/npmscan.XXXXXX")
# One comment per step: the marker includes the file list, so several npmscan
# steps in one workflow (e.g. a monorepo) never overwrite each other.
FILES_KEY=$(IFS=,; printf '%s' "${FILES[*]}")
MARKER="<!-- npmscan-action:${FILES_KEY//-->/} -->"

# --- Scan -------------------------------------------------------------------

# Minimal "before" document in the same format, for files the PR adds.
placeholder() {
  case "$(basename "$1")" in
    package-lock.json|npm-shrinkwrap.json) printf '{"lockfileVersion":3,"packages":{}}' ;;
    yarn.lock) printf '# yarn lockfile v1\n\n' ;;
    pnpm-lock.yaml) printf "lockfileVersion: '9.0'\n" ;;
    *) printf '{}' ;;
  esac
}

add_entry() { # file status isNew reason [result.json]
  if [ -n "${5:-}" ]; then
    jq -c --arg file "$1" --arg status "$2" --argjson isNew "$3" --arg reason "$4" \
      '{file: $file, status: $status, isNew: $isNew, reason: $reason, result: .}' "$5"
  else
    jq -nc --arg file "$1" --arg status "$2" --argjson isNew "$3" --arg reason "$4" \
      '{file: $file, status: $status, isNew: $isNew, reason: $reason, result: null}'
  fi >> "$WORK/entries.jsonl"
}

# POST before/after to the API. Returns 0 with the JSON in $3, or 1 with the
# reason in SCAN_ERROR.
call_api() {
  local code
  code=$(jq -n --rawfile before "$1" --rawfile after "$2" '{before: $before, after: $after}' \
    | curl -sS --retry 2 --retry-delay 30 --max-time 300 \
        -o "$3" -w '%{http_code}' -X POST "$API_URL" \
        -H 'Content-Type: application/json' -H "User-Agent: $USER_AGENT" \
        --data-binary @- 2>"$3.err") || true
  if [ "$code" != 200 ]; then
    SCAN_ERROR=$(jq -r '.error // empty' "$3" 2>/dev/null || true)
    [ -n "$SCAN_ERROR" ] || SCAN_ERROR=$(tail -n 1 "$3.err" 2>/dev/null || true)
    SCAN_ERROR="npmscan API returned HTTP ${code:-000}${SCAN_ERROR:+: $SCAN_ERROR}"
    return 1
  fi
  if ! jq -e 'type == "object" and has("flaggedCount")' "$3" >/dev/null 2>&1; then
    SCAN_ERROR="npmscan API returned an unexpected response"
    return 1
  fi
}

BASE_ERROR=""
if [ -z "${BASE_SHA:-}" ]; then
  BASE_ERROR="The pull_request event has no base commit"
elif ! git cat-file -e "$BASE_SHA^{commit}" 2>/dev/null \
  && ! git fetch --no-tags --depth=1 origin "$BASE_SHA" >"$WORK/fetch.log" 2>&1; then
  BASE_ERROR="Could not fetch the base commit $BASE_SHA: $(tail -n 1 "$WORK/fetch.log")"
fi

: > "$WORK/entries.jsonl"
i=0
for file in "${FILES[@]}"; do
  i=$((i + 1))
  before="$WORK/$i.before" after="$WORK/$i.after" result="$WORK/$i.json"

  if [ -n "$BASE_ERROR" ]; then
    if [ -f "$file" ]; then add_entry "$file" error false "$BASE_ERROR"; fi
    continue
  fi

  in_base=false
  if git cat-file -e "$BASE_SHA:$file" 2>/dev/null; then in_base=true; fi
  if [ ! -f "$file" ]; then
    if [ "$in_base" = true ]; then add_entry "$file" skipped false "removed in this PR"
    else add_entry "$file" skipped false "not found"; fi
    echo "::notice::$file not found in this PR — nothing to scan"
    continue
  fi

  is_new=false
  if [ "$in_base" = true ]; then git show "$BASE_SHA:$file" > "$before"
  else placeholder "$file" > "$before"; is_new=true; fi
  cp "$file" "$after"

  if cmp -s "$before" "$after"; then
    add_entry "$file" skipped false "unchanged"
    echo "::notice::$file unchanged in this PR — nothing to scan"
    continue
  fi
  if [ "$(wc -c < "$after")" -gt "$MAX_BYTES" ] || [ "$(wc -c < "$before")" -gt "$MAX_BYTES" ]; then
    add_entry "$file" error "$is_new" "larger than the 8 MB limit of the npmscan API"
    continue
  fi

  if call_api "$before" "$after" "$result"; then
    add_entry "$file" scanned "$is_new" "" "$result"
  else
    add_entry "$file" error "$is_new" "$SCAN_ERROR"
  fi
done

CFG=$(jq -nc --arg marker "$MARKER" --arg mode "$MODE" --arg severity "$SEVERITY" \
  --argjson failInstall "$FAIL_INSTALL" --argjson failSource "$FAIL_SOURCE" --argjson failOnError "$FAIL_ON_ERROR" \
  '{marker: $marker, mode: $mode, severity: $severity, failInstall: $failInstall, failSource: $failSource, failOnError: $failOnError}')
jq -s --argjson cfg "$CFG" -f "$HERE/render.jq" "$WORK/entries.jsonl" > "$WORK/report.json"

read -r SCANNED ERRORS FLAGGED BLOCKING < <(jq -r '"\(.scanned) \(.errors) \(.flagged) \(.blocking)"' "$WORK/report.json")
jq -r .markdown "$WORK/report.json" > "$WORK/comment.md"
# GitHub rejects comments over 65536 characters; the renderer caps rows, this is the backstop.
if [ "$(wc -m < "$WORK/comment.md")" -gt 60000 ]; then
  { head -c 60000 "$WORK/comment.md"; printf '\n\n_Report truncated — see the job summary for the run._\n'; } > "$WORK/comment.tmp"
  mv "$WORK/comment.tmp" "$WORK/comment.md"
fi

# --- Outputs and annotations ------------------------------------------------

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    # flagged-count stays empty when nothing was scanned (documented behaviour)
    if [ "$SCANNED" -gt 0 ]; then echo "flagged-count=$FLAGGED"; fi
    echo "blocking-count=$BLOCKING"
    echo "error-count=$ERRORS"
  } >> "$GITHUB_OUTPUT"
fi

# Prints the line of the first line containing one of the needles, searching
# only after the first line matching $section (if given). A needle starting
# with ^ must match at the start of the line. Falls back to the section line.
find_line() {
  local file=$1 section=$2; shift 2
  awk -v section="$section" -v needles="$(printf '%s\037' "$@")" '
    BEGIN { n = split(needles, ns, "\037"); armed = (section == "") }
    !armed { if ($0 ~ section) { armed = 1; sec = NR }; next }
    {
      for (i = 1; i <= n; i++) {
        nd = ns[i]; if (nd == "") continue
        if (substr(nd, 1, 1) == "^") { if (index($0, substr(nd, 2)) == 1) { print NR; found = 1; exit } }
        else if (index($0, nd)) { print NR; found = 1; exit }
      }
    }
    END { if (!found && sec) print sec }
  ' "$file" 2>/dev/null || true
}

annotation_line() { # file kind name version
  local file=$1 kind=$2 name=$3 version=$4
  case "$kind" in
    script) find_line "$file" '"scripts"' "\"$name\":" ;;
    override) find_line "$file" '(overrides|resolutions)' "\"$name\":" "  $name:" "  '$name'" ;;
    *)
      case "$(basename "$file")" in
        package-lock.json|npm-shrinkwrap.json) find_line "$file" "" "\"node_modules/$name\":" "/node_modules/$name\":" ;;
        yarn.lock) find_line "$file" "" "^$name@" "^\"$name@" ;;
        pnpm-lock.yaml) find_line "$file" '^packages:' "  $name@$version:" "  '$name@$version" "  /$name@$version" "  /$name/$version:" "  $name@" "  '$name@" "  /$name@" ;;
        *) find_line "$file" 'ependencies"' "\"$name\":" ;;
      esac
      ;;
  esac
}

while IFS=$'\037' read -r level file kind name version title message; do
  line=$(annotation_line "$file" "$kind" "$name" "$version")
  props="file=$(esc_prop "$file")${line:+,line=$line},title=$(esc_prop "$title")"
  echo "::$level $props::$(esc_data "$message")"
done < <(jq -r '.annotations[] | [.level, .file, .kind, .name, .version, .title, .message] | join("\u001f")' "$WORK/report.json")

# --- PR comment and job summary ---------------------------------------------

comment_warning() {
  local reason
  reason=$(tail -n 1 "$WORK/gh.err" 2>/dev/null || true)
  if [ "${PR_AUTHOR:-}" = "dependabot[bot]" ] || [ "${GITHUB_ACTOR:-}" = "dependabot[bot]" ]; then
    echo "::warning::Could not post the PR comment. Dependabot PRs get a read-only token unless the workflow sets 'permissions: pull-requests: write'. The report is in the job summary."
  elif [ -n "${HEAD_REPO:-}" ] && [ -n "${GITHUB_REPOSITORY:-}" ] && [ "$HEAD_REPO" != "$GITHUB_REPOSITORY" ]; then
    echo "::warning::Could not post the PR comment: PRs from forks get a read-only token. The report is in the job summary."
  else
    echo "::warning::Could not post the PR comment${reason:+ ($reason)}. Make sure the workflow grants 'pull-requests: write'. The report is in the job summary."
  fi
}

# Edits this step's previous comment (found by its marker) or creates one.
upsert_comment() { # body.md create-if-missing
  local api="repos/$GITHUB_REPOSITORY/issues" id payload
  if ! command -v gh >/dev/null; then
    echo "::warning::gh CLI not found — skipping the PR comment. The report is in the job summary."
    return 0
  fi
  id=$(gh api --paginate "$api/$PR/comments?per_page=100" 2>"$WORK/gh.err" \
    | jq -rs --arg m "$MARKER" 'add // [] | map(select((.body // "") | startswith($m))) | last | .id // empty') || id=""
  payload=$(jq -n --rawfile body "$1" '{body: $body}')
  if [ -n "$id" ] && printf '%s' "$payload" | gh api -X PATCH "$api/comments/$id" --input - >/dev/null 2>>"$WORK/gh.err"; then
    return 0
  fi
  if [ "$2" != true ]; then return 0; fi
  if ! printf '%s' "$payload" | gh api -X POST "$api/$PR/comments" --input - >/dev/null 2>>"$WORK/gh.err"; then
    comment_warning
  fi
}

if [ "$SCANNED" -eq 0 ] && [ "$ERRORS" -eq 0 ]; then
  # Nothing to report, but an earlier push may have left a comment with findings.
  upsert_comment "$WORK/comment.md" false
  exit 0
fi

if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$WORK/comment.md" >> "$GITHUB_STEP_SUMMARY"; fi
upsert_comment "$WORK/comment.md" true

# --- Exit status ------------------------------------------------------------

status=0
if [ "$ERRORS" -gt 0 ]; then
  while IFS=$'\037' read -r file reason; do
    if [ "$FAIL_ON_ERROR" = true ]; then
      echo "::error title=npmscan scan failed::$(esc_data "$file: $reason")"
    else
      echo "::warning title=npmscan scan failed::$(esc_data "$file: $reason (not blocking: fail-on-error is false)")"
    fi
  done < <(jq -rs '.[] | select(.status == "error") | [.file, .reason] | join("\u001f")' "$WORK/entries.jsonl")
  if [ "$FAIL_ON_ERROR" = true ]; then status=1; fi
fi
if [ "$BLOCKING" -gt 0 ]; then
  if [ "$MODE" = block ]; then
    echo "::error::npmscan found $BLOCKING blocking finding(s)"
    status=1
  else
    echo "::warning::npmscan found $BLOCKING finding(s) that would block in mode: block"
  fi
fi
exit "$status"
