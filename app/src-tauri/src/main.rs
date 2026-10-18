#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod scanner;

use std::os::windows::ffi::OsStrExt;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{Emitter, Manager};
use windows_sys::Win32::Storage::FileSystem::{
    GetDiskFreeSpaceExW, GetDriveTypeW, GetLogicalDriveStringsW, GetVolumeInformationW,
};

struct ScanSlot(Mutex<Option<scanner::cancel::CancelToken>>);
struct FileList(Mutex<Vec<TopEntry>>);
struct JunkList(Mutex<Vec<scanner::junk::JunkHit>>);
struct DupList(Mutex<Vec<scanner::dup::DupGroup>>);

fn dbg_log(line: &str) {
    use std::io::Write;
    if std::env::var_os("GREATER_DEBUG").is_none() {
        return;
    }
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(std::env::temp_dir().join("greater_debug.log"))
    {
        let _ = writeln!(f, "{line}");
    }
}

#[derive(Clone, serde::Serialize)]
struct ProgressEvent {
    kind: &'static str,
    /// "walk" while the tree is being traversed, "hash" while duplicate
    /// candidates are being read. Other pages ignore this.
    phase: &'static str,
    elapsed_ms: u128,
    files: u64,
    dirs: u64,
    bytes: u64,
    denied: u64,
    not_found: u64,
    errors: u64,
    reparse_skipped: u64,
}

#[derive(Clone, serde::Serialize)]
struct TopEntry {
    size: u64,
    path: String,
    mtime_ms: u64,
}

#[derive(Clone, serde::Serialize)]
struct DoneEvent {
    kind: &'static str,
    elapsed_ms: u128,
    files: u64,
    dirs: u64,
    bytes: u64,
    denied: u64,
    not_found: u64,
    errors: u64,
    reparse_skipped: u64,
    cancelled: bool,
    total_listed: usize,
    junk_files: usize,
    junk_bytes: u64,
    junk_safe_files: usize,
    junk_safe_bytes: u64,
    junk_optional_files: usize,
    junk_optional_bytes: u64,
    dup_groups: usize,
    dup_files: usize,
    dup_wasted: u64,
    error: Option<String>,
}

#[derive(Clone, serde::Serialize)]
struct FilesPage {
    total: usize,
    offset: usize,
    entries: Vec<TopEntry>,
}

#[derive(Clone, serde::Serialize)]
struct JunkPage {
    total: usize,
    offset: usize,
    entries: Vec<scanner::junk::JunkHit>,
}

#[derive(Clone, serde::Serialize)]
struct FailedItem {
    path: String,
    error: String,
}

#[derive(Clone, serde::Serialize)]
struct PurgeResult {
    deleted: usize,
    remaining: usize,
    safe_files: usize,
    safe_bytes: u64,
    optional_files: usize,
    optional_bytes: u64,
    failed: Vec<FailedItem>,
}

#[derive(Clone, serde::Serialize)]
struct DupFileOut {
    path: String,
    size: u64,
    mtime_ms: u64,
    /// true when this copy is the group's default "keep" candidate.
    keep: bool,
}

#[derive(Clone, serde::Serialize)]
struct DupGroupOut {
    id: usize,
    size: u64,
    name: String,
    files: Vec<DupFileOut>,
}

#[derive(Clone, serde::Serialize)]
struct DupPage {
    total: usize,
    offset: usize,
    entries: Vec<DupGroupOut>,
    groups: usize,
    files: usize,
    wasted: u64,
    /// Files/bytes that would be removed with the current keep policy and no
    /// per-path overrides (i.e. one copy kept per group).
    base_files: usize,
    base_bytes: u64,
}

#[derive(Clone, serde::Serialize)]
struct DupPurgeResult {
    deleted: usize,
    remaining_groups: usize,
    remaining_files: usize,
    wasted: u64,
    base_files: usize,
    base_bytes: u64,
    failed: Vec<FailedItem>,
}

/// Final path component, for a compact group label.
fn base_name(p: &str) -> String {
    match p.rfind(['\\', '/']) {
        Some(i) => p[i + 1..].to_string(),
        None => p.to_string(),
    }
}

