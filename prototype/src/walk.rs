use std::fs;
use std::os::windows::fs::MetadataExt;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;

use crate::cancel::CancelToken;
use crate::queue;
use crate::stats::Stats;

pub struct ScanResult {
    pub elapsed_ms: u128,
    pub cancelled: bool,
}

fn handle_entry(entry: fs::DirEntry, subdirs: &mut Vec<PathBuf>, stats: &Stats) {
    let md = match entry.metadata() {
        Ok(md) => md,
        Err(e) => {
            stats.record_error(&e, &entry.path());
            return;
        }
    };
    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    const FILE_ATTRIBUTE_DIRECTORY: u32 = 0x10;
    let attrs = md.file_attributes();
    if attrs & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        stats.reparse_skipped.fetch_add(1, Ordering::Relaxed);
        return;
    }
    if attrs & FILE_ATTRIBUTE_DIRECTORY != 0 {
        subdirs.push(entry.path());
        return;
    }
    stats.add_file(md.len(), &entry.path());
}

fn scan_dir_std(dir: &Path, cancel: &CancelToken, stats: &Stats) -> Vec<PathBuf> {
    let rd = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(e) => {
            stats.record_error(&e, dir);
            return Vec::new();
        }
    };
    stats.add_dir(dir);
    let mut subdirs = Vec::new();
    for entry in rd {
        if cancel.is_cancelled() {
            break;
        }
        match entry {
            Ok(e) => handle_entry(e, &mut subdirs, stats),
            Err(e) => stats.record_error(&e, dir),
        }
    }
    subdirs
}

pub fn scan_serial(root: &Path, cancel: &CancelToken, stats: &Stats) -> ScanResult {
    let start = std::time::Instant::now();
    let mut stack = vec![root.to_path_buf()];
    let mut cancelled = false;
    while let Some(dir) = stack.pop() {
        if cancel.is_cancelled() {
            cancelled = true;
            break;
        }
        let subdirs = scan_dir_std(&dir, cancel, stats);
        stack.extend(subdirs);
    }
    ScanResult {
        elapsed_ms: start.elapsed().as_millis(),
        cancelled,
    }
}

pub fn scan_parallel(
    root: &Path,
    threads: usize,
    cancel: &CancelToken,
    stats: &Stats,
) -> ScanResult {
    let start = std::time::Instant::now();
    let root = root.to_path_buf();
    queue::run_parallel(root, threads, cancel, |dir, cancel| {
        scan_dir_std(dir, cancel, stats)
    });
    ScanResult {
        elapsed_ms: start.elapsed().as_millis(),
        cancelled: cancel.is_cancelled(),
    }
}
