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

## CRITICAL: Tauri command threading (cost hours — do not remove)

In Tauri 2 a **plain `#[tauri::command] fn` runs on the main/UI thread**, so any
blocking work in it freezes the whole WebView (no repaint, queued events, the
window looks hung). Every command here that does IO, takes a lock, or calls a
Win32 API must be `#[tauri::command(async)]` — this is applied to all of:
`list_volumes`, `scan_start`/`stats_start`/`clean_start`/`dupes_start`,
`scan_cancel`, `get_files`/`get_folders`/`get_type_stats`/`get_junk`/`get_dupes`,
`remove_entry`, `purge_selected`/`delete_dupes`, `move_to_trash`,
`delete_permanent`, `file_info`, `open_location`. (`async` here means "run the
body on the async runtime, not the main thread"; `run_walk` additionally spawns
its own worker thread, so the command returns instantly and the walk is off-thread.)

Symptoms when this is wrong (all reported by the user, all fixed by the async
markers): scanning/cleaning felt frozen with the list blank until the very end;
Cancel ignored clicks and took seconds; a delete showed no feedback and looked
stuck; the progress bar never moved.

Two other responsiveness fixes in the same batch:
- `queue.rs` `pop()` now `wait_timeout(40ms)`s on the condvar and re-checks the
  cancel flag, so an idle worker notices a cancel instead of sleeping until the
  next push. Cancel latency dropped to ~0.3 s.
- `run_walk` **skips the post-walk sort/classify/hash entirely when cancelled**
  (the `skip_post` branch) and emits `scan-done` immediately, and the ticker
  streams the largest-so-far files (`Stats::top_entries`, 2000 of them, throttled
  to ~600 ms) into `FileList` while walking, so the Explorer table fills live.
  The frontend re-pages it via `streamExplorer()` (~2.5/s, only while the
  Explorer tab is active). `delete-progress` events keep the Clean/Duplicates
  status line moving during a bulk purge.

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

### Windows installer (NSIS)

`cargo tauri` (the CLI, `C:\Users\MSI\.cargo\bin\cargo-tauri.exe`) wraps cargo
and the bundler. `tauri.conf.json` sets `version 1.0.0`, `publisher MECATROTEC`,
`targets: ["nsis"]`, `installMode: perMachine` (installs to
`C:\Program Files\Greater`, needs admin) and
`webviewInstallMode: embedBootstrapper` (installs the WebView2 runtime on
machines that lack it — no internet needed for the app itself, the bootstrapper
fetches the runtime). Build from `app/src-tauri` (the CLI rejects
`--manifest-path`; run it with `workdir` set):

```powershell
Get-Process greater -ErrorAction SilentlyContinue | Stop-Process -Force
$env:CARGO_TARGET_DIR="D:\greater-target"
& "$env:USERPROFILE\.cargo\bin\cargo-tauri.exe" build   # in X:\Greater\app\src-tauri
# -> D:\greater-target\release\bundle\nsis\Greater_1.0.0_x64-setup.exe (~4.7 MiB)
```

Silent install / uninstall for testing (verify exit 0, `C:\Program Files\Greater`):

```powershell
Start-Process "<setup>.exe" -ArgumentList "/S" -PassThru -Wait
Start-Process "C:\Program Files\Greater\uninstall.exe" -ArgumentList "/S" -PassThru -Wait
```

Icons: regenerate with `cargo-tauri icon <png> --output app/src-tauri/icons`
(it emits `icon.ico` + the Windows Square*/Store logos). After changing
`icons/`, rebuild the bundle or the setup keeps the old icon.

Minimum requirements: **64-bit Windows 10 (1809+) or Windows 11** — the
Tauri/WebView2 floor. The exe links `SubsystemVer 6.0`; no MSVC runtime is
needed (Rust is statically linked). 32-bit and ARM64 would need
`rustup target add i686/aarch64-pc-windows-msvc` + `cargo-tauri build
--target ...` (ARM64 also needs VS "C++ ARM64 build tools").

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
sweep over a fabricated junk tree `D:\greater-clean`, a duplicate sweep
over a fabricated tree `D:\greater-dupes` (purging both), and a Statistics
sweep over a fabricated tree `D:\greater-stats`):

