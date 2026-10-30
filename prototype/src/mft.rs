use std::collections::HashSet;
use std::io;
use std::sync::atomic::Ordering;

use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, ReadFile, SetFilePointerEx, FILE_BEGIN, FILE_SHARE_DELETE, FILE_SHARE_READ,
    FILE_SHARE_WRITE, OPEN_EXISTING,
};
use windows_sys::Win32::System::IO::DeviceIoControl;

use crate::cancel::CancelToken;
use crate::stats::Stats;

pub const FSCTL_ENUM_USN_DATA: u32 = windows_sys::Win32::System::Ioctl::FSCTL_ENUM_USN_DATA;
pub const FSCTL_GET_NTFS_VOLUME_DATA: u32 =
    windows_sys::Win32::System::Ioctl::FSCTL_GET_NTFS_VOLUME_DATA;
pub const FSCTL_GET_NTFS_FILE_RECORD: u32 =
    windows_sys::Win32::System::Ioctl::FSCTL_GET_NTFS_FILE_RECORD;

pub const GENERIC_READ: u32 = 0x8000_0000;

#[repr(C)]
#[derive(Clone, Copy)]
pub struct MftEnumData {
    pub start_frn: u64,
    pub low_usn: u64,
    pub high_usn: u64,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct NtfsVolumeData {
    pub volume_serial_number: u64,
    pub number_of_sectors: u64,
    pub total_clusters: u64,
    pub free_clusters: u64,
    pub total_reserved: u64,
    pub bytes_per_sector: u32,
    pub bytes_per_cluster: u32,
    pub bytes_per_file_record_segment: u32,
    pub clusters_per_file_record_segment: u32,
    pub mft_valid_data_length: u64,
    pub mft_start_lcn: u64,
    pub mft2_start_lcn: u64,
    pub mft_zone_start: u64,
    pub mft_zone_end: u64,
}

#[repr(C)]
#[derive(Clone, Copy)]
pub struct UsnRecordV2 {
    pub record_length: u32,
    pub major_version: u16,
    pub minor_version: u16,
    pub file_reference_number: u64,
    pub parent_file_reference_number: u64,
    pub usn: i64,
    pub time_stamp: i64,
    pub reason: u32,
    pub source_info: u32,
    pub security_id: u32,
    pub file_attributes: u32,
    pub file_name_length: u16,
    pub file_name_offset: u16,
}

pub const FILE_ATTRIBUTE_DIRECTORY: u32 = 0x10;

pub struct VolumeHandle {
    handle: *mut core::ffi::c_void,
}

impl VolumeHandle {
    pub fn open(volume_device: &str) -> io::Result<Self> {
        let wide: Vec<u16> = volume_device.encode_utf16().chain(std::iter::once(0)).collect();
        let handle = unsafe {
            CreateFileW(
                wide.as_ptr(),
                GENERIC_READ,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                std::ptr::null(),
                OPEN_EXISTING,
                0,
                std::ptr::null_mut(),
            )
        };
        if handle == INVALID_HANDLE_VALUE {
            return Err(io::Error::last_os_error());
        }
        Ok(VolumeHandle { handle })
    }

    pub fn fsctl(&self, code: u32, input: &[u8], output: &mut [u8]) -> io::Result<usize> {
        let mut returned: u32 = 0;
        let ok = unsafe {
            DeviceIoControl(
                self.handle,
                code,
                input.as_ptr() as *const _,
                input.len() as u32,
                output.as_mut_ptr() as *mut _,
                output.len() as u32,
                &mut returned,
                std::ptr::null_mut(),
            )
        };
        if ok == 0 {
            return Err(io::Error::last_os_error());
        }
        Ok(returned as usize)
    }
}

impl Drop for VolumeHandle {
    fn drop(&mut self) {
        unsafe {
            CloseHandle(self.handle);
        }
    }
}

pub fn ntfs_volume_data(vol: &VolumeHandle) -> io::Result<NtfsVolumeData> {
    let mut out = vec![0u8; 4096];
    let n = vol.fsctl(FSCTL_GET_NTFS_VOLUME_DATA, &[], &mut out)?;
    if n < std::mem::size_of::<NtfsVolumeData>() {
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            format!("NTFS_VOLUME_DATA_BUFFER truncated: {n} bytes"),
        ));
    }
    Ok(unsafe { std::ptr::read_unaligned(out.as_ptr() as *const NtfsVolumeData) })
}

