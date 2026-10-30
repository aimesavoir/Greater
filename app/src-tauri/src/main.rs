#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod scanner;

use std::path::{Path, PathBuf};
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
/// Folder roll-up of `FileList` for the Explorer "by folder" view, cached as
/// `(generation, folders)` and rebuilt only when `FileGen` moves.
struct FolderList(Mutex<Option<(u64, Vec<FolderEntry>)>>);
/// Bumped whenever `FileList` is replaced or edited; invalidates `FolderList`.
struct FileGen(AtomicU64);
/// Root the last scan started from; the roll-up never aggregates above it.
struct ScanRoot(Mutex<String>);
/// Cancel flag for a running bulk deletion (`true` = stop after the current
/// batch). Reset at the start of every purge; set by `delete_cancel`.
struct DeleteCancel(AtomicBool);

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

/// One aggregated folder: recursive total, file count and sub-folder count.
#[derive(Clone, serde::Serialize)]
struct FolderEntry {
    size: u64,
    path: String,
    files: u64,
    dirs: u64,
}

#[derive(Clone, serde::Serialize)]
struct FoldersPage {
    total: usize,
    offset: usize,
    entries: Vec<FolderEntry>,
}

#[derive(Clone, serde::Serialize)]
struct JunkPage {
    total: usize,
    offset: usize,
    entries: Vec<scanner::junk::JunkHit>,
    /// Whole-list category totals, so the UI can refresh the Clean summary
    /// live while the walk (or a purge) is still changing the list.
    safe_files: usize,
    safe_bytes: u64,
    optional_files: usize,
    optional_bytes: u64,
}

#[derive(Clone, serde::Serialize)]
struct FailedItem {
    path: String,
    error: String,
}

#[derive(Clone, serde::Serialize)]
struct PurgeResult {
    deleted: usize,
    freed: u64,
    cancelled: bool,
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
    freed: u64,
    cancelled: bool,
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
struct TypeBucket {
    name: String,
    bytes: u64,
    files: u64,
}

#[derive(Clone, serde::Serialize)]
struct DriveStats {
    letter: String,
    path: String,
    total: u64,
    free: u64,
    used: u64,
    buckets: Vec<TypeBucket>,
    files: u64,
}

/// Coarse content bucket for a file, keyed off its extension.
fn bucket_for(path: &Path) -> &'static str {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "jpg" | "jpeg" | "png" | "gif" | "webp" | "avif" | "heic" | "heif" | "bmp" | "tiff" | "tif"
        | "ico" | "cur" | "raw" | "psd" | "svg" => "Images",
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "ts" | "vob" | "mpg"
        | "mpeg" => "Videos",
        "mp3" | "flac" | "wav" | "aac" | "m4a" | "ogg" | "opus" | "wma" | "aiff" => "Audio",
        "pdf" | "doc" | "docx" | "txt" | "rtf" | "xls" | "xlsx" | "ppt" | "pptx" | "md" | "csv"
        | "odt" | "ods" | "odp" | "epub" | "log" => "Documents",
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "lz" | "lzma" | "zst" | "iso" => {
            "Archives"
        }
        "exe" | "dll" | "msi" | "sys" | "bat" | "cmd" | "ps1" | "psm1" | "sh" | "com" | "ocx" => {
            "Executables"
        }
        "js" | "ts" | "jsx" | "tsx" | "py" | "rs" | "go" | "java" | "c" | "cpp" | "cc" | "cxx"
        | "h" | "hpp" | "hh" | "json" | "jsonc" | "yml" | "yaml" | "toml" | "xml" | "html" | "htm"
        | "css" | "scss" | "sass" | "less" | "vue" | "svelte" => "Code",
        _ => "Other",
    }
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

#[tauri::command(async)]
fn list_volumes() -> Vec<Volume> {
    volumes()
}

