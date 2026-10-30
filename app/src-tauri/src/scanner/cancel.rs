use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::OnceLock;

#[derive(Clone)]
pub struct CancelToken {
    flag: Arc<AtomicBool>,
}

impl CancelToken {
    pub fn new() -> Self {
        CancelToken {
            flag: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn cancel(&self) {
        self.flag.store(true, Ordering::SeqCst);
    }

    pub fn is_cancelled(&self) -> bool {
        self.flag.load(Ordering::Relaxed)
    }
}

static GLOBAL: OnceLock<CancelToken> = OnceLock::new();

pub fn global() -> &'static CancelToken {
    GLOBAL.get_or_init(CancelToken::new)
}

pub fn install_ctrlc_handler() {
    unsafe {
        windows_sys::Win32::System::Console::SetConsoleCtrlHandler(Some(ctrlc), 1);
    }
}

const CTRL_C_EVENT: u32 = 0;
const CTRL_BREAK_EVENT: u32 = 1;
const CTRL_CLOSE_EVENT: u32 = 2;
const CTRL_SHUTDOWN_EVENT: u32 = 6;

unsafe extern "system" fn ctrlc(ctrl_type: u32) -> i32 {
    match ctrl_type {
        CTRL_C_EVENT | CTRL_BREAK_EVENT | CTRL_CLOSE_EVENT | CTRL_SHUTDOWN_EVENT => {
            global().cancel();
            1
        }
        _ => 0,
    }
}
