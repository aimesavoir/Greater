const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

const $ = (id) => document.getElementById(id);

/* ---------- formatting helpers ---------- */

function human(bytes) {
  const units = ["B", "KB", "MB", "GB", "TB"];
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

/* ---------- theme ---------- */

const THEME_KEY = "greater.theme";
const ONBOARD_KEY = "greater.onboarded";
const THEME_MEDIA = window.matchMedia("(prefers-color-scheme: dark)");

function themePref() {
  const v = localStorage.getItem(THEME_KEY);
  return v === "light" || v === "system" ? v : "dark";
}

function applyTheme(pref = themePref()) {
  const dark = pref === "system" ? THEME_MEDIA.matches : pref === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelectorAll(".seg-btn[data-theme]").forEach((b) => {
    const on = b.dataset.theme === pref;
    b.classList.toggle("on", on);
    b.setAttribute("aria-checked", on ? "true" : "false");
  });
}

function setTheme(pref) {
  localStorage.setItem(THEME_KEY, pref);
  applyTheme(pref);
}

THEME_MEDIA.addEventListener("change", () => {
  if (themePref() === "system") applyTheme("system");
});

applyTheme();

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
let dupPath = ""
let statsPath = "";

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
  $("groupby").disabled = busy;
  $("clean-cancel").hidden = runKind !== "clean";
  $("clean-cancel").disabled = runKind !== "clean";
  $("clean-controls-msg").textContent =
    runKind === "clean"
      ? t("clean.controlsBusy", { path: cleanPath })
      : t("clean.controls");
  $("stats-cancel").hidden = runKind !== "stats";
  $("stats-cancel").disabled = runKind !== "stats";
  $("stats-controls-msg").textContent =
    runKind === "stats"
      ? t("stats.controlsBusy", { path: statsPath })
      : t("stats.controls");
  $("dupes-cancel").hidden = runKind !== "dupes";
  $("dupes-cancel").disabled = runKind !== "dupes";
  $("dupes-minsize").disabled = busy;
  $("dupes-keep").disabled = busy;
  $("dupes-controls-msg").textContent =
    runKind === "dupes"
      ? t("dupes.controlsBusy", { path: dupPath })
      : t("dupes.controls");
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
  document.querySelectorAll("#stats-volumes .drive-card").forEach((c) => {
    const on = c.classList.contains("active") && runKind === "stats";
    c.classList.toggle("cleaning", on);
    const ov = c.querySelector(".drive-overlay-btn");
    if (ov)
      ov.innerHTML = on
        ? '<span class="spin spin-lg"></span><span class="sr-only">Analyzing</span>'
        : STATS_IMG;
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
  $("stats-bar").classList.toggle("indeterminate", runKind === "stats");
  renderCleanActions();
  renderDupActions();
}

/* ---------- statistics readouts ---------- */

function renderScanStats(p, cancelled) {
  const elapsed = p.elapsed_ms / 1000;
  $("s-elapsed").textContent = `${elapsed.toFixed(2)} s${cancelled ? t("status.cancelledTag") : ""}`;
  $("s-files").textContent = p.files.toLocaleString();
  $("s-dirs").textContent = p.dirs.toLocaleString();
  $("s-bytes").textContent = human(p.bytes);
  $("s-rate").textContent = humanRate((p.files + p.dirs) / Math.max(elapsed, 0.001));
  const skip = p.denied + p.not_found + p.errors + p.reparse_skipped;
  $("s-skip").textContent = skip === 0 ? t("stat.none") : `${skip}`;
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
  '<img class="clean-img" src="duplicates.png" alt="Find duplicates" draggable="false" />';

const STATS_IMG =
  '<img class="clean-img" src="statistics.png" alt="Analyze" draggable="false" />';

/**
 * One scrollable, windowed list backed by a paged Tauri command.
 * Only the rows inside the viewport exist in the DOM.
 */
function createList({ viewportId, canvasId, windowId, countId, fetchPage, rowHtml, emptyText, countLabel: countLabelFn }) {
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
    if (countLabelFn) {
      const custom = countLabelFn(listTotal, totalRows);
      if (custom != null) return custom;
    }
    if (listTotal > totalRows) {
      return t("list.filesLargestOf", {
        shown: totalRows.toLocaleString(),
        total: listTotal.toLocaleString(),
      });
    }
    return t("list.filesLargest", { n: listTotal.toLocaleString() });
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
    `<span class="row-actions">` +
    `<button class="icon-btn" data-act="info" title="${t("row.moreInfo")}" aria-label="${t("row.moreInfo")}">${ICONS.info}</button>` +
    `<button class="icon-btn" data-act="open" title="${t("row.openLocation")}" aria-label="${t("row.openLocation")}">${ICONS.open}</button>` +
    `<button class="icon-btn" data-act="trash" title="${t("row.trash")}" aria-label="${t("row.trash")}">${ICONS.trash}</button>` +
    `<button class="icon-btn danger" data-act="delete" title="${t("row.delete")}" aria-label="${t("row.delete")}">${ICONS.del}</button>` +
    `</div></div>`
  );
}

// The Explorer list shows individual files or rolled-up folders; the paged
// backend command it calls is chosen at fetch time.
let explorerMode = "files"; // "files" | "folders"

const filesList = createList({
  viewportId: "list-viewport",
  canvasId: "list-canvas",
  windowId: "list-window",
  countId: "file-count",
  fetchPage: (offset, limit) =>
    explorerMode === "folders"
      ? invoke("get_folders", { offset, limit })
      : invoke("get_files", { offset, limit }),
  rowHtml: (entry, maxSize) =>
    explorerMode === "folders" ? folderRowHtml(entry, maxSize) : fileRowHtml(entry, maxSize),
  emptyText: () =>
    explorerMode === "folders" ? t("explorer.emptyFolders") : t("explorer.emptyFiles"),
  countLabel: (total, shown) =>
    explorerMode !== "folders"
      ? null
      : shown < total
      ? t("list.foldersLargestOf", { shown: shown.toLocaleString(), total: total.toLocaleString() })
      : t("list.foldersLargest", { n: total.toLocaleString() }),
});

// Same row shape as a file, but the entry is a folder: recursive size, the
// number of files inside it, and only an "open location" action.
function folderRowHtml(entry, maxSize) {
  const path = escapeHtml(entry.path);
  const name = baseName(entry.path) || entry.path;
  const parent = name === entry.path ? "" : dirName(entry.path);
  const pct = maxSize > 0 ? (entry.size / maxSize) * 100 : 0;
  return (
    `<div class="list-row folder-row" data-path="${path}" data-size="${entry.size}">` +
    `<div class="row-fill" style="width:${Math.max(pct, 0.15).toFixed(3)}%;--fill-edge:${fillColor(pct)}"></div>` +
    `<div class="row-inner">` +
    `<div class="row-main">` +
    `<span class="row-name" title="${path}">${escapeHtml(name)}</span>` +
    `<span class="row-path" title="${path}">${escapeHtml(parent)}</span>` +
    `</div>` +
    `<span class="row-size">${human(entry.size)}</span>` +
    `<span class="row-count">${entry.files.toLocaleString()}</span>` +
    `<span class="row-actions">` +
    `<button class="icon-btn" data-act="open" title="${t("row.openLocation")}" aria-label="${t("row.openLocation")}">${ICONS.open}</button>` +
    `</span></div>`
  );
}

// Re-page the Explorer list for the current mode without running a new scan.
async function refreshExplorerList() {
  try {
    const p =
      explorerMode === "folders"
        ? await invoke("get_folders", { offset: 0, limit: 1 })
        : await invoke("get_files", { offset: 0, limit: 1 });
    filesList.reset(p.total);
    await filesList.refreshMax();
    filesList.render();
  } catch (e) {
    setStatus(t("status.error", { e }));
  }
}

// Live-fill the Explorer while a scan runs: the backend streams the largest
// files found so far, so we re-page the list on a throttled timer (~2.5/s)
// instead of leaving it empty until the scan finishes. Skipped when the
// Explorer tab is hidden or a re-page is already in flight.
let streamAt = 0;
let streamBusy = false;
async function streamExplorer() {
  const now = performance.now();
  if (streamBusy || now - streamAt < 400) return;
  if (!$("page-explorer").classList.contains("active")) return;
  streamBusy = true;
  streamAt = now;
  try {
    const p =
      explorerMode === "folders"
        ? await invoke("get_folders", { offset: 0, limit: 1 })
        : await invoke("get_files", { offset: 0, limit: 1 });
    if (runKind !== "scan") return;
    filesList.reset(p.total);
    await filesList.refreshMax();
    filesList.render();
  } catch {
    /* keep whatever is on screen */
  } finally {
    streamBusy = false;
  }
}

// Live Clean streaming: while the backend walk classifies junk, re-page the
// junk list so rows appear as they are found. Throttled to ~600 ms to match
// the backend's classification ticker; skipped when the page is hidden.
let cleanStreamAt = 0;
let cleanStreamBusy = false;
async function streamClean() {
  const now = performance.now();
  if (cleanStreamBusy || now - cleanStreamAt < 500) return;
  if (!$("page-clean").classList.contains("active")) return;
  cleanStreamBusy = true;
  cleanStreamAt = now;
  try {
    const probe = await invoke("get_junk", { offset: 0, limit: 1, category: null });
    if (runKind !== "clean") return;
    $("c-files").textContent = (cleanAgg.safeFiles + cleanAgg.optFiles).toLocaleString();
    $("c-bytes").textContent = human(Math.max(cleanAgg.safeBytes + cleanAgg.optBytes, 0));
    if (probe.total !== junkList.total) {
      junkList.reset(probe.total, true);
    } else {
      junkList.render();
    }
  } catch {
    /* keep whatever is on screen */
  } finally {
    cleanStreamBusy = false;
  }
}

function setExplorerMode(mode) {
  if (mode === explorerMode) return;
  explorerMode = mode;
  const folder = mode === "folders";
  $("explorer-title").textContent = folder ? t("explorer.allFolders") : t("explorer.allFiles");
  document.querySelector("#page-explorer .list-head").classList.toggle("with-count", folder);
  document.querySelector("#page-explorer .col-count").hidden = !folder;
  if (runKind !== "scan") refreshExplorerList();
}

$("groupby").onchange = () => setExplorerMode($("groupby").value);

/* ---------- clean list ---------- */

let junkEmptyNoMatch = false;

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

function junkLabel(entry) {
  const key = "junk." + entry.rule;
  const s = t(key);
  return s === key ? entry.label : s;
}

function junkWhy(entry) {
  const key = "junk.why." + entry.rule;
  const s = t(key);
  return s === key ? JUNK_WHY[entry.rule] || entry.label : s;
}

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
      junkWhy(entry)
    )}">${escapeHtml(junkLabel(entry))}</span>` +
    `<span class="row-size">${human(entry.size)}</span>` +
    `<span class="row-actions">` +
    `<button class="icon-btn" data-act="info" title="${t("row.moreInfo")}" aria-label="${t("row.moreInfo")}">${ICONS.info}</button>` +
    `<button class="icon-btn" data-act="open" title="${t("row.openLocation")}" aria-label="${t("row.openLocation")}">${ICONS.open}</button>` +
    `</span></div>`
  );
}