fn volumes() -> Vec<Volume> {
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

#[tauri::command(async)]
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

#[tauri::command(async)]
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

#[tauri::command(async)]
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

#[tauri::command(async)]
fn delete_permanent(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    let md = std::fs::symlink_metadata(&p).map_err(|e| format!("cannot access file: {e}"))?;
    if md.is_dir() {
        return Err("refusing to permanently delete a directory".into());
    }
    std::fs::remove_file(&p).map_err(|e| format!("delete failed: {e}"))
}

#[tauri::command(async)]
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

/// Folder that contains `p` (file or directory), staying at the scan root's
/// own drive root for direct children: `C:\a.txt` -> `C:\`, `C:\d\f` -> `C:\d`.
fn parent_dir<'a>(p: &'a str) -> Option<&'a str> {
    let rel = p.rfind('\\')?;
    if rel == 0 {
        return None;
    }
    let dir = &p[..rel];
    if dir.ends_with(':') {
        // "C:" -> "C:\"; when the input already is "C:\" this yields itself.
        let full = &p[..rel + 1];
        if full.len() == p.len() {
            None
        } else {
            Some(full)
        }
    } else {
        Some(dir)
    }
}

/// Rolls the flat file list up into per-folder totals, never aggregating
/// above `root`. Every key is a slice of a scanned path, so no intermediate
/// `String` is allocated while building the tree.
fn aggregate_folders(files: &[TopEntry], root: &str) -> Vec<FolderEntry> {
    fn canon(s: &str) -> &str {
        s.trim_end_matches('\\')
    }
    let root_c = canon(root);
    use std::collections::HashMap;
    let mut map: HashMap<&str, (u64, u64, u64)> = HashMap::new();

    // pass 1: each file contributes size + one file to its immediate folder
    for e in files {
        if let Some(dir) = parent_dir(&e.path) {
            let en = map.entry(dir).or_insert((0, 0, 0));
            en.0 += e.size;
            en.1 += 1;
        }
    }
    if map.is_empty() {
        return Vec::new();
    }

    // closure: make sure every ancestor up to the root exists as a key
    let mut keys: Vec<&str> = map.keys().copied().collect();
    let mut i = 0;
    while i < keys.len() {
        let k = keys[i];
        i += 1;
        if canon(k) == root_c {
            continue;
        }
        if let Some(p) = parent_dir(k) {
            if !map.contains_key(p) {
                map.insert(p, (0, 0, 0));
                keys.push(p);
            }
        }
    }

    // deepest first, so a folder's total is final before it is rolled up
    keys.sort_by(|a, b| b.matches('\\').count().cmp(&a.matches('\\').count()));
    for k in keys {
        if canon(k) == root_c {
            continue;
        }
        if let Some(p) = parent_dir(k) {
            let c = map[k];
            let en = map.entry(p).or_insert((0, 0, 0));
            en.0 += c.0;
            en.1 += c.1;
            en.2 += c.2 + 1;
        }
    }

    let mut out: Vec<FolderEntry> = map
        .into_iter()
        .map(|(path, (size, files, dirs))| FolderEntry {
            size,
            path: path.to_string(),
            files,
            dirs,
        })
        .collect();
    out.sort_by(|a, b| b.size.cmp(&a.size).then(a.path.cmp(&b.path)));
    out
}

/// Paged folder view over the last Explorer/Statistics scan, aggregated on
/// first use (and after any change to `FileList`).
#[tauri::command(async)]
fn get_folders(
    app: tauri::AppHandle,
    offset: usize,
    limit: usize,
) -> Result<FoldersPage, String> {
    let gen = app.state::<FileGen>().0.load(Ordering::Relaxed);
    let root = app.state::<ScanRoot>().0.lock().unwrap().clone();
    let list = app.state::<FileList>();
    let guard = list.0.lock().unwrap();
    let folders = app.state::<FolderList>();
    let mut cache = folders.0.lock().unwrap();
    if cache.as_ref().map(|(g, _)| *g != gen).unwrap_or(true) {
        *cache = Some((gen, aggregate_folders(&guard, &root)));
    }
    let entries = &cache.as_ref().unwrap().1;
    let total = entries.len();
    let offset = offset.min(total);
    let end = (offset + limit.clamp(1, 2000)).min(total);
    Ok(FoldersPage {
        total,
        offset,
        entries: entries[offset..end].to_vec(),
    })
}