/// One explicit checkbox toggle made by the user, overriding their chosen
/// default ("safe" / "all" / "none").
#[derive(Clone, serde::Deserialize)]
struct InvertItem {
    path: String,
    on: bool,
}

#[derive(Clone, serde::Serialize)]
struct Volume {
    letter: String,
    kind: String,
    total: u64,
    free: u64,
    label: String,
    fs: String,
}

#[derive(Clone, serde::Serialize)]
struct FileInfo {
    name: String,
    path: String,
    parent: String,
    extension: String,
    size: u64,
    created_ms: Option<u64>,
    modified_ms: Option<u64>,
    accessed_ms: Option<u64>,
    readonly: bool,
    hidden: bool,
    system: bool,
    archive: bool,
    reparse: bool,
}

fn to_ms(t: std::io::Result<std::time::SystemTime>) -> Option<u64> {
    t.ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
}

fn read_wide(buf: &[u16]) -> String {
    let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
    String::from_utf16_lossy(&buf[..end])
}

/// Strips the `\\?\` verbatim prefix the walker uses for long-path support.
/// Shell APIs (SHFileOperation, explorer /select) reject verbatim paths, and
/// they are noisy in the UI.
fn normalize_path(p: &str) -> String {
    if let Some(rest) = p.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{}", rest)
    } else if let Some(rest) = p.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        p.to_string()
    }
}

#[tauri::command]
fn list_volumes() -> Vec<Volume> {
    unsafe {
        let mut buf = vec![0u16; 512];
        let n = GetLogicalDriveStringsW(buf.len() as u32, buf.as_mut_ptr());
        if n == 0 {
            return Vec::new();
        }
        let drives: Vec<String> = buf[..n as usize]
            .split(|&c| c == 0)
            .filter(|s| !s.is_empty())
            .map(|s| String::from_utf16_lossy(s))
            .collect();
        let mut out = Vec::new();
        for d in drives {
            let wide: Vec<u16> = d.encode_utf16().chain(std::iter::once(0)).collect();
            let kind = match GetDriveTypeW(wide.as_ptr()) {
                2 => "removable",
                3 => "fixed",
                4 => "network",
                5 => "optical",
                6 => "ram",
                _ => "unknown",
            };
            let mut total: u64 = 0;
            let mut free: u64 = 0;
            GetDiskFreeSpaceExW(
                wide.as_ptr(),
                std::ptr::null_mut(),
                &mut total as *mut u64,
                &mut free as *mut u64,
            );
            let mut label_buf = vec![0u16; 261];
            let mut fs_buf = vec![0u16; 261];
            let mut serial: u32 = 0;
            let mut max_comp: u32 = 0;
            let mut flags: u32 = 0;
            GetVolumeInformationW(
                wide.as_ptr(),
                label_buf.as_mut_ptr(),
                label_buf.len() as u32,
                &mut serial,
                &mut max_comp,
                &mut flags,
                fs_buf.as_mut_ptr(),
                fs_buf.len() as u32,
            );
            out.push(Volume {
                letter: d.chars().next().map(|c| c.to_string()).unwrap_or_default(),
                kind: kind.to_string(),
                total,
                free,
                label: read_wide(&label_buf),
                fs: read_wide(&fs_buf),
            });
        }
        out
    }
}

#[tauri::command]
fn file_info(path: String) -> Result<FileInfo, String> {
    use std::os::windows::fs::MetadataExt;
    const FILE_ATTRIBUTE_READONLY: u32 = 0x1;
    const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
    const FILE_ATTRIBUTE_SYSTEM: u32 = 0x4;
    const FILE_ATTRIBUTE_ARCHIVE: u32 = 0x20;
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;

    let p = std::path::PathBuf::from(&path);
    let md = std::fs::metadata(&p).map_err(|e| format!("cannot read metadata: {e}"))?;
    let attrs = md.file_attributes();
    Ok(FileInfo {
        name: p
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default(),
        path: p.display().to_string(),
        parent: p
            .parent()
            .map(|s| s.display().to_string())
            .unwrap_or_default(),
        extension: p
            .extension()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default(),
        size: md.len(),
        created_ms: to_ms(md.created()),
        modified_ms: to_ms(md.modified()),
        accessed_ms: to_ms(md.accessed()),
        readonly: attrs & FILE_ATTRIBUTE_READONLY != 0,
        hidden: attrs & FILE_ATTRIBUTE_HIDDEN != 0,
        system: attrs & FILE_ATTRIBUTE_SYSTEM != 0,
        archive: attrs & FILE_ATTRIBUTE_ARCHIVE != 0,
        reparse: attrs & FILE_ATTRIBUTE_REPARSE_POINT != 0,
    })
}