```powershell
Get-Process greater -ErrorAction SilentlyContinue | Stop-Process -Force
& "X:\Greater\app\e2e-test.ps1"      # prints PASS/FAIL; start app with $env:GREATER_DEBUG=1 for %TEMP%\greater_debug.log
```

Set `$env:GREATER_DEBUG="1"` to log scan_start / progress / done emits to
`%TEMP%\greater_debug.log` (off by default).

### Public product page & releases

`X:\Greater\site\` is the landing page but is **its own git repository** (it is
in `.gitignore` here) pushed to the public repo
[`aimesavoir/Greater-Site`](https://github.com/aimesavoir/Greater-Site), served
by GitHub Pages from `main` / root:

- <https://aimesavoir.github.io/Greater-Site/> (English)
- <https://aimesavoir.github.io/Greater-Site/?lang=ar> (Arabic, RTL)

Pages is free only for public repos, and release assets of a private repo are
not publicly downloadable — that is why the page and the installer live in the
public repo while the sources stay private here.

Site files: `index.html` (English inline; every translatable element carries
`data-t="key"`), `styles.css` (palette copied from `app/ui/styles.css`; RTL
rules; breakpoints 940px / 560px), `main.js` (Arabic `AR` dictionary, toggle,
`?lang=` param, `localStorage` `greater.site.lang`), `img/` (real app
screenshots), `.nojekyll`. No build step and no external requests.

**Text changes need both sides**: `index.html` and the `AR` map in `main.js`.
`main.js` snapshots the English `innerHTML` at load, so switching back is
lossless. Verify with a static server plus headless Edge:

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new `
  --disable-gpu --hide-scrollbars --virtual-time-budget=8000 `
  --window-size=1440,6100 --screenshot=<out.png> http://127.0.0.1:8099/index.html
```

Screenshots are 1800 px JPEG q88 (~200 KB each) and load **eagerly**: lazy
images never trigger in the OpenCode Review pane (it does not paint), and 2.4 MB
of PNGs is too heavy for a landing page anyway. `body` uses
`overflow-x: clip`, not `hidden` — `hidden` makes `<body>` a second scroll
container.

Publishing a new version (bump the version in `tauri.conf.json`, rebuild, then):

```powershell
$env:PATH="C:\Program Files\GitHub CLI;$env:PATH"
cd X:\Greater\site; git add -A; git commit -m "..."; git push
gh release create v1.0.0 -R aimesavoir/Greater-Site <setup.exe> --title "Greater 1.0.0" --notes-file <notes.md>
```

The download buttons point at
`https://github.com/aimesavoir/Greater-Site/releases/latest/download/Greater_1.0.0_x64-setup.exe`,
so the asset name must stay exactly `Greater_<version>_x64-setup.exe`. Check the
Pages build with `gh api repos/aimesavoir/Greater-Site/pages/builds/latest`
(`status: built`) and confirm the asset hash matches the local installer.
`gh` resolves the repo from the working directory — pass `-R` when not in
`site/`, or it looks at the private repo and reports "release not found".

App commands: `list_volumes` (letter/label/fs/total/free), `scan_start`,
`stats_start(path, mode, threads)`, `clean_start`,
`dupes_start(path, mode, threads, min_size)`, `scan_cancel`,
`get_files(offset, limit)` paged list,
`get_type_stats(path)` file-type breakdown of the last scan (see below),
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

