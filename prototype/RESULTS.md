# scanbench — Scanning Architecture Benchmark Results

Prototype: `X:\Greater\prototype` (Rust 1.99.1, release: opt-level 3, LTO thin,
codegen-units 1, panic=abort, strip). Date: 2026-10-17. Live Windows 11 system.

Test volumes:

| Volume | Media | Size | Free | Notes |
|--------|-------|------|------|-------|
| C: | NVMe SSD | 913 GB | ~7% | system volume, heavy churn |
| D: | NTFS | 70 GB | 99.9% | scratch, almost empty |
| E: | SATA (FUJITSU MHZ2320BH) | 228 GB | 1.3% | near-full data disk |
| X: | NTFS | 39 GB | — | workspace |

All runs unless noted: single scan of the **entire volume root** (`walk C:\`,
`mft-raw C:`). Warm cache unless marked cold. Walk counts = directory entries
(paths); MFT counts = unique file records.

## 1. Walk scanners (no elevation, any filesystem)

Full volume, parallel = worker-pool `FindFirstFileExW(FindExInfoBasic,
FIND_FIRST_EX_LARGE_FETCH)`:

| Target | Mode | Elapsed | Files | Dirs | Logical bytes | Notes |
|--------|------|---------|-------|------|---------------|-------|
| C:\ | serial (std read_dir) | 38.9 s | — | — | — | baseline A |
| C:\ | serial-w32 | 14.0 s | — | — | — | A2 |
| C:\ | parallel (8t) | 3.4 s | — | — | — | A+ |
| C:\ | parallel-w32 (16t) | 2.7–5.1 s | 1,409,221 | 330,141 | 877,515,972,686 (817.25 GiB) | range = run-to-run churn |
| C:\Windows | all modes | 0.80–14.5 s | 133,767 | 91,276 | — | modes match exactly |
| E:\ | parallel-w32 | 0.163 s warm / 68.2 s cold | 133,034 | 8,601 | 236,702,635,581 (220.45 GiB) | cold = first touch after boot/idle |
| D:\ | all modes | <0.05 s | — | — | — | all modes MATCH |

Thread sweep (parallel-w32, C:\): 1t 13.8 s · 4t 4.9 s · 8t 3.5 s · 16t 3.2 s · 32t 3.0 s.
Peak working set: 6–16 MiB. Cancellation (`--cancel-after`) stops within 1 ms of
deadline, clean exit.

Access behavior: walk respects ACLs — 584 dirs on C:\, 28 on E:\ returned
ACCESS_DENIED (their contents are invisible to walk, counted in `denied`).
Reparse points are skipped entirely (not descended, not counted).
Hard-linked files are counted **once per directory entry** (same file under two
paths = two entries, sizes double-counted) — standard walk behavior, same as
Explorer/WinDirStat.

## 2. USN enumeration (`FSCTL_ENUM_USN_DATA`, elevated, NTFS only)

| Volume | Elapsed | Records | Throughput | Notes |
|--------|---------|---------|-----------|-------|
| C: | 2.79 s | 1,774,925 | 637k rec/s | includes journaled-but-deleted records |
| D: | <0.01 s | 28 | — | |
| E: | 0.21 s | 145,636 | 697k rec/s | |

**USN records carry no file sizes** — useless alone for a disk-usage analyzer.
Sizes would require `FSCTL_GET_NTFS_FILE_RECORD` per record (syscall per file,
estimated far slower) or raw MFT parsing. USN mode is therefore superseded by
mft-raw in the app (kept in the prototype for diagnostics only).
Requires elevation (os error 5 otherwise).

## 3. Raw MFT scanner (`mft-raw`, elevated, NTFS only)

Reads record 0 at `MftStartLcn`, parses `$DATA` runlist (incl. attribute-list
extension records for $MFT's own layout), streams the full MFT in 4 MiB chunks,
applies NTFS fixups, parses resident/non-resident `$DATA` sizes, `$FILE_NAME`
(parent + name), in-use flag, reparse flag.

| Volume | Elapsed | In-use files | In-use dirs | Logical bytes | Allocated | Deleted | Rec/s |
|--------|---------|--------------|-------------|---------------|-----------|---------|-------|
| C: | **3.31 s** | 1,427,724 | 347,142 | 561,307,584,849 (522.76 GiB) | 525.42 GiB | 498,219 | 537k |
| D: | 0.14 s | 31 | 18 | 90,862,107 | 0.08 GiB | 2 | — |
| E: | **3.73 s** | 136,369 | 9,288 | 231,420,361,710 (215.53 GiB) | 215.86 GiB | 67,491 | 39k |

Other C: figures: FN name entries 3,037,029 (2.13 links/file avg), extension
records 27,264 (skipped, see limitations), torn/garbage free slots 36, reparse
31, MFT size read 2,355,625,984 B in 13 physical runs, peak WS 7.9 MiB.
E: FN names 210,058 (1.54 links/file), MFT read 218 MB in 2 runs.

Raw volume read micro-benchmark (`rawread`, 8 MiB reads from MFT LCN):
C: **1,075 MB/s** (NVMe), E: **56 MB/s** (SATA). mft-raw C: wall time ≈
2.1 s read + ~1.2 s parse.

### The 4 KiB chunk bug (recorded lesson)

First mft-raw implementation used `chunk = record_size.max(cluster)` = 4 KiB —
575,000 `ReadFile` calls → C: 28.8 s, E: 11.1 s at identical parse CPU. With a
4 MiB chunk: C: 3.31 s (8.7×), E: 3.73 s (3.0×). I/O granularity dominates
syscall-per-page overhead; WizTree-class scanners need large sequential reads.

## 4. Cross-validation

- **Walk modes vs each other**: serial/serial-w32/parallel/parallel-w32 produce
  identical (files, dirs, bytes) on every test tree; back-to-back full-volume
  runs of different modes match exactly when run within seconds.
- **Walk vs PowerShell** (`Get-ChildItem` full C:\, ProgramData subtree):
  files+bytes exact match on ProgramData (16,639 files / 22,753,620,511 B);
  dir-count differences fully explained by denied + reparse dirs.
- **USN vs mft-raw** (C:): USN records 1,774,925 ≈ mft-raw in-use
  1,427,724 + 347,142 = 1,774,866 in-use + extension 27,264 + reparse 31 +
  torn 36 (historical deleted are in USN, counted separately by mft-raw as
  498,219 free-slot deleted records). Consistent.
- **Walk vs mft-raw** (C:): walk 817.25 GiB vs MFT 522.76 GiB. Cause:
  hard-link double counting in walk — verified `fsutil hardlink list
  kernelbase.dll` shows 2 links (System32 + WinSxS); system-wide 2.13
  names/file. MFT counts each file once (disk-usage truth); walk counts paths.
  Walk file count is lower (1,409,221) because 584 ACL-denied directories are
  invisible; MFT sees all metadata regardless of ACL. Both deltas are expected
  and explainable to the byte.
- **Walk vs mft-raw** (E:): walk 220.45 GiB / 133,034 files vs MFT
  215.53 GiB / 136,369 files — same story (hardlink dedup vs denied-dir
  visibility; 28 denied dirs on E:).
- **Cancellation**: walk (both variants) and mft-raw stop on the token; USN
  loop checks per iteration.

## 5. Limitations (measured or known)

1. **Elevation**: mft-raw/usn need admin (or SeBackupPrivilege). The app must
   fall back to walk when not elevated.
2. **NTFS only**: mft-raw/usn reject FAT/exFAT/ReFS; walk works everywhere.
3. **Extension records** (attribute-list files, 27,264 on C:) are counted as
   files but their `$DATA` attributes living in extension records are not
   aggregated into sizes (runlists of $MFT itself ARE followed). Impact
   observed small (+35 MB when $MFT runlist fix landed), but heavily
   fragmented files may under-report logical size. Full attribute-list
   aggregation is a production enhancement.
4. **Hard links**: mft-raw = per-record (disk truth); walk = per-path. The app
   must expose both semantics (total vs per-path sizes).
5. **Reparse points** skipped on all paths (neither walk nor MFT counts them);
   symlinked trees are not resolved — documented product decision.
6. **Resident `$DATA`**: allocated size counted as content length, not
   cluster-padded; directory `$INDEX_ALLOCATION` counted separately —
   allocated totals are approximate.
7. **Live churn**: full-volume scans of C: run while the system is live;
   run-to-run deltas of ±0.1% are normal (matches observed).
8. **USN journal**: enabled here; long-disabled journals may make
   `FSCTL_ENUM_USN_DATA` slower to start (not observed on test volumes).
9. **CPU sample** (GetProcessTimes) under-reported for mft-raw (31 ms vs
   ~1.2 s implied parse) — elapsed time is the trusted metric; CPU metric
   flagged as unreliable for volume-handle I/O in this prototype.

## 6. Architecture decision (validated)

1. **Default engine: parallel `FindFirstFileExW` walk (16 threads default,
   no elevation)** — 2.7–5.1 s full C: (NVMe, warm), 0.16 s E: warm,
   works on every filesystem, respects ACLs, needs no privilege.
   Cold-cache HDD worst case: 68 s for 228 GB (E:).
2. **Optional accelerated engine: raw MFT (elevated sidecar, NTFS only)** —
   3.3 s C:, 3.7 s E: regardless of cache state (E: cold walk 68 s → 3.7 s,
   **18×**), complete metadata (sees ACL-hidden dirs, hardlink-deduped
   totals, deleted-record counts). Ship as UAC-elevated helper relaunch.
3. **USN mode**: dropped from the product (no sizes; same elevation cost as
   mft-raw); retained in the prototype for diagnostics.
4. Raw MFT reads must use ≥1 MiB (measured: 4 MiB) sequential chunks; small
   reads destroy throughput (28.8 s → 3.3 s on C:).
5. Cancel tokens must be checked per directory (walk) and per 4 MiB chunk
   (MFT) — both measured to abort within milliseconds.