#[tauri::command]
fn open_location(path: String) -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    let path = normalize_path(&path);
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err("file no longer exists".into());
    }
    // raw_arg: Rust's normal argument quoting wraps the whole `/select,"path"`
    // token, and explorer's own parser then splits at the first space and
    // silently opens Documents instead. The raw form below is what explorer
    // expects. Verified with paths containing spaces and parentheses.
    let arg = if p.is_dir() {
        format!("\"{}\"", p.display())
    } else {
        format!("/select,\"{}\"", p.display())
    };
    std::process::Command::new("explorer.exe")
        .raw_arg(arg)
        .spawn()
        .map_err(|e| format!("cannot launch explorer: {e}"))?;
    Ok(())
}

#[tauri::command]
fn move_to_trash(path: String) -> Result<(), String> {
    use windows_sys::Win32::UI::Shell::{SHFileOperationW, SHFILEOPSTRUCTW};

    const FO_DELETE: u32 = 3;
    const FOF_SILENT: u16 = 0x0004;
    const FOF_NOCONFIRMATION: u16 = 0x0010;
    const FOF_NOERRORUI: u16 = 0x0400;
    const FOF_ALLOWUNDO: u16 = 0x0040;

    let path = normalize_path(&path);
    let p = std::path::PathBuf::from(&path);
    if !p.exists() {
        return Err("file no longer exists".into());
    }
    let mut from: Vec<u16> = p.as_os_str().encode_wide().collect();
    from.push(0);
    from.push(0);
    dbg_log(&format!(
        "move_to_trash path={path:?} wide_len={} valid_sep={}",
        from.len(),
        !path.contains('/')
    ));

    let mut op: SHFILEOPSTRUCTW = unsafe { std::mem::zeroed() };
    op.wFunc = FO_DELETE;
    op.pFrom = from.as_ptr();
    op.fFlags = FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI;

    let rc = unsafe { SHFileOperationW(&mut op) };
    if rc != 0 {
        return Err(format!("recycle bin operation failed (code {rc})"));
    }
    if op.fAnyOperationsAborted != 0 {
        return Err("operation aborted".into());
    }
    if p.exists() {
        return Err("file still present after recycle operation".into());
    }
    Ok(())
}

#[tauri::command]
fn delete_permanent(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    let md = std::fs::symlink_metadata(&p).map_err(|e| format!("cannot access file: {e}"))?;
    if md.is_dir() {
        return Err("refusing to permanently delete a directory".into());
    }
    std::fs::remove_file(&p).map_err(|e| format!("delete failed: {e}"))
}

#[tauri::command]
fn get_files(
    app: tauri::AppHandle,
    offset: usize,
    limit: usize,
) -> Result<FilesPage, String> {
    let list = app.state::<FileList>();
    let guard = list.0.lock().unwrap();
    let total = guard.len();
    let offset = offset.min(total);
    let end = (offset + limit.clamp(1, 2000)).min(total);
    let entries: Vec<TopEntry> = guard[offset..end].to_vec();
    Ok(FilesPage {
        total,
        offset,
        entries,
    })
}

#[tauri::command]
fn remove_entry(app: tauri::AppHandle, path: String) -> usize {
    let list = app.state::<FileList>();
    let mut guard = list.0.lock().unwrap();
    let key = normalize_path(&path);
    if let Some(pos) = guard.iter().position(|e| e.path == key) {
        guard.remove(pos);
    }
    guard.len()
}

#[derive(Clone, Copy, PartialEq)]
enum RunKind {
    Scan,
    Clean,
    Dupes,
}

