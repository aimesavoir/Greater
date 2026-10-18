const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const $ = (id) => document.getElementById(id);

/* ---------- formatting helpers ---------- */

function human(bytes) {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function humanRate(entriesPerSec) {
  if (entriesPerSec >= 1e6) return `${(entriesPerSec / 1e6).toFixed(2)}M/s`;
  if (entriesPerSec >= 1e3) return `${(entriesPerSec / 1e3).toFixed(0)}k/s`;
  return `${Math.round(entriesPerSec)}/s`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function baseName(p) {
  const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  return i < 0 ? p : p.slice(i + 1);
}

function dirName(p) {
  const i = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
  return i <= 0 ? p : p.slice(0, i);
}

function pctText(entry, maxSize) {
  const pct = maxSize > 0 ? (entry.size / maxSize) * 100 : 0;
  return pct >= 10 ? pct.toFixed(1) : pct >= 1 ? pct.toFixed(2) : pct > 0 ? pct.toFixed(3) : "0";
}

function fillColor(pct) {
  if (pct >= 99.5) return "#16a34a";
  if (pct >= 50) return "#22c55e";
  if (pct >= 10) return "#34d399";
  if (pct >= 1) return "#4ade80";
  return "#86efac";
}

let toastTimer = 0;
function toast(msg, kind) {
  const el = $("toast");
  el.textContent = msg;
  el.className = `toast ${kind || ""}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3800);
}

window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  setStatus(`JS-REJECTION: ${r && r.message ? r.message : r}`);
});
window.addEventListener("error", (e) => {
  setStatus(`JS-ERROR: ${e.message}`);
});

/* ---------- run state ---------- */

// "scan" while the Explorer walks, "clean" while the Clean page walks, "dupes"
// while the Duplicates page hashes, null when idle. All share one backend
// scanner, so only one can run at a time.
let runKind = null;
let cleanPath = "";
let dupPath = "";

function setStatus(msg) {
  $("status").textContent = msg;
}
function cleanStatus(msg) {
  $("clean-status").textContent = msg;
}

function setUi() {
  const busy = runKind !== null;
  $("start").disabled = busy;
  $("cancel").disabled = runKind !== "scan";
  $("path").disabled = busy;
  $("mode").disabled = busy;
  $("clean-cancel").hidden = runKind !== "clean";
  $("clean-cancel").disabled = runKind !== "clean";
  $("clean-controls-msg").textContent =
    runKind === "clean" ? `Cleaning ${cleanPath}…` : "Hover a drive card, then click Clean.";
  $("dupes-cancel").hidden = runKind !== "dupes";
  $("dupes-cancel").disabled = runKind !== "dupes";
  $("dupes-minsize").disabled = busy;
  $("dupes-keep").disabled = busy;
  $("dupes-controls-msg").textContent =
    runKind === "dupes" ? `Finding duplicates on ${dupPath}…` : "Hover a drive card, then click Find duplicates.";
  document.querySelectorAll(".drive-card").forEach((c) => {
    if (!c.classList.contains("offline")) c.disabled = busy;
  });
  document.querySelectorAll("#clean-volumes .drive-card").forEach((c) => {
    const on = c.classList.contains("active") && runKind === "clean";
    c.classList.toggle("cleaning", on);
    const ov = c.querySelector(".drive-overlay-btn");
    if (ov)
      ov.innerHTML = on
        ? '<span class="spin spin-lg"></span><span class="sr-only">Cleaning</span>'
        : CLEAN_IMG;
  });
  document.querySelectorAll("#dupes-volumes .drive-card").forEach((c) => {
    const on = c.classList.contains("active") && runKind === "dupes";
    c.classList.toggle("cleaning", on);
    const ov = c.querySelector(".drive-overlay-btn");
    if (ov)
      ov.innerHTML = on
        ? '<span class="spin spin-lg"></span><span class="sr-only">Scanning</span>'
        : DUP_IMG;
  });
  $("bar").classList.toggle("indeterminate", runKind === "scan");
  $("clean-bar").classList.toggle("indeterminate", runKind === "clean");
  $("dupes-bar").classList.toggle("indeterminate", runKind === "dupes");
  renderCleanActions();
  renderDupActions();
}

/* ---------- statistics readouts ---------- */

function renderScanStats(p, cancelled) {
  const elapsed = p.elapsed_ms / 1000;
  $("s-elapsed").textContent = `${elapsed.toFixed(2)} s${cancelled ? " (cancelled)" : ""}`;
  $("s-files").textContent = p.files.toLocaleString();
  $("s-dirs").textContent = p.dirs.toLocaleString();
  $("s-bytes").textContent = human(p.bytes);
  $("s-rate").textContent = humanRate((p.files + p.dirs) / Math.max(elapsed, 0.001));
  const skip = p.denied + p.not_found + p.errors + p.reparse_skipped;
  $("s-skip").textContent = skip === 0 ? "none" : `${skip}`;
}

function renderCleanStats(p) {
  $("c-scanned").textContent = p.files.toLocaleString();
  $("c-elapsed").textContent = `${(p.elapsed_ms / 1000).toFixed(2)} s`;
  $("c-files").textContent = p.junk_files.toLocaleString();
  $("c-bytes").textContent = human(p.junk_bytes);
}

/* ---------- virtual list ---------- */

const ROW = 46;
const PAGE = 250;
const OVERSCAN = 6;
// Chromium clamps layout to ~33.5M px; 1.4M rows x 46px would exceed it and
// silently break the scrollbar. Cap the rendered window and say so.
const MAX_ROWS = 600000;

const ICONS = {
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>',
  open: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v5"/><path d="M9.6 13.4 12 11l2.4 2.4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/></svg>',
  del: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
};

const CLEAN_IMG = '<img class="clean-img" src="clean.png" alt="Clean" draggable="false" />';
const DUP_IMG =
  '<svg class="dup-img" viewBox="0 0 24 24" aria-hidden="true">' +
  '<rect x="3" y="3" width="13" height="13" rx="2.6"/>' +
  '<rect x="8" y="8" width="13" height="13" rx="2.6"/></svg>';

/**
 * One scrollable, windowed list backed by a paged Tauri command.
 * Only the rows inside the viewport exist in the DOM.
 */
function createList({ viewportId, canvasId, windowId, countId, fetchPage, rowHtml, emptyText }) {
  const viewport = $(viewportId);
  const canvas = $(canvasId);
  const rowWindow = $(windowId);
  const pageCache = new Map();
  let totalRows = 0;
  let listTotal = 0;
  let maxSize = 0;
  let renderSeq = 0;

  async function page(pi) {
    if (!pageCache.has(pi)) {
      pageCache.set(
        pi,
        Promise.resolve(fetchPage(pi * PAGE, PAGE))
          .then((p) => p.entries)
          .catch(() => [])
      );
    }
    return pageCache.get(pi);
  }

  function countLabel() {
    if (listTotal === 0) return "";
    if (listTotal > totalRows) {
      return `${totalRows.toLocaleString()} largest of ${listTotal.toLocaleString()} files`;
    }
    return `${listTotal.toLocaleString()} files (largest first)`;
  }

  function reset(total, keepScroll) {
    listTotal = total;
    totalRows = Math.min(total, MAX_ROWS);
    pageCache.clear();
    canvas.style.height = `${totalRows * ROW}px`;
    if (!keepScroll) viewport.scrollTop = 0;
    if (countId) $(countId).textContent = countLabel();
    render();
  }

  async function refreshMax() {
    maxSize = 0;
    const first = await page(0);
    if (first && first[0]) maxSize = first[0].size;
  }

  async function render() {
    if (totalRows === 0) {
      rowWindow.style.transform = "translateY(0px)";
      rowWindow.innerHTML = `<div class="list-empty">${emptyText()}</div>`;
      return;
    }
    const seq = ++renderSeq;
    const scrollTop = viewport.scrollTop;
    const first = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
    const visibleCount = Math.ceil(viewport.clientHeight / ROW) + OVERSCAN * 2;
    const last = Math.min(totalRows, first + visibleCount);
    rowWindow.style.transform = `translateY(${first * ROW}px)`;

    const firstPage = Math.floor(first / PAGE);
    const lastPage = Math.floor((last - 1) / PAGE);
    const pages = await Promise.all(
      Array.from({ length: lastPage - firstPage + 1 }, (_, i) => page(firstPage + i))
    );
    if (seq !== renderSeq) return;

    let html = "";
    for (let i = first; i < last; i++) {
      const pi = Math.floor(i / PAGE);
      const entry = pages[pi - firstPage]?.[i - pi * PAGE];
      if (!entry) continue;
      html += rowHtml(entry, maxSize);
    }
    rowWindow.innerHTML = html;
  }

  let scheduled = false;
  viewport.addEventListener("scroll", () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      render();
    });
  });

  return {
    viewport,
    window: rowWindow,
    reset,
    render,
    refreshMax,
    get total() {
      return listTotal;
    },
    get max() {
      return maxSize;
    },
  };
}

/* ---------- explorer list ---------- */

function fileRowHtml(entry, maxSize) {
  const path = escapeHtml(entry.path);
  const pct = maxSize > 0 ? (entry.size / maxSize) * 100 : 0;
  return (
    `<div class="list-row" data-path="${path}" data-size="${entry.size}">` +
    `<div class="row-fill" style="width:${Math.max(pct, 0.15).toFixed(3)}%;--fill-edge:${fillColor(pct)}"></div>` +
    `<div class="row-inner">` +
    `<div class="row-main">` +
    `<span class="row-name" title="${path}">${escapeHtml(baseName(entry.path))}</span>` +
    `<span class="row-path" title="${path}">${escapeHtml(dirName(entry.path))}</span>` +
    `</div>` +
    `<span class="row-size">${human(entry.size)}</span>` +
    `<span class="row-pct">${pctText(entry, maxSize)}%</span>` +
    `<span class="row-actions">` +
    `<button class="icon-btn" data-act="info" title="More info" aria-label="More info">${ICONS.info}</button>` +
    `<button class="icon-btn" data-act="open" title="Open location" aria-label="Open location">${ICONS.open}</button>` +
    `<button class="icon-btn" data-act="trash" title="Move to trash" aria-label="Move to trash">${ICONS.trash}</button>` +
    `<button class="icon-btn danger" data-act="delete" title="Delete permanently" aria-label="Delete permanently">${ICONS.del}</button>` +
    `</div></div>`
  );
}

const filesList = createList({
  viewportId: "list-viewport",
  canvasId: "list-canvas",
  windowId: "list-window",
  countId: "file-count",
  fetchPage: (offset, limit) => invoke("get_files", { offset, limit }),
  rowHtml: fileRowHtml,
  emptyText: () => "No scan yet.",
});

/* ---------- clean list ---------- */

let junkEmptyText = "Run a clean sweep to list junk files.";

// Plain-language explanation for each junk rule, shown as a hover tooltip on
// the reason badge so it is clear *why* a file is offered and that it is safe.
const JUNK_WHY = {
  "win-temp": "Scratch space Windows programs use while running. Recreated on demand; holds no user data.",
  "system-temp": "System-wide scratch area for Windows services. Safe to clear; Windows recreates it.",
  "user-temp": "Programs' temporary files for this account. Recreated on demand; holds no user data.",
  "pkg-temp": "Store-app temporary state while it runs. Recreated by the app on next launch.",
  inetcache: "Internet Explorer / system web cache. Regenerated by browsing.",
  thumbs: "Thumbnail and icon cache. Windows rebuilds these automatically.",
  "browser-cache": "Browser page/GPU shader cache. Regenerated by browsing.",
  "win-update-cache": "Downloaded Windows Update payloads already installed. Re-downloaded only if needed again.",
  "delivery-opt": "Delivery Optimization peer/download cache. Windows manages and refills it.",
  "recycle-bin": "Files you already deleted, still recoverable until emptied.",
  "crash-dumps": "Kernel/application crash dumps (incl. MEMORY.DMP) kept for debugging after a crash. Windows writes a new one if it crashes again.",
  "win-logs": "Old Windows log files. Only used for troubleshooting; new logs are written continuously.",
  "servicing-cache": "Temporary staging for Windows servicing/WinSxS updates. Windows recreates it.",
  "os-cache": "Windows component cache files. Regenerated by the shell.",
  "shader-cache": "GPU shader caches (DirectX/NVIDIA/AMD). Rebuilt the next time games/apps run.",
  "gpu-installer": "Leftover GPU driver installer packages/cache. Safe to remove; drivers are already installed.",
  prefetch: "Windows app-launch prefetch hints. Deleting only slows the first few launches while they rebuild.",
  "windows-old": "A previous Windows installation kept for 10 days for rollback. Deleting frees a lot; you can no longer roll back.",
  "package-cache": "Installer payloads for repair/uninstall. Removing means big installers must be re-downloaded.",
  panther: "Windows Setup logs. For troubleshooting upgrades; safe to remove.",
  wer: "Windows Error Reporting crash reports. Safe to remove; only used to report bugs.",
  "patch-cache": "Cached Windows patch payloads. Removing means repair/patching re-downloads them.",
  "dev-cache": "Developer package caches (npm/pip/Cargo/NuGet/Gradle/Maven/Go). Re-downloaded on next build.",
};

function junkRowHtml(entry, maxSize) {
  const path = escapeHtml(entry.path);
  const selected = isJunkSelected(entry);
  return (
    `<div class="list-row junk-row ${selected ? "selected" : ""}" data-path="${path}" data-size="${entry.size}" data-category="${entry.category}" data-label="${escapeHtml(
      entry.label
    )}">` +
    `<div class="row-fill" style="width:${Math.max(
      maxSize > 0 ? (entry.size / maxSize) * 100 : 0,
      0.15
    ).toFixed(3)}%;--fill-edge:${fillColor(maxSize > 0 ? (entry.size / maxSize) * 100 : 0)}"></div>` +
    `<div class="row-inner">` +
    `<span class="col-check"><input class="row-check" type="checkbox" data-act="pick" ${
      selected ? "checked" : ""
    } /></span>` +
    `<div class="row-main">` +
    `<span class="row-name" title="${path}">${escapeHtml(baseName(entry.path))}</span>` +
    `<span class="row-path" title="${path}">${escapeHtml(dirName(entry.path))}</span>` +
    `</div>` +
    `<span class="junk-badge ${entry.category}" title="${escapeHtml(
      JUNK_WHY[entry.rule] || entry.label
    )}">${escapeHtml(entry.label)}</span>` +
    `<span class="row-size">${human(entry.size)}</span>` +
    `<span class="row-actions">` +
    `<button class="icon-btn" data-act="info" title="More info" aria-label="More info">${ICONS.info}</button>` +
    `<button class="icon-btn" data-act="open" title="Open location" aria-label="Open location">${ICONS.open}</button>` +
    `</span></div>`
  );
}