const junkList = createList({
  viewportId: "clean-viewport",
  canvasId: "clean-canvas",
  windowId: "clean-window",
  fetchPage: (offset, limit) =>
    invoke("get_junk", { offset, limit, category: cleanFilter === "all" ? null : cleanFilter }).then((p) => {
      // The page response also carries whole-list category totals; harvesting
      // them here keeps the summary/chips live while the walk streams junk in.
      cleanAgg.safeFiles = p.safe_files;
      cleanAgg.safeBytes = p.safe_bytes;
      cleanAgg.optFiles = p.optional_files;
      cleanAgg.optBytes = p.optional_bytes;
      renderCleanSummary();
      // Keep the whole page — `createList` picks `.entries` off it. Returning
      // just the array here would break that (`array.entries` is a method).
      return p;
    }),
  rowHtml: junkRowHtml,
  emptyText: () => t(junkEmptyNoMatch ? "clean.emptyNoMatch" : "clean.emptyDefault"),
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
  $("clean-filter-all").textContent = `${t("clean.all")} ${total.toLocaleString()}`;
  $("clean-filter-safe").textContent = `${t("clean.safe")} ${cleanAgg.safeFiles.toLocaleString()}`;
  $("clean-filter-optional").textContent = `${t("clean.optional")} ${cleanAgg.optFiles.toLocaleString()}`;
}

function renderCleanActions() {
  const { count, bytes } = selectedTotals();
  const size = Math.max(bytes, 0);
  const total = cleanAgg.safeFiles + cleanAgg.optFiles;
  $("c-selected").textContent =
    count === 0
      ? t("clean.selectedNone")
      : t("clean.selected", { count: count.toLocaleString(), size: human(size) });
  const zero = count === 0 || purging || runKind === "clean";
  $("clean-trash").disabled = zero;
  $("clean-perm").disabled = zero;
  $("clean-none").disabled = runKind === "clean";
  $("clean-all-btn").disabled = runKind === "clean";
  $("clean-hint").textContent =
    total === 0
      ? t("clean.hintNothing")
      : count === 0
      ? t("clean.hintNone", { total: total.toLocaleString() })
      : t("clean.hintSome", {
          count: count.toLocaleString(),
          total: total.toLocaleString(),
          size: human(size),
        });
}

function renderCleanSummary() {
  renderChipCounts();
  renderCleanActions();
}

/* ---------- drive cards ---------- */

// Which drive the user picked on each page's card grid, kept across
// refreshVolumes() rebuilding the cards after every scan.
const gridSel = {};

function markSelected(box, card) {
  gridSel[box.id] = card ? card.dataset.letter || "" : "";
  box
    .querySelectorAll(".drive-card")
    .forEach((c) => c.classList.toggle("selected", c === card));
}

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
    btn.classList.toggle("selected", (gridSel[box.id] || "") === v.letter);
    btn.title = t("drive.tooltip", {
      letter: v.letter,
      used: human(used),
      free: human(v.free),
      total: human(v.total),
    });
    btn.innerHTML =
      donut(pct) +
      `<span class="drive-body">` +
      `<span class="drive-top"><span class="drive-letter">${v.letter}:</span>` +
      `<span class="drive-label">${escapeHtml(v.label || v.kind)}</span>` +
      `<span class="drive-fs">${escapeHtml(v.fs || "—")}</span></span>` +
      `<span class="drive-line"><span>${t("drive.used")} <b>${human(used)}</b></span><span>${t(
        "drive.free"
      )} <b>${human(v.free)}</b></span></span>` +
      `<span class="drive-line"><span>${t("drive.total")} ${human(v.total)}</span><span>${
        v.kind === "fixed" ? t("drive.internal") : v.kind
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
      markSelected(box, btn);
    };
    box.appendChild(btn);
  }
  if (!box.children.length) {
    const off = document.createElement("button");
    off.className = "drive-card offline";
    off.type = "button";
    off.textContent = t("drive.noDrives");
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
    fillDriveCards($("stats-volumes"), vols, {
      overlayHtml: STATS_IMG,
      onPick: (v, box, card) => startStats(`${v.letter}:\\`, box, card),
    });
    fillDriveCards($("dupes-volumes"), vols, {
      overlayHtml: DUP_IMG,
      onPick: (v, box, card) => startDupes(`${v.letter}:\\`, box, card),
    });
  } catch (e) {
    setStatus(t("status.volumeFail", { e }));
  }
}

/* ---------- file actions ---------- */

async function actionInfo(path, size, maxSize) {
  try {
    const info = await invoke("file_info", { path });
    const pct = maxSize > 0 ? ((info.size / maxSize) * 100).toFixed(2) : "—";
    const fmt = (v) => (v ? new Date(v).toLocaleString(curLang()) : "—");
    $("info-title").textContent = t("modal.info.title");
    $("info-body").innerHTML =
      `<div class="file-name">${escapeHtml(info.name)}</div>` +
      `<div class="file-path">${escapeHtml(info.path)}</div>` +
      `<dl class="info-grid">` +
      `<dt>${t("info.size")}</dt><dd>${human(info.size)} (${t("info.bytes", {
        n: info.size.toLocaleString(),
      })})</dd>` +
      `<dt>${t("info.pctLargest")}</dt><dd>${pct}%</dd>` +
      `<dt>${t("info.extension")}</dt><dd>${escapeHtml(info.extension || "—")}</dd>` +
      `<dt>${t("info.folder")}</dt><dd>${escapeHtml(info.parent)}</dd>` +
      `<dt>${t("info.modified")}</dt><dd>${fmt(info.modified_ms)}</dd>` +
      `<dt>${t("info.created")}</dt><dd>${fmt(info.created_ms)}</dd>` +
      `<dt>${t("info.accessed")}</dt><dd>${fmt(info.accessed_ms)}</dd>` +
      `</dl>` +
      `<div class="info-tags">` +
      `<span class="tag ${info.readonly ? "on" : ""}">${t("info.readonly")}</span>` +
      `<span class="tag ${info.hidden ? "on" : ""}">${t("info.hidden")}</span>` +
      `<span class="tag ${info.system ? "on" : ""}">${t("info.system")}</span>` +
      `<span class="tag ${info.archive ? "on" : ""}">${t("info.archive")}</span>` +
      `<span class="tag ${info.reparse ? "on" : ""}">${t("info.reparse")}</span>` +
      `</div>`;
    $("modal-info").dataset.path = path;
    $("modal-info").dataset.size = String(size);
    $("modal-info").hidden = false;
  } catch (e) {
    toast(t("toast.infoFail", { e }), "err");
  }
}

function closeModals() {
  $("modal-info").hidden = true;
  $("modal-confirm").hidden = true;
  $("modal-help").hidden = true;
  $("modal-settings").hidden = true;
  $("modal-about").hidden = true;
  // The deleting modal is only closed when a purge finishes, never by a stray
  // backdrop/Escape close.
}

/* ---------- live delete-progress modal ---------- */

// Open the progress dialog before a bulk purge. It stays up (not dismissable
// except via its own Cancel) until finishDelete() is called, so the user always
// sees what is happening. `deletingStopping` guards against double-cancel.
let deletingFreed = 0;
let deletingStopping = false;

function openDeleting(total) {
  deletingFreed = 0;
  deletingStopping = false;
  $("deleting-title").textContent = t("deleting.title");
  $("deleting-title").dataset.done = "";
  $("deleting-deleted").textContent = "0";
  $("deleting-total").textContent = total.toLocaleString();
  $("deleting-freed").textContent = "";
  $("deleting-current").textContent = "";
  $("deleting-failed").hidden = true;
  $("deleting-bar").style.width = "0%";
  $("deleting-cancel").hidden = false;
  $("deleting-cancel").disabled = false;
  $("deleting-cancel").textContent = t("btn.cancel");
  $("deleting-close").hidden = true;
  $("modal-deleting").hidden = false;
}

// Update it from a `delete-progress` event.
function updateDeleting(p) {
  $("deleting-deleted").textContent = p.deleted.toLocaleString();
  $("deleting-total").textContent = p.total.toLocaleString();
  const pct = p.total > 0 ? Math.min(100, (p.processed / p.total) * 100) : 100;
  $("deleting-bar").style.width = `${pct.toFixed(1)}%`;
  if (p.freed != null) {
    deletingFreed = p.freed;
    $("deleting-freed").textContent = t("deleting.freed", { size: human(p.freed) });
  }
  const name = p.last ? baseName(p.last) : "";
  $("deleting-current").textContent = name ? t("deleting.current", { name }) : "";
  if (p.failed > 0) {
    $("deleting-failed").textContent = t("deleting.failed", { n: p.failed.toLocaleString() });
    $("deleting-failed").hidden = false;
  }
}

// Mark the purge complete: full bar, a summary line, and a Close button.
function finishDeleting(deleted, permanent, cancelled) {
  $("deleting-bar").style.width = "100%";
  $("deleting-title").textContent = cancelled ? t("deleting.titleCancelled") : t("deleting.titleDone");
  $("deleting-freed").textContent = t("deleting.freed", { size: human(deletingFreed) });
  $("deleting-current").textContent = permanent
    ? t("deleting.donePerm", { n: deleted.toLocaleString() })
    : t("deleting.doneTrash", { n: deleted.toLocaleString() });
  $("deleting-cancel").hidden = true;
  $("deleting-close").hidden = false;
  $("deleting-close").focus();
}

function closeDeleting() {
  $("modal-deleting").hidden = true;
}

// Cancel button: ask the backend to stop, then disable the button so a second
// click can't spam the command. The modal stays up until the invoke returns.
async function cancelDeleting() {
  if (deletingStopping) return;
  deletingStopping = true;
  $("deleting-cancel").disabled = true;
  $("deleting-cancel").textContent = t("deleting.stopping");
  try {
    await invoke("delete_cancel");
  } catch (e) {
    // ignore — the purge may already be done
  }
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
    t("confirm.trashTitle"),
    t("confirm.trashBody", { name }),
    t("row.trash")
  );
  if (!ok) return;
  setStatus(t("status.deleting", { name }));
  try {
    await invoke("move_to_trash", { path });
    dropRows([path]);
    toast(t("toast.moved", { name }), "ok");
    setStatus(t("status.moved", { path }));
  } catch (e) {
    toast(t("toast.trashFail", { e }), "err");
    setStatus(t("status.error", { e }));
  }
}

async function actionDelete(path) {
  const name = baseName(path);
  const ok = await confirmDialog(
    t("confirm.deleteTitle"),
    t("confirm.deleteBody", { name }),
    t("btn.deletePerm")
  );
  if (!ok) return;
  setStatus(t("status.deleting", { name }));
  try {
    await invoke("delete_permanent", { path });
    dropRows([path]);
    toast(t("toast.deleted", { name }), "ok");
    setStatus(t("status.deleted", { path }));
  } catch (e) {
    toast(t("toast.deleteFail", { e }), "err");
    setStatus(t("status.error", { e }));
  }
}

async function actionOpen(path) {
  try {
    await invoke("open_location", { path });
    toast(t("toast.opened", { name: baseName(path) }), "ok");
  } catch (e) {
    toast(t("toast.openFail", { e }), "err");
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
  if (!row) return;
  if (row.classList.contains("folder-row")) actionOpen(row.dataset.path);
  else actionInfo(row.dataset.path, Number(row.dataset.size || 0), filesList.max);
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
    cleanStatus(t("status.error", { e }));
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
  const countLabel = `${count.toLocaleString()} ${
    count === 1 ? t("unit.file") : t("unit.files")
  }`;
  const ok = await confirmDialog(
    permanent ? t("confirm.deleteTitle") : t("confirm.trashTitle"),
    t("confirm.cleanBody", {
      count: countLabel,
      size: human(Math.max(bytes, 0)),
      note: permanent ? t("confirm.permNote") : t("confirm.cleanTrashNote"),
    }),
    permanent ? t("btn.deletePerm") : t("row.trash")
  );
  if (!ok) return;

  purging = true;
  renderCleanActions();
  const invert = Array.from(cleanSel.overrides, ([path, o]) => ({ path, on: o.on }));
  cleanStatus(t("clean.deleting", { done: 0, total: count.toLocaleString() }));
  openDeleting(count);
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
    const verb = permanent ? t("clean.deleted") : t("clean.trashed");
    const failedNote = res.failed.length
      ? t("clean.failedNote", { n: res.failed.length })
      : "";
    cleanStatus(
      t("clean.result", {
        verb,
        deleted: res.deleted.toLocaleString(),
        size: human(Math.max(bytes, 0)),
        failed: failedNote,
      })
    );
    toast(t("toast.purged", { verb: verb.toLowerCase(), n: res.deleted.toLocaleString() }), res.failed.length ? "warn" : "ok");
    finishDeleting(res.deleted, permanent, res.cancelled);
    refreshVolumes();
  } catch (e) {
    closeDeleting();
    cleanStatus(t("status.error", { e }));
    toast(t("toast.cleanFail", { e }), "err");
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
    if (card) markSelected(box, card);
  }
  runKind = "clean";
  setUi();
  junkEmptyNoMatch = true;
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
  cleanStatus(t("clean.scanning", { path }));
  try {
    await invoke("clean_start", {
      path,
      mode: $("mode").value,
      threads: navigator.hardwareConcurrency || 8,
    });
  } catch (e) {
    runKind = null;
    setUi();
    cleanStatus(t("status.error", { e }));
  }
}

$("clean-cancel").onclick = () => {
  invoke("scan_cancel")
    .then(() => cleanStatus(t("status.cancelling")))
    .catch((e) => cleanStatus(t("status.cancel", { e })));
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
  return ms ? new Date(ms).toLocaleDateString(curLang()) : "—";
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
    `<input type="checkbox" class="row-check" data-act="pick" ${del ? "checked" : ""} title="${t("dupes.pickTitle")}" />` +
    `<button type="button" class="dup-star" data-act="keep" title="${t("dupes.starTitle")}" aria-label="${t("dupes.starTitle")}">★</button>` +
    `<span class="dup-path" title="${escapeHtml(f.path)}">${escapeHtml(f.path)}</span>` +
    `<span class="dup-when">${fmtDate(f.mtime_ms)}</span>` +
    `<span class="dup-tag">${del ? t("dupes.tagDelete") : t("dupes.tagKeep")}</span>` +
    `</div>`
  );
}

function dupGroupHtml(g) {
  const wasted = g.size * (g.files.length - 1);
  return (
    `<div class="dup-group" data-gid="${g.id}">` +
    `<div class="dup-head">` +
    `<span class="dup-name" title="${escapeHtml(g.files[0].path)}">${escapeHtml(g.name)}</span>` +
    `<span class="dup-meta">${t("dupes.groupMeta", {
      n: g.files.length,
      size: human(g.size),
      wasted: human(wasted),
    })}</span>` +
    `</div>` +
    `<div class="dup-files">${g.files.map((f) => dupFileHtml(g, f)).join("")}</div>` +
    `</div>`
  );
}

function paintDupRow(row, del) {
  row.classList.toggle("del", del);
  row.classList.toggle("keep", !del);
  const tag = row.querySelector(".dup-tag");
  if (tag) tag.textContent = del ? t("dupes.tagDelete") : t("dupes.tagKeep");
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
  $("d-selected").textContent =
    count === 0
      ? t("clean.selectedNone")
      : t("clean.selected", { count: count.toLocaleString(), size: human(bytes) });
  const zero = count === 0 || dupPurging || busy;
  $("dupes-trash").disabled = zero;
  $("dupes-perm").disabled = zero;
  $("dupes-none").disabled = dupGroups.length === 0 || busy;
  $("dupes-all").disabled = dupGroups.length === 0 || busy;
  $("dupes-more").hidden = dupGroups.length >= dupTotal;
  const total = dupAgg.files;
  $("dupes-hint").textContent =
    total === 0
      ? t("dupes.hintEmpty")
      : count === 0
      ? t("dupes.hintNone", { groups: dupAgg.groups.toLocaleString() })
      : t("dupes.hintSome", {
          count: count.toLocaleString(),
          total: total.toLocaleString(),
          size: human(bytes),
        });
}

function renderDupSummary() {
  $("dupes-summary").textContent =
    dupAgg.groups === 0
      ? ""
      : t("dupes.summary", {
          groups: dupAgg.groups.toLocaleString(),
          files: dupAgg.files.toLocaleString(),
          wasted: human(dupAgg.wasted),
        });
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
    dupStatus(t("status.error", { e }));
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
    list.innerHTML = `<div class="list-empty">${t("dupes.emptyList")}</div>`;
  renderDupSummary();
  renderDupActions();
}

// Live-remove copies reported by `delete-progress` from the visible groups so
// the Duplicates list shrinks while the purge runs. Groups that fall below two
// copies are dropped (they are no longer duplicates).
function applyDupRemoved(paths) {
  if (!paths || !paths.length) return;
  const gone = new Set(paths);
  let changed = false;
  for (const g of dupGroups) {
    const before = g.files.length;
    g.files = g.files.filter((f) => !gone.has(f.path));
    if (g.files.length !== before) changed = true;
  }
  const kept = dupGroups.filter((g) => g.files.length >= 2);
  if (kept.length !== dupGroups.length) {
    changed = true;
    dupGroups = kept;
    dupById.clear();
    for (const g of dupGroups) dupById.set(g.id, g);
  }
  if (!changed) return;
  const list = $("dupes-list");
  list.innerHTML = "";
  if (dupGroups.length) list.innerHTML = dupGroups.map(dupGroupHtml).join("");
  else list.innerHTML = `<div class="list-empty">${t("dupes.emptyList")}</div>`;
  renderDupActions();
}

async function startDupes(path, box, card) {
  if (runKind !== null) return;
  dupPath = path;
  if (box) {
    box.querySelectorAll(".drive-card").forEach((c) => c.classList.toggle("active", c === card));
    if (card) markSelected(box, card);
  }
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
  dupStatus(t("dupes.scanning", { path }));
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
    dupStatus(t("status.error", { e }));
  }
}

async function runDupPurge(permanent) {
  const { count, bytes } = dupSelectedTotals();
  if (count === 0 || dupPurging) return;
  const countLabel = `${count.toLocaleString()} ${
    count === 1 ? t("unit.copy") : t("unit.copies")
  }`;
  const ok = await confirmDialog(
    permanent ? t("confirm.deleteTitle") : t("confirm.trashTitle"),
    t("confirm.dupBody", {
      count: countLabel,
      size: human(bytes),
      note: permanent ? t("confirm.dupPermNote") : t("confirm.dupTrashNote"),
    }),
    permanent ? t("btn.deletePerm") : t("btn.toRecycle")
  );
  if (!ok) return;
  dupPurging = true;
  renderDupActions();
  const invert = [...dupSel.overrides].map(([path, o]) => ({ path, on: o.on }));
  dupStatus(t("clean.deleting", { done: 0, total: count.toLocaleString() }));
  openDeleting(count);
  try {
    const res = await invoke("delete_dupes", { keep: dupSel.keep, invert, permanent });
    await loadDupes(true);
    const verb = permanent ? t("clean.deleted") : t("clean.trashed");
    const failedNote = res.failed.length
      ? t("clean.failedNote", { n: res.failed.length })
      : "";
    dupStatus(
      t("dupes.result", {
        verb,
        deleted: res.deleted.toLocaleString(),
        size: human(Math.max(bytes, 0)),
        groups: res.remaining_groups.toLocaleString(),
        wasted: human(res.wasted),
        failed: failedNote,
      })
    );
    toast(t("toast.purged", { verb: verb.toLowerCase(), n: res.deleted.toLocaleString() }), res.failed.length ? "warn" : "ok");
    finishDeleting(res.deleted, permanent, res.cancelled);
    refreshVolumes();
  } catch (e) {
    closeDeleting();
    dupStatus(t("status.error", { e }));
    toast(t("toast.deleteFail", { e }), "err");
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
    .then(() => dupStatus(t("dupes.cancel")))
    .catch((e) => dupStatus(t("status.cancel", { e })));
};
$("dupes-trash").onclick = () => runDupPurge(false);
$("dupes-perm").onclick = () => runDupPurge(true);
$("dupes-keep").onchange = () => {
  dupSel.keep = $("dupes-keep").value;
  if (dupAgg.groups > 0 || dupGroups.length) loadDupes(true);
};

/* ---------- statistics page ---------- */

const STATS_COLORS = {
  Images: "#60a5fa",
  Videos: "#f472b6",
  Audio: "#fbbf24",
  Documents: "#34d399",
  Archives: "#a78bfa",
  Executables: "#f87171",
  Code: "#22d3ee",
  Other: "#9ca3af",
};

function statsColor(name) {
  return STATS_COLORS[name] || "#9ca3af";
}

function bucketName(name) {
  const key = "bucket." + name.toLowerCase();
  const s = t(key);
  return s === key ? name : s;
}
function statsStatus(msg) {
  $("stats-status").textContent = msg;
}

function resetStatsView() {
  ["t-scanned", "t-elapsed", "t-files", "t-bytes", "t-cats", "t-largest"].forEach(
    (id) => ($(id).textContent = "—")
  );
  $("stats-view-total").textContent = t("stats.subtitle");
  $("stats-bar").style.width = "0%";
  $("type-chart").hidden = true;
  $("type-chart").innerHTML = "";
  $("type-legend").hidden = true;
  $("type-legend").innerHTML = "";
}

function renderTypeStats(d) {
  const buckets = [...d.buckets].sort((a, b) => b.bytes - a.bytes);
  const totalBytes = buckets.reduce((a, b) => a + b.bytes, 0);
  const largest = buckets[0];

  $("t-scanned").textContent = `${d.letter}:\\`;
  $("t-files").textContent = d.files.toLocaleString();
  $("t-bytes").textContent = human(totalBytes);
  $("t-cats").textContent = buckets.length.toLocaleString();
  $("t-largest").textContent = largest
    ? t("stats.largest", { name: bucketName(largest.name), size: human(largest.bytes) })
    : "—";
  $("stats-view-total").textContent = largest
    ? t("stats.viewTotal", {
        pct: ((largest.bytes / Math.max(totalBytes, 1)) * 100).toFixed(1),
        name: bucketName(largest.name),
        size: human(totalBytes),
      })
    : t("stats.noFiles");

  const chart = $("type-chart");
  chart.innerHTML = "";
  chart.hidden = buckets.length === 0;
  for (const b of buckets) {
    const pct = totalBytes > 0 ? (b.bytes / totalBytes) * 100 : 0;
    const seg = document.createElement("div");
    seg.className = "type-seg";
    seg.style.width = `${pct}%`;
    seg.style.setProperty("--seg-color", statsColor(b.name));
    seg.title = t("stats.chartTitle", {
      name: bucketName(b.name),
      size: human(b.bytes),
      pct: pct.toFixed(1),
    });
    chart.appendChild(seg);
  }

  const legend = $("type-legend");
  legend.innerHTML = "";
  legend.hidden = buckets.length === 0;
  const maxBytes = largest ? largest.bytes : 0;
  const diskTotal = Number(d.total) || 0;
  for (const b of buckets) {
    const scannedPct = totalBytes > 0 ? (b.bytes / totalBytes) * 100 : 0;
    const diskPct = diskTotal > 0 ? (b.bytes / diskTotal) * 100 : scannedPct;
    const barW =
      diskTotal > 0
        ? Math.min(100, (b.bytes / diskTotal) * 100)
        : maxBytes > 0
        ? (b.bytes / maxBytes) * 100
        : 0;
    const color = statsColor(b.name);
    const row = document.createElement("div");
    row.className = "type-row";
    row.title =
      diskTotal > 0
        ? t("stats.rowTitleDisk", {
            name: bucketName(b.name),
            size: human(b.bytes),
            pct: diskPct.toFixed(2),
            disk: human(diskTotal),
          })
        : t("stats.rowTitleScanned", {
            name: bucketName(b.name),
            size: human(b.bytes),
            pct: diskPct.toFixed(2),
            scanned: human(totalBytes),
          });
    row.innerHTML =
      `<span class="type-swatch" style="background:${color}"></span>` +
      `<span class="type-name">${escapeHtml(bucketName(b.name))}</span>` +
      `<span class="type-bar-mini"><span class="type-bar-mini-inner" style="background:${color};width:${Math.max(
        barW,
        1.5
      )}%"></span></span>` +
      `<span class="type-meta">${human(b.bytes)}</span>` +
      `<span class="type-meta">${diskPct.toFixed(2)}%</span>` +
      `<span class="type-meta-small">${b.files.toLocaleString()}</span>`;
    legend.appendChild(row);
  }
  return { buckets: buckets.length, totalBytes };
}