impl RunKind {
    fn id(self) -> &'static str {
        match self {
            RunKind::Scan => "scan",
            RunKind::Clean => "clean",
            RunKind::Dupes => "dupes",
        }
    }
}

/// Shared walker driver behind the Explorer scan, the Clean sweep and the
/// Duplicates finder. `Scan` keeps every file (largest first); `Clean` keeps
/// only the files the junk rules accept; `Dupes` hashes shared-size candidates
/// and groups identical files. All emit `scan-progress` while running and a
/// single `scan-done` carrying `kind`.
fn run_walk(
    app: tauri::AppHandle,
    path: String,
    mode: String,
    threads: usize,
    min_size: u64,
    kind: RunKind,
) -> Result<(), String> {
    if path.trim().is_empty() {
        return Err("path is empty".into());
    }
    match kind {
        RunKind::Scan => app.state::<FileList>().0.lock().unwrap().clear(),
        RunKind::Clean => app.state::<JunkList>().0.lock().unwrap().clear(),
        RunKind::Dupes => app.state::<DupList>().0.lock().unwrap().clear(),
    }
    let cancel = {
        let slot = app.state::<ScanSlot>();
        let mut g = slot.0.lock().unwrap();
        if g.is_some() {
            return Err("a scan is already running".into());
        }
        let c = scanner::cancel::CancelToken::new();
        *g = Some(c.clone());
        c
    };

    std::thread::spawn(move || {
        dbg_log(&format!(
            "{} path={path} mode={mode} threads={threads}",
            kind.id()
        ));
        let stats = Arc::new(scanner::stats::Stats::new());
        let p = std::path::PathBuf::from(&path);
        let threads = threads.clamp(1, 64);
        let stop = Arc::new(AtomicBool::new(false));

        let stats_t = stats.clone();
        let app_t = app.clone();
        let stop_t = stop.clone();
        let ticker = std::thread::spawn(move || {
            let t0 = Instant::now();
            while !stop_t.load(Ordering::Relaxed) {
                std::thread::sleep(Duration::from_millis(200));
                if stop_t.load(Ordering::Relaxed) {
                    break;
                }
                let s = stats_t.snapshot();
                let ev = ProgressEvent {
                    kind: kind.id(),
                    phase: "walk",
                    elapsed_ms: t0.elapsed().as_millis(),
                    files: s.files,
                    dirs: s.dirs,
                    bytes: s.bytes,
                    denied: s.denied,
                    not_found: s.not_found,
                    errors: s.errors,
                    reparse_skipped: s.reparse_skipped,
                };
                match app_t.emit("scan-progress", ev) {
                    Ok(()) => dbg_log(&format!("{} progress ok files={}", kind.id(), s.files)),
                    Err(e) => dbg_log(&format!("progress emit ERR {e}")),
                }
            }
        });

        let outcome = catch_unwind(AssertUnwindSafe(|| {
            match mode.as_str() {
                "serial" => scanner::walk::scan_serial(&p, &cancel, &stats),
                "parallel" => scanner::walk::scan_parallel(&p, threads, &cancel, &stats),
                "serial-w32" => scanner::win32walk::scan_serial_w32(&p, &cancel, &stats),
                _ => scanner::win32walk::scan_parallel_w32(&p, threads, &cancel, &stats),
            }
        }));

        stop.store(true, Ordering::Relaxed);
        let _ = ticker.join();

        let mut error: Option<String> = None;
        let mut elapsed_ms: u128 = 0;
        let mut cancelled = false;
        let mut s = scanner::stats::Snapshot {
            files: 0,
            dirs: 0,
            bytes: 0,
            denied: 0,
            not_found: 0,
            errors: 0,
            reparse_skipped: 0,
        };
        let mut total_listed = 0usize;
        let mut junk_files = 0usize;
        let mut junk_bytes = 0u64;
        let mut junk_safe_files = 0usize;
        let mut junk_safe_bytes = 0u64;
        let mut junk_optional_files = 0usize;
        let mut junk_optional_bytes = 0u64;
        let mut dup_groups = 0usize;
        let mut dup_files = 0usize;
        let mut dup_wasted = 0u64;

        match outcome {
            Ok(result) => {
                elapsed_ms = result.elapsed_ms;
                cancelled = result.cancelled;
                s = stats.snapshot();
                match Arc::try_unwrap(stats) {
                    Ok(owned) => {
                        let sorted = owned.into_sorted_files();
                        match kind {
                            RunKind::Scan => {
                                total_listed = sorted.len();
                                let entries: Vec<TopEntry> = sorted
                                    .into_iter()
                                    .map(|h| TopEntry {
                                        size: h.size,
                                        path: normalize_path(&h.path.display().to_string()),
                                        mtime_ms: h.mtime_ms,
                                    })
                                    .collect();
                                if let Some(list) = app.try_state::<FileList>() {
                                    *list.0.lock().unwrap() = entries;
                                }
                            }
                            RunKind::Clean => {
                                let now = scanner::junk::now_ms();
                                let mut hits: Vec<scanner::junk::JunkHit> = Vec::new();
                                for h in sorted {
                                    let path = normalize_path(&h.path.display().to_string());
                                    if let Some(rule) = scanner::junk::classify(&path, h.mtime_ms, now)
                                    {
                                        junk_bytes += h.size;
                                        hits.push(scanner::junk::JunkHit {
                                            size: h.size,
                                            path,
                                            mtime_ms: h.mtime_ms,
                                            rule: rule.id,
                                            label: rule.label,
                                            category: rule.category_str(),
                                        });
                                    }
                                }
                                dbg_log(&format!(
                                    "clean matched files={} bytes={}",
                                    hits.len(),
                                    junk_bytes
                                ));
                                for h in &hits {
                                    if h.category == "optional" {
                                        junk_optional_files += 1;
                                        junk_optional_bytes += h.size;
                                    } else {
                                        junk_safe_files += 1;
                                        junk_safe_bytes += h.size;
                                    }
                                }
                                junk_files = hits.len();
                                total_listed = hits.len();
                                if let Some(list) = app.try_state::<JunkList>() {
                                    *list.0.lock().unwrap() = hits;
                                }
                            }
                            RunKind::Dupes => {
                                let hashed = Arc::new(AtomicU64::new(0));
                                let stop2 = Arc::new(AtomicBool::new(false));
                                let t2_start = Instant::now();
                                let hashed_t = hashed.clone();
                                let stop2_t = stop2.clone();
                                let app2 = app.clone();
                                let ticker2 = std::thread::spawn(move || {
                                    while !stop2_t.load(Ordering::Relaxed) {
                                        std::thread::sleep(Duration::from_millis(200));
                                        if stop2_t.load(Ordering::Relaxed) {
                                            break;
                                        }
                                        let h = hashed_t.load(Ordering::Relaxed);
                                        let _ = app2.emit(
                                            "scan-progress",
                                            ProgressEvent {
                                                kind: "dupes",
                                                phase: "hash",
                                                elapsed_ms: t2_start.elapsed().as_millis(),
                                                files: h,
                                                dirs: 0,
                                                bytes: 0,
                                                denied: 0,
                                                not_found: 0,
                                                errors: 0,
                                                reparse_skipped: 0,
                                            },
                                        );
                                    }
                                });
                                let plan = scanner::dup::find(&sorted, min_size, threads, &cancel, &hashed);                                stop2.store(true, Ordering::Relaxed);
                                let _ = ticker2.join();
                                elapsed_ms += t2_start.elapsed().as_millis();
                                dup_groups = plan.groups.len();
                                dup_files = plan.files;
                                dup_wasted = plan.wasted;
                                total_listed = plan.groups.len();
                                dbg_log(&format!(
                                    "dupes groups={} files={} wasted={}",
                                    dup_groups, dup_files, dup_wasted
                                ));
                                if let Some(list) = app.try_state::<DupList>() {
                                    *list.0.lock().unwrap() = plan.groups;
                                }
                            }
                        }
                    }
                    Err(_) => {
                        error = Some("scanner state still referenced".into());
                    }
                }
            }
            Err(_) => {
                error = Some("internal scanner error (panic) — partial results discarded".into());
            }
        }

        let done = DoneEvent {
            kind: kind.id(),
            elapsed_ms,
            files: s.files,
            dirs: s.dirs,
            bytes: s.bytes,
            denied: s.denied,
            not_found: s.not_found,
            errors: s.errors,
            reparse_skipped: s.reparse_skipped,
            cancelled,
            total_listed,
            junk_files,
            junk_bytes,
            junk_safe_files,
            junk_safe_bytes,
            junk_optional_files,
            junk_optional_bytes,
            dup_groups,
            dup_files,
            dup_wasted,
            error,
        };
        match app.emit("scan-done", done) {
            Ok(()) => dbg_log(&format!(
                "{} done ok files={} listed={} junk={} cancelled={}",
                kind.id(),
                s.files,
                total_listed,
                junk_files,
                cancelled
            )),
            Err(e) => dbg_log(&format!("done emit ERR {e}")),
        }
        if let Some(slot) = app.try_state::<ScanSlot>() {
            *slot.0.lock().unwrap() = None;
        }
    });
    Ok(())
}