const junkList = createList({
  viewportId: "clean-viewport",
  canvasId: "clean-canvas",
  windowId: "clean-window",
  fetchPage: (offset, limit) =>
    invoke("get_junk", { offset, limit, category: cleanFilter === "all" ? null : cleanFilter }),
  rowHtml: junkRowHtml,
  emptyText: () => junkEmptyText,
});

// Totals per category, straight from the backend, so the default "safe"
// selection can be summed without paging the whole list into the browser.
const cleanAgg = { safeFiles: 0, safeBytes: 0, optFiles: 0, optBytes: 0 };
// Selection = a default mode plus the individual toggles the user made.
const cleanSel = { mode: "safe", overrides: new Map() };
let cleanFilter = "all";
let purging = false;

function isJunkSelected(entry) {
  const o = cleanSel.overrides.get(entry.path);
  if (o) return o.on;
  if (cleanSel.mode === "all") return true;
  if (cleanSel.mode === "none") return false;
  return entry.category === "safe";
}

function baseSelected(category) {
  if (cleanSel.mode === "all") return true;
  if (cleanSel.mode === "none") return false;
  return category === "safe";
}

function selectedTotals() {
  let count = cleanSel.mode === "all" ? cleanAgg.safeFiles + cleanAgg.optFiles : cleanSel.mode === "none" ? 0 : cleanAgg.safeFiles;
  let bytes = cleanSel.mode === "all" ? cleanAgg.safeBytes + cleanAgg.optBytes : cleanSel.mode === "none" ? 0 : cleanAgg.safeBytes;
  for (const o of cleanSel.overrides.values()) {
    const was = baseSelected(o.cat);
    if (o.on && !was) {
      count++;
      bytes += o.size;
    } else if (!o.on && was) {
      count--;
      bytes -= o.size;
    }
  }
  return { count, bytes };
}

