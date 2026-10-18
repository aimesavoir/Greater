//! Duplicate-file finder.
//!
//! Strategy: the walker already gives us every file with its size, so we only
//! ever open files whose size is shared with at least one other file. Those
//! candidates are hashed (a 128-bit pair of independent 64-bit hashes) and
//! grouped. Files that share a size *and* both hashes are duplicates.
//!
//! A few deliberate choices keep this safe rather than merely fast:
//!
//! * Hardlinks are skipped. Two names for the same data are not duplicates and
//!   deleting one frees nothing, so counting them would lie about reclaimable
//!   space. We read the link count from the same handle we hash through.
//! * System/servicing trees (WinSxS, System32, the component store, the Recycle
//!   Bin, ...) are never offered. Their files are hardlinked by design and
//!   removing them can break Windows.
//! * `min_size` filters tiny files, where identical content is expected and
//!   useless to surface (thumbnails, `desktop.ini`, empty stubs).

use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Mutex;

use windows_sys::Win32::Foundation::{CloseHandle, GENERIC_READ, INVALID_HANDLE_VALUE};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, GetFileInformationByHandle, ReadFile, BY_HANDLE_FILE_INFORMATION, FILE_SHARE_DELETE,
    FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
};

use super::cancel::CancelToken;
use super::stats::FileHit;

/// Path fragments (lowercased, backslash-delimited) that are never scanned for
/// duplicates: system-owned, frequently hardlinked, dangerous to remove.
const EXCLUDED: &[&str] = &[
    "\\windows\\winsxs\\",
    "\\windows\\system32\\",
    "\\windows\\syswow64\\",
    "\\windows\\servicing\\",
    "\\windows\\installer\\",
    "\\windows\\assembly\\",
    "\\windows\\microsoft.net\\",
    "\\windows\\winsat\\",
    "\\$recycle.bin\\",
    "\\system volume information\\",
    "\\recovery\\",
    "\\$windows.~",
];

pub fn excluded(path: &str) -> bool {
    let low = path.to_ascii_lowercase();
    EXCLUDED.iter().any(|frag| low.contains(frag))
}

#[derive(Clone)]
pub struct DupFile {
    pub path: String,
    pub size: u64,
    pub mtime_ms: u64,
}

pub struct DupGroup {
    pub size: u64,
    pub files: Vec<DupFile>,
}

pub struct DupPlan {
    pub groups: Vec<DupGroup>,
    pub files: usize,
    pub wasted: u64,
}

struct Hashed {
    size: u64,
    mtime_ms: u64,
    h1: u64,
    h2: u64,
    path: String,
    links: u32,
    ok: bool,
}

/// Opens the file once, reads it through the handle while hashing, and pulls
/// the link count so hardlinks can be dropped. `ok` stays false when the file
/// cannot be opened or read (locked, permission denied, ...).
fn hash_and_id(path: &Path, size: u64, out: &mut Hashed) {
    out.ok = false;
    unsafe {
        let mut wide: Vec<u16> =
            std::os::windows::ffi::OsStrExt::encode_wide(path.as_os_str()).collect();
        wide.push(0);
        let handle = CreateFileW(
            wide.as_ptr(),
            GENERIC_READ,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            std::ptr::null(),
            OPEN_EXISTING,
            0,
            std::ptr::null_mut(),
        );
        if handle == INVALID_HANDLE_VALUE {
            return;
        }
        let mut info: BY_HANDLE_FILE_INFORMATION = std::mem::zeroed();
        if GetFileInformationByHandle(handle, &mut info) == 0 {
            CloseHandle(handle);
            return;
        }
        out.links = info.nNumberOfLinks;

        let mut buf = vec![0u8; 1 << 16];
        let mut h1: u64 = 0xcbf2_9ce4_8422_2325; // FNV-1a 64 offset basis
        let mut h2: u64 = 0x9e37_79b9_7f4a_7c15; // distinct seed
        loop {
            let mut read: u32 = 0;
            let ok = ReadFile(
                handle,
                buf.as_mut_ptr(),
                buf.len() as u32,
                &mut read,
                std::ptr::null_mut(),
            );
            if ok == 0 || read == 0 {
                break;
            }
            for &byte in &buf[..read as usize] {
                h1 ^= byte as u64;
                h1 = h1.wrapping_mul(0x0000_0100_0000_01b3);
                h2 = h2.rotate_left(7) ^ (byte as u64);
                h2 = h2.wrapping_mul(0x0000_0100_0000_01b3);
            }
        }
        CloseHandle(handle);
        let _ = size;
        out.h1 = h1;
        out.h2 = h2;
        out.ok = true;
    }
}