pub struct MftStats {
    pub records: u64,
    pub dirs: u64,
    pub files: u64,
    pub errors: u64,
}

pub fn scan_usn(vol: &VolumeHandle, cancel: &CancelToken, stats: &Stats) -> io::Result<(MftStats, u128)> {
    let start = std::time::Instant::now();
    let mut result = MftStats {
        records: 0,
        dirs: 0,
        files: 0,
        errors: 0,
    };
    let mut input = MftEnumData {
        start_frn: 0,
        low_usn: 0,
        high_usn: i64::MAX as u64,
    };
    let mut buf = vec![0u8; 1024 * 1024];
    let mut seen: HashSet<u64> = HashSet::new();
    loop {
        if cancel.is_cancelled() {
            break;
        }
        let input_bytes = unsafe {
            std::slice::from_raw_parts(
                &input as *const MftEnumData as *const u8,
                std::mem::size_of::<MftEnumData>(),
            )
        };
        let n = match vol.fsctl(FSCTL_ENUM_USN_DATA, input_bytes, &mut buf) {
            Ok(n) => n,
            Err(e) if e.raw_os_error() == Some(38) => break,
            Err(e) if e.raw_os_error() == Some(1) => {
                result.errors += 1;
                break;
            }
            Err(e) => return Err(e),
        };
        if n < 8 {
            break;
        }
        let mut next_start = 0u64;
        unsafe {
            std::ptr::copy_nonoverlapping(buf.as_ptr(), &mut next_start as *mut u64 as *mut u8, 8);
        }
        let mut offset = 8usize;
        while offset + std::mem::size_of::<UsnRecordV2>() <= n {
            let rec = unsafe { &*(buf.as_ptr().add(offset) as *const UsnRecordV2) };
            if rec.record_length == 0
                || rec.record_length as usize + offset > n
                || rec.record_length < std::mem::size_of::<UsnRecordV2>() as u32
            {
                break;
            }
            if rec.major_version == 2 && seen.insert(rec.file_reference_number) {
                result.records += 1;
                if rec.file_attributes & FILE_ATTRIBUTE_DIRECTORY != 0 {
                    result.dirs += 1;
                    stats.dirs.fetch_add(1, Ordering::Relaxed);
                } else {
                    result.files += 1;
                    stats.files.fetch_add(1, Ordering::Relaxed);
                }
            }
            offset += rec.record_length as usize;
        }
        if next_start == 0 || next_start <= input.start_frn {
            break;
        }
        input.start_frn = next_start;
    }
    Ok((result, start.elapsed().as_millis()))
}

pub struct RawMftStats {
    pub files: u64,
    pub dirs: u64,
    pub deleted: u64,
    pub extensions: u64,
    pub torn: u64,
    pub reparse: u64,
    pub fn_links: u64,
    pub orphan: u64,
    pub bytes_logical: u64,
    pub bytes_allocated: u64,
    pub dir_bytes_allocated: u64,
    pub run_count: u64,
    pub sparse_runs: u64,
    pub mft_bytes_read: u64,
    pub used_fallback_contiguous: bool,
}

