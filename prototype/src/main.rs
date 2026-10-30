mod cancel;
mod metrics;
mod mft;
mod queue;
mod stats;
mod walk;
mod win32walk;

use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

use stats::Stats;

fn print_usage() {
    eprintln!(
        "scanbench - scanning architecture benchmark prototype

USAGE:
  scanbench walk <path> [--mode serial|serial-w32|parallel|parallel-w32]
                          [--threads N] [--top N] [--progress]
                          [--cancel-after MS]
  scanbench usn <volume> [--top N] [--progress] [--cancel-after MS]
  scanbench mft-raw <volume> [--top N] [--progress] [--cancel-after MS]
  scanbench rawread <volume> <mib>   volume raw-read throughput micro-benchmark
  scanbench compare <path> [--threads N]
  scanbench help

MODES:
  serial        std::fs::read_dir, single thread (baseline A)
  serial-w32    FindFirstFileExW(FindExInfoBasic, LARGE_FETCH), single thread (A2)
  parallel      std::fs::read_dir, worker pool (A+)
  parallel-w32  FindFirstFileExW, worker pool (recommended default path)
  usn           FSCTL_ENUM_USN_DATA enumeration (elevated, NTFS only, no sizes)
  mft-raw       raw MFT read + parse (elevated, NTFS only, full sizes)
"
    );
}

struct WalkArgs {
    path: PathBuf,
    mode: String,
    threads: usize,
    top: usize,
    progress: bool,
    cancel_after: Option<u64>,
}

fn parse_walk_args(args: &[String]) -> Result<WalkArgs, String> {
    if args.is_empty() {
        return Err("missing path".into());
    }
    let path = PathBuf::from(&args[0]);
    let mut mode = "parallel-w32".to_string();
    let mut threads = metrics::cpu_cores();
    let mut top = 10;
    let mut progress = false;
    let mut cancel_after = None;
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--mode" => {
                i += 1;
                mode = args.get(i).ok_or("--mode needs a value")?.clone();
            }
            "--threads" => {
                i += 1;
                threads = args
                    .get(i)
                    .ok_or("--threads needs a value")?
                    .parse()
                    .map_err(|_| "--threads must be a number")?;
            }
            "--top" => {
                i += 1;
                top = args
                    .get(i)
                    .ok_or("--top needs a value")?
                    .parse()
                    .map_err(|_| "--top must be a number")?;
            }
            "--progress" => progress = true,
            "--cancel-after" => {
                i += 1;
                cancel_after = Some(
                    args.get(i)
                        .ok_or("--cancel-after needs a value")?
                        .parse()
                        .map_err(|_| "--cancel-after must be ms")?,
                );
            }
            other => return Err(format!("unknown flag {other}")),
        }
        i += 1;
    }
    Ok(WalkArgs {
        path,
        mode,
        threads,
        top,
        progress,
        cancel_after,
    })
}

fn spawn_progress(stop: std::sync::Arc<std::sync::atomic::AtomicBool>) -> std::thread::JoinHandle<()> {
    let start = Instant::now();
    std::thread::spawn(move || {
        while !stop.load(Ordering::Relaxed) {
            std::thread::sleep(Duration::from_millis(1000));
            if stop.load(Ordering::Relaxed) {
                break;
            }
            eprintln!("  progress: {:.1}s elapsed", start.elapsed().as_secs_f32());
        }
    })
}

fn run_walk(args: WalkArgs) -> Result<(), String> {
    let cancel = cancel::CancelToken::new();
    cancel::install_ctrlc_handler();

    if let Some(ms) = args.cancel_after {
        let c = cancel.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(ms));
            c.cancel();
        });
    }

    let stats = Stats::new(args.top);
    let before = metrics::sample();

    let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let progress_handle = if args.progress {
        Some(spawn_progress(stop.clone()))
    } else {
        None
    };

    let result = match args.mode.as_str() {
        "serial" => walk::scan_serial(&args.path, &cancel, &stats),
        "parallel" => walk::scan_parallel(&args.path, args.threads, &cancel, &stats),
        "serial-w32" => win32walk::scan_serial_w32(&args.path, &cancel, &stats),
        "parallel-w32" => win32walk::scan_parallel_w32(&args.path, args.threads, &cancel, &stats),
        other => return Err(format!("unknown mode {other}")),
    };

    stop.store(true, Ordering::Relaxed);
    if let Some(h) = progress_handle {
        let _ = h.join();
    }

    let after = metrics::sample();
    report(&args.mode, args.threads, &result, &stats, before, after, args.top);
    Ok(())
}