async function loadTypeStats() {
  const d = await invoke("get_type_stats", { path: statsPath });
  return renderTypeStats(d);
}

async function startStats(path, box, card) {
  if (runKind !== null) return;
  statsPath = path;
  if (box) {
    box.querySelectorAll(".drive-card").forEach((c) => c.classList.toggle("active", c === card));
    if (card) markSelected(box, card);
  }
  runKind = "stats";
  setUi();
  resetStatsView();
  $("t-scanned").textContent = path;
  statsStatus(t("stats.analyzing", { path }));
  try {
    await invoke("stats_start", {
      path,
      mode: $("mode").value,
      threads: navigator.hardwareConcurrency || 8,
    });
  } catch (e) {
    runKind = null;
    setUi();
    statsStatus(t("status.error", { e }));
  }
}

$("stats-cancel").onclick = () => {
  invoke("scan_cancel")
    .then(() => statsStatus(t("stats.cancelling")))
    .catch((e) => statsStatus(t("status.cancel", { e })));
};

document.querySelectorAll(".modal .modal-x").forEach((b) => (b.onclick = closeModals));
$("deleting-close").onclick = closeDeleting;
$("deleting-cancel").onclick = cancelDeleting;
$("help-btn").onclick = () => {
  $("modal-help").hidden = false;
  $("modal-help").querySelector(".modal-body").scrollTop = 0;
};
$("settings-btn").onclick = () => {
  applyTheme();
  $("modal-settings").hidden = false;
};
document.querySelectorAll(".seg-btn[data-theme]").forEach((b) => {
  b.onclick = () => setTheme(b.dataset.theme);
});
$("lang-select").onchange = () => applyLang($("lang-select").value);