pub fn scan_raw_mft(
    vol: &VolumeHandle,
    vd: &NtfsVolumeData,
    cancel: &CancelToken,
    stats: &Stats,
) -> io::Result<(RawMftStats, u128)> {
    use std::sync::atomic::Ordering;
    let start = std::time::Instant::now();
    let mut r = RawMftStats {
        files: 0,
        dirs: 0,
        deleted: 0,
        extensions: 0,
        torn: 0,
        reparse: 0,
        fn_links: 0,
        orphan: 0,
        bytes_logical: 0,
        bytes_allocated: 0,
        dir_bytes_allocated: 0,
        run_count: 0,
        sparse_runs: 0,
        mft_bytes_read: 0,
        used_fallback_contiguous: false,
    };

    let mut record_size = vd.bytes_per_file_record_segment as usize;
    if record_size < 64 || record_size > 64 * 1024 {
        record_size = 1024;
    }
    let cluster = vd.bytes_per_cluster.max(512) as usize;
    let mut chunk = record_size.max(cluster).max(4 * 1024 * 1024);
    while chunk % record_size != 0 || chunk % cluster != 0 {
        chunk += record_size.max(cluster);
    }
    let valid_len = vd.mft_valid_data_length;
    let mft_phys = vd.mft_start_lcn.wrapping_mul(vd.bytes_per_cluster as u64);

    let mut rec0 = vec![0u8; record_size];
    let n0 = read_at(vol, mft_phys, &mut rec0)?;
    if n0 < record_size {
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            format!("cannot read MFT record 0 ({n0} bytes)"),
        ));
    }
    if !apply_fixup(&mut rec0) {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "MFT record 0 failed fixup validation",
        ));
    }
    let used0 = (u32le(&rec0, 24) as usize).min(rec0.len());
    let mut runs = extract_data_runs(&rec0, used0);
    let attrlist_targets = collect_attrlist_data_targets(&rec0, used0);

    if !attrlist_targets.is_empty() {
        let cluster_u = cluster as u64;
        let mut fetched: std::collections::HashSet<u64> = std::collections::HashSet::new();
        let mut ext_rec = vec![0u8; record_size];
        for frn in attrlist_targets {
            if frn == 0 || !fetched.insert(frn) {
                continue;
            }
            let logical = frn * record_size as u64;
            if logical + record_size as u64 > valid_len {
                continue;
            }
            match read_mft_logical(vol, &runs, cluster_u, logical, &mut ext_rec) {
                Ok(g) if g >= record_size => {}
                _ => {
                    stats.errors.fetch_add(1, Ordering::Relaxed);
                    continue;
                }
            }
            if !apply_fixup(&mut ext_rec) {
                r.torn += 1;
                continue;
            }
            let used = (u32le(&ext_rec, 24) as usize).min(ext_rec.len());
            runs.extend(extract_data_runs(&ext_rec, used));
        }
    }

    if runs.is_empty() {
        r.used_fallback_contiguous = true;
        runs.push((0, vd.mft_start_lcn, valid_len.div_ceil(cluster as u64).max(1)));
    }
    runs.sort_by_key(|x| x.0);
    r.run_count = runs.len() as u64;

    let cluster_u = cluster as u64;
    let mut buf = vec![0u8; chunk];
    'outer: for (vcn, run_lcn, run_clusters) in runs {
        if cancel.is_cancelled() {
            break;
        }
        let logical_start = vcn.saturating_mul(cluster_u);
        if logical_start >= valid_len {
            break;
        }
        let mut run_bytes = run_clusters.saturating_mul(cluster_u);
        if logical_start + run_bytes > valid_len {
            run_bytes = valid_len - logical_start;
        }
        if run_lcn == u64::MAX {
            r.sparse_runs += 1;
            continue;
        }
        let mut off = 0u64;
        while off < run_bytes {
            if cancel.is_cancelled() {
                break 'outer;
            }
            let want = (run_bytes - off).min(chunk as u64) as usize;
            if want < record_size {
                break;
            }
            let phys = run_lcn.wrapping_mul(cluster_u).wrapping_add(off);
            let got = match read_at(vol, phys, &mut buf[..want]) {
                Ok(g) => g,
                Err(_) => {
                    stats.errors.fetch_add(1, Ordering::Relaxed);
                    break;
                }
            };
            if got < record_size {
                break;
            }
            let full = got - (got % record_size);
            for rec in buf[..full].chunks_exact_mut(record_size) {
                if !apply_fixup(rec) {
                    r.torn += 1;
                    continue;
                }
                parse_fixed_record(rec, &mut r, stats);
            }
            r.mft_bytes_read += full as u64;
            off += full as u64;
            if got < want {
                break;
            }
        }
    }
    Ok((r, start.elapsed().as_millis()))
}

fn read_mft_logical(
    vol: &VolumeHandle,
    runs: &[(u64, u64, u64)],
    cluster: u64,
    logical: u64,
    buf: &mut [u8],
) -> io::Result<usize> {
    let vcn = logical / cluster;
    let within = logical % cluster;
    for (rvcn, lcn, clusters) in runs {
        if *lcn == u64::MAX {
            continue;
        }
        if vcn >= *rvcn && vcn < rvcn + clusters {
            let phys = lcn
                .wrapping_mul(cluster)
                .wrapping_add((vcn - rvcn).wrapping_mul(cluster))
                .wrapping_add(within);
            return read_at(vol, phys, buf);
        }
    }
    Err(io::Error::new(
        io::ErrorKind::NotFound,
        "MFT logical offset not covered by known runs",
    ))
}

