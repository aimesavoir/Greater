# AGENTS.md — Greater (disk usage analyzer)

## Toolchain

- Rust 1.99.1 (msvc): `& "$env:USERPROFILE\.cargo\bin\cargo.exe"` — NOT on PATH.
- Node 24 (present, not needed yet: frontend is vanilla HTML/JS, no npm build).
- Shell: PowerShell 5.1 (French locale — errors appear in French).

## CRITICAL: disk layout

- **X: is nearly full** (39 GB, user's personal data — never delete their
  folders, never store build artifacts on X:). Free space fluctuates; treat it
  as ~1 GB at most.
- Set `$env:CARGO_TARGET_DIR="D:\greater-target"` for every cargo build in
  `app/src-tauri` (D: is the empty 70 GB scratch drive). Kill any running
  `greater.exe` first or the build fails with "failed to remove file".
- Prototype builds stay in `X:\Greater\prototype\target` (small, ~30 MB).

## Build & run

Prototype (scanbench benchmark CLI):

```powershell
$env:CARGO_TARGET_DIR=""  # ensure default
& "$env:USERPROFILE\.cargo\bin\cargo.exe" build --release   # in X:\Greater\prototype
X:\Greater\prototype\target\release\scanbench.exe help
```

App (Tauri 2):

```powershell
$env:CARGO_TARGET_DIR="D:\greater-target"
& "$env:USERPROFILE\.cargo\bin\cargo.exe" build --release   # in X:\Greater\app\src-tauri
Start-Process "D:\greater-target\release\greater.exe"
```

Kill `greater.exe` before rebuilding (it locks the output binary).

Unit tests (duplicate finder):

```powershell
$env:CARGO_TARGET_DIR="D:\greater-target"
& "$env:USERPROFILE\.cargo\bin\cargo.exe" test --release   # in X:\Greater\app\src-tauri
```