function renderChipCounts() {
  const total = cleanAgg.safeFiles + cleanAgg.optFiles;
  $("clean-filter-all").textContent = `all ${total.toLocaleString()}`;
  $("clean-filter-safe").textContent = `safe ${cleanAgg.safeFiles.toLocaleString()}`;
  $("clean-filter-optional").textContent = `optional ${cleanAgg.optFiles.toLocaleString()}`;
}

function renderCleanActions() {
  const { count, bytes } = selectedTotals();
  const size = Math.max(bytes, 0);
  const total = cleanAgg.safeFiles + cleanAgg.optFiles;
  $("c-selected").textContent =
    count === 0 ? "none" : `${count.toLocaleString()} files · ${human(size)}`;
  const zero = count === 0 || purging || runKind === "clean";
  $("clean-trash").disabled = zero;
  $("clean-perm").disabled = zero;
  $("clean-none").disabled = runKind === "clean";
  $("clean-all-btn").disabled = runKind === "clean";
  $("clean-hint").textContent =
    total === 0
      ? "Nothing to clean."
      : count === 0
      ? `Nothing selected of ${total.toLocaleString()} junk files.`
      : `${count.toLocaleString()} of ${total.toLocaleString()} junk files selected · ${human(size)}.`;
}

function renderCleanSummary() {
  renderChipCounts();
  renderCleanActions();
}

/* ---------- drive cards ---------- */

function driveColor(pct) {
  if (pct >= 92) return ["#f2555a", "#ff8d90"];
  if (pct >= 80) return ["#f0b429", "#ffd166"];
  return ["#22c55e", "#86efac"];
}

function donut(pct) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * c;
  const [col] = driveColor(pct);
  return (
    `<svg class="donut" viewBox="0 0 62 62" aria-hidden="true">` +
    `<circle cx="31" cy="31" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="7"/>` +
    `<circle cx="31" cy="31" r="${r}" fill="none" stroke="${col}" stroke-width="7" stroke-linecap="round" ` +
    `stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" transform="rotate(-90 31 31)"/>` +
    `<text class="donut-center" x="31" y="31" text-anchor="middle" dominant-baseline="central">${Math.round(
      pct
    )}%</text>` +
    `</svg>`
  );
}

