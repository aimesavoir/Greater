use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::Ordering;

use windows_sys::Win32::Foundation::{GetLastError, INVALID_HANDLE_VALUE};
use windows_sys::Win32::Storage::FileSystem::{
    FindClose, FindExInfoBasic, FindExSearchNameMatch, FindFirstFileExW, FindNextFileW,
    FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_REPARSE_POINT, WIN32_FIND_DATAW,
};

use crate::cancel::CancelToken;
use crate::queue;
use crate::stats::Stats;
use crate::walk::ScanResult;

const FIND_FIRST_EX_LARGE_FETCH: u32 = 0x2;

pub fn to_extended(path: &Path) -> PathBuf {
    let s = path.to_string_lossy();
    if s.starts_with(r"\\?\") {
        return path.to_path_buf();
    }
    if let Some(rest) = s.strip_prefix(r"\\") {
        return PathBuf::from(format!(r"\\?\UNC\{rest}"));
    }
    PathBuf::from(format!(r"\\?\{s}"))
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn pattern_for(base: &Path) -> Vec<u16> {
    let mut s = base.to_string_lossy().into_owned();
    if s.ends_with('\\') || s.ends_with('/') {
        s.push('*');
    } else {
        s.push_str(r"\*");
    }
    wide(&s)
}

unsafe fn read_dir_w32(dir: &Path, subdirs: &mut Vec<PathBuf>, stats: &Stats) -> io::Result<()> {
    let pattern = pattern_for(dir);
    let mut data = std::mem::zeroed::<WIN32_FIND_DATAW>();
    let handle = FindFirstFileExW(
        pattern.as_ptr(),
        FindExInfoBasic,
        &mut data as *mut _ as *mut _,
        FindExSearchNameMatch,
        std::ptr::null(),
        FIND_FIRST_EX_LARGE_FETCH,
    );
    if handle == INVALID_HANDLE_VALUE {
        let e = io::Error::last_os_error();
        return Err(e);
    }
    loop {
        let name_len = data
            .cFileName
            .iter()
            .position(|&c| c == 0)
            .unwrap_or(data.cFileName.len());
        let name = String::from_utf16_lossy(&data.cFileName[..name_len]);
        if name != "." && name != ".." {
            let attrs = data.dwFileAttributes;
            if attrs & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
                stats.reparse_skipped.fetch_add(1, Ordering::Relaxed);
            } else if attrs & FILE_ATTRIBUTE_DIRECTORY != 0 {
                let mut p = dir.to_path_buf();
                p.push(&name);
                subdirs.push(p);
            } else {
                let size = ((data.nFileSizeHigh as u64) << 32) | data.nFileSizeLow as u64;
                let mut p = dir.to_path_buf();
                p.push(&name);
                stats.add_file(size, &p);
            }
        }
        if FindNextFileW(handle, &mut data) == 0 {
            let err = GetLastError();
            if err == 18 {
                break;
            }
            break;
        }
    }
    FindClose(handle);
    Ok(())
}

fn record_dir_error(e: &io::Error, dir: &Path, stats: &Stats) {
    stats.record_error(e, dir);
}

pub fn scan_serial_w32(root: &Path, cancel: &CancelToken, stats: &Stats) -> ScanResult {
    let start = std::time::Instant::now();
    let root = to_extended(root);
    let mut stack = vec![root];
    let mut cancelled = false;
    while let Some(dir) = stack.pop() {
        if cancel.is_cancelled() {
            cancelled = true;
            break;
        }
        let mut subdirs = Vec::new();
        match unsafe { read_dir_w32(&dir, &mut subdirs, stats) } {
            Ok(()) => {
                stats.add_dir(&dir);
                stack.extend(subdirs);
            }
            Err(e) => record_dir_error(&e, &dir, stats),
        }
    }
    ScanResult {
        elapsed_ms: start.elapsed().as_millis(),
        cancelled,
    }
}

pub fn scan_parallel_w32(
    root: &Path,
    threads: usize,
    cancel: &CancelToken,
    stats: &Stats,
) -> ScanResult {
    let start = std::time::Instant::now();
    let root = to_extended(root);
    queue::run_parallel(root, threads, cancel, |dir, cancel| {
        if cancel.is_cancelled() {
            return Vec::new();
        }
        let mut subdirs = Vec::new();
        match unsafe { read_dir_w32(dir, &mut subdirs, stats) } {
            Ok(()) => {
                stats.add_dir(dir);
                subdirs
            }
            Err(e) => {
                record_dir_error(&e, dir, stats);
                Vec::new()
            }
        }
    });
    ScanResult {
        elapsed_ms: start.elapsed().as_millis(),
        cancelled: cancel.is_cancelled(),
    }
}