#[tauri::command]
fn scan_start(
    app: tauri::AppHandle,
    path: String,
    mode: String,
    threads: usize,
) -> Result<(), String> {
    run_walk(app, path, mode, threads, 0, RunKind::Scan)
}

#[tauri::command]
fn clean_start(
    app: tauri::AppHandle,
    path: String,
    mode: String,
    threads: usize,
) -> Result<(), String> {
    run_walk(app, path, mode, threads, 0, RunKind::Clean)
}

#[tauri::command]
fn dupes_start(
    app: tauri::AppHandle,
    path: String,
    mode: String,
    threads: usize,
    min_size: u64,
) -> Result<(), String> {
    run_walk(app, path, mode, threads, min_size, RunKind::Dupes)
}

#[tauri::command]
fn get_junk(
    app: tauri::AppHandle,
    offset: usize,
    limit: usize,
    category: Option<String>,
) -> Result<JunkPage, String> {
    let list = app.state::<JunkList>();
    let guard = list.0.lock().unwrap();
    let wanted = category.as_deref().filter(|c| *c == "safe" || *c == "optional");
    let matches = |h: &scanner::junk::JunkHit| match wanted {
        Some(c) => h.category == c,
        None => true,
    };
    let total = guard.iter().filter(|h| matches(h)).count();
    let offset = offset.min(total);
    let limit = limit.clamp(1, 2000);
    let entries: Vec<scanner::junk::JunkHit> = guard
        .iter()
        .filter(|h| matches(h))
        .skip(offset)
        .take(limit)
        .cloned()
        .collect();
    Ok(JunkPage {
        total,
        offset,
        entries,
    })
}