/* ---------- About (reachable from the help page) ---------- */

$("help-about").onclick = () => {
  $("modal-about").hidden = false;
};
// The About box sits on top of Help: closing it only hides itself. It also
// overrides the generic .modal-x binding above (assigned after it).
const closeAbout = () => {
  $("modal-about").hidden = true;
};
$("about-x").onclick = closeAbout;
$("about-close").onclick = closeAbout;

async function copyEmail() {
  const email = "baroudi.inc@gmail.com";
  try {
    await navigator.clipboard.writeText(email);
    toast(t("toast.copied"), "ok");
  } catch (e) {
    toast(`${email} — ${e}`, "warn");
  }
}
$("about-email").onclick = copyEmail;
$("about-email").onkeydown = (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    copyEmail();
  }
};

/* ---------- first run: ask for language + theme ---------- */

$("firstrun-lang").onchange = () => applyLang($("firstrun-lang").value);
$("firstrun-go").onclick = () => {
  const picked = document.querySelector("#theme-seg-onboard .seg-btn.on");
  setTheme(picked ? picked.dataset.theme : themePref());
  applyLang($("firstrun-lang").value);
  try {
    localStorage.setItem(ONBOARD_KEY, "1");
  } catch (e) {
    /* storage unavailable — the prompt simply returns next launch */
  }
  $("modal-firstrun").hidden = true;
};