/// File-type breakdown of the most recent scan (`FileList`), bucketed into
/// coarse content categories. `path` labels the analyzed root and selects the
/// drive whose capacity fills `total`/`free`.
#[tauri::command(async)]
fn get_type_stats(app: tauri::AppHandle, path: String) -> DriveStats {
    const ORDER: [&str; 8] = [
        "Images",
        "Videos",
        "Audio",
        "Documents",
        "Archives",
        "Executables",
        "Code",
        "Other",
    ];

    let list = app.state::<FileList>();
    let guard = list.0.lock().unwrap();
    let mut bytes = [0u64; 8];
    let mut files = [0u64; 8];
    for e in guard.iter() {
        let name = bucket_for(Path::new(&e.path));
        let idx = ORDER.iter().position(|&o| o == name).unwrap_or(7);
        bytes[idx] += e.size;
        files[idx] += 1;
    }

    let letter = path
        .chars()
        .next()
        .map(|c| c.to_ascii_uppercase())
        .unwrap_or_default();
    let mut total = 0u64;
    let mut free = 0u64;
    if let Some(v) = volumes()
        .into_iter()
        .find(|v| v.letter.eq_ignore_ascii_case(&letter.to_string()))
    {
        total = v.total;
        free = v.free;
    }

    let buckets = ORDER
        .iter()
        .enumerate()
        .filter(|(i, _)| files[*i] > 0)
        .map(|(i, &name)| TypeBucket {
            name: name.to_string(),
            bytes: bytes[i],
            files: files[i],
        })
        .collect();

    DriveStats {
        letter: letter.to_string(),
        path,
        total,
        free,
        used: total.saturating_sub(free),
        buckets,
        files: guard.len() as u64,
    }
}

#[tauri::command(async)]
fn remove_entry(app: tauri::AppHandle, path: String) -> usize {
    let list = app.state::<FileList>();
    let mut guard = list.0.lock().unwrap();
    let key = normalize_path(&path);
    if let Some(pos) = guard.iter().position(|e| e.path == key) {
        guard.remove(pos);
    }
    if let Some(gen) = app.try_state::<FileGen>() {
        gen.0.fetch_add(1, Ordering::Relaxed);
    }
    guard.len()
}

#[derive(Clone, Copy, PartialEq)]
enum RunKind {
    Scan,
    Stats,
    Clean,
    Dupes,
}

impl RunKind {
    fn id(self) -> &'static str {
        match self {
            RunKind::Scan => "scan",
            RunKind::Stats => "stats",
            RunKind::Clean => "clean",
            RunKind::Dupes => "dupes",
        }
    }
}