/// One page of duplicate groups, with each file flagged as the default keeper
/// or not. `keep` selects the heuristic: "oldest" | "newest" | "shortest".
#[tauri::command]
fn get_dupes(
    app: tauri::AppHandle,
    offset: usize,
    limit: usize,
    keep: Option<String>,
) -> Result<DupPage, String> {
    let keep = keep.unwrap_or_else(|| "oldest".to_string());
    let list = app.state::<DupList>();
    let guard = list.0.lock().unwrap();
    let total = guard.len();
    let offset = offset.min(total);
    let end = (offset + limit.clamp(1, 1000)).min(total);
    let mut entries: Vec<DupGroupOut> = Vec::with_capacity(end - offset);
    for (gi, g) in guard.iter().enumerate().skip(offset).take(end - offset) {
        let keeper = scanner::dup::keeper_index(&g.files, &keep);
        entries.push(DupGroupOut {
            id: gi,
            size: g.size,
            name: base_name(&g.files[0].path),
            files: g
                .files
                .iter()
                .enumerate()
                .map(|(i, f)| DupFileOut {
                    path: f.path.clone(),
                    size: f.size,
                    mtime_ms: f.mtime_ms,
                    keep: i == keeper,
                })
                .collect(),
        });
    }
    let files: usize = guard.iter().map(|g| g.files.len()).sum();
    let wasted: u64 = guard
        .iter()
        .map(|g| g.size * (g.files.len() as u64 - 1))
        .sum();
    Ok(DupPage {
        total,
        offset,
        entries,
        groups: total,
        files,
        wasted,
        base_files: files.saturating_sub(total),
        base_bytes: wasted,
    })
}

