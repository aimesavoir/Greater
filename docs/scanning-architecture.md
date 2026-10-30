# Scanning Architecture Analysis

Date: 2026-10-17
Environment: Windows 10/11, NTFS volumes (C: 913 GB, D: 70 GB, E: 228 GB, X: 39 GB), Rust 1.99.1 (MSVC), non-elevated session by default.

## Options Considered

### A. Standard recursive enumeration (`std::fs::read_dir`)

- Per directory: `FindFirstFileExW`/`FindNextFileW` under the hood with
  `FindExInfoBasic` + `FindExSearchNameMatching` (no wildcard scan of `.`
  / `..` needed beyond default behavior).
- Metadata via `GetFileInformationByHandleEx` or the find-data already
  returned by the enumeration (size, times, attributes) — no extra handle
  opens per file required for the discovery phase.
- Pros: documented, safe, works on every filesystem (NTFS, ReFS, FAT,
  exFAT, network shares), no elevation required, correct with normal
  Windows permission semantics.
- Cons: one kernel transition per directory plus per-entry name copies;
  serial execution under-uses SSD/NVMe parallelism and leaves CPU cores idle.

### B. Direct NTFS MFT enumeration

Two sub-approaches:

1. **`FSCTL_ENUM_USN_DATA` on `\\.\X:`** (documented, `winioctl.h`).
   Enumerates MFT records via the USN change journal machinery.
   - Returns per record: file reference number, parent reference, name,
     timestamps, attributes, security ID.
   - **Does not return sizes** (no `$DATA` extent information). Sizes would
     require an additional per-file `FSCTL_GET_NTFS_FILE_RECORD` round-trip
     or reading the raw MFT — that erases most of the speed advantage.
   - Opening a volume handle `\\.\X:` with the access rights this needs
     requires administrator/backup privileges in practice.

2. **Raw `$MFT` read + parse** (the WizTree technique): open the volume or
   `C:\$MFT` with `FILE_FLAG_BACKUP_SEMANTICS` (requires
   `SeBackupPrivilege`, i.e. elevation), locate the MFT via
   `FSCTL_GET_NTFS_VOLUME_DATA`, read it sequentially, parse
   `FILE_RECORD_SEGMENT` entries (`$STANDARD_INFORMATION`, `$FILE_NAME`,
   `$DATA` runlists) to compute allocated/logical sizes and build the
   parent index.
   - Pros: by far the fastest possible discovery on NTFS — sequential
     reads of a flat database instead of millions of directory queries;
     inherently correct handling of hard links (each file record counted
     once); matches Windows-reported totals when done right.
   - Cons: **requires elevation**; NTFS-specific (needs a fallback for
     ReFS/FAT/network); parsing on-disk structures is unsafe-adjacent code
     that must be validated carefully; version skew between records
     (v3/v4 for long names) must be handled; deleted/in-use records,
     reparse points, and security descriptors need deliberate treatment.

3. **`GetFileInformationByHandleEx` / `FILE_ID_BOTH_DIR_INFO`**: same
   family as A, no meaningful advantage over `FindFirstFileExW`.

Other APIs evaluated: USN journal tailing (`FSCTL_READ_USN_JOURNAL`) only
tracks changes, not the current full set — not usable for initial scans.

### C. Third-party walkers (`jwalk`, `ignore`, `rayon`)

- `jwalk`: parallel walker using rayon + crossbeam. Good throughput, but
  adds ~1 MB+ of dependencies and yields less control over cancellation
  and streaming than we need. A custom bounded-queue worker pool gives the
  same parallelism with zero extra dependencies.

## Decision

**Hybrid, two-tier architecture:**

