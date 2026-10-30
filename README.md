<div align="center">

<img src="Logo.png" width="140" alt="Greater logo">

# Greater

**A fast Windows disk usage analyzer — see what eats your space, and reclaim it safely.**

[![Platform](https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-0078D6)](#requirements)
[![Built with](https://img.shields.io/badge/Tauri%202-Rust%20%2B%20WebView2-orange)](#architecture)
[![Version](https://img.shields.io/badge/version-1.0.0-blue)]()

</div>

---

Greater scans a whole drive in seconds, then gives you four ways to look at it:
what is big, what is junk, what is duplicated, and what type of file eats the most
space. Nothing is ever deleted without you ticking it and confirming.

## Features

### Explorer — what is big
- Scans an entire drive in **2.7–5.1 s** (1.4 M files on a typical `C:`).
- Virtualized list of the largest files, largest first, with size bars and
  %-of-largest so the giants stand out instantly.
- Switch to **By folder** to see which directories carry the weight.
- Per-row actions: file info, open location, move to Recycle Bin, delete permanently.

### Clean — what is junk
- A **whitelist-only** rule engine: only temp, cache, log and download folders
  can ever match. Anything outside those patterns is never proposed.
- Two severities: **safe** (regenerated scratch — preselected) and **optional**
  (reversible, but costs a re-download or rebuild — opt-in).
- Age-gated: files touched recently are skipped as "probably in use".
- Hard-blocked system paths: `pagefile.sys`, `hiberfil.sys`, boot/BCD files and
  `System Volume Information` are never touched, whatever the rules say.
- Results **stream in live** while the drive is still being walked.
- Purge to the Recycle Bin, or delete permanently.

### Duplicates — what is redundant
- Groups files by size first, then hashes only the candidates — so it stays fast
  on drives with millions of files.
- Hardlink-aware (a hardlinked pair is not counted as reclaimable).
- Keeps one copy per group by **oldest**, **newest**, or **shortest path** — and
  the last copy of a group can never be deleted.

### Statistics — what type of file eats space
- Every file bucketed into Images / Videos / Audio / Documents / Archives /
  Executables / Code / Other.
- Stacked colour bar plus a legend with size, percentage and file count per
  category.

### Deleting safely and visibly
Bulk deletes run inside a live progress dialog: progress bar, "deleted X of Y",
the current file name, a running failure count, and the **size freed so far**.
A **Cancel** button stops the purge within one batch.

| Engine | Used for | Speed |
| --- | --- | --- |
| Parallel `DeleteFileW` (up to 16 threads) | Permanent delete | ~3,000 files in 0.25 s |
| `SHFileOperationW` (shell) | Recycle Bin | ~512 files/s (OS cost of recoverability) |

## Install

Download `Greater_1.0.0_x64-setup.exe` and run it. The installer is `perMachine`
(installs to `C:\Program Files\Greater`, needs admin) and embeds the WebView2
bootstrapper, so machines without the runtime can still install.

## Requirements

- 64-bit Windows 10 (1809+) or Windows 11 — the Tauri/WebView2 floor.
- No MSVC runtime needed: Rust is statically linked.
- Scanning does **not** need administrator rights. A few SYSTEM-owned files can
  only be deleted with elevation; the UI reports those as "could not be removed".

## Build from source

Prerequisites: Rust (MSVC toolchain) and the Tauri CLI.

```powershell
# Dev / release build of the app
cd app\src-tauri
$env:CARGO_TARGET_DIR="D:\greater-target"   # keep build output off a small drive
cargo build --release

# Windows installer (NSIS)
cargo tauri build
# -> D:\greater-target\release\bundle\nsis\Greater_1.0.0_x64-setup.exe
```

Tests:

```powershell
cd app\src-tauri
cargo test --release        # duplicate finder unit tests
..\e2e-test.ps1             # end-to-end UI test (drives the real window)
```

## Architecture

- **Scanner**: parallel `FindFirstFileExW(FindExInfoBasic, LARGE_FETCH)` work-queue
  walker, no elevation, works on all filesystems. Emits `\\?\` verbatim paths for
  long-path support and strips them before they reach the UI or the shell.
- **Optional**: an elevated raw NTFS MFT reader (sees ACL-hidden directories,
  hardlink-deduped totals).
- **Frontend**: vanilla HTML/CSS/JS in a WebView2 window — no npm build step.
- **UI languages**: English, French, Spanish, German and Arabic (with RTL layout).
- Design notes live in [`docs/scanning-architecture.md`](docs/scanning-architecture.md)
  and the scanner prototype's measurements in [`prototype/RESULTS.md`](prototype/RESULTS.md).

## Project layout

```
app/src-tauri/     Rust backend (commands, scanner, junk rules, duplicate finder)
app/ui/            UI: index.html, app.js, i18n.js, styles.css
app/e2e-test.ps1   End-to-end test driving the real window via UI Automation
prototype/         Benchmark CLI used to validate the scanning strategy
docs/              Architecture notes
```

## Author

**Mohamed Baroudi** — MECATROTEC — [baroudi.inc@gmail.com](mailto:baroudi.inc@gmail.com)

## License

Not yet chosen — see the repository owner.