/// Picks which copy of a group to keep by default.
///
/// `keep` is `"oldest"` (default), `"newest"` or `"shortest"` (by path length —
/// handy when the copy you want is the tidier one). Ties break on the
/// lexicographically smallest path so the choice is stable.
pub fn keeper_index(files: &[DupFile], keep: &str) -> usize {
    let n = files.len();
    if n == 0 {
        return 0;
    }
    let shortest = || {
        let mut best = 0usize;
        for i in 1..n {
            if files[i].path.len() < files[best].path.len()
                || (files[i].path.len() == files[best].path.len()
                    && files[i].path < files[best].path)
            {
                best = i;
            }
        }
        best
    };
    match keep {
        "newest" => {
            let mut best = 0usize;
            for i in 1..n {
                let (mi, mb) = (files[i].mtime_ms, files[best].mtime_ms);
                if mi > mb || (mi == mb && files[i].path < files[best].path) {
                    best = i;
                }
            }
            best
        }
        "shortest" => shortest(),
        _ => {
            // oldest, ignoring unknown (0) timestamps
            let mut best: Option<usize> = None;
            for i in 0..n {
                if files[i].mtime_ms == 0 {
                    continue;
                }
                match best {
                    None => best = Some(i),
                    Some(b) => {
                        let (mi, mb) = (files[i].mtime_ms, files[b].mtime_ms);
                        if mi < mb || (mi == mb && files[i].path < files[b].path) {
                            best = Some(i);
                        }
                    }
                }
            }
            best.unwrap_or_else(shortest)
        }
    }
}