fn report(
    mode: &str,
    threads: usize,
    result: &walk::ScanResult,
    stats: &Stats,
    before: metrics::ProcessSample,
    after: metrics::ProcessSample,
    top: usize,
) {
    let s = stats.snapshot();
    let elapsed_s = result.elapsed_ms as f64 / 1000.0;
    let throughput = if elapsed_s > 0.0 {
        (s.files + s.dirs) as f64 / elapsed_s
    } else {
        0.0
    };
    let cpu_before = before.user_ns + before.kernel_ns;
    let cpu_after = after.user_ns + after.kernel_ns;
    let cpu_ms = (cpu_after.saturating_sub(cpu_before)) / 1_000_000;
    let cpu_pct = if elapsed_s > 0.0 {
        cpu_ms as f64 / 1000.0 / elapsed_s * 100.0
    } else {
        0.0
    };

    println!("mode               : {mode} (threads={threads})");
    println!(
        "elapsed            : {:.3} s{}",
        elapsed_s,
        if result.cancelled { "  [CANCELLED]" } else { "" }
    );
    println!("files              : {}", s.files);
    println!("directories        : {}", s.dirs);
    println!("bytes (logical)    : {} ({:.2} GiB)", s.bytes, s.bytes as f64 / (1024.0 * 1024.0 * 1024.0));
    println!("throughput         : {throughput:.0} entries/s");
    println!("access denied      : {}", s.denied);
    println!("not found (raced)  : {}", s.not_found);
    println!("other errors       : {}", s.errors);
    println!("reparse skipped    : {}", s.reparse_skipped);
    println!("cpu time           : {cpu_ms} ms ({cpu_pct:.0}% of one core)");
    println!(
        "working set        : {:.1} MiB (peak {:.1} MiB)",
        after.working_set as f64 / 1048576.0,
        after.peak_working_set as f64 / 1048576.0
    );
    let top_files = stats.top(top);
    if !top_files.is_empty() {
        println!("top {top} files:");
        for (size, path) in top_files {
            println!("  {:>12}  {}", human_size(size), path.display());
        }
    }
    let exts = stats.top_ext(5);
    if !exts.is_empty() {
        println!("top extensions by count:");
        for (ext, count) in exts {
            println!("  .{ext:<8} {count}");
        }
    }
}

fn human_size(b: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KiB", "MiB", "GiB", "TiB"];
    let mut v = b as f64;
    let mut i = 0;
    while v >= 1024.0 && i < UNITS.len() - 1 {
        v /= 1024.0;
        i += 1;
    }
    format!("{v:.1} {}", UNITS[i])
}

