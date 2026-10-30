use windows_sys::Win32::Foundation::FILETIME;
use windows_sys::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
use windows_sys::Win32::System::Threading::{GetCurrentProcess, GetProcessTimes};

#[derive(Clone, Copy, Default)]
pub struct ProcessSample {
    pub working_set: u64,
    pub peak_working_set: u64,
    pub user_ns: u128,
    pub kernel_ns: u128,
}

fn filetime_to_ns(ft: FILETIME) -> u128 {
    let raw = ((ft.dwHighDateTime as u64) << 32) | ft.dwLowDateTime as u64;
    raw as u128 * 100
}

pub fn sample() -> ProcessSample {
    let mut counters: PROCESS_MEMORY_COUNTERS = unsafe { std::mem::zeroed() };
    counters.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
    let mut out = ProcessSample::default();
    unsafe {
        if GetProcessMemoryInfo(
            GetCurrentProcess(),
            &mut counters,
            std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32,
        ) != 0
        {
            out.working_set = counters.WorkingSetSize as u64;
            out.peak_working_set = counters.PeakWorkingSetSize as u64;
        }
        let mut creation = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };
        let mut exit = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };
        let mut kernel = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };
        let mut user = FILETIME {
            dwLowDateTime: 0,
            dwHighDateTime: 0,
        };
        if GetProcessTimes(GetCurrentProcess(), &mut creation, &mut exit, &mut kernel, &mut user)
            != 0
        {
            out.user_ns = filetime_to_ns(user);
            out.kernel_ns = filetime_to_ns(kernel);
        }
    }
    out
}

pub fn cpu_cores() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1)
}
