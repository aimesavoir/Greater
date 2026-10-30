use std::path::PathBuf;
use std::sync::{Arc, Condvar, Mutex};

use crate::cancel::CancelToken;

pub struct Queue {
    state: Mutex<QueueState>,
    not_empty: Condvar,
}

struct QueueState {
    dirs: Vec<PathBuf>,
    active: usize,
    done: bool,
}

impl Queue {
    pub fn new() -> Self {
        Queue {
            state: Mutex::new(QueueState {
                dirs: Vec::new(),
                active: 0,
                done: false,
            }),
            not_empty: Condvar::new(),
        }
    }

    pub fn push(&self, batch: Vec<PathBuf>) {
        let mut st = self.state.lock().unwrap();
        st.dirs.extend(batch);
        drop(st);
        self.not_empty.notify_all();
    }

    pub fn pop(&self, cancel: &CancelToken) -> Option<PathBuf> {
        let mut st = self.state.lock().unwrap();
        loop {
            if st.done || cancel.is_cancelled() {
                return None;
            }
            if let Some(d) = st.dirs.pop() {
                st.active += 1;
                return Some(d);
            }
            if st.active == 0 {
                st.done = true;
                self.not_empty.notify_all();
                return None;
            }
            st = self.not_empty.wait(st).unwrap();
        }
    }

    pub fn task_done(&self) {
        let mut st = self.state.lock().unwrap();
        st.active -= 1;
        if st.active == 0 && st.dirs.is_empty() {
            st.done = true;
            self.not_empty.notify_all();
        }
    }

    pub fn finish(&self) {
        let mut st = self.state.lock().unwrap();
        st.done = true;
        st.dirs.clear();
        drop(st);
        self.not_empty.notify_all();
    }
}

impl Default for Queue {
    fn default() -> Self {
        Queue::new()
    }
}

pub fn run_parallel<F>(root: PathBuf, threads: usize, cancel: &CancelToken, scan_dir: F)
where
    F: Fn(&std::path::Path, &CancelToken) -> Vec<PathBuf> + Sync,
{
    let queue = Arc::new(Queue::new());
    queue.push(vec![root]);
    std::thread::scope(|scope| {
        for _ in 0..threads.max(1) {
            let queue = &queue;
            let cancel = cancel;
            let scan_dir = &scan_dir;
            scope.spawn(move || loop {
                let Some(dir) = queue.pop(cancel) else { break };
                let subdirs = scan_dir(&dir, cancel);
                if !subdirs.is_empty() {
                    queue.push(subdirs);
                }
                queue.task_done();
            });
        }
    });
    queue.finish();
}
