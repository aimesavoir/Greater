use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

pub struct Stats {
    pub files: AtomicU64,
    pub dirs: AtomicU64,
    pub bytes: AtomicU64,
    pub denied: AtomicU64,
    pub not_found: AtomicU64,
    pub errors: AtomicU64,
    pub reparse_skipped: AtomicU64,
    pub ext_count: Mutex<HashMap<&'static str, u64>>,
    top: Mutex<Vec<(u64, PathBuf)>>,
    top_cap: usize,
}

impl Stats {
    pub fn new(top_cap: usize) -> Self {
        Stats {
            files: AtomicU64::new(0),
            dirs: AtomicU64::new(0),
            bytes: AtomicU64::new(0),
            denied: AtomicU64::new(0),
            not_found: AtomicU64::new(0),
            errors: AtomicU64::new(0),
            reparse_skipped: AtomicU64::new(0),
            ext_count: Mutex::new(HashMap::new()),
            top: Mutex::new(Vec::new()),
            top_cap,
        }
    }

    pub fn add_dir(&self, _path: &Path) {
        self.dirs.fetch_add(1, Ordering::Relaxed);
    }

    pub fn add_file(&self, size: u64, path: &Path) {
        self.files.fetch_add(1, Ordering::Relaxed);
        self.bytes.fetch_add(size, Ordering::Relaxed);
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            let ext = intern_ext(ext);
            let mut map = self.ext_count.lock().unwrap();
            *map.entry(ext).or_insert(0) += 1;
        } else {
            let mut map = self.ext_count.lock().unwrap();
            *map.entry("").or_insert(0) += 1;
        }
        let mut top = self.top.lock().unwrap();
        let floor = top.last().map(|t| t.0).unwrap_or(0);
        if top.len() < self.top_cap || size > floor {
            top.push((size, path.to_path_buf()));
            top.sort_unstable_by(|a, b| b.0.cmp(&a.0));
            top.truncate(self.top_cap);
        }
    }

    pub fn record_error(&self, err: &std::io::Error, _path: &Path) {
        match err.kind() {
            std::io::ErrorKind::PermissionDenied => {
                self.denied.fetch_add(1, Ordering::Relaxed);
            }
            std::io::ErrorKind::NotFound => {
                self.not_found.fetch_add(1, Ordering::Relaxed);
            }
            _ => {
                self.errors.fetch_add(1, Ordering::Relaxed);
            }
        }
    }

    pub fn top(&self, n: usize) -> Vec<(u64, PathBuf)> {
        self.top.lock().unwrap().iter().take(n).cloned().collect()
    }

    pub fn top_ext(&self, n: usize) -> Vec<(&'static str, u64)> {
        let map = self.ext_count.lock().unwrap();
        let mut v: Vec<(&'static str, u64)> = map.iter().map(|(k, v)| (*k, *v)).collect();
        v.sort_unstable_by(|a, b| b.1.cmp(&a.1));
        v.truncate(n);
        v
    }

    pub fn snapshot(&self) -> Snapshot {
        Snapshot {
            files: self.files.load(Ordering::Relaxed),
            dirs: self.dirs.load(Ordering::Relaxed),
            bytes: self.bytes.load(Ordering::Relaxed),
            denied: self.denied.load(Ordering::Relaxed),
            not_found: self.not_found.load(Ordering::Relaxed),
            errors: self.errors.load(Ordering::Relaxed),
            reparse_skipped: self.reparse_skipped.load(Ordering::Relaxed),
        }
    }
}

fn intern_ext(ext: &str) -> &'static str {
    match ext.to_ascii_lowercase().as_str() {
        "exe" => "exe",
        "dll" => "dll",
        "sys" => "sys",
        "pdb" => "pdb",
        "log" => "log",
        "txt" => "txt",
        "dat" => "dat",
        "tmp" => "tmp",
        "js" => "js",
        "json" => "json",
        "html" => "html",
        "css" => "css",
        "png" => "png",
        "jpg" => "jpg",
        "jpeg" => "jpeg",
        "gif" => "gif",
        "svg" => "svg",
        "ico" => "ico",
        "zip" => "zip",
        "7z" => "7z",
        "rar" => "rar",
        "cab" => "cab",
        "msi" => "msi",
        "iso" => "iso",
        "mp3" => "mp3",
        "mp4" => "mp4",
        "mkv" => "mkv",
        "avi" => "avi",
        "pdf" => "pdf",
        "doc" => "doc",
        "docx" => "docx",
        "xls" => "xls",
        "xlsx" => "xlsx",
        "ppt" => "ppt",
        "pptx" => "pptx",
        "rs" => "rs",
        "toml" => "toml",
        "md" => "md",
        "py" => "py",
        "cs" => "cs",
        "cpp" => "cpp",
        "h" => "h",
        "c" => "c",
        "obj" => "obj",
        "lib" => "lib",
        "zipx" => "zipx",
        "gz" => "gz",
        "tar" => "tar",
        "bak" => "bak",
        "cache" => "cache",
        "log1" => "log",
        "etl" => "etl",
        "bin" => "bin",
        "dat1" => "dat",
        _ => "other",
    }
}

#[derive(Clone, Copy)]
pub struct Snapshot {
    pub files: u64,
    pub dirs: u64,
    pub bytes: u64,
    pub denied: u64,
    pub not_found: u64,
    pub errors: u64,
    pub reparse_skipped: u64,
}

impl Snapshot {
    pub fn matches(&self, other: &Snapshot) -> bool {
        self.files == other.files && self.dirs == other.dirs && self.bytes == other.bytes
    }

    fn verdict(ok: bool) -> &'static str {
        if ok {
            "match"
        } else {
            "DIFF"
        }
    }

    pub fn describe_diff(&self, other: &Snapshot) -> String {
        format!(
            "files {} ({} vs {}), dirs {} ({} vs {}), bytes {} ({} vs {})",
            Snapshot::verdict(self.files == other.files),
            self.files,
            other.files,
            Snapshot::verdict(self.dirs == other.dirs),
            self.dirs,
            other.dirs,
            Snapshot::verdict(self.bytes == other.bytes),
            self.bytes,
            other.bytes
        )
    }
}