function fillDriveCards(box, vols, opts) {
  opts = opts || {};
  box.innerHTML = "";
  for (const v of vols) {
    if (v.kind !== "fixed" && v.kind !== "removable" && v.kind !== "ram") continue;
    const used = v.total - v.free;
    const pct = v.total > 0 ? (used / v.total) * 100 : 0;
    const [c1, c2] = driveColor(pct);
    const btn = document.createElement("button");
    btn.className = "drive-card";
    btn.type = "button";
    btn.dataset.letter = v.letter;
    btn.disabled = runKind !== null;
    btn.title = `${v.letter}: — ${human(used)} used, ${human(v.free)} free of ${human(v.total)}`;
    btn.innerHTML =
      donut(pct) +
      `<span class="drive-body">` +
      `<span class="drive-top"><span class="drive-letter">${v.letter}:</span>` +
      `<span class="drive-label">${escapeHtml(v.label || v.kind)}</span>` +
      `<span class="drive-fs">${escapeHtml(v.fs || "—")}</span></span>` +
      `<span class="drive-line"><span>used <b>${human(used)}</b></span><span>free <b>${human(
        v.free
      )}</b></span></span>` +
      `<span class="drive-line"><span>total ${human(v.total)}</span><span>${
        v.kind === "fixed" ? "internal" : v.kind
      }</span></span>` +
      `<span class="drive-bar" style="--drive-color:${c1};--drive-color-2:${c2}"><span style="width:${pct.toFixed(
        1
      )}%"></span></span>` +
      `</span>`;
    if (opts.overlayHtml) {
      btn.insertAdjacentHTML(
        "beforeend",
        `<span class="drive-overlay"><span class="drive-overlay-btn">${opts.overlayHtml}</span></span>`
      );
    }
    btn.onclick = () => {
      if (opts.onPick) return opts.onPick(v, box, btn);
      $(opts.inputId).value = `${v.letter}:\\`;
      box.querySelectorAll(".drive-card").forEach((c) => c.classList.toggle("picked", c === btn));
    };
    box.appendChild(btn);
  }
  if (!box.children.length) {
    const off = document.createElement("button");
    off.className = "drive-card offline";
    off.type = "button";
    off.textContent = "no drives";
    box.appendChild(off);
  }
}

async function refreshVolumes() {
  try {
    const vols = await invoke("list_volumes");
    fillDriveCards($("volumes"), vols, { inputId: "path" });
    fillDriveCards($("clean-volumes"), vols, {
      overlayHtml: CLEAN_IMG,
      onPick: (v, box, card) => startClean(`${v.letter}:\\`, box, card),
    });
    fillDriveCards($("dupes-volumes"), vols, {
      overlayHtml: DUP_IMG,
      onPick: (v, box, card) => startDupes(`${v.letter}:\\`, box, card),
    });
  } catch (e) {
    setStatus(`volume list failed: ${e}`);
  }
}

/* ---------- file actions ---------- */

async function actionInfo(path, size, maxSize) {
  try {
    const info = await invoke("file_info", { path });
    const pct = maxSize > 0 ? ((info.size / maxSize) * 100).toFixed(2) : "—";
    const fmt = (t) => (t ? new Date(t).toLocaleString() : "—");
    $("info-title").textContent = "File information";
    $("info-body").innerHTML =
      `<div class="file-name">${escapeHtml(info.name)}</div>` +
      `<div class="file-path">${escapeHtml(info.path)}</div>` +
      `<dl class="info-grid">` +
      `<dt>size</dt><dd>${human(info.size)} (${info.size.toLocaleString()} bytes)</dd>` +
      `<dt>% of largest</dt><dd>${pct}%</dd>` +
      `<dt>extension</dt><dd>${escapeHtml(info.extension || "—")}</dd>` +
      `<dt>folder</dt><dd>${escapeHtml(info.parent)}</dd>` +
      `<dt>modified</dt><dd>${fmt(info.modified_ms)}</dd>` +
      `<dt>created</dt><dd>${fmt(info.created_ms)}</dd>` +
      `<dt>accessed</dt><dd>${fmt(info.accessed_ms)}</dd>` +
      `</dl>` +
      `<div class="info-tags">` +
      `<span class="tag ${info.readonly ? "on" : ""}">read-only</span>` +
      `<span class="tag ${info.hidden ? "on" : ""}">hidden</span>` +
      `<span class="tag ${info.system ? "on" : ""}">system</span>` +
      `<span class="tag ${info.archive ? "on" : ""}">archive</span>` +
      `<span class="tag ${info.reparse ? "on" : ""}">reparse point</span>` +
      `</div>`;
    $("modal-info").dataset.path = path;
    $("modal-info").dataset.size = String(size);
    $("modal-info").hidden = false;
  } catch (e) {
    toast(`cannot open info: ${e}`, "err");
  }
}

function closeModals() {
  $("modal-info").hidden = true;
  $("modal-confirm").hidden = true;
}

function confirmDialog(title, text, okLabel) {
  return new Promise((resolve) => {
    $("confirm-title").textContent = title;
    $("confirm-text").textContent = text;
    $("confirm-ok").textContent = okLabel;
    $("modal-confirm").hidden = false;
    const done = (v) => {
      $("modal-confirm").hidden = true;
      $("confirm-ok").onclick = null;
      $("confirm-cancel").onclick = null;
      resolve(v);
    };
    $("confirm-ok").onclick = () => done(true);
    $("confirm-cancel").onclick = () => done(false);
  });
}

async function dropRows(paths) {
  let total = filesList.total;
  for (const p of paths) {
    try {
      total = await invoke("remove_entry", { path: p });
    } catch {
      /* keep previous total */
    }
  }
  filesList.reset(total, true);
  await filesList.refreshMax();
  filesList.render();
}

async function actionTrash(path) {
  const name = baseName(path);
  const ok = await confirmDialog(
    "Move to Recycle Bin?",
    `${name}\n\nYou can restore it from the Recycle Bin later.`,
    "Move to trash"
  );
  if (!ok) return;
  try {
    await invoke("move_to_trash", { path });
    dropRows([path]);
    toast(`moved to Recycle Bin: ${name}`, "ok");
    setStatus(`Moved to Recycle Bin: ${path}`);
  } catch (e) {
    toast(`trash failed: ${e}`, "err");
    setStatus(`error: ${e}`);
  }
}