function firstRun() {
  try {
    if (localStorage.getItem(ONBOARD_KEY) === "1") return false;
  } catch (e) {
    return false;
  }
  $("firstrun-lang").value = curLang();
  applyTheme();
  $("modal-firstrun").hidden = false;
  return true;
}

function onLangChange() {
  applyTheme();
  setUi();
  $("explorer-title").textContent =
    explorerMode === "folders" ? t("explorer.allFolders") : t("explorer.allFiles");
  filesList.reset(filesList.total, true);
  junkList.render();
  renderCleanSummary();
  if (dupGroups.length) $("dupes-list").innerHTML = dupGroups.map(dupGroupHtml).join("");
  renderDupSummary();
  renderDupActions();
  if (runKind === null && !$("type-legend").hidden) loadTypeStats().catch(() => {});
  refreshVolumes();
}
$("modal-info").querySelector('[data-action="open"]').onclick = () =>
  actionOpen($("modal-info").dataset.path);
$("modal-info").querySelector('[data-action="trash"]').onclick = () =>
  actionTrash($("modal-info").dataset.path);
$("modal-info").querySelector('[data-action="delete"]').onclick = () =>
  actionDelete($("modal-info").dataset.path);

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (!$("modal-firstrun").hidden) return; // make a choice first
  if (!$("modal-deleting").hidden && $("deleting-close").hidden) return; // purge running
  if (!$("modal-about").hidden) {
    $("modal-about").hidden = true;
    return;
  }
  closeModals();
});

