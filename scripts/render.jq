# Turns per-file npmscan results into counts, a markdown report and annotations.
#
# Input:  array of {file, status: "scanned"|"error"|"skipped", isNew, reason, result}
# $cfg:   {marker, mode, severity, failInstall, failSource, failOnError}
# Output: {scanned, errors, flagged, blocking, markdown, annotations}

def enforce: $cfg.mode == "block";
def threshold: {"low": 1, "moderate": 2, "high": 3, "critical": 4, "none": 99}[$cfg.severity];
# Unknown severities count as LOW: they block only at the default threshold.
def rank: {"LOW": 1, "MODERATE": 2, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}[tostring | ascii_upcase] // 1;
def count($n; $one; $many): "\($n) \(if $n == 1 then $one else $many end)";

# Everything below can contain text from the PR (package names, script bodies),
# so strip what could break out of a table cell, code span or annotation.
def clean($max): tostring | gsub("[\\x00-\\x1f`]"; " ") | if length > $max then .[0:$max] + "…" else . end;
def code: clean(100) | if . == "" then "–" else "`" + gsub("\\|"; "\\|") + "`" end;
def prose($max): clean($max) | gsub("(?<c>[\\\\*_~\\[\\]|])"; "\\\(.c)") | gsub("@"; "@&#8203;") | gsub("<"; "&lt;");
def link($url; $text):
  if ($url | type) == "string" and ($url | test("^https://npmscan\\.com/[A-Za-z0-9@/._~%+-]*$"))
  then "[\($text)](\($url))" else $text end;