/// How many of the largest files are streamed to the Explorer while a walk is
/// still running (see the ticker in `run_walk`).
const PARTIAL_LIMIT: usize = 2000;

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
        RunKind::Scan | RunKind::Stats => app.state::<FileList>().0.lock().unwrap().clear(),
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
        // Live Clean streaming state: how far of the walker's hit list we have
        // already classified, and the junk hits accumulated so far.
        let mut junk_cursor = 0usize;
        let mut junk_live: Vec<scanner::junk::JunkHit> = Vec::new();
        let ticker = std::thread::spawn(move || {
            let t0 = Instant::now();
            let mut last_partial = Instant::now();
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
                // Stream a partial "largest files so far" list to the Explorer
                // while the walk runs, so the table fills in live instead of
                // staying blank until the scan finishes. Bumping FileGen also
                // invalidates the by-folder roll-up cache. Throttled to ~600 ms
                // because selecting the top entries rescans the whole list.
                if matches!(kind, RunKind::Scan | RunKind::Stats)
                    && s.files > 0
                    && last_partial.elapsed() >= Duration::from_millis(600)
                {
                    last_partial = Instant::now();
                    let partial = stats_t.top_entries(PARTIAL_LIMIT);
                    let entries: Vec<TopEntry> = partial
                        .into_iter()
                        .map(|h| TopEntry {
                            size: h.size,
                            path: normalize_path(&h.path.display().to_string()),
                            mtime_ms: h.mtime_ms,
                        })
                        .collect();
                    if let Some(list) = app_t.try_state::<FileList>() {
                        *list.0.lock().unwrap() = entries;
                    }
                    if let Some(gen) = app_t.try_state::<FileGen>() {
                        gen.0.fetch_add(1, Ordering::Relaxed);
                    }
                }
                // Stream junk classification live for the Clean page: classify
                // only the entries appended since the last tick (each file is
                // classified once across the whole walk), then publish the
                // accumulated list so get_junk sees it growing.
                if matches!(kind, RunKind::Clean)
                    && last_partial.elapsed() >= Duration::from_millis(600)
                {
                    last_partial = Instant::now();
                    let (next, new_hits) = stats_t.new_since(junk_cursor);
                    junk_cursor = next;
                    if !new_hits.is_empty() {
                        let now = scanner::junk::now_ms();
                        for h in new_hits {
                            let path = normalize_path(&h.path.display().to_string());
                            if let Some(rule) = scanner::junk::classify(&path, h.mtime_ms, now) {
                                junk_live.push(scanner::junk::JunkHit {
                                    size: h.size,
                                    path,
                                    mtime_ms: h.mtime_ms,
                                    rule: rule.id,
                                    label: rule.label,
                                    category: rule.category_str(),
                                });
                            }
                        }
                        if let Some(list) = app_t.try_state::<JunkList>() {
                            *list.0.lock().unwrap() = junk_live.clone();
                        }
                    }
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
                // On cancel, skip the expensive post-processing (sorting up to
                // 1.4M entries, junk classification, hashing) and report back
                // immediately — otherwise a cancel click can hang for seconds
                // while the worker churns through a finished-but-unsorted list.
                let skip_post = cancelled;
                match if skip_post { Err(stats) } else { Arc::try_unwrap(stats) } {
                    Ok(owned) => {
                        let sorted = owned.into_sorted_files();
                        match kind {
                            RunKind::Scan | RunKind::Stats => {
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
                                if let Some(root) = app.try_state::<ScanRoot>() {
                                    *root.0.lock().unwrap() = normalize_path(&path);
                                }
                                if let Some(gen) = app.try_state::<FileGen>() {
                                    gen.0.fetch_add(1, Ordering::Relaxed);
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
                        // Deliberate skip on cancel: tolerated. Anything else
                        // means the Arc was still shared, which is a real bug.
                        if !skip_post {
                            error = Some("scanner state still referenced".into());
                        }
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

#[tauri::command(async)]
fn scan_start(
    app: tauri::AppHandle,
    path: String,
    mode: String,
    threads: usize,
) -> Result<(), String> {
    run_walk(app, path, mode, threads, 0, RunKind::Scan)
}

#[tauri::command(async)]
fn stats_start(
    app: tauri::AppHandle,
    path: String,
    mode: String,
    threads: usize,
) -> Result<(), String> {
    run_walk(app, path, mode, threads, 0, RunKind::Stats)
}

#[tauri::command(async)]
fn clean_start(
    app: tauri::AppHandle,
    path: String,
    mode: String,
    threads: usize,
) -> Result<(), String> {
    run_walk(app, path, mode, threads, 0, RunKind::Clean)
}

#[tauri::command(async)]
fn dupes_start(
    app: tauri::AppHandle,
    path: String,
    mode: String,
    threads: usize,
    min_size: u64,
) -> Result<(), String> {
    run_walk(app, path, mode, threads, min_size, RunKind::Dupes)
}

#[tauri::command(async)]
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
        safe_files: guard.iter().filter(|h| h.category == "safe").count(),
        safe_bytes: guard.iter().filter(|h| h.category == "safe").map(|h| h.size).sum(),
        optional_files: guard.iter().filter(|h| h.category == "optional").count(),
        optional_bytes: guard
            .iter()
            .filter(|h| h.category == "optional")
            .map(|h| h.size)
            .sum(),
    })
}

/// One page of duplicate groups, with each file flagged as the default keeper
/// or not. `keep` selects the heuristic: "oldest" | "newest" | "shortest".
#[tauri::command(async)]
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

/// Payload for `delete-progress`: how far a bulk purge has gotten.
#[derive(Clone, serde::Serialize)]
struct DeleteProgressEvent {
    kind: &'static str,
    /// Files submitted to the shell so far.
    processed: usize,
    /// Total files being deleted.
    total: usize,
    deleted: usize,
    failed: usize,
    /// Bytes reclaimed so far, so the UI can show live space freed.
    freed: u64,
    /// Paths that were actually removed in this step, so the UI can strike them
    /// off the list live. Kept bounded by the shell batch size.
    removed: Vec<String>,
    /// The most recent path handled, shown as "deleting <name>…".
    last: String,
    /// True when the user cancelled and the purge stopped early.
    cancelled: bool,
}

/// Deletes `(path, size)` pairs. Returns the number deleted, the per-path
/// failures, the set of paths that no longer exist, and the bytes reclaimed.
///
/// `on_batch(removed, last, processed, total, deleted, failed, freed, cancelled)`
/// fires after every batch so the caller can stream a `delete-progress` event
/// carrying the paths that actually went away (the UI strikes them off the list
/// live) and the running byte total; bulk purges of tens of thousands of files
/// would otherwise look frozen for many seconds. `cancel` is polled before each
/// batch, so a purge stops within one batch of the user clicking Cancel.
///
/// Two engines: **permanent** deletes use parallel `DeleteFileW` (the shell's
/// `SHFileOperationW` spends ~20-100 ms per file writing Recycle-Bin metadata,
/// which is unusably slow for tens of thousands); **Recycle-Bin** deletes still
/// use the shell because only it can move files to the bin.
fn shell_delete<F>(
    paths: Vec<(String, u64)>,
    permanent: bool,
    cancel: &std::sync::atomic::AtomicBool,
    mut on_batch: F,
) -> (usize, Vec<FailedItem>, std::collections::HashSet<String>, u64, bool)
where
    F: FnMut(&[String], &str, usize, usize, usize, usize, u64, bool),
{
    use std::collections::HashSet;
    use std::sync::atomic::Ordering;

    let mut deleted = 0usize;
    let mut failed: Vec<FailedItem> = Vec::new();
    let mut deleted_set: HashSet<String> = HashSet::new();
    let mut freed = 0u64;

    // Normalize + pack into batches bounded by both count and pFrom's ~32k
    // character limit (the shell's documented ceiling).
    let mut chunk: Vec<(String, u64)> = Vec::new();
    let mut chunk_chars = 0usize;
    let mut chunks: Vec<Vec<(String, u64)>> = Vec::new();
    for (p, size) in paths {
        let p = normalize_path(&p);
        chunk_chars += p.len() + 1;
        chunk.push((p, size));
        if chunk_chars >= 24_000 || chunk.len() >= 512 {
            chunks.push(std::mem::take(&mut chunk));
            chunk_chars = 0;
        }
    }
    if !chunk.is_empty() {
        chunks.push(chunk);
    }

    let total: usize = chunks.iter().map(|c| c.len()).sum();
    let mut processed = 0usize;
    let mut cancelled = false;

    for batch in chunks {
        if cancel.load(Ordering::Relaxed) {
            cancelled = true;
            on_batch(&[], "", processed, total, deleted, failed.len(), freed, true);
            break;
        }
        let batch_len = batch.len();
        let batch_last = batch.last().map(|(p, _)| p.clone()).unwrap_or_default();

        let mut removed: Vec<String> = Vec::new();
        if permanent {
            // Fast path: DeleteFileW in parallel. Errors are per-file (a locked
            // file just stays), so one failure never aborts the batch.
            parallel_delete(&batch, &mut removed, &mut deleted, &mut freed, &mut failed);
        } else {
            shell_delete_recycle(&batch, &mut removed, &mut deleted, &mut freed, &mut failed);
        }

        deleted_set.extend(removed.iter().cloned());
        processed += batch_len;
        let last = removed.last().cloned().unwrap_or(batch_last);
        on_batch(&removed, &last, processed, total, deleted, failed.len(), freed, false);
    }

    (deleted, failed, deleted_set, freed, cancelled)
}

/// Parallel `DeleteFileW` over one batch, updating the running tallies.
fn parallel_delete(
    batch: &[(String, u64)],
    removed: &mut Vec<String>,
    deleted: &mut usize,
    freed: &mut u64,
    failed: &mut Vec<FailedItem>,
) {
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Mutex;
    use windows_sys::Win32::Storage::FileSystem::DeleteFileW;

    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(8).clamp(1, 16);
    let idx = AtomicUsize::new(0);
    let removed_m: Mutex<Vec<String>> = Mutex::new(Vec::new());
    let failed_m: Mutex<Vec<FailedItem>> = Mutex::new(Vec::new());
    let freed_a = std::sync::atomic::AtomicU64::new(0);
    let deleted_a = AtomicUsize::new(0);

    std::thread::scope(|scope| {
        for _ in 0..threads.min(batch.len().max(1)) {
            scope.spawn(|| loop {
                let i = idx.fetch_add(1, Ordering::Relaxed);
                if i >= batch.len() {
                    break;
                }
                let (p, size) = &batch[i];
                let wide: Vec<u16> = p.encode_utf16().chain(std::iter::once(0)).collect();
                let ok = unsafe { DeleteFileW(wide.as_ptr()) } != 0;
                if ok || !std::path::Path::new(p).exists() {
                    deleted_a.fetch_add(1, Ordering::Relaxed);
                    freed_a.fetch_add(*size, Ordering::Relaxed);
                    removed_m.lock().unwrap().push(p.clone());
                } else {
                    failed_m.lock().unwrap().push(FailedItem {
                        path: p.clone(),
                        error: "still present (in use or access denied)".into(),
                    });
                }
            });
        }
    });

    *deleted += deleted_a.load(Ordering::Relaxed);
    *freed += freed_a.load(Ordering::Relaxed);
    removed.extend(removed_m.into_inner().unwrap());
    failed.extend(failed_m.into_inner().unwrap());
}

/// One `SHFileOperationW` Recycle-Bin batch (the only way to use the bin).
fn shell_delete_recycle(
    batch: &[(String, u64)],
    removed: &mut Vec<String>,
    deleted: &mut usize,
    freed: &mut u64,
    failed: &mut Vec<FailedItem>,
) {
    use windows_sys::Win32::UI::Shell::{SHFileOperationW, SHFILEOPSTRUCTW};

    const FO_DELETE: u32 = 3;
    const FOF_NOCONFIRMATION: u16 = 0x0010;
    const FOF_SILENT: u16 = 0x0004;
    const FOF_NOERRORUI: u16 = 0x0400;
    const FOF_ALLOWUNDO: u16 = 0x0040;

    let mut from: Vec<u16> = Vec::with_capacity(batch.iter().map(|(p, _)| p.len() + 1).sum());
    for (p, _) in batch {
        from.extend(p.encode_utf16());
        from.push(0);
    }
    from.push(0);

    let mut op: SHFILEOPSTRUCTW = unsafe { std::mem::zeroed() };
    op.wFunc = FO_DELETE;
    op.pFrom = from.as_ptr();
    op.fFlags = FOF_NOCONFIRMATION | FOF_SILENT | FOF_NOERRORUI | FOF_ALLOWUNDO;

    let rc = unsafe { SHFileOperationW(&mut op) };
    if rc != 0 || op.fAnyOperationsAborted != 0 {
        let msg = if rc != 0 {
            format!("shell delete failed (code {rc})")
        } else {
            "operation aborted".to_string()
        };
        for (p, _) in batch {
            failed.push(FailedItem {
                path: p.clone(),
                error: msg.clone(),
            });
        }
        return;
    }
    for (p, size) in batch {
        if std::path::Path::new(p).exists() {
            failed.push(FailedItem {
                path: p.clone(),
                error: "still present (in use or access denied)".into(),
            });
        } else {
            *deleted += 1;
            *freed += *size;
            removed.push(p.clone());
        }
    }
}

/// Deletes every currently-selected junk file.
///
/// The selection lives here rather than in the UI: the list can hold tens of
/// thousands of rows and the page only ever renders a window of them, so the
/// client sends its default (`kind`: "safe" | "all" | "none") plus the
/// individual toggles it knows about, and Rust applies both to the full list.
#[tauri::command(async)]
fn purge_selected(
    app: tauri::AppHandle,
    kind: String,
    invert: Vec<InvertItem>,
    permanent: bool,
) -> Result<PurgeResult, String> {
    use std::collections::HashMap;

    let toggles: HashMap<String, bool> = invert.into_iter().map(|i| (i.path, i.on)).collect();

    let selected: Vec<(String, u64)> = {
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
            .map(|h| (h.path.clone(), h.size))
            .collect()
    };

    // Fresh cancel flag for this purge; `delete_cancel` sets it.
    let cancel = app.state::<DeleteCancel>();
    cancel.0.store(false, Ordering::Relaxed);

    let app_p = app.clone();
    let cancel_ref = &cancel.0;
    let (deleted, failed, deleted_set, freed, cancelled) = shell_delete(
        selected,
        permanent,
        cancel_ref,
        move |removed, last, processed, total, deleted, failed, freed, cancelled| {
            // Drop the files that just went away so a mid-purge page fetch sees
            // a shrinking list, then tell the UI what changed.
            if !removed.is_empty() {
                if let Some(list) = app_p.try_state::<JunkList>() {
                    let mut guard = list.0.lock().unwrap();
                    guard.retain(|h| !removed.iter().any(|p| p == &h.path));
                }
            }
            let _ = app_p.emit(
                "delete-progress",
                DeleteProgressEvent {
                    kind: "clean",
                    processed,
                    total,
                    deleted,
                    failed,
                    freed,
                    removed: removed.to_vec(),
                    last: last.to_string(),
                    cancelled,
                },
            );
        },
    );

    // Drop what actually went away so the totals stay honest even when a few
    // entries were locked by a running process.
    let remaining;
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
        freed,
        cancelled,
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
#[tauri::command(async)]
fn delete_dupes(
    app: tauri::AppHandle,
    keep: String,
    invert: Vec<InvertItem>,
    permanent: bool,
) -> Result<DupPurgeResult, String> {
    use std::collections::HashMap;

    let toggles: HashMap<String, bool> = invert.into_iter().map(|i| (i.path, i.on)).collect();

    let selected: Vec<(String, u64)> = {
        let list = app.state::<DupList>();
        let guard = list.0.lock().unwrap();
        let mut out: Vec<(String, u64)> = Vec::new();
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
                    out.push((f.path.clone(), f.size));
                }
            }
        }
        out
    };

    let cancel = app.state::<DeleteCancel>();
    cancel.0.store(false, Ordering::Relaxed);

    let app_d = app.clone();
    let cancel_ref = &cancel.0;
    let (deleted, failed, deleted_set, freed, cancelled) = shell_delete(
        selected,
        permanent,
        cancel_ref,
        move |removed, last, processed, total, deleted, failed, freed, cancelled| {
            // Drop the copies that just went away so the group list shrinks live
            // and any group that falls below two copies disappears.
            if !removed.is_empty() {
                if let Some(list) = app_d.try_state::<DupList>() {
                    let mut guard = list.0.lock().unwrap();
                    for g in guard.iter_mut() {
                        g.files.retain(|f| !removed.iter().any(|p| p == &f.path));
                    }
                }
            }
            let _ = app_d.emit(
                "delete-progress",
                DeleteProgressEvent {
                    kind: "dupes",
                    processed,
                    total,
                    deleted,
                    failed,
                    freed,
                    removed: removed.to_vec(),
                    last: last.to_string(),
                    cancelled,
                },
            );
        },
    );

    let remaining_groups: usize;
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
        freed,
        cancelled,
        remaining_groups,
        remaining_files,
        wasted,
        base_files: remaining_files.saturating_sub(remaining_groups),
        base_bytes: wasted,
        failed,
    })
}

#[tauri::command(async)]
fn scan_cancel(app: tauri::AppHandle) -> Result<(), String> {
    let slot = app.state::<ScanSlot>();
    let g = slot.0.lock().unwrap();
    match g.as_ref() {
        Some(c) => {
            c.cancel();
            Ok(())
        }
        // The walk already finished (the slot is cleared at the very end of the
        // worker) — the UI is just a beat behind. Treat this as a no-op success
        // so a late click never shows a scary "cancel failed" message.
        None => Ok(()),
    }
}

/// Ask a running bulk deletion to stop after the current batch. A no-op when no
/// purge is in flight (the flag is simply left set until the next purge resets
/// it), so a late click never errors.
#[tauri::command(async)]
fn delete_cancel(app: tauri::AppHandle) -> Result<(), String> {
    app.state::<DeleteCancel>().0.store(true, Ordering::Relaxed);
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(ScanSlot(Mutex::new(None)))
        .manage(FileList(Mutex::new(Vec::new())))
        .manage(JunkList(Mutex::new(Vec::new())))
        .manage(DupList(Mutex::new(Vec::new())))
        .manage(FolderList(Mutex::new(None)))
        .manage(FileGen(AtomicU64::new(0)))
        .manage(ScanRoot(Mutex::new(String::new())))
        .manage(DeleteCancel(AtomicBool::new(false)))
        .invoke_handler(tauri::generate_handler![
            list_volumes,
            scan_start,
            stats_start,
            clean_start,
            dupes_start,
            scan_cancel,
            get_files,
            get_folders,
            get_type_stats,
            get_junk,
            get_dupes,
            remove_entry,
            file_info,
            open_location,
            move_to_trash,
            delete_permanent,
            purge_selected,
            delete_dupes,
            delete_cancel
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod folder_tests {
    use super::*;

    fn e(size: u64, path: &str) -> TopEntry {
        TopEntry {
            size,
            path: path.into(),
            mtime_ms: 0,
        }
    }

    fn find<'a>(folders: &'a [FolderEntry], path: &str) -> &'a FolderEntry {
        folders
            .iter()
            .find(|f| f.path == path)
            .unwrap_or_else(|| panic!("missing folder {path}: {:?}", folders.iter().map(|f| &f.path).collect::<Vec<_>>()))
    }

    #[test]
    fn parent_dir_edges() {
        assert_eq!(parent_dir(r"C:\a.txt"), Some(r"C:\"));
        assert_eq!(parent_dir(r"C:\dir\a.txt"), Some(r"C:\dir"));
        assert_eq!(parent_dir(r"C:\"), None);
        assert_eq!(parent_dir(r"C:"), None);
        assert_eq!(parent_dir(r"\a.txt"), None);
        assert_eq!(parent_dir("relative.txt"), None);
    }

    #[test]
    fn rolls_up_recursively_and_stops_at_root() {
        let files = vec![
            e(100, r"C:\root\a\f1.bin"),
            e(50, r"C:\root\a\b\f2.bin"),
            e(7, r"C:\root\top.bin"),
        ];
        let got = aggregate_folders(&files, r"C:\root");
        assert_eq!(got.len(), 3); // root, a, b

        let root = find(&got, r"C:\root");
        assert_eq!((root.size, root.files, root.dirs), (157, 3, 2));
        let a = find(&got, r"C:\root\a");
        assert_eq!((a.size, a.files, a.dirs), (150, 2, 1));
        let b = find(&got, r"C:\root\a\b");
        assert_eq!((b.size, b.files, b.dirs), (50, 1, 0));
        // never aggregates above the scan root
        assert!(got.iter().all(|f| f.path != r"C:\"));
        // largest first
        assert_eq!(got[0].path, r"C:\root");
    }

    #[test]
    fn drive_root_scan_and_trailing_slash() {
        let files = vec![e(1000, r"C:\top.bin"), e(10, r"C:\a\b.bin")];
        for root in [r"C:\", "C:"] {
            let got = aggregate_folders(&files, root);
            let r = find(&got, r"C:\");
            assert_eq!((r.size, r.files, r.dirs), (1010, 2, 1));
            let a = find(&got, r"C:\a");
            assert_eq!((a.size, a.files, a.dirs), (10, 1, 0));
        }

        let files = vec![e(5, r"C:\games\a.bin"), e(6, r"C:\games\pack\b.bin")];
        let got = aggregate_folders(&files, r"C:\games\");
        let r = find(&got, r"C:\games");
        assert_eq!((r.size, r.files, r.dirs), (11, 2, 1));
        assert!(got.iter().all(|f| f.path != r"C:\"));
    }

    #[test]
    fn empty_scan_has_no_folders() {
        assert!(aggregate_folders(&[], r"C:\root").is_empty());
    }
}