Live deletion modal (Clean + Duplicates purges): a bulk purge opens `#modal-deleting`
(index.html), a non-dismissable dialog with a progress bar, "deleted X of Y
removed", the current file name, live "{size} freed so far", a running
"N could not be removed" line, and a **Cancel** button; Escape and the backdrop
are ignored while it runs. `DeleteProgressEvent` carries
`removed: Vec<String>` (paths actually gone in that batch), `last` (for the
current-file line), `freed` (bytes reclaimed so far) and `cancelled`; the final
`PurgeResult`/`DupPurgeResult` also carry `freed` + `cancelled`.
`shell_delete` takes `Vec<(String, u64)>` (path + size) and a
`&AtomicBool` (`DeleteCancel` state, reset by each purge, set by the
`delete_cancel` command); it polls the flag **between batches**, so a purge
stops within one batch of a Cancel click and `shell_delete` returns
`(deleted, failed, deleted_set, freed, cancelled)`. **Two delete engines:**
permanent purges use *parallel `DeleteFileW`* (`parallel_delete`,
`available_parallelism` clamped 1..=16) — the shell spends ~20–100 ms/file
writing Recycle-Bin metadata, so 3k files went from minutes to ~0.25 s;
Recycle-Bin purges still use one `SHFileOperationW` batch (`shell_delete_recycle`)
because only the shell can use the bin (~512 files/s). One gotcha: the deletion
Cancel button / banner text uses `deleting.*` i18n keys — `deleting.freed`,
`deleting.stopping`, `deleting.titleCancelled` are in all 5 dicts (288 keys).

Live Clean streaming: the `run_walk` ticker (600 ms) also serves Clean — it
calls `Stats::new_since(cursor)` (returns only entries appended since the last
tick; each file is classified exactly once across the whole walk) and publishes
the accumulated `JunkHit` list to `JunkList`, so `get_junk` sees the list grow
while walking. The frontend `scan-progress` `kind === "clean"` branch calls
`streamClean()` (throttled ~500 ms, only while the Clean tab is active), which
probes `get_junk` and re-pages `junkList` when the total moved. `JunkPage` now
also carries whole-list `safe_files/safe_bytes/optional_files/optional_bytes`;
the `junkList.fetchPage` harvests them into `cleanAgg` + calls
`renderCleanSummary()` so chips/keystats stay live. **Gotcha:** `fetchPage` must
return the whole page object — `createList` does `.then(p => p.entries)` and a
returned `p.entries` array would make that read `Array.prototype.entries` (a
function), silently rendering zero rows (cost an e2e failure to find).

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

Statistics page: same drive-card layout (hover a card, click its overlay Analyze
button) — it runs `stats_start`, which is the shared walker as `RunKind::Stats`
(same `FileList` as the Explorer scan, but tagged `kind = "stats"` so
`scan-progress` / `scan-done` route here instead of the Explorer list). When the
scan finishes the UI calls `get_type_stats(path)`, which buckets every file in
`FileList` by extension into coarse categories (Images / Videos / Audio /
Documents / Archives / Executables / Code / Other — see `bucket_for` in
`src/main.rs`) and returns `{letter, path, total, free, used, buckets[], files}`
(the drive capacity comes from the matching volume). Shown: six readouts
(scanned path, elapsed, files, total size, categories, largest type), a stacked
colour bar of each category's share, and a legend row per category (swatch,
name, mini bar vs. the largest, size, %, file count). `stats-cancel` calls
`scan_cancel` like the other pages. Headings: the page `<h2>` is exactly
"Statistics" (the e2e `Page-HasText` match is an exact `-ieq`, so keep it
exactly that string); `#stats-view-total` carries the "space by file type"
subtitle / breakdown note.

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

### UI i18n (5 languages)

`ui/i18n.js` loads before `app.js`: `I18N.en|fr|es|de|ar` dictionaries (263
keys each — keep key sets in sync), `HELP[lang]` (sections of raw HTML), and
`curLang()` / `t(key, params)` / `renderHelp(lang)` / `applyLang(lang)` (also
exposed on `window`). Default is `en`; choice persists in localStorage
`greater.lang`.

- Static markup carries `data-i18n` (textContent), `data-i18n-html`,
  `data-i18n-ph` (placeholder), `data-i18n-title`, `data-i18n-aria`.
- Dynamic strings use `t("key", {name: value})` (`{name}` substitution, English
  fallback, returns the key when missing). Junk rule ids map to `junk.<rule>` /
  `junk.why.<rule>`; stats buckets to `bucket.<lowercase>`.