/// Deletes paths via the shell, one NUL-separated batch per call (SHFileOperation
/// documents a ~32k character limit for pFrom). Returns the number deleted, the
/// per-path failures, and the set of paths that no longer exist.
fn shell_delete(
    paths: Vec<String>,
    permanent: bool,
) -> (usize, Vec<FailedItem>, std::collections::HashSet<String>) {
    use std::collections::HashSet;
    use windows_sys::Win32::UI::Shell::{SHFileOperationW, SHFILEOPSTRUCTW};

    const FO_DELETE: u32 = 3;
    const FOF_NOCONFIRMATION: u16 = 0x0010;
    const FOF_SILENT: u16 = 0x0004;
    const FOF_NOERRORUI: u16 = 0x0400;
    const FOF_ALLOWUNDO: u16 = 0x0040;

    let mut deleted = 0usize;
    let mut failed: Vec<FailedItem> = Vec::new();
    let mut deleted_set: HashSet<String> = HashSet::new();

    let mut chunk: Vec<String> = Vec::new();
    let mut chunk_chars = 0usize;
    let mut chunks: Vec<Vec<String>> = Vec::new();
    for p in paths {
        let p = normalize_path(&p);
        chunk_chars += p.len() + 1;
        chunk.push(p);
        if chunk_chars >= 24_000 || chunk.len() >= 512 {
            chunks.push(std::mem::take(&mut chunk));
            chunk_chars = 0;
        }
    }
    if !chunk.is_empty() {
        chunks.push(chunk);
    }

    for batch in chunks {
        let mut from: Vec<u16> = Vec::with_capacity(batch.iter().map(|p| p.len() + 1).sum());
        for p in &batch {
            from.extend(p.encode_utf16());
            from.push(0);
        }
        from.push(0);

        let mut op: SHFILEOPSTRUCTW = unsafe { std::mem::zeroed() };
        op.wFunc = FO_DELETE;
        op.pFrom = from.as_ptr();
        op.fFlags =
            FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI | if permanent { 0 } else { FOF_ALLOWUNDO };

        let rc = unsafe { SHFileOperationW(&mut op) };
        if rc != 0 || op.fAnyOperationsAborted != 0 {
            let msg = if rc != 0 {
                format!("shell delete failed (code {rc})")
            } else {
                "operation aborted".to_string()
            };
            for p in batch {
                failed.push(FailedItem {
                    path: p,
                    error: msg.clone(),
                });
            }
            continue;
        }
        for p in batch {
            if std::path::Path::new(&p).exists() {
                failed.push(FailedItem {
                    path: p,
                    error: "still present (in use or access denied)".into(),
                });
            } else {
                deleted += 1;
                deleted_set.insert(p);
            }
        }
    }
    (deleted, failed, deleted_set)
}

/// Deletes every currently-selected junk file.
///
/// The selection lives here rather than in the UI: the list can hold tens of
/// thousands of rows and the page only ever renders a window of them, so the
/// client sends its default (`kind`: "safe" | "all" | "none") plus the
/// individual toggles it knows about, and Rust applies both to the full list.
#[tauri::command]
fn purge_selected(
    app: tauri::AppHandle,
    kind: String,
    invert: Vec<InvertItem>,
    permanent: bool,
) -> Result<PurgeResult, String> {
    use std::collections::HashMap;

    let toggles: HashMap<String, bool> = invert.into_iter().map(|i| (i.path, i.on)).collect();

    let selected: Vec<String> = {
        let list = app.state::<JunkList>();
        let guard = list.0.lock().unwrap();
        guard
            .iter()
            .filter(|h| {
                let base = match kind.as_str() {
                    "all" => true,
                    "none" => false,
                    _ => h.category == "safe",
                };
                toggles.get(&h.path).copied().unwrap_or(base)
            })
            .map(|h| h.path.clone())
            .collect()
    };

    let (deleted, failed, deleted_set) = shell_delete(selected, permanent);

    // Drop what actually went away so the totals stay honest even when a few
    // entries were locked by a running process.
    let mut remaining = 0usize;
    let mut safe_files = 0usize;
    let mut safe_bytes = 0u64;
    let mut optional_files = 0usize;
    let mut optional_bytes = 0u64;
    {
        let list = app.state::<JunkList>();
        let mut guard = list.0.lock().unwrap();
        guard.retain(|h| !deleted_set.contains(&h.path));
        remaining = guard.len();
        for h in guard.iter() {
            if h.category == "optional" {
                optional_files += 1;
                optional_bytes += h.size;
            } else {
                safe_files += 1;
                safe_bytes += h.size;
            }
        }
    }

    dbg_log(&format!(
        "purge kind={kind} permanent={permanent} deleted={deleted} remaining={remaining} failed={}",
        failed.len()
    ));
    Ok(PurgeResult {
        deleted,
        remaining,
        safe_files,
        safe_bytes,
        optional_files,
        optional_bytes,
        failed,
    })
}