/* ---------- explorer controls ---------- */

$("start").onclick = async () => {
  const path = $("path").value.trim();
  if (!path) {
    setStatus(t("status.pickFolder"));
    return;
  }
  runKind = "scan";
  setUi();
  $("bar").style.width = "0%";
  filesList.reset(0);
  setStatus(t("status.scanning", { path }));
  try {
    await invoke("scan_start", {
      path,
      mode: $("mode").value,
      threads: navigator.hardwareConcurrency || 8,
    });
  } catch (e) {
    runKind = null;
    setUi();
    setStatus(t("status.error", { e }));
  }
};

$("cancel").onclick = () => {
  invoke("scan_cancel")
    .then(() => setStatus(t("status.cancelling")))
    .catch((e) => setStatus(t("status.cancel", { e })));
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
      t("clean.scanningProgress", {
        files: p.files.toLocaleString(),
        folders: p.dirs.toLocaleString(),
      })
    );
    streamClean();
  } else if (p.kind === "dupes") {
    if (runKind !== "dupes") return;
    $("d-scanned").textContent = p.files.toLocaleString();
    $("d-elapsed").textContent = `${(p.elapsed_ms / 1000).toFixed(2)} s`;
    dupStatus(
      p.phase === "hash"
        ? t("dupes.hashing", { files: p.files.toLocaleString() })
        : t("dupes.scanningProgress", {
            files: p.files.toLocaleString(),
            folders: p.dirs.toLocaleString(),
          })
    );
  } else if (p.kind === "stats") {
    if (runKind !== "stats") return;
    $("t-files").textContent = p.files.toLocaleString();
    $("t-elapsed").textContent = `${(p.elapsed_ms / 1000).toFixed(2)} s`;
    statsStatus(
      t("stats.scanningProgress", {
        files: p.files.toLocaleString(),
        folders: p.dirs.toLocaleString(),
      })
    );
  } else {
    if (runKind !== "scan") return;
    renderScanStats(p, false);
    setStatus(
      t("status.scanningProgress", {
        files: p.files.toLocaleString(),
        folders: p.dirs.toLocaleString(),
      })
    );
    streamExplorer();
  }
}).catch((e) => setStatus(t("status.listenProgressFail", { e })));