fn run_compare(args: &[String]) -> Result<(), String> {
    if args.is_empty() {
        return Err("missing path".into());
    }
    let path = PathBuf::from(&args[0]);
    let threads = args
        .iter()
        .position(|a| a == "--threads")
        .and_then(|i| args.get(i + 1))
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or_else(metrics::cpu_cores);

    let modes = ["serial", "serial-w32", "parallel", "parallel-w32"];
    let mut snapshots = Vec::new();
    for mode in modes {
        let cancel = cancel::CancelToken::new();
        let stats = Stats::new(5);
        println!("running {mode} ...");
        let result = match mode {
            "serial" => walk::scan_serial(&path, &cancel, &stats),
            "parallel" => walk::scan_parallel(&path, threads, &cancel, &stats),
            "serial-w32" => win32walk::scan_serial_w32(&path, &cancel, &stats),
            _ => win32walk::scan_parallel_w32(&path, threads, &cancel, &stats),
        };
        let s = stats.snapshot();
        println!(
            "  {:<14} {:>8.3}s  files={} dirs={} bytes={} denied={} errors={}",
            mode,
            result.elapsed_ms as f64 / 1000.0,
            s.files,
            s.dirs,
            s.bytes,
            s.denied,
            s.errors
        );
        snapshots.push((mode.to_string(), result, s));
    }

    println!();
    let base = &snapshots[0];
    let mut ok = true;
    for (mode, _, s) in &snapshots[1..] {
        if base.2.matches(s) {
            println!("{mode} vs {}: MATCH", base.0);
        } else {
            ok = false;
            println!(
                "{mode} vs {}: {}",
                base.0,
                base.2.describe_diff(s)
            );
        }
    }
    if ok {
        println!("validation: all modes produced identical results");
        Ok(())
    } else {
        Err("results differ between modes".into())
    }
}

fn run_usn(args: &[String]) -> Result<(), String> {
    let va = parse_vol_args(args)?;
    let root = va.root;

    let vol = mft::VolumeHandle::open(&root).map_err(|e| {
        format!(
            "cannot open {root}: {e} (os error {}). Direct MFT/USN enumeration \
             requires administrator rights or SeBackupPrivilege; use the walk \
             scanner as fallback.",
            e.raw_os_error().unwrap_or(-1)
        )
    })?;

    let vd = mft::ntfs_volume_data(&vol).map_err(|e| format!("FSCTL_GET_NTFS_VOLUME_DATA failed: {e}"))?;
    println!(
        "volume             : {} (NTFS, {} sectors x {} bytes)",
        root, vd.number_of_sectors, vd.bytes_per_sector
    );
    println!(
        "MFT                : start LCN {}, record size {} bytes, valid data {} bytes",
        vd.mft_start_lcn, vd.bytes_per_file_record_segment, vd.mft_valid_data_length
    );
    println!(
        "clusters           : {} total, {} free ({:.1}% free)",
        vd.total_clusters,
        vd.free_clusters,
        vd.free_clusters as f64 / vd.total_clusters as f64 * 100.0
    );

    let cancel = cancel::CancelToken::new();
    cancel::install_ctrlc_handler();
    if let Some(ms) = va.cancel_after {
        let c = cancel.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(ms));
            c.cancel();
        });
    }

    let stats = Stats::new(va.top);
    let before = metrics::sample();
    let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let progress_handle = if va.progress {
        Some(spawn_progress(stop.clone()))
    } else {
        None
    };

    let res = mft::scan_usn(&vol, &cancel, &stats);

    stop.store(true, Ordering::Relaxed);
    if let Some(h) = progress_handle {
        let _ = h.join();
    }

    let (m, elapsed_ms) = res.map_err(|e| {
        format!(
            "FSCTL_ENUM_USN_DATA failed: {e} (os error {}). Elevation required.",
            e.raw_os_error().unwrap_or(-1)
        )
    })?;
    let after = metrics::sample();
    let elapsed_s = elapsed_ms as f64 / 1000.0;
    println!(
        "elapsed            : {:.3} s{}",
        elapsed_s,
        if cancel.is_cancelled() { "  [CANCELLED]" } else { "" }
    );
    println!("MFT records        : {}", m.records);
    println!("  directories      : {}", m.dirs);
    println!("  files            : {}", m.files);
    println!("throughput         : {:.0} records/s", if elapsed_s > 0.0 { m.records as f64 / elapsed_s } else { 0.0 });
    let cpu_ms = ((after.user_ns + after.kernel_ns).saturating_sub(before.user_ns + before.kernel_ns)) / 1_000_000;
    println!("cpu time           : {cpu_ms} ms");
    println!(
        "working set        : {:.1} MiB (peak {:.1} MiB)",
        after.working_set as f64 / 1048576.0,
        after.peak_working_set as f64 / 1048576.0
    );
    println!("NOTE               : USN records carry no file sizes; sizes require");
    println!("                     FSCTL_GET_NTFS_FILE_RECORD per record or raw MFT parsing.");
    Ok(())
}

