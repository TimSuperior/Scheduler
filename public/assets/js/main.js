// public/assets/js/main.js
// Schedule Builder (MVP+) — editor/view/embed in one file.
// Requires your HTML structure (board, .daycol[data-day], buttons/selects with IDs) and PHP endpoints.
//
// Paths assumed (root-absolute):
//   /server/api/share.php  (POST JSON => {success:true,id,url,embedUrl})
//   /server/api/load.php?id=XXXX (GET => {success:true,payload:{...}})

"use strict";

/* ----------------------------- Config ----------------------------- */

const API = {
  share: "/server/api/share.php",
  load: "/server/api/load.php",
};

const STORAGE_KEY = "sb_schedule_v2";

/** Default palette */
const DEFAULT_COLORS = [
  "#4f7cff", "#4caf50", "#ff9800", "#9c27b0", "#2196f3", "#e91e63", "#00bcd4",
];

/* ----------------------------- Helpers ----------------------------- */

function qs(sel, root = document) {
  return root.querySelector(sel);
}
function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function minToTime(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}
function timeToMin(hhmm) {
  // "08:30" => 510
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}
function safeJsonParse(str) {
  try { return JSON.parse(str); } catch { return null; }
}
function getQueryParam(name) {
  const url = new URL(location.href);
  return url.searchParams.get(name);
}
function getCssNumber(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}
function detectMode() {
  const p = (location.pathname || "").toLowerCase();
  if (p.includes("editor.html")) return "editor";
  if (p.includes("view.html") || p.includes("view.php") || p.includes("/s/")) return "view";
  if (p.includes("embed.html") || p.includes("embed.php") || p.includes("/embed/")) return "embed";
  return "editor";
}
function uid() {
  // short id for blocks (not share id)
  return "b_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function pickColor(i) {
  return DEFAULT_COLORS[i % DEFAULT_COLORS.length];
}

function toast(msg) {
  // Lightweight “toast” without extra HTML dependencies
  // Falls back to alert if DOM not ready.
  try {
    let el = qs("#sb_toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sb_toast";
      el.style.position = "fixed";
      el.style.left = "50%";
      el.style.bottom = "18px";
      el.style.transform = "translateX(-50%)";
      el.style.padding = "10px 12px";
      el.style.borderRadius = "12px";
      el.style.border = "1px solid rgba(255,255,255,.18)";
      el.style.background = "rgba(10,12,18,.92)";
      el.style.color = "rgba(255,255,255,.92)";
      el.style.zIndex = "9999";
      el.style.maxWidth = "92vw";
      el.style.boxShadow = "0 12px 30px rgba(0,0,0,.35)";
      el.style.font = "14px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
      el.style.opacity = "0";
      el.style.transition = "opacity .15s ease";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = "0"; }, 1600);
  } catch {
    alert(msg);
  }
}

/* ----------------------------- API ----------------------------- */