async function actionDelete(path) {
  const name = baseName(path);
  const ok = await confirmDialog(
    "Delete permanently?",
    `${name}\n\nThis bypasses the Recycle Bin. The file cannot be recovered.`,
    "Delete permanently"
  );
  if (!ok) return;
  try {
    await invoke("delete_permanent", { path });
    dropRows([path]);
    toast(`deleted permanently: ${name}`, "ok");
    setStatus(`Deleted permanently: ${path}`);
  } catch (e) {
    toast(`delete failed: ${e}`, "err");
    setStatus(`error: ${e}`);
  }
}

async function actionOpen(path) {
  try {
    await invoke("open_location", { path });
    toast(`opened location of ${baseName(path)}`, "ok");
  } catch (e) {
    toast(`cannot open location: ${e}`, "err");
  }
}

filesList.window.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const row = btn.closest(".list-row");
  if (!row) return;
  const path = row.dataset.path;
  const size = Number(row.dataset.size || 0);
  e.stopPropagation();
  switch (btn.dataset.act) {
    case "info":
      actionInfo(path, size, filesList.max);
      break;
    case "open":
      actionOpen(path);
      break;
    case "trash":
      actionTrash(path);
      break;
    case "delete":
      actionDelete(path);
      break;
  }
});

filesList.window.addEventListener("dblclick", (e) => {
  const row = e.target.closest(".list-row");
  if (row) actionInfo(row.dataset.path, Number(row.dataset.size || 0), filesList.max);
});

/* ---------- clean page interactions ---------- */

junkList.window.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (btn) {
    const row = btn.closest(".list-row");
    if (!row) return;
    e.stopPropagation();
    if (btn.dataset.act === "info") {
      actionInfo(row.dataset.path, Number(row.dataset.size || 0), junkList.max);
    } else if (btn.dataset.act === "open") {
      actionOpen(row.dataset.path);
    }
    return;
  }
  if (e.target.closest('input[data-act="pick"]')) return;
  const row = e.target.closest(".list-row.junk-row");
  if (!row) return;
  const cb = row.querySelector('input[data-act="pick"]');
  if (cb) cb.click();
});

junkList.window.addEventListener("change", (e) => {
  const cb = e.target.closest('input[data-act="pick"]');
  if (!cb) return;
  const row = cb.closest(".list-row");
  cleanSel.overrides.set(row.dataset.path, {
    on: cb.checked,
    size: Number(row.dataset.size || 0),
    cat: row.dataset.category,
  });
  row.classList.toggle("selected", cb.checked);
  renderCleanActions();
});

junkList.window.addEventListener("dblclick", (e) => {
  const row = e.target.closest(".list-row");
  if (row) actionInfo(row.dataset.path, Number(row.dataset.size || 0), junkList.max);
});

function setFilter(name) {
  cleanFilter = name;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.filter === name));
}

async function applyFilter(name) {
  setFilter(name);
  try {
    const p = await invoke("get_junk", {
      offset: 0,
      limit: 1,
      category: name === "all" ? null : name,
    });
    junkList.reset(p.total);
    await junkList.refreshMax();
    junkList.render();
  } catch (e) {
    cleanStatus(`error: ${e}`);
  }
  renderCleanActions();
}

document.querySelectorAll(".chip").forEach((c) => {
  c.onclick = () => applyFilter(c.dataset.filter);
});

$("clean-all-btn").onclick = () => {
  cleanSel.mode = "all";
  cleanSel.overrides.clear();
  junkList.render();
  renderCleanActions();
};

$("clean-none").onclick = () => {
  cleanSel.mode = "none";
  cleanSel.overrides.clear();
  junkList.render();
  renderCleanActions();
};

$("clean-check-all").onclick = () => {
  cleanSel.mode = $("clean-check-all").checked ? "all" : "none";
  cleanSel.overrides.clear();
  junkList.render();
  renderCleanActions();
};

async function runPurge(permanent) {
  const { count, bytes } = selectedTotals();
  if (count === 0 || purging) return;
  const ok = await confirmDialog(
    permanent ? "Delete permanently?" : "Move to Recycle Bin?",
    `${count.toLocaleString()} file${count === 1 ? "" : "s"}, ${human(Math.max(bytes, 0))}.\n\n` +
      (permanent
        ? "This bypasses the Recycle Bin and cannot be undone."
        : "Restorable from the Recycle Bin afterwards. Windows deletes items that are too big for the Recycle Bin structure permanently."),
    permanent ? "Delete permanently" : "Move to trash"
  );
  if (!ok) return;

  purging = true;
  renderCleanActions();
  const invert = Array.from(cleanSel.overrides, ([path, o]) => ({ path, on: o.on }));
  try {
    const res = await invoke("purge_selected", {
      kind: cleanSel.mode,
      invert,
      permanent,
    });
    cleanAgg.safeFiles = res.safe_files;
    cleanAgg.safeBytes = res.safe_bytes;
    cleanAgg.optFiles = res.optional_files;
    cleanAgg.optBytes = res.optional_bytes;
    cleanSel.mode = "safe";
    cleanSel.overrides.clear();
    junkList.reset(res.remaining);
    await junkList.refreshMax();
    junkList.render();
    renderCleanSummary();
    const verb = permanent ? "Deleted permanently" : "Moved to Recycle Bin";
    const failedNote = res.failed.length
      ? ` ${res.failed.length} could not be removed (in use or access denied).`
      : "";
    cleanStatus(
      `${verb}: ${res.deleted.toLocaleString()} file${res.deleted === 1 ? "" : "s"}, ${human(
        Math.max(bytes, 0)
      )}.${failedNote}`
    );
    toast(`${verb.toLowerCase()}: ${res.deleted.toLocaleString()} files`, res.failed.length ? "warn" : "ok");
    refreshVolumes();
  } catch (e) {
    cleanStatus(`error: ${e}`);
    toast(`clean failed: ${e}`, "err");
  } finally {
    purging = false;
    renderCleanActions();
  }
}

$("clean-trash").onclick = () => runPurge(false);
$("clean-perm").onclick = () => runPurge(true);