struct VolArgs {
    root: String,
    top: usize,
    progress: bool,
    cancel_after: Option<u64>,
}

fn parse_vol_args(args: &[String]) -> Result<VolArgs, String> {
    if args.is_empty() {
        return Err("missing volume".into());
    }
    let vol_letter = args[0].trim_end_matches(['\\', ':']);
    if vol_letter.chars().count() != 1 {
        return Err("volume must look like C: or C".into());
    }
    let root = format!(r"\\.\{}:", vol_letter.to_ascii_uppercase());
    let mut top = 10;
    let mut progress = false;
    let mut cancel_after = None;
    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--top" => {
                i += 1;
                top = args
                    .get(i)
                    .and_then(|v| v.parse().ok())
                    .ok_or("--top needs a number")?;
            }
            "--progress" => progress = true,
            "--cancel-after" => {
                i += 1;
                cancel_after = Some(
                    args.get(i)
                        .and_then(|v| v.parse().ok())
                        .ok_or("--cancel-after needs ms")?,
                );
            }
            other => return Err(format!("unknown flag {other}")),
        }
        i += 1;
    }
    Ok(VolArgs {
        root,
        top,
        progress,
        cancel_after,
    })
}

fn run_mft_raw(args: &[String]) -> Result<(), String> {
    let va = parse_vol_args(args)?;
    let root = va.root.clone();

    let vol = mft::VolumeHandle::open(&root).map_err(|e| {
        format!(
            "cannot open {root}: {e} (os error {}). Raw MFT scanning requires \
             administrator rights; use the walk scanner as fallback.",
            e.raw_os_error().unwrap_or(-1)
        )
    })?;
    let vd =
        mft::ntfs_volume_data(&vol).map_err(|e| format!("FSCTL_GET_NTFS_VOLUME_DATA failed: {e}"))?;
    println!(
        "volume             : {} (NTFS, {} sectors x {} bytes)",
        root, vd.number_of_sectors, vd.bytes_per_sector
    );
    println!(
        "MFT                : start LCN {}, record size {} bytes, valid data {} bytes ({:.2} MiB)",
        vd.mft_start_lcn,
        vd.bytes_per_file_record_segment,
        vd.mft_valid_data_length,
        vd.mft_valid_data_length as f64 / 1048576.0
    );

    let cancel = cancel::CancelToken::new();
    cancel::install_ctrlc_handler();
    if let Some(ms) = va.cancel_after {
        let c = cancel.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(ms));
            c.cancel();
        });
    }

    let stats = Stats::new(va.top);
    let before = metrics::sample();
    let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
    let progress_handle = if va.progress {
        Some(spawn_progress(stop.clone()))
    } else {
        None
    };

    let res = mft::scan_raw_mft(&vol, &vd, &cancel, &stats);

    stop.store(true, Ordering::Relaxed);
    if let Some(h) = progress_handle {
        let _ = h.join();
    }

    let (r, elapsed_ms) = res.map_err(|e| {
        format!(
            "raw MFT scan failed: {e} (os error {}). Elevation required.",
            e.raw_os_error().unwrap_or(-1)
        )
    })?;
    let after = metrics::sample();
    let elapsed_s = elapsed_ms as f64 / 1000.0;
    println!(
        "elapsed            : {:.3} s{}",
        elapsed_s,
        if cancel.is_cancelled() { "  [CANCELLED]" } else { "" }
    );
    println!("in-use files       : {}", r.files);
    println!("in-use directories : {}", r.dirs);
    println!(
        "bytes (logical)    : {} ({:.2} GiB)",
        r.bytes_logical,
        r.bytes_logical as f64 / (1024.0 * 1024.0 * 1024.0)
    );
    println!(
        "bytes (allocated)  : {} ({:.2} GiB)",
        r.bytes_allocated,
        r.bytes_allocated as f64 / (1024.0 * 1024.0 * 1024.0)
    );
    println!(
        "dir index alloc    : {} ({:.2} GiB)",
        r.dir_bytes_allocated,
        r.dir_bytes_allocated as f64 / (1024.0 * 1024.0 * 1024.0)
    );
    println!("deleted records    : {}", r.deleted);
    println!("extension records  : {}", r.extensions);
    println!("FN name entries    : {} (hard-linked names)", r.fn_links);
    println!("reparse skipped    : {}", r.reparse);
    println!("torn records       : {}", r.torn);
    println!("orphans (no name)  : {}", r.orphan);
    println!(
        "MFT read           : {} bytes in {} runs{}",
        r.mft_bytes_read,
        r.run_count,
        if r.used_fallback_contiguous {
            " (fallback contiguous)"
        } else {
            ""
        }
    );
    println!(
        "throughput         : {:.0} records/s",
        if elapsed_s > 0.0 {
            (r.files + r.dirs) as f64 / elapsed_s
        } else {
            0.0
        }
    );
    let cpu_ms =
        ((after.user_ns + after.kernel_ns).saturating_sub(before.user_ns + before.kernel_ns)) / 1_000_000;
    println!("cpu time           : {cpu_ms} ms");
    println!(
        "working set        : {:.1} MiB (peak {:.1} MiB)",
        after.working_set as f64 / 1048576.0,
        after.peak_working_set as f64 / 1048576.0
    );
    let top_files = stats.top(va.top);
    if !top_files.is_empty() {
        println!(
            "top {} files (by name only; full paths need a parent index):",
            va.top
        );
        for (size, path) in top_files {
            println!("  {:>12}  {}", human_size(size), path.display());
        }
    }
    Ok(())
}