- `applyLang()` sets `<html lang/dir>` (`rtl` for Arabic), sweeps the
  attributes, syncs `#lang-select`, re-renders help, then calls
  `window.__onLangChange`. `app.js` must call `applyLang(curLang())` at startup
  (it does) and define that hook (it re-renders drive cards, explorer, clean,
  dupes and stats lists plus `setUi()`).
- The e2e script asserts English strings, so keep `en` the default (the probes
  restore it after manual language testing).

### Encoding hazard (PS 5.1 + CP1256 — cost hours)

This machine's ANSI codepage is **CP1256**, so `Get-Content -Raw` /
`Set-Content -Encoding UTF8` round-trips corrupt every non-ASCII char in the
UTF-8 UI files (it already mangled `index.html`: em dashes, accents, `·`, `✕`
and the Arabic strings). Touch these files with the edit/write tools, or:

    $s=[System.IO.File]::ReadAllText($p,[Text.Encoding]::UTF8)
    [System.IO.File]::WriteAllText($p,$s,(New-Object Text.UTF8Encoding($false)))

Recovery if corrupted: read as UTF-8 → `[Text.Encoding]::GetEncoding(1256).GetBytes($s)`
→ `[Text.Encoding]::UTF8.GetString($bytes)` → write UTF-8 without BOM. The
PowerShell console shows non-ASCII as `?`/`�` even when the file is fine —
verify characters by codepoint, not by eye.

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
        dark UI; commands list_volumes / scan_start / stats_start / clean_start /
        dupes_start / scan_cancel / get_files / get_type_stats / get_junk /
        purge_selected / remove_entry / get_dupes / delete_dupes / file_info /
        open_location / move_to_trash / delete_permanent;
        events scan-progress / scan-done, both tagged with
        `kind` = scan | stats | clean | dupes; drive cards with donut + usage bars;
        virtualized all-files list largest first with name/path/%-of-largest
        rows and green size bars; per-row actions with confirmation modals;
        tabbed shell (Explorer / Clean / Duplicates / Statistics — all four
        live);
        window-fit flex layout (only the file list scrolls; list renders at
        most 600k rows — Chromium clamps element height at ~33.5M px, so the
        label says "N largest of M files"). Clean page: drive cards, press
        Clean, rule engine lists junk (safe preselected, optional opt-in) with
        reason badges + filter chips, purge to Recycle Bin or permanently.
        Duplicates page: drive cards, press "Find duplicates", size floor +
        keep heuristic, groups with per-copy keep star, purge all-but-one.
        Statistics page: drive cards, press Analyze, per-type size buckets as
        a stacked bar + legend.
        Also: About box (Help → About: Mohamed Baroudi / MECATROTEC / v1.0 /
        baroudi.inc@gmail.com, click-to-copy) and a first-run onboarding modal
        (language + theme, stored under localStorage `greater.onboarded`).
        Verified by `app/e2e-test.ps1`:
        C: full scan 2.8–4.0 s → 1,420,000 files, cancel mid-scan < 1 s,
        Clean on a fabricated junk tree lists only junk and deletes it,
        Duplicates on a fabricated tree finds the pair and deletes the
        non-keeper copy, Statistics on a fabricated tree buckets all five
        file types, first-run prompt + About box contents).
        Remaining: streaming progress from walker (currently ticker over atomic
        stats), MFT fast path in app + elevation relaunch, treemap/sunburst
        visualization, icon (placeholder only).
- [x] Stage 5: packaging — NSIS installer (`Greater_1.0.0_x64-setup.exe`,
        4.7 MiB, perMachine, embedded WebView2 bootstrapper). Verified install /
        launch / silent uninstall on Win11.
- [x] Stage 6: publishing — private source repo `aimesavoir/Greater`; public
        product page + installer in `aimesavoir/Greater-Site` (GitHub Pages,
        EN + AR, four real screenshots), release `v1.0.0` with the installer
        asset. Verified: live page 200, 8/8 images, no console errors, no
        horizontal overflow, Arabic RTL fully translated, download asset hash
        identical to the local installer.
        Remaining: license not chosen; code signing certificate (SmartScreen
        warns on the unsigned installer).