End-to-end test (drives the real window via UI Automation — launches the app,
scans `X:\Greater`, cancels a `C:\` scan mid-flight, scans `C:\` fully, checks
the window-fit layout and drive cards, walks the Explorer / Clean / Duplicates /
Statistics tabs, exercises file actions (info modal / open location / recycle
bin / permanent delete) on a junk folder `D:\greater-junk`, then runs a Clean
sweep over a fabricated junk tree `D:\greater-clean`, and a duplicate sweep
over a fabricated tree `D:\greater-dupes`, purging both):

```powershell
Get-Process greater -ErrorAction SilentlyContinue | Stop-Process -Force
& "X:\Greater\app\e2e-test.ps1"      # prints PASS/FAIL; start app with $env:GREATER_DEBUG=1 for %TEMP%\greater_debug.log
```

Set `$env:GREATER_DEBUG="1"` to log scan_start / progress / done emits to
`%TEMP%\greater_debug.log` (off by default).

App commands: `list_volumes` (letter/label/fs/total/free), `scan_start`,
`clean_start`, `dupes_start(path, mode, threads, min_size)`, `scan_cancel`,
`get_files(offset, limit)` paged list,
`get_junk(offset, limit, category)` paged junk list (category `safe` /
`optional` / null = all), `remove_entry(path)` (after a file action),
`purge_selected(kind, invert, permanent)` (bulk junk delete; `kind` =
`safe` / `all` / `none` is the base selection, `invert` is the list of
per-path overrides `{path, on}` computed from what the user ticked),
`get_dupes(offset, limit, keep)` paged duplicate-group list (`keep` =
`oldest` / `newest` / `shortest`; each file carries `keep: bool`),
`delete_dupes(keep, invert, permanent)` (bulk duplicate delete),
`file_info`, `open_location`, `move_to_trash`, `delete_permanent`.

Clean page: mirrors Explorer (drive cards on top; hover a card and click its
overlay Clean button to start — there is no path field). While a clean runs the
overlay shows a spinner + "Cleaning…" and a Cancel button appears in the
controls row (hidden when idle).
Backend walks the tree and classifies each file with the rule engine in
`src/scanner/junk.rs` (narrow, path-pattern rules split into `safe` =
regenerated scratch/no user data, and `optional` = reversible but costs a
re-download/rebuild; files younger than a rule's `min_age_minutes` are skipped
as "in use"; `is_protected` never touches pagefile/hiberfil/boot BCD/System
Volume Information, and `is_ignored_name` skips desktop.ini/Thumbs.db). The
scanner carries mtimes for this (`FileHit.mtime_ms`). Selection is computed in
Rust: the UI keeps only a mode + per-path toggles and asks `get_junk` for a
category filter; `purge_selected` recomputes category totals so the UI and
backend never drift. Shown after a Clean are five keystats (scanned, elapsed,
junk files, reclaimable, selected) plus a live selection summary right of the
"Files to delete" heading (`N of M selected · size`) and an action hint; all
three refresh on every tick / select all-none / filter change (selection
totals are derived from the Rust category counts + per-path overrides, so they
match what `purge_selected` will delete). The list has checkboxes, reason
badges, all/safe/optional filter chips (with per-category counts), select
all/none, and two purge buttons (Recycle Bin / permanent). Note
SHFileOperation with `FOF_ALLOWUNDO` silently deletes items too big for the
Recycle Bin permanently — the confirm modal warns this.

Duplicates page: same drive-card layout as Clean (hover a card, click its
overlay Find duplicates button). Two controls: a "smallest file" floor (default
1 MiB; `<select id="dupes-minsize">`) and a "keep" heuristic (oldest / newest /
shortest path, `<select id="dupes-keep">`). Backend walks the tree, then
`src/scanner/dup.rs` hashes only files whose size is shared with another
candidate (128-bit pair = FNV-1a 64 + rotated variant; the link count is read
from the same handle so hardlinks are dropped, and system/servicing trees are
excluded) and groups by size+hash. Groups are sorted by reclaimable size desc;
each row shows every copy with a star to "keep only this one", path, size and
mtime. Selection mirrors Clean: Rust computes the default keeper per group
(`keeper_index`), the UI keeps only the keep-mode + per-path overrides, and
`delete_dupes` recomputes so a group's last copy can never be deleted (the
keeper is un-ticked if it would be). Stats: scanned, elapsed, groups, copies,
reclaimable, selected. Actions: Load more, Keep all, Select all duplicates,
Move to Recycle Bin / Delete permanently; the confirm modal warns one copy per
group is always kept. `scan-progress` carries a `phase` field (`walk` / `hash`);
`scan-done` for `kind = "dupes"` carries `dup_groups` / `dup_files` /
`dup_wasted`.

CRITICAL duplicate-finder lesson: **never mix metadata into the content hash**.
`hash_and_id` originally did `h2 ^= mtime_ms`, so two byte-identical copies with
different timestamps hashed differently and were never grouped (surfaced as
"0 duplicate groups" on a fixture whose two files were MD5-identical). The unit
tests in `dup.rs` deliberately give the duplicate pair *different* mtimes to
catch this.

Paths: the walker emits `\\?\` verbatim paths (long-path support). Rust
`normalize_path()` strips the prefix before paths reach the UI or the shell —
`SHFileOperationW` rejects verbatim paths with `DE_INVALIDFILES` (124), and
they are noisy in the list.

### Tauri 2 gotcha (cost hours — do not remove)

`app/src-tauri/capabilities/default.json` must exist and grant `core:default`.
Without it the ACL rejects `plugin:event|listen`, the frontend's `listen()`
promise rejects (easily swallowed), and **no events ever reach the UI** while
commands still work — the scan finishes in Rust but the UI stays "Scanning…"
forever. JS now surfaces such failures in the status line.

Elevated MFT benchmarks: rewrite `C:\Users\MSI\AppData\Local\Temp\opencode\run_usn.bat`,
then `Start-Process <bat> -Verb RunAs -Wait` (inline cmd / `-ArgumentList` with
redirection does NOT work; must be a .bat). Non-elevated `usn`/`mft-raw` fail
with os error 5 — expected; walk scanner is the fallback.

## Architecture (validated — see docs/scanning-architecture.md, prototype/RESULTS.md)

- Default scanner: parallel `FindFirstFileExW(FindExInfoBasic, LARGE_FETCH)`
  work-queue walker, no elevation, all filesystems. C: full scan 2.7–5.1 s.
- Optional: raw MFT reader (elevated, NTFS only): C: 3.3 s, sees ACL-hidden
  dirs, hardlink-deduped totals. Chunk size ≥ 4 MiB (4 KiB = 8.7× slower).
- USN mode: prototype-only diagnostic (no sizes), dropped from product.
- Reparse points never followed/counted; live-churn deltas ≤ 0.1 % are normal.

## Workflow state

- [x] Stage 1: environment inspected
- [x] Stage 2: docs/scanning-architecture.md
- [x] Stage 3: prototype scanbench built, benchmarked, validated
        (prototype/RESULTS.md)
- [ ] Stage 4: app — scan/UI end-to-end works (Tauri 2 + engine port + vanilla
        dark UI; commands list_volumes / scan_start / clean_start / dupes_start /
        scan_cancel / get_files / get_junk / purge_selected / remove_entry /
        get_dupes / delete_dupes / file_info / open_location / move_to_trash /
        delete_permanent; events scan-progress / scan-done, both tagged with
        `kind` = scan | clean | dupes; drive cards with donut + usage bars;
        virtualized all-files list largest first with name/path/%-of-largest
        rows and green size bars; per-row actions with confirmation modals;
        tabbed shell (Explorer / Clean / Duplicates / Statistics — Explorer,
        Clean and Duplicates are live, Statistics is a placeholder);
        window-fit flex layout (only the file list scrolls; list renders at
        most 600k rows — Chromium clamps element height at ~33.5M px, so the
        label says "N largest of M files"). Clean page: drive cards, press
        Clean, rule engine lists junk (safe preselected, optional opt-in) with
        reason badges + filter chips, purge to Recycle Bin or permanently.
        Duplicates page: drive cards, press "Find duplicates", size floor +
        keep heuristic, groups with per-copy keep star, purge all-but-one.
        Verified by `app/e2e-test.ps1`:
        C: full scan 2.8–4.0 s → 1,420,000 files, cancel mid-scan < 1 s,
        Clean on a fabricated junk tree lists only junk and deletes it,
        Duplicates on a fabricated tree finds the pair and deletes the
        non-keeper copy).
        Remaining: streaming progress from walker (currently ticker over atomic
        stats), MFT fast path in app + elevation relaunch, treemap/sunburst
        visualization, Statistics page content, packaging (installer < 15 MB),
        icon (placeholder only).
- [ ] Stage 5: packaging + final validation