async function startClean(path, box, card) {
  if (runKind !== null) return;
  cleanPath = path;
  if (box) {
    box.querySelectorAll(".drive-card").forEach((c) => c.classList.toggle("active", c === card));
  }
  runKind = "clean";
  setUi();
  junkEmptyText = "Nothing to clean here — no junk matched.";
  cleanAgg.safeFiles = 0;
  cleanAgg.safeBytes = 0;
  cleanAgg.optFiles = 0;
  cleanAgg.optBytes = 0;
  cleanSel.mode = "safe";
  cleanSel.overrides.clear();
  cleanFilter = "all";
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.filter === "all"));
  $("clean-bar").style.width = "0%";
  $("c-scanned").textContent = "—";
  $("c-elapsed").textContent = "—";
  $("c-files").textContent = "—";
  $("c-bytes").textContent = "—";
  $("c-selected").textContent = "—";
  junkList.reset(0);
  renderCleanSummary();
  cleanStatus(`Scanning ${path} for junk…`);
  try {
    await invoke("clean_start", {
      path,
      mode: $("mode").value,
      threads: navigator.hardwareConcurrency || 8,
    });
  } catch (e) {
    runKind = null;
    setUi();
    cleanStatus(`error: ${e}`);
  }
}

$("clean-cancel").onclick = () => {
  invoke("scan_cancel")
    .then(() => cleanStatus("Cancelling — finishing current folder…"))
    .catch((e) => cleanStatus(`cancel: ${e}`));
};

/* ---------- duplicates page ---------- */

const DUP_PAGE = 150;
let dupGroups = [];
const dupById = new Map();
let dupTotal = 0;
let dupAgg = { groups: 0, files: 0, wasted: 0, baseFiles: 0, baseBytes: 0 };
// keep = which copy of each group the backend keeps by default; overrides =
// the individual boxes the user re-ticked (path -> {on, size, base}).
const dupSel = { keep: "oldest", overrides: new Map() };
let dupPurging = false;

function dupStatus(msg) {
  $("dupes-status").textContent = msg;
}

function fmtDate(ms) {
  return ms ? new Date(ms).toLocaleDateString() : "—";
}

function dupIsDeleted(f) {
  const o = dupSel.overrides.get(f.path);
  return o ? o.on : !f.keep;
}

function setDupOverride(f, on) {
  // `base` is the untouched default (delete unless it is the keep copy), so
  // totals stay a simple delta over what the backend reported.
  dupSel.overrides.set(f.path, { on, size: f.size, base: !f.keep });
}

function dupSelectedTotals() {
  let count = dupAgg.baseFiles;
  let bytes = dupAgg.baseBytes;
  for (const o of dupSel.overrides.values()) {
    if (o.on && !o.base) {
      count++;
      bytes += o.size;
    } else if (!o.on && o.base) {
      count--;
      bytes -= o.size;
    }
  }
  return { count: Math.max(count, 0), bytes: Math.max(bytes, 0) };
}

function dupFileHtml(g, f) {
  const del = dupIsDeleted(f);
  return (
    `<div class="dup-file ${del ? "del" : "keep"}" data-path="${escapeHtml(f.path)}" data-gid="${g.id}">` +
    `<input type="checkbox" class="row-check" data-act="pick" ${del ? "checked" : ""} title="Tick to delete this copy" />` +
    `<button type="button" class="dup-star" data-act="keep" title="Keep only this copy" aria-label="Keep only this copy">★</button>` +
    `<span class="dup-path" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</span>` +
    `<span class="dup-when">${fmtDate(f.mtime_ms)}</span>` +
    `<span class="dup-tag">${del ? "delete" : "keep"}</span>` +
    `</div>`
  );
}

function dupGroupHtml(g) {
  const wasted = g.size * (g.files.length - 1);
  return (
    `<div class="dup-group" data-gid="${g.id}">` +
    `<div class="dup-head">` +
    `<span class="dup-name" title="${escapeHtml(g.files[0].path)}">${escapeHtml(g.name)}</span>` +
    `<span class="dup-meta">${g.files.length} copies · ${human(g.size)} each · ${human(wasted)} reclaimable</span>` +
    `</div>` +
    `<div class="dup-files">${g.files.map((f) => dupFileHtml(g, f)).join("")}</div>` +
    `</div>`
  );
}

function paintDupRow(row, del) {
  row.classList.toggle("del", del);
  row.classList.toggle("keep", !del);
  const tag = row.querySelector(".dup-tag");
  if (tag) tag.textContent = del ? "delete" : "keep";
}

function updateGroupDom(g) {
  const el = $("dupes-list").querySelector(`.dup-group[data-gid="${g.id}"]`);
  if (!el) return;
  const rows = el.querySelectorAll(".dup-file");
  g.files.forEach((f, i) => {
    const row = rows[i];
    if (!row) return;
    const del = dupIsDeleted(f);
    const cb = row.querySelector('input[data-act="pick"]');
    if (cb) cb.checked = del;
    paintDupRow(row, del);
  });
}

function renderDupActions() {
  const { count, bytes } = dupSelectedTotals();
  const busy = runKind === "dupes";
  $("d-selected").textContent = count === 0 ? "none" : `${count.toLocaleString()} files · ${human(bytes)}`;
  const zero = count === 0 || dupPurging || busy;
  $("dupes-trash").disabled = zero;
  $("dupes-perm").disabled = zero;
  $("dupes-none").disabled = dupGroups.length === 0 || busy;
  $("dupes-all").disabled = dupGroups.length === 0 || busy;
  $("dupes-more").hidden = dupGroups.length >= dupTotal;
  const total = dupAgg.files;
  $("dupes-hint").textContent =
    total === 0
      ? "No duplicates listed."
      : count === 0
      ? `Nothing selected — every copy of ${dupAgg.groups.toLocaleString()} groups is being kept.`
      : `${count.toLocaleString()} of ${total.toLocaleString()} copies selected · ${human(bytes)}. One copy per group is always kept.`;
}

function renderDupSummary() {
  $("dupes-summary").textContent =
    dupAgg.groups === 0
      ? ""
      : `${dupAgg.groups.toLocaleString()} groups · ${dupAgg.files.toLocaleString()} copies · ${human(
          dupAgg.wasted
        )} reclaimable`;
  $("d-groups").textContent = dupAgg.groups.toLocaleString();
  $("d-files").textContent = dupAgg.files.toLocaleString();
  $("d-wasted").textContent = human(dupAgg.wasted);
}