listen("scan-done", async (ev) => {
  const p = ev.payload;
  const secs = (p.elapsed_ms / 1000).toFixed(2);

  if (p.kind === "dupes") {
    runKind = null;
    setUi();
    $("dupes-bar").style.width = "100%";
    if (p.error) {
      dupStatus(t("status.error", { e: p.error }));
      return;
    }
    $("d-scanned").textContent = p.files.toLocaleString();
    $("d-elapsed").textContent = `${secs} s`;
    await loadDupes(true);
    dupStatus(
      p.cancelled
        ? t("dupes.cancelled", { secs, groups: p.dup_groups.toLocaleString() })
        : p.dup_groups === 0
        ? t("dupes.none", {
            path: dupPath,
            files: p.files.toLocaleString(),
            secs,
          })
        : t("dupes.found", {
            groups: p.dup_groups.toLocaleString(),
            wasted: human(p.dup_wasted),
            copies: p.dup_files.toLocaleString(),
            files: p.files.toLocaleString(),
            secs,
          })
    );
  } else if (p.kind === "clean") {
    runKind = null;
    setUi();
    $("clean-bar").style.width = "100%";
    if (p.error) {
      cleanStatus(t("status.error", { e: p.error }));
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
        ? t("clean.cancelled", { secs, files: p.junk_files.toLocaleString() })
        : p.junk_files === 0
        ? t("clean.nothing", {
            path: cleanPath,
            files: p.files.toLocaleString(),
            secs,
          })
        : t("clean.found", {
            files: p.junk_files.toLocaleString(),
            size: human(p.junk_bytes),
            safe: p.junk_safe_files.toLocaleString(),
            optional: p.junk_optional_files.toLocaleString(),
            scanned: p.files.toLocaleString(),
            secs,
          })
    );
  } else if (p.kind === "stats") {
    runKind = null;
    setUi();
    $("stats-bar").style.width = "100%";
    if (p.error) {
      statsStatus(t("status.error", { e: p.error }));
      return;
    }
    $("t-files").textContent = p.files.toLocaleString();
    $("t-elapsed").textContent = `${secs} s`;
    let cats = 0;
    let total = 0;
    try {
      ({ buckets: cats, totalBytes: total } = await loadTypeStats());
    } catch (e) {
      statsStatus(t("status.error", { e }));
      return;
    }
    statsStatus(
      p.cancelled
        ? t("stats.cancelled", { secs, cats, size: human(total) })
        : t("stats.done", {
            files: p.files.toLocaleString(),
            path: statsPath,
            secs,
            cats,
            size: human(total),
          })
    );
  } else {
    runKind = null;
    setUi();
    renderScanStats(p, p.cancelled);
    $("bar").style.width = "100%";
    if (p.error) {
      setStatus(t("status.error", { e: p.error }));
      filesList.reset(0);
      return;
    }
    filesList.reset(p.total_listed);
    setStatus(
      p.cancelled
        ? t("status.doneCancelled", { secs, files: p.files.toLocaleString() })
        : t("status.done", { secs, files: p.files.toLocaleString(), size: human(p.bytes) })
    );
    await refreshExplorerList();
  }
  refreshVolumes();
}).catch((e) => setStatus(t("status.listenDoneFail", { e })));

listen("delete-progress", (ev) => {
  const p = ev.payload;
  updateDeleting(p);
  const msg = t("clean.deleting", {
    done: p.deleted.toLocaleString(),
    total: p.total.toLocaleString(),
  });
  if (p.kind === "dupes") {
    dupStatus(msg);
    // Drop the copies that just went away so the groups shrink live.
    applyDupRemoved(p.removed);
  } else {
    cleanStatus(msg);
    // The junk list is a virtual list backed by `get_junk`; re-page it so the
    // rows the backend just removed disappear from view. Shrink the row count
    // by the batch we just dropped so the scrollbar tracks the live total; the
    // authoritative `remaining` is applied when the purge returns.
    const gone = p.removed ? p.removed.length : 0;
    junkList.reset(Math.max(0, junkList.total - gone), true);
  }
}).catch((e) => setStatus(t("status.listenProgressFail", { e })));

/* ---------- init ---------- */

applyLang(curLang());
window.__onLangChange = onLangChange;
firstRun();
refreshVolumes();
setUi();
filesList.reset(0);
junkList.reset(0);
renderCleanSummary();
$("file-count").textContent = "";