fn run_rawread(args: &[String]) -> Result<(), String> {
    if args.len() < 2 {
        return Err("usage: rawread <volume> <mib>".into());
    }
    let va = parse_vol_args(&args[..1])?;
    let mib: u64 = args[1].parse().map_err(|_| "<mib> must be a number")?;
    let vol = mft::VolumeHandle::open(&va.root).map_err(|e| {
        format!(
            "cannot open {}: {e} (os error {})",
            va.root,
            e.raw_os_error().unwrap_or(-1)
        )
    })?;
    let vd = mft::ntfs_volume_data(&vol).map_err(|e| format!("volume data failed: {e}"))?;
    let start = vd.mft_start_lcn.wrapping_mul(vd.bytes_per_cluster as u64);
    let total = mib * 1024 * 1024;
    let chunk = 8 * 1024 * 1024u64;
    let mut buf = vec![0u8; chunk as usize];
    let t0 = Instant::now();
    let mut done = 0u64;
    let mut io = 0u64;
    while done < total {
        let want = chunk.min(total - done) as usize;
        match mft::read_at(&vol, start + done, &mut buf[..want]) {
            Ok(0) => break,
            Ok(g) => {
                done += g as u64;
                io += 1;
            }
            Err(e) => {
                if io == 0 {
                    return Err(format!("first read failed: {e}"));
                }
                break;
            }
        }
    }
    let dt = t0.elapsed().as_secs_f64();
    println!(
        "raw volume read    : {} MiB in {:.3} s ({:.0} MB/s, {} x 8 MiB reads)",
        done / 1024 / 1024,
        dt,
        done as f64 / 1e6 / dt.max(1e-9),
        io
    );
    Ok(())
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let result = match args.first().map(|s| s.as_str()) {
        Some("walk") => parse_walk_args(&args[1..]).and_then(run_walk),
        Some("compare") => run_compare(&args[1..]),
        Some("usn") => run_usn(&args[1..]),
        Some("mft-raw") => run_mft_raw(&args[1..]),
        Some("rawread") => run_rawread(&args[1..]),
        Some("help") | Some("--help") | Some("-h") | None => {
            print_usage();
            return ExitCode::SUCCESS;
        }
        Some(other) => Err(format!("unknown command {other}; try `scanbench help`")),
    };
    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e}");
            ExitCode::FAILURE
        }
    }
}