async function apiLoad(id) {
  const url = `${API.load}?id=${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data || data.success !== true) {
    throw new Error(data?.message || data?.error || `Load failed (${res.status})`);
  }
  return data.payload;
}

async function apiShare(payload) {
  const res = await fetch(API.share, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data || data.success !== true) {
    throw new Error(data?.message || data?.error || `Share failed (${res.status})`);
  }
  return data; // {success,id,url,embedUrl,...}
}

/* ----------------------------- State ----------------------------- */

function defaultSchedule() {
  return {
    id: "local",
    type: "weekly", // "weekly" | "daily"
    title: "My Schedule",
    settings: { startHour: 6, endHour: 24, slotMinutes: 30 },
    ui: { dailyDayIndex: 0 },
    blocks: [],
  };
}

let schedule = null;
let mode = "editor";

// derived rendering constants
function getPxPerMin() {
  const hourH = getCssNumber("--hourH", 64);
  return hourH / 60;
}

function getWindowStartMin() {
  const sh = Number(schedule?.settings?.startHour ?? 6);
  return clamp(sh, 0, 24) * 60;
}
function getWindowEndMin() {
  const eh = Number(schedule?.settings?.endHour ?? 24);
  return clamp(eh, 0, 24) * 60;
}
function getSnapMin() {
  const s = Number(schedule?.settings?.slotMinutes ?? 30);
  return clamp(s, 5, 120);
}

function saveLocal() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
  } catch {
    // ignore
  }
}
function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeJsonParse(raw) : null;
  return parsed && typeof parsed === "object" ? parsed : defaultSchedule();
}

/* ----------------------------- DOM refs ----------------------------- */

function getDayCols() {
  // map dayIndex => element
  const map = new Map();
  qsa(".daycol").forEach((col) => {
    const d = col.getAttribute("data-day");
    if (d != null) map.set(Number(d), col);
  });
  return map;
}

function ensureBoardHeight() {
  const daysEl = qs(".days");
  if (!daysEl) return;
  const start = getWindowStartMin();
  const end = getWindowEndMin();
  const pxPerMin = getPxPerMin();
  const h = Math.max(60, (end - start) * pxPerMin);
  daysEl.style.minHeight = `${h}px`;
}

/* ----------------------------- Rendering ----------------------------- */

function clearBlocks() {
  qsa(".daycol").forEach((col) => (col.innerHTML = ""));
}

function normalizeSchedule() {
  if (!schedule || typeof schedule !== "object") schedule = defaultSchedule();
  if (!schedule.settings) schedule.settings = { startHour: 6, endHour: 24, slotMinutes: 30 };
  if (!Array.isArray(schedule.blocks)) schedule.blocks = [];
  if (!schedule.ui) schedule.ui = { dailyDayIndex: 0 };

  schedule.settings.startHour = clamp(Number(schedule.settings.startHour ?? 6), 0, 24);
  schedule.settings.endHour = clamp(Number(schedule.settings.endHour ?? 24), 0, 24);
  if (schedule.settings.endHour <= schedule.settings.startHour) {
    schedule.settings.endHour = Math.min(24, schedule.settings.startHour + 1);
  }
  schedule.settings.slotMinutes = clamp(Number(schedule.settings.slotMinutes ?? 30), 5, 120);

  schedule.type = (schedule.type === "daily" ? "daily" : "weekly");
  schedule.ui.dailyDayIndex = clamp(Number(schedule.ui.dailyDayIndex ?? 0), 0, 6);
}

function render() {
  normalizeSchedule();
  ensureBoardHeight();
  clearBlocks();

  // Title (editor)
  const titleInput = qs("#title");
  if (titleInput) titleInput.value = schedule.title || "";

  // Apply settings controls if present
  const startSel = qs("#startHour");
  const endSel = qs("#endHour");
  const slotSel = qs("#slotMinutes");
  if (startSel) startSel.value = String(schedule.settings.startHour);
  if (endSel) endSel.value = String(schedule.settings.endHour);
  if (slotSel) slotSel.value = String(schedule.settings.slotMinutes);

  // Mode UI
  qsa(".seg__btn").forEach((b) => {
    const m = b.getAttribute("data-mode");
    b.classList.toggle("is-active", m === schedule.type);
  });

  // Daily mode visibility (no extra CSS required)
  const showDaily = schedule.type === "daily";
  const dayCols = getDayCols();
  for (let i = 0; i < 7; i++) {
    const col = dayCols.get(i);
    if (col) col.style.display = (!showDaily || i === schedule.ui.dailyDayIndex) ? "" : "none";
  }
  // also day headers if they exist
  const dayHeads = qsa(".dayhead");
  if (dayHeads.length === 7) {
    dayHeads.forEach((h, i) => {
      h.style.display = (!showDaily || i === schedule.ui.dailyDayIndex) ? "" : "none";
    });
  }

  // Render blocks
  const pxPerMin = getPxPerMin();
  const winStart = getWindowStartMin();
  const winEnd = getWindowEndMin();

  // stable ordering
  const blocks = [...schedule.blocks].sort((a, b) => (a.dayIndex - b.dayIndex) || (a.startMin - b.startMin));

  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const dayIndex = Number(b.dayIndex);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) continue;

    // daily mode: only show one day
    if (showDaily && dayIndex !== schedule.ui.dailyDayIndex) continue;

    const col = dayCols.get(dayIndex);
    if (!col) continue;

    const startMin = Number(b.startMin);
    const endMin = Number(b.endMin);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) continue;

    const s = clamp(startMin, winStart, winEnd);
    const e = clamp(endMin, winStart, winEnd);
    if (e <= s) continue;

    const top = (s - winStart) * pxPerMin;
    const height = Math.max(10, (e - s) * pxPerMin);

    const el = document.createElement("div");
    el.className = "block";
    el.dataset.blockId = String(b.id);
    el.style.top = `${top}px`;
    el.style.height = `${height}px`;
    el.style.setProperty("--b", String(b.color || "#4f7cff"));

    const title = document.createElement("div");
    title.className = "block__title";
    title.textContent = String(b.label || "Block");

    const meta = document.createElement("div");
    meta.className = "block__meta";
    meta.textContent = `${minToTime(startMin)}–${minToTime(endMin)}`;

    el.appendChild(title);
    el.appendChild(meta);

    // Editor-only controls/handles
    if (mode === "editor") {
      // top resize handle
      const hTop = document.createElement("div");
      hTop.dataset.handle = "top";
      hTop.style.position = "absolute";
      hTop.style.left = "0";
      hTop.style.right = "0";
      hTop.style.top = "0";
      hTop.style.height = "10px";
      hTop.style.cursor = "ns-resize";
      hTop.style.touchAction = "none";

      // bottom resize handle
      const hBot = document.createElement("div");
      hBot.dataset.handle = "bottom";
      hBot.style.position = "absolute";
      hBot.style.left = "0";
      hBot.style.right = "0";
      hBot.style.bottom = "0";
      hBot.style.height = "10px";
      hBot.style.cursor = "ns-resize";
      hBot.style.touchAction = "none";

      el.appendChild(hTop);
      el.appendChild(hBot);

      // right-click context menu (delete/edit)
      el.addEventListener("contextmenu", (ev) => {
        ev.preventDefault();
        openBlockMenu(ev.clientX, ev.clientY, b.id);
      });
      // double click to edit
      el.addEventListener("dblclick", () => {
        editBlock(b.id);
      });
    }

    col.appendChild(el);
  }
}

function findBlock(blockId) {
  return schedule.blocks.find((b) => String(b.id) === String(blockId)) || null;
}

function removeBlock(blockId) {
  schedule.blocks = schedule.blocks.filter((b) => String(b.id) !== String(blockId));
  saveLocal();
  render();
}

/* ----------------------------- Block edit UI ----------------------------- */

let menuEl = null;

function closeBlockMenu() {
  if (menuEl) {
    menuEl.remove();
    menuEl = null;
  }
}

function openBlockMenu(x, y, blockId) {
  closeBlockMenu();
  const b = findBlock(blockId);
  if (!b) return;

  menuEl = document.createElement("div");
  menuEl.style.position = "fixed";
  menuEl.style.left = `${x}px`;
  menuEl.style.top = `${y}px`;
  menuEl.style.zIndex = "99999";
  menuEl.style.minWidth = "180px";
  menuEl.style.padding = "8px";
  menuEl.style.borderRadius = "12px";
  menuEl.style.background = "rgba(10,12,18,.96)";
  menuEl.style.border = "1px solid rgba(255,255,255,.16)";
  menuEl.style.boxShadow = "0 16px 40px rgba(0,0,0,.45)";
  menuEl.style.color = "rgba(255,255,255,.92)";
  menuEl.style.font = "14px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

  const mkBtn = (label, onClick) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.style.width = "100%";
    btn.style.textAlign = "left";
    btn.style.padding = "10px 10px";
    btn.style.borderRadius = "10px";
    btn.style.border = "1px solid rgba(255,255,255,.10)";
    btn.style.background = "rgba(255,255,255,.06)";
    btn.style.color = "inherit";
    btn.style.cursor = "pointer";
    btn.style.marginTop = "6px";
    btn.addEventListener("click", () => {
      closeBlockMenu();
      onClick();
    });
    return btn;
  };

  menuEl.appendChild(mkBtn("Edit…", () => editBlock(blockId)));
  menuEl.appendChild(mkBtn("Duplicate", () => duplicateBlock(blockId)));
  menuEl.appendChild(mkBtn("Delete", () => removeBlock(blockId)));

  document.body.appendChild(menuEl);

  // keep inside viewport
  const r = menuEl.getBoundingClientRect();
  let nx = x, ny = y;
  if (r.right > window.innerWidth - 8) nx = Math.max(8, window.innerWidth - r.width - 8);
  if (r.bottom > window.innerHeight - 8) ny = Math.max(8, window.innerHeight - r.height - 8);
  menuEl.style.left = `${nx}px`;
  menuEl.style.top = `${ny}px`;

  setTimeout(() => {
    window.addEventListener("pointerdown", closeBlockMenu, { once: true });
    window.addEventListener("scroll", closeBlockMenu, { once: true, passive: true });
  }, 0);
}

function editBlock(blockId) {
  const b = findBlock(blockId);
  if (!b) return;

  // simple prompt-based editor (works without extra HTML)
  const label = prompt("Block title:", String(b.label ?? "Block"));
  if (label === null) return;

  const startStr = prompt("Start time (HH:MM):", minToTime(Number(b.startMin ?? 480)));
  if (startStr === null) return;

  const endStr = prompt("End time (HH:MM):", minToTime(Number(b.endMin ?? 540)));
  if (endStr === null) return;

  const startMin = timeToMin(startStr);
  const endMin = timeToMin(endStr);
  if (startMin == null || endMin == null || endMin <= startMin) {
    toast("Invalid time range.");
    return;
  }

  const dayIndex = schedule.type === "daily"
    ? schedule.ui.dailyDayIndex
    : clamp(Number(prompt("Day index (0=Mon … 6=Sun):", String(b.dayIndex ?? 0)) ?? b.dayIndex), 0, 6);

  const color = prompt("Color (hex like #4f7cff):", String(b.color ?? "#4f7cff"));
  if (color === null) return;

  b.label = String(label).slice(0, 60);
  b.dayIndex = dayIndex;
  b.startMin = startMin;
  b.endMin = endMin;
  b.color = String(color).trim() || "#4f7cff";

  // keep within window (soft)
  const winStart = getWindowStartMin();
  const winEnd = getWindowEndMin();
  b.startMin = clamp(b.startMin, winStart, winEnd - 5);
  b.endMin = clamp(b.endMin, b.startMin + 5, winEnd);

  saveLocal();
  render();
}

function duplicateBlock(blockId) {
  const b = findBlock(blockId);
  if (!b) return;
  const copy = { ...b, id: uid() };
  // shift 30 minutes by default
  copy.startMin = Number(copy.startMin) + 30;
  copy.endMin = Number(copy.endMin) + 30;

  const winStart = getWindowStartMin();
  const winEnd = getWindowEndMin();
  const dur = Math.max(5, Number(copy.endMin) - Number(copy.startMin));
  copy.startMin = clamp(copy.startMin, winStart, winEnd - dur);
  copy.endMin = clamp(copy.startMin + dur, winStart + 5, winEnd);

  schedule.blocks.push(copy);
  saveLocal();
  render();
}

/* ----------------------------- Editor interactions: drag/resize ----------------------------- */

let dragState = null;

function getBlockElementFromEventTarget(t) {
  if (!(t instanceof Element)) return null;
  return t.closest(".block");
}

function pointerToMinutesInColumn(pointerY, colEl) {
  const pxPerMin = getPxPerMin();
  const winStart = getWindowStartMin();

  const colRect = colEl.getBoundingClientRect();
  // blocks are positioned relative to daycol; top=0 corresponds to winStart
  const y = clamp(pointerY - colRect.top, 0, colRect.height);
  const minsFromStart = y / pxPerMin;

  return winStart + minsFromStart;
}

function snapMin(minValue) {
  const snap = getSnapMin();
  return Math.round(minValue / snap) * snap;
}

function onPointerDown(ev) {
  if (mode !== "editor") return;

  const target = ev.target;
  const blockEl = getBlockElementFromEventTarget(target);
  if (!blockEl) return;

  const blockId = blockEl.dataset.blockId;
  const b = findBlock(blockId);
  if (!b) return;

  const handle = (target instanceof Element) ? target.getAttribute("data-handle") : null;
  const action = handle === "top" ? "resize-top" : handle === "bottom" ? "resize-bottom" : "drag";

  const colEl = blockEl.parentElement;
  if (!colEl || !colEl.classList.contains("daycol")) return;

  // capture pointer
  blockEl.setPointerCapture?.(ev.pointerId);

  const startMin = Number(b.startMin);
  const endMin = Number(b.endMin);
  const dur = endMin - startMin;

  dragState = {
    blockId: String(blockId),
    action,
    pointerId: ev.pointerId,
    colEl,
    startStartMin: startMin,
    startEndMin: endMin,
    dur,
    startDayIndex: Number(b.dayIndex),
  };

  ev.preventDefault();
}

function onPointerMove(ev) {
  if (!dragState) return;
  const b = findBlock(dragState.blockId);
  if (!b) return;

  const winStart = getWindowStartMin();
  const winEnd = getWindowEndMin();
  const minDur = 10; // 10 minutes min

  let tMin = pointerToMinutesInColumn(ev.clientY, dragState.colEl);
  tMin = snapMin(tMin);

  if (dragState.action === "drag") {
    // move whole block keeping duration
    const dur = Math.max(minDur, dragState.dur);
    const newStart = clamp(tMin, winStart, winEnd - dur);
    b.startMin = newStart;
    b.endMin = newStart + dur;

    // change day when dragging across columns: optional
    // (simple: if pointer is over another .daycol, move there)
    const elAt = document.elementFromPoint(ev.clientX, ev.clientY);
    const overCol = elAt instanceof Element ? elAt.closest(".daycol") : null;
    if (overCol && overCol.hasAttribute("data-day")) {
      const d = Number(overCol.getAttribute("data-day"));
      if (Number.isInteger(d) && d >= 0 && d <= 6) {
        b.dayIndex = d;
        dragState.colEl = overCol;
      }
    }
  } else if (dragState.action === "resize-top") {
    const newStart = clamp(tMin, winStart, Number(b.endMin) - minDur);
    b.startMin = newStart;
  } else if (dragState.action === "resize-bottom") {
    const newEnd = clamp(tMin, Number(b.startMin) + minDur, winEnd);
    b.endMin = newEnd;
  }

  // update DOM fast (no full re-render each move)
  updateBlockElement(blockStateToDom(b));
  ev.preventDefault();
}

function onPointerUp(ev) {
  if (!dragState) return;
  const b = findBlock(dragState.blockId);
  dragState = null;

  if (b) {
    // finalize clamp & save
    const winStart = getWindowStartMin();
    const winEnd = getWindowEndMin();
    b.startMin = clamp(Number(b.startMin), winStart, winEnd - 5);
    b.endMin = clamp(Number(b.endMin), Number(b.startMin) + 5, winEnd);
    saveLocal();
    render(); // normalize any column move / daily hide/show
  }
}

function blockStateToDom(b) {
  const pxPerMin = getPxPerMin();
  const winStart = getWindowStartMin();
  const top = (Number(b.startMin) - winStart) * pxPerMin;
  const height = Math.max(10, (Number(b.endMin) - Number(b.startMin)) * pxPerMin);
  return { id: String(b.id), top, height, label: String(b.label || "Block"), meta: `${minToTime(b.startMin)}–${minToTime(b.endMin)}`, color: String(b.color || "#4f7cff") };
}

function updateBlockElement(dom) {
  const el = qs(`.block[data-block-id="${CSS.escape(dom.id)}"]`);
  if (!el) return;
  el.style.top = `${dom.top}px`;
  el.style.height = `${dom.height}px`;
  el.style.setProperty("--b", dom.color);
  const t = qs(".block__title", el);
  const m = qs(".block__meta", el);
  if (t) t.textContent = dom.label;
  if (m) m.textContent = dom.meta;
}

/* ----------------------------- Editor actions ----------------------------- */

function addBlock() {
  normalizeSchedule();

  const dayIndex = schedule.type === "daily" ? schedule.ui.dailyDayIndex : 0;
  const winStart = getWindowStartMin();
  const winEnd = getWindowEndMin();
  const snap = getSnapMin();

  // place at +2 hours from start
  const start = clamp(winStart + 120, winStart, winEnd - 60);
  const end = clamp(start + Math.max(30, snap), start + 10, winEnd);

  const idx = schedule.blocks.length;
  schedule.blocks.push({
    id: uid(),
    dayIndex,
    startMin: start,
    endMin: end,
    label: "New Block",
    color: pickColor(idx),
  });

  saveLocal();
  render();
  toast("Block added (drag/resize it).");
}

function clearAll() {
  schedule = defaultSchedule();
  saveLocal();
  render();
  toast("Cleared.");
}

async function shareNow() {
  normalizeSchedule();
  try {
    const result = await apiShare(schedule);
    const shareUrl = result.url || `/s/${result.id}`;
    const embedUrl = result.embedUrl || `/embed/${result.id}`;
    const text = `Share: ${location.origin}${shareUrl}\nEmbed: ${location.origin}${embedUrl}`;

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast("Copied share links.");
    } else {
      toast("Share created.");
      alert(text);
    }
  } catch (e) {
    toast(e?.message ? String(e.message) : "Share failed.");
  }
}

/* ----------------------------- Wire UI ----------------------------- */

function wireControls() {
  // Only attach once
  const btnAdd = qs("#btnAddBlock");
  if (btnAdd && !btnAdd._wired) {
    btnAdd._wired = true;
    btnAdd.addEventListener("click", addBlock);
  }

  const btnClear = qs("#btnClear");
  if (btnClear && !btnClear._wired) {
    btnClear._wired = true;
    btnClear.addEventListener("click", clearAll);
  }

  const btnShare = qs("#btnShare");
  if (btnShare && !btnShare._wired) {
    btnShare._wired = true;
    btnShare.addEventListener("click", shareNow);
  }

  const titleInput = qs("#title");
  if (titleInput && !titleInput._wired) {
    titleInput._wired = true;
    titleInput.addEventListener("input", () => {
      schedule.title = String(titleInput.value || "").slice(0, 80);
      saveLocal();
    });
  }

  const startSel = qs("#startHour");
  const endSel = qs("#endHour");
  const slotSel = qs("#slotMinutes");

  if (startSel && !startSel._wired) {
    startSel._wired = true;
    startSel.addEventListener("change", () => {
      schedule.settings.startHour = clamp(Number(startSel.value), 0, 24);
      if (schedule.settings.endHour <= schedule.settings.startHour) {
        schedule.settings.endHour = Math.min(24, schedule.settings.startHour + 1);
      }
      saveLocal();
      render();
    });
  }
  if (endSel && !endSel._wired) {
    endSel._wired = true;
    endSel.addEventListener("change", () => {
      schedule.settings.endHour = clamp(Number(endSel.value), 0, 24);
      if (schedule.settings.endHour <= schedule.settings.startHour) {
        schedule.settings.endHour = Math.min(24, schedule.settings.startHour + 1);
      }
      saveLocal();
      render();
    });
  }
  if (slotSel && !slotSel._wired) {
    slotSel._wired = true;
    slotSel.addEventListener("change", () => {
      schedule.settings.slotMinutes = clamp(Number(slotSel.value), 5, 120);
      saveLocal();
      toast(`Snap: ${schedule.settings.slotMinutes} min`);
    });
  }

  // Mode toggles (weekly/daily)
  qsa(".seg__btn").forEach((btn) => {
    if (btn._wired) return;
    btn._wired = true;
    btn.addEventListener("click", () => {
      const m = btn.getAttribute("data-mode");
      schedule.type = (m === "daily" ? "daily" : "weekly");
      saveLocal();
      render();
    });
  });

  // Optional: if you have mobile day pills (.daypill), wire them
  qsa(".daypill").forEach((pill, i) => {
    if (pill._wired) return;
    pill._wired = true;
    pill.addEventListener("click", () => {
      schedule.ui.dailyDayIndex = clamp(i, 0, 6);
      qsa(".daypill").forEach((p, j) => p.classList.toggle("is-active", j === schedule.ui.dailyDayIndex));
      schedule.type = "daily";
      saveLocal();
      render();
    });
  });

  // Pointer events for drag/resize
  if (!document._sbPointerWired) {
    document._sbPointerWired = true;
    document.addEventListener("pointerdown", onPointerDown, { passive: false });
    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("pointercancel", onPointerUp, { passive: true });
  }

  // Click on empty space in a day column to quick-add a block (editor only)
  qsa(".daycol").forEach((col) => {
    if (col._wiredClick) return;
    col._wiredClick = true;
    col.addEventListener("dblclick", (ev) => {
      if (mode !== "editor") return;
      const dayIndex = Number(col.getAttribute("data-day") ?? 0);
      const tMin = snapMin(pointerToMinutesInColumn(ev.clientY, col));
      const winStart = getWindowStartMin();
      const winEnd = getWindowEndMin();
      const snap = getSnapMin();

      const start = clamp(tMin, winStart, winEnd - 10);
      const end = clamp(start + Math.max(30, snap), start + 10, winEnd);

      schedule.blocks.push({
        id: uid(),
        dayIndex: Number.isInteger(dayIndex) ? dayIndex : 0,
        startMin: start,
        endMin: end,
        label: "New Block",
        color: pickColor(schedule.blocks.length),
      });
      saveLocal();
      render();
      toast("Block added (double-click).");
    });
  });
}

/* ----------------------------- Boot ----------------------------- */

async function boot() {
  mode = detectMode();

  // Priority 1: PHP injected schedule
  if (window.__SCHEDULE__ && typeof window.__SCHEDULE__ === "object") {
    schedule = window.__SCHEDULE__;
    // read-only pages should not mutate localStorage unless user opens editor
    normalizeSchedule();
    render();
    wireControls();
    return;
  }

  // Priority 2: ?id=XXXX load from backend
  const id = getQueryParam("id");
  if (id) {
    try {
      schedule = await apiLoad(id);
    } catch (e) {
      schedule = loadLocal();
      toast("Could not load id, showing local schedule.");
    }
    normalizeSchedule();
    render();
    wireControls();
    return;
  }

  // Priority 3: localStorage (editor)
  schedule = loadLocal();
  normalizeSchedule();
  render();
  wireControls();

  // In view/embed HTML files (not PHP), you might want read-only:
  if (mode !== "editor") {
    // keep interactions disabled by mode checks
  }
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((e) => {
    console.error(e);
    schedule = defaultSchedule();
    render();
    wireControls();
    toast("Recovered from an error.");
  });
});