/// Deletes the selected copies of each duplicate group.
///
/// Base selection: every copy except the group's `keep` candidate. The UI sends
/// the individual toggles it made (`invert`) and they win. A safety net keeps at
/// least one copy per group even if every box was ticked, so a slip cannot wipe
/// the last remaining copy of a file.
#[tauri::command]
fn delete_dupes(
    app: tauri::AppHandle,
    keep: String,
    invert: Vec<InvertItem>,
    permanent: bool,
) -> Result<DupPurgeResult, String> {
    use std::collections::HashMap;

    let toggles: HashMap<String, bool> = invert.into_iter().map(|i| (i.path, i.on)).collect();

    let selected: Vec<String> = {
        let list = app.state::<DupList>();
        let guard = list.0.lock().unwrap();
        let mut out: Vec<String> = Vec::new();
        for g in guard.iter() {
            let keeper = scanner::dup::keeper_index(&g.files, &keep);
            let mut del: Vec<bool> = g
                .files
                .iter()
                .enumerate()
                .map(|(i, f)| toggles.get(&f.path).copied().unwrap_or(i != keeper))
                .collect();
            // never delete every copy in a group
            if del.iter().all(|&d| d) && !del.is_empty() {
                del[keeper] = false;
            }
            for (i, f) in g.files.iter().enumerate() {
                if del[i] {
                    out.push(f.path.clone());
                }
            }
        }
        out
    };

    let (deleted, failed, deleted_set) = shell_delete(selected, permanent);

    let mut remaining_groups = 0usize;
    let mut remaining_files = 0usize;
    let mut wasted = 0u64;
    {
        let list = app.state::<DupList>();
        let mut guard = list.0.lock().unwrap();
        for g in guard.iter_mut() {
            g.files.retain(|f| !deleted_set.contains(&f.path));
        }
        guard.retain(|g| g.files.len() >= 2);
        remaining_groups = guard.len();
        for g in guard.iter() {
            remaining_files += g.files.len();
            wasted += g.size * (g.files.len() as u64 - 1);
        }
    }

    dbg_log(&format!(
        "dup-purge keep={keep} permanent={permanent} deleted={deleted} groups={remaining_groups} failed={}",
        failed.len()
    ));
    Ok(DupPurgeResult {
        deleted,
        remaining_groups,
        remaining_files,
        wasted,
        base_files: remaining_files.saturating_sub(remaining_groups),
        base_bytes: wasted,
        failed,
    })
}

#[tauri::command]
fn scan_cancel(app: tauri::AppHandle) -> Result<(), String> {
    let slot = app.state::<ScanSlot>();
    let g = slot.0.lock().unwrap();
    match g.as_ref() {
        Some(c) => {
            c.cancel();
            Ok(())
        }
        None => Err("no scan is running".into()),
    }
}

fn main() {
    tauri::Builder::default()
        .manage(ScanSlot(Mutex::new(None)))
        .manage(FileList(Mutex::new(Vec::new())))
        .manage(JunkList(Mutex::new(Vec::new())))
        .manage(DupList(Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            list_volumes,
            scan_start,
            clean_start,
            dupes_start,
            scan_cancel,
            get_files,
            get_junk,
            get_dupes,
            remove_entry,
            file_info,
            open_location,
            move_to_trash,
            delete_permanent,
            purge_selected,
            delete_dupes
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