/// Groups identical files. `hashed` counts files read so far, for progress.
pub fn find(
    files: &[FileHit],
    min_size: u64,
    threads: usize,
    cancel: &CancelToken,
    hashed: &AtomicU64,
) -> DupPlan {
    let min_size = min_size.max(1);

    // Only files whose size is shared with at least one other file can be
    // duplicates; everything else is skipped without ever being opened.
    let mut by_size: HashMap<u64, Vec<usize>> = HashMap::new();
    for (i, f) in files.iter().enumerate() {
        if f.size < min_size || f.size == 0 {
            continue;
        }
        if excluded(&f.path.to_string_lossy()) {
            continue;
        }
        by_size.entry(f.size).or_default().push(i);
    }
    let mut cands: Vec<usize> = Vec::new();
    for idxs in by_size.values() {
        if idxs.len() >= 2 {
            cands.extend_from_slice(idxs);
        }
    }

    let n = cands.len();
    let results: Mutex<Vec<Hashed>> = Mutex::new(Vec::with_capacity(n));
    let next = AtomicUsize::new(0);
    let workers = threads.clamp(1, 32);
    std::thread::scope(|scope| {
        for _ in 0..workers {
            scope.spawn(|| loop {
                if cancel.is_cancelled() {
                    break;
                }
                let k = next.fetch_add(1, Ordering::Relaxed);
                if k >= n {
                    break;
                }
                let f = &files[cands[k]];
                let mut h = Hashed {
                    size: f.size,
                    mtime_ms: f.mtime_ms,
                    h1: 0,
                    h2: 0,
                    path: f.path.display().to_string(),
                    links: 0,
                    ok: false,
                };
                hash_and_id(&f.path, f.size, &mut h);
                if h.ok {
                    hashed.fetch_add(1, Ordering::Relaxed);
                }
                results.lock().unwrap().push(h);
            });
        }
    });

    let mut map: HashMap<(u64, u64, u64), Vec<Hashed>> = HashMap::new();
    for h in results.into_inner().unwrap() {
        if !h.ok {
            continue;
        }
        if h.links > 1 {
            continue; // hardlink: same data, no space to reclaim
        }
        map.entry((h.size, h.h1, h.h2)).or_default().push(h);
    }

    let mut groups: Vec<DupGroup> = Vec::new();
    let mut files_total = 0usize;
    let mut wasted = 0u64;
    for ((size, _, _), mut hs) in map {
        if hs.len() < 2 {
            continue;
        }
        hs.sort_by(|a, b| a.path.cmp(&b.path));
        files_total += hs.len();
        wasted += size * (hs.len() as u64 - 1);
        groups.push(DupGroup {
            size,
            files: hs
                .into_iter()
                .map(|h| DupFile {
                    path: crate::normalize_path(&h.path),
                    size: h.size,
                    mtime_ms: h.mtime_ms,
                })
                .collect(),
        });
    }

    groups.sort_by(|a, b| {
        let wa = a.size * (a.files.len() as u64 - 1);
        let wb = b.size * (b.files.len() as u64 - 1);
        wb.cmp(&wa).then_with(|| a.files[0].path.cmp(&b.files[0].path))
    });

    DupPlan {
        groups,
        files: files_total,
        wasted,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scanner::cancel::CancelToken;
    use crate::scanner::stats::FileHit;
    use std::sync::atomic::AtomicU64;

    fn write(path: &Path, fill: u8, len: usize) {
        std::fs::write(path, vec![fill; len]).unwrap();
    }

    fn hit(path: std::path::PathBuf, size: u64, mtime_ms: u64) -> FileHit {
        FileHit {
            size,
            mtime_ms,
            path,
        }
    }

    #[test]
    fn detects_identical_pair_and_ignores_decoy() {
        let dir = std::env::temp_dir().join("greater_dup_test");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(dir.join("keep")).unwrap();
        std::fs::create_dir_all(dir.join("copy")).unwrap();
        let n = 2 * 1024 * 1024usize;
        write(&dir.join("keep/photo.bin"), 65, n);
        write(&dir.join("copy/photo.bin"), 65, n);
        write(&dir.join("copy/decoy.bin"), 66, n);
        let hits = vec![
            hit(dir.join("keep/photo.bin"), n as u64, 1_000),
            hit(dir.join("copy/photo.bin"), n as u64, 2_000),
            hit(dir.join("copy/decoy.bin"), n as u64, 3_000),
        ];
        let plan = find(
            &hits,
            1024 * 1024,
            4,
            &CancelToken::new(),
            &AtomicU64::new(0),
        );
        assert_eq!(
            plan.groups.len(),
            1,
            "expected 1 group, got {} groups / {} files / {} wasted",
            plan.groups.len(),
            plan.files,
            plan.wasted
        );
        assert_eq!(plan.groups[0].files.len(), 2);
        assert_eq!(plan.wasted, n as u64);
    }

    #[test]
    fn opens_verbatim_paths_via_subst_drive() {
        let base = std::path::PathBuf::from(r"D:\greater-dup-subst");
        let _ = std::fs::remove_dir_all(&base);
        std::fs::create_dir_all(base.join("keep")).unwrap();
        std::fs::create_dir_all(base.join("copy")).unwrap();
        let n = 2 * 1024 * 1024usize;
        std::fs::write(base.join("keep").join("photo.bin"), vec![65u8; n]).unwrap();
        std::fs::write(base.join("copy").join("photo.bin"), vec![65u8; n]).unwrap();
        let _ = std::process::Command::new("subst")
            .args(["Z:", "/d"])
            .status();
        let _ = std::process::Command::new("subst")
            .args(["Z:", base.to_str().unwrap()])
            .status()
            .unwrap();
        let hits = vec![
            hit(std::path::PathBuf::from(r"\\?\Z:\keep\photo.bin"), n as u64, 1_000),
            hit(std::path::PathBuf::from(r"\\?\Z:\copy\photo.bin"), n as u64, 2_000),
        ];
        let plan = find(
            &hits,
            1024 * 1024,
            4,
            &CancelToken::new(),
            &AtomicU64::new(0),
        );
        let _ = std::process::Command::new("subst")
            .args(["Z:", "/d"])
            .status();
        assert_eq!(
            plan.groups.len(),
            1,
            "subst+verbatim: groups={} files={} wasted={}",
            plan.groups.len(),
            plan.files,
            plan.wasted
        );
    }
}
