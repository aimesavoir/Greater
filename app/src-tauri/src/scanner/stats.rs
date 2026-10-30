use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

#[derive(Clone)]
pub struct FileHit {
    pub size: u64,
    /// Modification time in ms since the Unix epoch; 0 when unavailable.
    pub mtime_ms: u64,
    pub path: PathBuf,
}

pub struct Stats {
    pub files: AtomicU64,
    pub dirs: AtomicU64,
    pub bytes: AtomicU64,
    pub denied: AtomicU64,
    pub not_found: AtomicU64,
    pub errors: AtomicU64,
    pub reparse_skipped: AtomicU64,
    file_list: Mutex<Vec<FileHit>>,
}

impl Stats {
    pub fn new() -> Self {
        Stats {
            files: AtomicU64::new(0),
            dirs: AtomicU64::new(0),
            bytes: AtomicU64::new(0),
            denied: AtomicU64::new(0),
            not_found: AtomicU64::new(0),
            errors: AtomicU64::new(0),
            reparse_skipped: AtomicU64::new(0),
            file_list: Mutex::new(Vec::with_capacity(1 << 16)),
        }
    }

    pub fn add_dir(&self, _path: &std::path::Path) {
        self.dirs.fetch_add(1, Ordering::Relaxed);
    }

    pub fn add_file(&self, size: u64, mtime_ms: u64, path: &std::path::Path) {
        self.files.fetch_add(1, Ordering::Relaxed);
        self.bytes.fetch_add(size, Ordering::Relaxed);
        self.file_list.lock().unwrap().push(FileHit {
            size,
            mtime_ms,
            path: path.to_path_buf(),
        });
    }

    pub fn record_error(&self, err: &std::io::Error, _path: &std::path::Path) {
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

    /// Entries appended since `start`, plus the list length to use as the next
    /// start. Only the new tail is cloned, so repeated calls cost O(new) not
    /// O(total) — this is what lets the Clean page stream junk hits while the
    /// walk is still running.
    pub fn new_since(&self, start: usize) -> (usize, Vec<FileHit>) {
        let guard = self.file_list.lock().unwrap();
        let len = guard.len();
        (len, guard[start.min(len)..].to_vec())
    }

    pub fn snapshot(&self) -> Snapshot {        Snapshot {
            files: self.files.load(Ordering::Relaxed),
            dirs: self.dirs.load(Ordering::Relaxed),
            bytes: self.bytes.load(Ordering::Relaxed),
            denied: self.denied.load(Ordering::Relaxed),
            not_found: self.not_found.load(Ordering::Relaxed),
            errors: self.errors.load(Ordering::Relaxed),
            reparse_skipped: self.reparse_skipped.load(Ordering::Relaxed),
        }
    }

    pub fn into_sorted_files(self) -> Vec<FileHit> {
        let mut list = self.file_list.into_inner().unwrap();
        list.sort_unstable_by(|a, b| b.size.cmp(&a.size).then_with(|| a.path.cmp(&b.path)));
        list
    }

    /// Clone the largest `limit` files seen so far, largest first. Used to
    /// stream a partial list to the UI while the walk is still running so the
    /// table is not blank until the very end. Cheap relative to re-sorting the
    /// whole list: it keeps a bounded max-heap of `limit` items.
    pub fn top_entries(&self, limit: usize) -> Vec<FileHit> {
        use std::collections::BinaryHeap;
        // Min-heap keyed so the smallest kept item is on top; we keep the
        // largest `limit` entries as we scan. Holds owned copies (limit small),
        // so the lock is released before sorting.
        struct K(u64, u64, PathBuf); // size, mtime, path
        impl PartialEq for K {
            fn eq(&self, o: &Self) -> bool {
                self.0 == o.0
            }
        }
        impl Eq for K {}
        impl Ord for K {
            fn cmp(&self, o: &Self) -> std::cmp::Ordering {
                // Reverse so BinaryHeap (a max-heap) evicts the smallest size.
                o.0.cmp(&self.0)
            }
        }
        impl PartialOrd for K {
            fn partial_cmp(&self, o: &Self) -> Option<std::cmp::Ordering> {
                Some(self.cmp(o))
            }
        }
        let guard = self.file_list.lock().unwrap();
        let mut heap: BinaryHeap<K> = BinaryHeap::with_capacity(limit + 1);
        for h in guard.iter() {
            heap.push(K(h.size, h.mtime_ms, h.path.clone()));
            if heap.len() > limit {
                heap.pop();
            }
        }
        drop(guard);
        let mut v: Vec<FileHit> = heap
            .into_iter()
            .map(|k| FileHit {
                size: k.0,
                mtime_ms: k.1,
                path: k.2,
            })
            .collect();
        v.sort_unstable_by(|a, b| b.size.cmp(&a.size).then_with(|| a.path.cmp(&b.path)));
        v
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