def host:
  if type == "string" then (capture("^[A-Za-z][A-Za-z0-9+.-]*://(?:[^@/]*@)?(?<h>[^/:?#]+)").h // null)
  else null end;
def plain: if type == "object" and has("after") then "\(.before // "") → \(.after // "")"
  elif type == "string" then . else tojson end;

def package_findings($file):
  ((.added // []) + (.changed // []))[]
  | . as $p
  | ($p.isVulnerable == true) as $vuln
  | ($p.installScriptIntroduced == true or ($p.beforeVersion == null and $p.hasInstallScript == true)) as $install
  | ($p.sourceIntegrityChanged == true) as $source
  | select($vuln or $install or $source)
  | ($p.highestSeverity // "UNKNOWN") as $severity
  | {
      file: $file, kind: "package", name: ($p.name // "?"), url: $p.npmscanUrl,
      before: $p.beforeVersion, after: $p.afterVersion,
      vuln: $vuln, severity: $severity, advisories: ($p.vulnerabilities // []),
      install: $install,
      scripts: ((($p.installScriptKeysIntroduced // [])
                 + (if $p.beforeVersion == null then $p.installScriptKeys // [] else [] end)) | unique),
      source: $source, resolvedHost: ($p.resolvedUrl | host),
      risky: true,
      blocking: (($vuln and ($severity | rank) >= threshold)
                 or ($install and $cfg.failInstall) or ($source and $cfg.failSource))
    };

# Root lifecycle scripts and overrides/resolutions: {introduced, changed, removed}.
def project_changes($changes; $kind; $file; $blocks):
  ($changes // {}) as $c
  | (["introduced", "added"], ["changed", "changed"], ["removed", "removed"]) as [$src, $label]
  | ($c[$src] // {}) | to_entries[]
  | {file: $file, kind: $kind, name: .key, value: .value, change: $label,
     risky: ($label != "removed"), blocking: ($label != "removed" and $blocks)};

def mark: if .blocking and enforce then "❌" elif .risky then "⚠️" else "ℹ️" end;

def package_row:
  (.advisories | length) as $n
  | "| \(mark) | \(link(.url; (.name | code))) "
  + "| \(if .before == null then "new" else (.before | code) end) → \(.after // "?" | code) "
  + "| \(if .vuln then (.severity | clean(20)) + (if $n > 0 then " · " + count($n; "advisory"; "advisories") else "" end) else "–" end) "
  + "| \(if .install then
          (if (.scripts | length) > 0 then "⚠️ adds " + (.scripts | map(code) | join(", "))
           elif .before == null then "⚠️ new package with install scripts"
           else "⚠️ install script added" end)
        else "–" end) "
  + "| \(if .source then "⚠️ changed" + (if .resolvedHost then " → " + (.resolvedHost | code) else "" end) else "–" end) |";

def change_row:
  "| \(mark) | \(.name | code) | \(.change) | "
  + (if (.value | type) == "object" and (.value | has("after"))
     then "\(.value.before | code) → \(.value.after | code)" else (.value | plain | code) end)
  + " |";

def advisories_block:
  [ .[] | select(.vuln and (.advisories | length) > 0) ][0:20]
  | if length == 0 then empty else
      "<details><summary>Advisories</summary>\n\n"
      + ( map(. as $p
            | ($p.advisories[0:5][]
               | "- \("\($p.name)@\($p.after // "?")" | code) — \(link(.npmscanUrl; (.id // "advisory" | prose(40)))) "
                 + "**\(.severity // "UNKNOWN" | clean(20))** \(.summary // "" | prose(160))"
                 + (if .fixedVersion then " · fixed in \(.fixedVersion | code)" else "" end)),
              (($p.advisories | length) - 5 | select(. > 0)
               | "- …and \(.) more for \($p.name | code) on \(link($p.url; "npmscan.com"))"))
          | join("\n"))
      + "\n\n</details>"
    end;

def file_section:
  ([ "### \(.file | code)\(if .isNew then " · new in this PR" else "" end)" ]
   + if .status == "error" then
       [ "> [!WARNING]\n> Scan failed: \(.reason | prose(300))" ]
     else
       .result as $r
       | [ "\($r.totalAdded // 0) added · \($r.totalRemoved // 0) removed · \($r.totalChanged // 0) changed · **\(.flagged) flagged**" ]
       + (if $r.truncated == true then [ "> [!WARNING]\n> Results are partial: \($r.truncationNote // "the dependency list was truncated" | prose(300))" ] else [] end)
       + ([ $r.enrichmentNote, (if .isNew then null else $r.comparisonNote end) ]
          | map(select(type == "string" and . != "") | "> [!NOTE]\n> \(prose(400))"))
       + (if .unexplained then [ "> [!NOTE]\n> \($r.summary // "" | prose(400))" ] else [] end)
       + (if (.packages | length) > 0 then
            [ "| | Package | Version | Vulnerabilities | Install scripts | Source / integrity |\n|---|---|---|---|---|---|\n"
              + (.packages[0:50] | map(package_row) | join("\n"))
              + (if (.packages | length) > 50 then "\n\n_…and \((.packages | length) - 50) more._" else "" end) ]
          else [] end)
       + ([ .project[] | select(.kind == "script") ] as $s
          | if ($s | length) > 0 then
              [ "**Root lifecycle scripts changed** — these run on `npm install` in this repository.\n\n| | Script | Change | Command |\n|---|---|---|---|\n"
                + ($s | map(change_row) | join("\n")) ]
            else [] end)
       + ([ .project[] | select(.kind == "override") ] as $o
          | if ($o | length) > 0 then
              [ "**Overrides / resolutions changed**\n\n| | Package | Change | Value |\n|---|---|---|---|\n"
                + ($o | map(change_row) | join("\n")) ]
            else [] end)
       + [ .packages | advisories_block ]
     end)
  | join("\n\n");

def annotation_message:
  if .kind == "package" then
    "\(.name) \(.before // "new") → \(.after // "?"): "
    + ([ (if .vuln then "\(.severity) vulnerability (\(count(.advisories | length; "advisory"; "advisories")))" else empty end),
         (if .install then "install script added" + (if (.scripts | length) > 0 then " (\(.scripts | join(", ")))" else "" end) else empty end),
         (if .source then "tarball source/integrity changed" + (if .resolvedHost then " (now \(.resolvedHost))" else "" end) else empty end)
       ] | join("; "))
  elif .kind == "script" then "Root \(.name) script \(.change): \(.value | plain)"
  else "Override for \(.name) \(.change): \(.value | plain)" end;

map(
  if .status == "scanned" then
    .result as $r | .file as $f
    | .packages = [ $r | package_findings($f) ]
    | .project = [ project_changes($r.projectLifecycleChanges; "script"; $f; $cfg.failInstall),
                   project_changes($r.overridesChanges; "override"; $f; $cfg.failSource) ]
    | .flagged = ((.packages | length) + ([ .project[] | select(.risky) ] | length))
    | .blocking = ([ .packages[], .project[] | select(.blocking) ] | length)
    # The server flagged something this version of the action can't break down:
    # show its summary rather than silently reporting nothing.
    | .unexplained = (.flagged == 0 and ($r.flaggedCount // 0) > 0)
    | if .unexplained then .flagged = $r.flaggedCount else . end
  else .packages = [] | .project = [] | .flagged = 0 | .blocking = 0 | .unexplained = false end
) as $files
| ($files | map(select(.status == "scanned")) | length) as $scanned
| ($files | map(select(.status == "error")) | length) as $errors
| ($files | map(.flagged) | add // 0) as $flagged
| ($files | map(.blocking) | add // 0) as $blocking
| ($files | map(select(.status == "skipped"))) as $skipped
| {
    scanned: $scanned, errors: $errors, flagged: $flagged, blocking: $blocking,
    markdown: ([
      $cfg.marker,
      "## 🛡️ npmscan dependency check",
      ( if $blocking > 0 and enforce then "❌ **\(count($blocking; "finding blocks"; "findings block")) this PR.**"
        elif $blocking > 0 then "⚠️ **\(count($blocking; "finding"; "findings")) would block this PR** — `mode: warn` is set, so the check passes."
        elif $flagged > 0 then "⚠️ **\(count($flagged; "finding"; "findings")) flagged**, none at or above the configured thresholds."
        elif $scanned > 0 then "✅ No risky dependency changes found."
        elif $errors > 0 then "⚠️ The scan could not run."
        else "✅ No dependency file changes left to scan in this PR." end )
      + ( if $errors > 0 then
            "\n\n⚠️ \(count($errors; "file"; "files")) could not be scanned"
            + (if $cfg.failOnError then " — failing the check (`fail-on-error: true`)." else " — not blocking (`fail-on-error: false`)." end)
          else "" end ),
      ( $files[] | select(.status != "skipped") | file_section ),
      ( if ($skipped | length) > 0 then
          "<sub>Not scanned: " + ($skipped | map("\(.file | code) (\(.reason | prose(60)))") | join(", ")) + "</sub>"
        else empty end ),
      "<sub>`mode: \($cfg.mode)` · `fail-on-severity: \($cfg.severity)` · `fail-on-install-script: \($cfg.failInstall)` · `fail-on-source-change: \($cfg.failSource)` · Scanned by [npmscan.com](https://npmscan.com) · [Docs](https://npmscan.com/docs/github-action)</sub>"
    ] | join("\n\n")),
    annotations: [
      $files[] | (.packages[], .project[]) | select(.risky)
      | { level: (if .blocking and enforce then "error" else "warning" end),
          file, kind, name: (.name | clean(200)), version: (.after // "" | clean(100)),
          title: "npmscan: \(.name | clean(80))",
          message: (annotation_message | clean(500)) }
    ]
  }