async function loadDupes(reset) {
  if (reset) {
    dupGroups = [];
    dupById.clear();
    dupSel.overrides.clear();
    $("dupes-list").innerHTML = "";
  }
  let page;
  try {
    page = await invoke("get_dupes", { offset: dupGroups.length, limit: DUP_PAGE, keep: dupSel.keep });
  } catch (e) {
    dupStatus(`error: ${e}`);
    return;
  }
  dupTotal = page.total;
  dupAgg = {
    groups: page.groups,
    files: page.files,
    wasted: page.wasted,
    baseFiles: page.base_files,
    baseBytes: page.base_bytes,
  };
  for (const g of page.entries) {
    dupGroups.push(g);
    dupById.set(g.id, g);
  }
  const list = $("dupes-list");
  if (reset) list.innerHTML = "";
  if (page.entries.length) list.insertAdjacentHTML("beforeend", page.entries.map(dupGroupHtml).join(""));
  if (reset && dupGroups.length === 0)
    list.innerHTML = `<div class="list-empty">No duplicates at this size floor.</div>`;
  renderDupSummary();
  renderDupActions();
}

async function startDupes(path, box, card) {
  if (runKind !== null) return;
  dupPath = path;
  if (box) box.querySelectorAll(".drive-card").forEach((c) => c.classList.toggle("active", c === card));
  runKind = "dupes";
  dupGroups = [];
  dupById.clear();
  dupTotal = 0;
  dupAgg = { groups: 0, files: 0, wasted: 0, baseFiles: 0, baseBytes: 0 };
  dupSel.overrides.clear();
  $("dupes-list").innerHTML = "";
  $("dupes-bar").style.width = "0%";
  ["d-scanned", "d-elapsed", "d-groups", "d-files", "d-wasted", "d-selected"].forEach((id) => {
    $(id).textContent = "—";
  });
  $("dupes-summary").textContent = "";
  setUi();
  dupStatus(`Scanning ${path}, then reading shared-size files for duplicates…`);
  try {
    await invoke("dupes_start", {
      path,
      mode: $("mode").value,
      threads: navigator.hardwareConcurrency || 8,
      minSize: Number($("dupes-minsize").value),
    });
  } catch (e) {
    runKind = null;
    setUi();
    dupStatus(`error: ${e}`);
  }
}

async function runDupPurge(permanent) {
  const { count, bytes } = dupSelectedTotals();
  if (count === 0 || dupPurging) return;
  const ok = await confirmDialog(
    permanent ? "Delete permanently?" : "Move to Recycle Bin?",
    `${count.toLocaleString()} duplicate cop${count === 1 ? "y" : "ies"} · ${human(bytes)}.\n\n` +
      `One copy of each group is always kept. ` +
      (permanent
        ? "This bypasses the Recycle Bin; the files cannot be recovered."
        : "Files go to the Recycle Bin. Very large ones may be deleted permanently instead."),
    permanent ? "Delete permanently" : "Move to Recycle Bin"
  );
  if (!ok) return;
  dupPurging = true;
  renderDupActions();
  const invert = [...dupSel.overrides].map(([path, o]) => ({ path, on: o.on }));
  try {
    const res = await invoke("delete_dupes", { keep: dupSel.keep, invert, permanent });
    await loadDupes(true);
    const verb = permanent ? "Deleted permanently" : "Moved to Recycle Bin";
    const failedNote = res.failed.length
      ? ` ${res.failed.length} could not be removed (in use or access denied).`
      : "";
    dupStatus(
      `${verb}: ${res.deleted.toLocaleString()} file${res.deleted === 1 ? "" : "s"}, ${human(
        Math.max(bytes, 0)
      )}. ${res.remaining_groups.toLocaleString()} groups left (${human(res.wasted)} reclaimable).${failedNote}`
    );
    toast(`${verb.toLowerCase()}: ${res.deleted.toLocaleString()} files`, res.failed.length ? "warn" : "ok");
    refreshVolumes();
  } catch (e) {
    dupStatus(`error: ${e}`);
    toast(`delete failed: ${e}`, "err");
  } finally {
    dupPurging = false;
    renderDupActions();
  }
}

$("dupes-list").addEventListener("click", (e) => {
  const star = e.target.closest('button[data-act="keep"]');
  if (star) {
    e.stopPropagation();
    const row = star.closest(".dup-file");
    const g = dupById.get(Number(row.dataset.gid));
    if (!g) return;
    for (const f of g.files) setDupOverride(f, f.path !== row.dataset.path);
    updateGroupDom(g);
    renderDupActions();
    return;
  }
  if (e.target.closest('input[data-act="pick"]')) return; // handled by change
  const row = e.target.closest(".dup-file");
  if (!row) return;
  const cb = row.querySelector('input[data-act="pick"]');
  if (cb) {
    cb.checked = !cb.checked;
    const g = dupById.get(Number(row.dataset.gid));
    const f = g && g.files.find((x) => x.path === row.dataset.path);
    if (f) {
      setDupOverride(f, cb.checked);
      paintDupRow(row, cb.checked);
      renderDupActions();
    }
  }
});

$("dupes-list").addEventListener("change", (e) => {
  const cb = e.target.closest('input[data-act="pick"]');
  if (!cb) return;
  const row = cb.closest(".dup-file");
  const g = dupById.get(Number(row.dataset.gid));
  const f = g && g.files.find((x) => x.path === row.dataset.path);
  if (f) {
    setDupOverride(f, cb.checked);
    paintDupRow(row, cb.checked);
    renderDupActions();
  }
});

$("dupes-list").addEventListener("dblclick", (e) => {
  const row = e.target.closest(".dup-file");
  if (row) actionInfo(row.dataset.path, 0, 0);
});

$("dupes-all").onclick = () => {
  // Default selection: every copy except one keeper per group (clear overrides).
  dupSel.overrides.clear();
  dupGroups.forEach(updateGroupDom);
  renderDupActions();
};

$("dupes-none").onclick = () => {
  for (const g of dupGroups) for (const f of g.files) setDupOverride(f, false);
  dupGroups.forEach(updateGroupDom);
  renderDupActions();
};

$("dupes-more").onclick = () => loadDupes(false);
$("dupes-cancel").onclick = () => {
  invoke("scan_cancel")
    .then(() => dupStatus("Cancelling — finishing current file…"))
    .catch((e) => dupStatus(`cancel: ${e}`));
};
$("dupes-trash").onclick = () => runDupPurge(false);
$("dupes-perm").onclick = () => runDupPurge(true);
$("dupes-keep").onchange = () => {
  dupSel.keep = $("dupes-keep").value;
  if (dupAgg.groups > 0 || dupGroups.length) loadDupes(true);
};

document.querySelectorAll(".modal .modal-x").forEach((b) => (b.onclick = closeModals));
$("modal-info").querySelector('[data-action="open"]').onclick = () =>
  actionOpen($("modal-info").dataset.path);