pub fn read_at(vol: &VolumeHandle, offset: u64, buf: &mut [u8]) -> io::Result<usize> {
    unsafe {
        if SetFilePointerEx(vol.handle, offset as i64, std::ptr::null_mut(), FILE_BEGIN) == 0 {
            return Err(io::Error::last_os_error());
        }
    }
    let mut read: u32 = 0;
    unsafe {
        if ReadFile(
            vol.handle,
            buf.as_mut_ptr(),
            buf.len() as u32,
            &mut read,
            std::ptr::null_mut(),
        ) == 0
        {
            return Err(io::Error::last_os_error());
        }
    }
    Ok(read as usize)
}

fn u16le(b: &[u8], off: usize) -> u16 {
    u16::from_le_bytes([b[off], b[off + 1]])
}

fn u32le(b: &[u8], off: usize) -> u32 {
    u32::from_le_bytes([b[off], b[off + 1], b[off + 2], b[off + 3]])
}

fn u64le(b: &[u8], off: usize) -> u64 {
    u64::from_le_bytes([
        b[off],
        b[off + 1],
        b[off + 2],
        b[off + 3],
        b[off + 4],
        b[off + 5],
        b[off + 6],
        b[off + 7],
    ])
}

fn apply_fixup(b: &mut [u8]) -> bool {
    if b.len() < 48 || &b[0..4] != b"FILE" {
        return false;
    }
    let usa_off = u16le(b, 4) as usize;
    let usa_cnt = u16le(b, 6) as usize;
    if usa_cnt < 2 || usa_off == 0 || usa_off + usa_cnt * 2 > b.len() {
        return false;
    }
    let usn = u16le(b, usa_off);
    for i in 0..usa_cnt - 1 {
        let tail = (i + 1) * 512 - 2;
        if tail + 2 > b.len() || u16le(b, tail) != usn {
            return false;
        }
        let saved = u16le(b, usa_off + 2 + i * 2);
        b[tail] = saved as u8;
        b[tail + 1] = (saved >> 8) as u8;
    }
    true
}

fn extract_data_runs(b: &[u8], used: usize) -> Vec<(u64, u64, u64)> {
    let mut out: Vec<(u64, u64, u64)> = Vec::new();
    let mut pos = u16le(b, 20) as usize;
    while pos + 16 <= used {
        let atype = u32le(b, pos);
        if atype == 0xFFFF_FFFF {
            break;
        }
        let alen = u32le(b, pos + 4) as usize;
        if alen < 0x18 || pos + alen > used {
            break;
        }
        let nonres = b[pos + 8] != 0;
        let namelen = b[pos + 9] as usize;
        if atype == 0x80 && namelen == 0 && nonres && alen >= 0x40 {
            let start_vcn = u64le(b, pos + 16);
            let run_off = pos + u16le(b, pos + 32) as usize;
            if run_off < pos + alen {
                let mut vcn = start_vcn;
                for (lcn, len) in parse_runlist(&b[run_off..pos + alen]) {
                    out.push((vcn, lcn, len));
                    vcn = vcn.saturating_add(len);
                }
            }
        }
        pos += alen;
    }
    out
}

fn collect_attrlist_data_targets(b: &[u8], used: usize) -> Vec<u64> {
    let mut out: Vec<u64> = Vec::new();
    let mut pos = u16le(b, 20) as usize;
    while pos + 16 <= used {
        let atype = u32le(b, pos);
        if atype == 0xFFFF_FFFF {
            break;
        }
        let alen = u32le(b, pos + 4) as usize;
        if alen < 0x18 || pos + alen > used {
            break;
        }
        let nonres = b[pos + 8] != 0;
        if atype == 0x20 && !nonres && alen >= 0x18 {
            let clen = u32le(b, pos + 16) as usize;
            let coff = u16le(b, pos + 20) as usize;
            let content = pos + coff;
            let end = (content + clen).min(pos + alen);
            let mut p = content;
            while p + 0x1A <= end {
                let etype = u32le(b, p);
                let ename_len = b[p + 4] as usize;
                let efrn = u64le(b, p + 0x10) & 0x0000_FFFF_FFFF_FFFF;
                if etype == 0x80 && ename_len == 0 && efrn != 0 {
                    out.push(efrn);
                }
                let mut step = 0x1A + ename_len * 2;
                step = (step + 7) & !7usize;
                if step == 0 {
                    break;
                }
                p += step;
            }
        }
        pos += alen;
    }
    out
}