1. **Default scanner (always available, no elevation):**
   Windows-native directory enumeration (`FindFirstFileExW` with
   `FindExInfoBasic`) driven by a custom work-queue thread pool
   (`std::thread` + bounded channel), streaming results in batches over
   IPC. Symlink/junction cycles are broken by tracking visited directory
   file-IDs and by never following reparse points by default. Hard links
   are detected by (file ID, volume serial) deduplication when totals must
   match Windows. This is option A + parallelism — documented APIs,
   works on all filesystems, no admin rights.

2. **Optional fast mode (elevated, NTFS only):** raw MFT enumeration
   implemented as a separate module with extensive validation, used only
   when (a) the process has backup privileges, (b) the volume is NTFS, and
   (c) the user opts in. Any failure — access denied, unsupported FS,
   parse error — falls back to scanner 1 without losing the scan.
   `FSCTL_ENUM_USN_DATA` alone is rejected for the main path because it
   cannot supply sizes without extra per-file calls.

Rationale: correctness and zero-privilege operation cover acceptance
criteria; the elevated MFT path is an optimization layer that must never
be a hard requirement. Speed for the default path comes from parallelism,
no-per-file-handle enumeration, and streaming batches — measured in
`prototype/` (see `prototype/RESULTS.md`).

## Key correctness rules (both scanners)

- Never follow reparse points (symlinks/junctions) during traversal →
  no cycles, no escaping the selected scope.
- Track visited directory IDs (file ID + volume serial) → no loops even
  where links are followed (e.g., user-explicit link descent is off by
  default).
- Access-denied/unreadable entries are counted and reported, not fatal.
- Deleted records are never surfaced as active files (raw MFT mode skips
  records with `in-use` flag clear, except when explicitly auditing).
- Hard links: a file with N links contributes its size once per unique
  location when summing "disk used by this folder", but file listing must
  not double-count a directory tree.
- Reparse-point/special files excluded from size totals where Windows
  excludes them (e.g., `System Volume Information` reported separately).

## Benchmark plan (prototype)

- Scanners: (A) serial `read_dir`, (A+) parallel pool, (B) MFT if the
  session permits elevation.
- Metrics: elapsed wall time, files/sec, peak working set (via
  `GetProcessMemoryInfo`), access-denied count, cancellation latency.
- Validation: file counts and byte totals cross-checked between serial
  and parallel scanners on identical scopes, and against
  `Get-ChildItem -Recurse` totals for a medium directory.

## Validated results (2026-10-17, full data in `prototype/RESULTS.md`)

The plan was executed on live volumes (C: 913 GB NVMe, E: 228 GB SATA,
D: 70 GB scratch). Decision confirmed with measurements:

| Scanner | Elevation | C: full volume | E: full volume |
|---------|-----------|----------------|----------------|
| serial `read_dir` | no | 38.9 s | — |
| serial `FindFirstFileExW` | no | 14.0 s | — |
| **parallel-w32 walk (16t, default)** | **no** | **2.7–5.1 s** | **0.16 s warm / 68.2 s cold** |
| USN `FSCTL_ENUM_USN_DATA` | yes | 2.79 s (no sizes) | 0.21 s (no sizes) |
| **raw MFT (mft-raw)** | **yes** | **3.31 s** | **3.73 s (18× vs cold walk)** |

- All four walk modes produce identical results; walk matches
  `Get-ChildItem` exactly where ACLs allow; cancellation aborts in ≤1 ms.
- Walk vs MFT deltas are fully explained: walk double-counts hard links
  (2.13 names/file system-wide) and cannot see 584 ACL-denied directory
  subtrees on C:; MFT counts each file once and sees all metadata.
- Raw MFT read throughput: 1,075 MB/s (NVMe) / 56 MB/s (SATA) with 4 MiB
  chunks. A 4 KiB-chunk variant was 8.7× slower (28.8 s on C:) — chunk
  size is load-bearing.
- USN mode is dropped from the product: same elevation requirement as raw
  MFT but no sizes.
- Raw MFT extension records (attribute-list files) are not yet fully
  size-aggregated (27,264 on C:); listed as a production enhancement.