$("modal-info").querySelector('[data-action="trash"]').onclick = () =>
  actionTrash($("modal-info").dataset.path);
$("modal-info").querySelector('[data-action="delete"]').onclick = () =>
  actionDelete($("modal-info").dataset.path);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModals();
});

/* ---------- explorer controls ---------- */

$("start").onclick = async () => {
  const path = $("path").value.trim();
  if (!path) {
    setStatus("Pick a drive or type a folder first.");
    return;
  }
  runKind = "scan";
  setUi();
  $("bar").style.width = "0%";
  filesList.reset(0);
  setStatus(`Scanning ${path}…`);
  try {
    await invoke("scan_start", {
      path,
      mode: $("mode").value,
      threads: navigator.hardwareConcurrency || 8,
    });
  } catch (e) {
    runKind = null;
    setUi();
    setStatus(`error: ${e}`);
  }
};

$("cancel").onclick = () => {
  invoke("scan_cancel")
    .then(() => setStatus("Cancelling — finishing current folder…"))
    .catch((e) => setStatus(`cancel: ${e}`));
};

/* ---------- tabs ---------- */

const tabButtons = Array.from(document.querySelectorAll(".tab"));

function activatePage(name) {
  tabButtons.forEach((t) => {
    const on = t.dataset.page === name;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });
  document.querySelectorAll(".page").forEach((p) => {
    p.classList.toggle("active", p.id === `page-${name}`);
  });
  // A hidden list has no height, so re-render whichever one just appeared.
  if (name === "explorer") filesList.render();
  if (name === "clean") junkList.render();
}

tabButtons.forEach((t) => {
  t.addEventListener("click", () => activatePage(t.dataset.page));
  t.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const i = tabButtons.indexOf(t);
    const next = tabButtons[(i + (e.key === "ArrowRight" ? 1 : tabButtons.length - 1)) % tabButtons.length];
    next.focus();
    activatePage(next.dataset.page);
  });
});

/* ---------- backend events ---------- */

listen("scan-progress", (ev) => {
  const p = ev.payload;
  if (p.kind === "clean") {
    if (runKind !== "clean") return;
    $("c-scanned").textContent = p.files.toLocaleString();
    $("c-elapsed").textContent = `${(p.elapsed_ms / 1000).toFixed(2)} s`;
    cleanStatus(
      `scanning… ${p.files.toLocaleString()} files, ${p.dirs.toLocaleString()} folders`
    );
  } else if (p.kind === "dupes") {
    if (runKind !== "dupes") return;
    $("d-scanned").textContent = p.files.toLocaleString();
    $("d-elapsed").textContent = `${(p.elapsed_ms / 1000).toFixed(2)} s`;
    dupStatus(
      p.phase === "hash"
        ? `checking duplicates… ${p.files.toLocaleString()} files read`
        : `scanning… ${p.files.toLocaleString()} files, ${p.dirs.toLocaleString()} folders`
    );
  } else {
    if (runKind !== "scan") return;
    renderScanStats(p, false);
    setStatus(
      `scanning… ${p.files.toLocaleString()} files, ${p.dirs.toLocaleString()} folders`
    );
  }
}).catch((e) => setStatus(`listen progress failed: ${e}`));

listen("scan-done", async (ev) => {
  const p = ev.payload;
  const secs = (p.elapsed_ms / 1000).toFixed(2);

  if (p.kind === "dupes") {
    runKind = null;
    setUi();
    $("dupes-bar").style.width = "100%";
    if (p.error) {
      dupStatus(`error: ${p.error}`);
      return;
    }
    $("d-scanned").textContent = p.files.toLocaleString();
    $("d-elapsed").textContent = `${secs} s`;
    await loadDupes(true);
    dupStatus(
      p.cancelled
        ? `Cancelled after ${secs} s — ${p.dup_groups.toLocaleString()} duplicate groups found.`
        : p.dup_groups === 0
        ? `No duplicates on ${dupPath} at this size floor — scanned ${p.files.toLocaleString()} files in ${secs} s.`
        : `Found ${p.dup_groups.toLocaleString()} duplicate groups — ${human(
            p.dup_wasted
          )} reclaimable across ${p.dup_files.toLocaleString()} copies. Scanned ${p.files.toLocaleString()} files in ${secs} s.`
    );
  } else if (p.kind === "clean") {
    runKind = null;
    setUi();
    $("clean-bar").style.width = "100%";
    if (p.error) {
      cleanStatus(`error: ${p.error}`);
      junkList.reset(0);
      return;
    }
    cleanAgg.safeFiles = p.junk_safe_files;
    cleanAgg.safeBytes = p.junk_safe_bytes;
    cleanAgg.optFiles = p.junk_optional_files;
    cleanAgg.optBytes = p.junk_optional_bytes;
    cleanSel.mode = "safe";
    cleanSel.overrides.clear();
    renderCleanStats(p);
    renderCleanSummary();
    junkList.reset(p.total_listed);
    await junkList.refreshMax();
    junkList.render();
    cleanStatus(
      p.cancelled
        ? `Cancelled after ${secs} s — ${p.junk_files.toLocaleString()} junk files found.`
        : p.junk_files === 0
        ? `Nothing to clean on ${cleanPath} — scanned ${p.files.toLocaleString()} files in ${secs} s.`
        : `Found ${p.junk_files.toLocaleString()} files to remove — ${human(
            p.junk_bytes
          )} reclaimable (${p.junk_safe_files.toLocaleString()} safe · ${p.junk_optional_files.toLocaleString()} optional). Scanned ${p.files.toLocaleString()} files in ${secs} s.`
    );
  } else {
    runKind = null;
    setUi();
    renderScanStats(p, p.cancelled);
    $("bar").style.width = "100%";
    if (p.error) {
      setStatus(`error: ${p.error}`);
      filesList.reset(0);
      return;
    }
    filesList.reset(p.total_listed);
    setStatus(
      p.cancelled
        ? `Cancelled after ${secs} s — ${p.files.toLocaleString()} files found.`
        : `Done in ${secs} s — ${p.files.toLocaleString()} files, ${human(p.bytes)}.`
    );
    await filesList.refreshMax();
    filesList.render();
  }
  refreshVolumes();
}).catch((e) => setStatus(`listen done failed: ${e}`));

/* ---------- init ---------- */

refreshVolumes();
setUi();
filesList.reset(0);
junkList.reset(0);
renderCleanSummary();
$("file-count").textContent = "";