fn parse_runlist(mut b: &[u8]) -> Vec<(u64, u64)> {
    let mut runs: Vec<(u64, u64)> = Vec::new();
    let mut lcn: i64 = 0;
    while !b.is_empty() && b[0] != 0 {
        let header = b[0];
        let len_sz = (header & 0xF) as usize;
        let off_sz = (header >> 4) as usize;
        b = &b[1..];
        if len_sz == 0 || len_sz > 8 || off_sz > 8 || b.len() < len_sz + off_sz {
            break;
        }
        let len = read_sized(&b[..len_sz]);
        if off_sz == 0 {
            runs.push((u64::MAX, len));
        } else {
            lcn += read_signed(&b[len_sz..len_sz + off_sz]);
            if lcn >= 0 {
                runs.push((lcn as u64, len));
            }
        }
        b = &b[len_sz + off_sz..];
    }
    runs
}

fn read_sized(b: &[u8]) -> u64 {
    b.iter().rev().fold(0u64, |acc, &x| (acc << 8) | x as u64)
}

fn read_signed(b: &[u8]) -> i64 {
    let mut v: i64 = 0;
    for i in (0..b.len()).rev() {
        v = (v << 8) | b[i] as i64;
    }
    if b.last().map(|&x| x & 0x80 != 0).unwrap_or(false) {
        v |= -1i64 << (b.len() * 8);
    }
    v
}

fn parse_fixed_record(b: &mut [u8], r: &mut RawMftStats, stats: &Stats) {
    use std::sync::atomic::Ordering;
    let rec_flags = u16le(b, 22);
    let used = (u32le(b, 24) as usize).min(b.len());
    let base = u64le(b, 32);
    if base != 0 {
        r.extensions += 1;
        return;
    }
    if rec_flags & 1 == 0 {
        r.deleted += 1;
        return;
    }
    let is_dir = rec_flags & 2 != 0;
    let mut pos = u16le(b, 20) as usize;
    let mut logical: u64 = 0;
    let mut alloc: u64 = 0;
    let mut dir_alloc: u64 = 0;
    let mut reparse = false;
    let mut links: u64 = 0;
    let mut name: Option<String> = None;

    while pos + 16 <= used {
        let atype = u32le(b, pos);
        if atype == 0xFFFF_FFFF {
            break;
        }
        let alen = u32le(b, pos + 4) as usize;
        if alen < 0x18 || pos + alen > used || alen % 8 != 0 {
            break;
        }
        let nonres = b[pos + 8] != 0;
        let namelen = b[pos + 9] as usize;
        if atype == 0x80 && namelen == 0 {
            if nonres && alen >= 0x40 {
                alloc += u64le(b, pos + 40);
                logical += u64le(b, pos + 48);
            } else if !nonres && alen >= 0x18 {
                let clen = u32le(b, pos + 16) as u64;
                logical += clen;
                alloc += clen;
            }
        }
        if atype == 0xB0 && nonres && alen >= 0x40 {
            dir_alloc += u64le(b, pos + 40);
        }
        if atype == 0x30 && namelen == 0 && alen >= 0x18 {
            let content = pos + u16le(b, pos + 20) as usize;
            let content_len = u32le(b, pos + 16) as usize;
            if content_len >= 0x42 && content + 0x42 <= pos + alen {
                links += 1;
                let fn_flags = u32le(b, content + 0x38);
                if fn_flags & 0x400 != 0 {
                    reparse = true;
                }
                let nlen = b[content + 0x40] as usize;
                let noff = content + 0x42;
                if name.is_none()
                    && nlen > 0
                    && nlen <= 255
                    && noff + nlen * 2 <= content + content_len
                    && noff + nlen * 2 <= pos + alen
                {
                    let decoded: String = (0..nlen)
                        .map(|i| char::from_u32(u16le(b, noff + i * 2) as u32).unwrap_or('\u{FFFD}'))
                        .collect();
                    name = Some(decoded);
                }
            }
        }
        pos += alen;
    }

    if reparse {
        r.reparse += 1;
        stats.reparse_skipped.fetch_add(1, Ordering::Relaxed);
        return;
    }
    r.fn_links += links;
    if links == 0 {
        r.orphan += 1;
    }
    if is_dir {
        r.dirs += 1;
        r.dir_bytes_allocated += dir_alloc;
        stats.add_dir(std::path::Path::new(name.as_deref().unwrap_or(".")));
    } else {
        r.files += 1;
        r.bytes_logical += logical;
        r.bytes_allocated += alloc;
        let p = std::path::Path::new(name.as_deref().unwrap_or("(unnamed)"));
        stats.add_file(logical, p);
    }
}
