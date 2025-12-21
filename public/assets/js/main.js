// public/assets/js/main.js
"use strict";

const API = {
  share: "/server/api/share.php",
  load: "/server/api/load.php",
};

const STORAGE_KEY = "sb_schedule_v2";
const DEFAULT_COLORS = ["#4f7cff", "#4caf50", "#ff9800", "#9c27b0", "#2196f3", "#e91e63", "#00bcd4"];

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
function pad2(n) { return String(n).padStart(2, "0"); }
function minToTime(min) { const h = Math.floor(min / 60), m = min % 60; return `${pad2(h)}:${pad2(m)}`; }
function safeJsonParse(s) { try { return JSON.parse(s); } catch { return null; } }
function getQueryParam(name) { return new URL(location.href).searchParams.get(name); }
function getCssNumber(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}
function uid() { return "b_" + Math.random().toString(16).slice(2) + Date.now().toString(16); }
function pickColor(i) { return DEFAULT_COLORS[i % DEFAULT_COLORS.length]; }

function detectMode() {
  const p = (location.pathname || "").toLowerCase();
  if (p.includes("editor.html")) return "editor";
  if (p.includes("view.html") || p.includes("view.php") || p.includes("/s/")) return "view";
  if (p.includes("embed.html") || p.includes("embed.php") || p.includes("/embed/")) return "embed";
  return "editor";
}

function toast(msg) {
  try {
    let el = qs("#sb_toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "sb_toast";
      Object.assign(el.style, {
        position: "fixed", left: "50%", bottom: "18px", transform: "translateX(-50%)",
        padding: "10px 12px", borderRadius: "12px",
        border: "1px solid rgba(255,255,255,.18)",
        background: "rgba(10,12,18,.92)", color: "rgba(255,255,255,.92)",
        zIndex: "9999", maxWidth: "92vw", boxShadow: "0 12px 30px rgba(0,0,0,.35)",
        font: "14px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        opacity: "0", transition: "opacity .15s ease",
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.opacity = "0"), 1600);
  } catch {
    alert(msg);
  }
}

async function apiLoad(id) {
  const res = await fetch(`${API.load}?id=${encodeURIComponent(id)}`, { headers: { Accept: "application/json" } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data || data.success !== true) throw new Error(data?.message || data?.error || `Load failed (${res.status})`);
  return data.payload;
}
async function apiShare(payload) {
  const res = await fetch(API.share, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data || data.success !== true) throw new Error(data?.message || data?.error || `Share failed (${res.status})`);
  return data;
}

function defaultSchedule() {
  return {
    id: "local",
    type: "weekly",
    title: "My Schedule",
    settings: { startHour: 6, endHour: 24, slotMinutes: 30 },
    ui: { dailyDayIndex: 0 },
    blocks: [],
  };
}

let schedule = null;
let mode = "editor";

function normalizeSchedule() {
  if (!schedule || typeof schedule !== "object") schedule = defaultSchedule();
  if (!schedule.settings) schedule.settings = { startHour: 6, endHour: 24, slotMinutes: 30 };
  if (!schedule.ui) schedule.ui = { dailyDayIndex: 0 };
  if (!Array.isArray(schedule.blocks)) schedule.blocks = [];

  schedule.settings.startHour = clamp(Number(schedule.settings.startHour ?? 6), 0, 24);
  schedule.settings.endHour = clamp(Number(schedule.settings.endHour ?? 24), 0, 24);
  if (schedule.settings.endHour <= schedule.settings.startHour) schedule.settings.endHour = Math.min(24, schedule.settings.startHour + 1);
  schedule.settings.slotMinutes = clamp(Number(schedule.settings.slotMinutes ?? 30), 5, 120);

  schedule.type = schedule.type === "daily" ? "daily" : "weekly";
  schedule.ui.dailyDayIndex = clamp(Number(schedule.ui.dailyDayIndex ?? 0), 0, 6);
}

function saveLocal() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule)); } catch {} }
function loadLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? safeJsonParse(raw) : null;
  return parsed && typeof parsed === "object" ? parsed : defaultSchedule();
}

function getPxPerMin() { return getCssNumber("--hourH", 64) / 60; }
function winStart() { return clamp(Number(schedule.settings.startHour ?? 6), 0, 24) * 60; }
function winEnd() { return clamp(Number(schedule.settings.endHour ?? 24), 0, 24) * 60; }
function snapMin(v) {
  const snap = clamp(Number(schedule.settings.slotMinutes ?? 30), 5, 120);
  return Math.round(v / snap) * snap;
}

function getDayColsMap() {
  // If data-day exists, use it. Otherwise assign by order 0..6 (fixes your view.html/embed.html)
  const cols = qsa(".daycol");
  const map = new Map();
  cols.forEach((col, i) => {
    const dAttr = col.getAttribute("data-day");
    const day = dAttr != null ? Number(dAttr) : i;
    if (Number.isInteger(day) && day >= 0 && day <= 6 && !map.has(day)) map.set(day, col);
  });
  return map;
}

function ensureBoardHeight() {
  const daysEl = qs(".days");
  if (!daysEl) return;
  const h = Math.max(60, (winEnd() - winStart()) * getPxPerMin());
  daysEl.style.minHeight = `${h}px`;
}

function clearBlocks() { qsa(".daycol").forEach((c) => (c.innerHTML = "")); }

function render() {
  normalizeSchedule();
  ensureBoardHeight();
  clearBlocks();

  const titleInput = qs("#title");
  if (titleInput) titleInput.value = schedule.title || "";

  const startSel = qs("#startHour");
  const endSel = qs("#endHour");
  const slotSel = qs("#slotMinutes");
  if (startSel) startSel.value = String(schedule.settings.startHour);
  if (endSel) endSel.value = String(schedule.settings.endHour);
  if (slotSel) slotSel.value = String(schedule.settings.slotMinutes);

  qsa(".seg__btn").forEach((b) => b.classList.toggle("is-active", b.getAttribute("data-mode") === schedule.type));

  const map = getDayColsMap();

  const showDaily = schedule.type === "daily";
  for (let i = 0; i < 7; i++) {
    const col = map.get(i);
    if (col) col.style.display = (!showDaily || i === schedule.ui.dailyDayIndex) ? "" : "none";
  }
  const heads = qsa(".dayhead");
  if (heads.length === 7) heads.forEach((h, i) => (h.style.display = (!showDaily || i === schedule.ui.dailyDayIndex) ? "" : "none"));

  const pxPerMin = getPxPerMin();
  const ws = winStart();
  const we = winEnd();

  const blocks = [...schedule.blocks].filter(Boolean).sort((a, b) => (a.dayIndex - b.dayIndex) || (a.startMin - b.startMin));

  for (const b of blocks) {
    const dayIndex = Number(b.dayIndex);
    if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) continue;
    if (showDaily && dayIndex !== schedule.ui.dailyDayIndex) continue;

    const col = map.get(dayIndex);
    if (!col) continue;

    const startMin = Number(b.startMin);
    const endMin = Number(b.endMin);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) continue;

    const s = clamp(startMin, ws, we);
    const e = clamp(endMin, ws, we);
    if (e <= s) continue;

    const top = (s - ws) * pxPerMin;
    const height = Math.max(10, (e - s) * pxPerMin);

    const el = document.createElement("div");
    el.className = "block";
    el.dataset.blockId = String(b.id);
    el.style.top = `${top}px`;
    el.style.height = `${height}px`;
    el.style.setProperty("--b", String(b.color || "#4f7cff"));

    const t = document.createElement("div");
    t.className = "block__title";
    t.textContent = String(b.label || "Block");

    const m = document.createElement("div");
    m.className = "block__meta";
    m.textContent = `${minToTime(startMin)}–${minToTime(endMin)}`;

    el.appendChild(t);
    el.appendChild(m);

    if (mode === "editor") {
      const hTop = document.createElement("div");
      hTop.dataset.handle = "top";
      Object.assign(hTop.style, { position: "absolute", left: 0, right: 0, top: 0, height: "10px", cursor: "ns-resize", touchAction: "none" });

      const hBot = document.createElement("div");
      hBot.dataset.handle = "bottom";
      Object.assign(hBot.style, { position: "absolute", left: 0, right: 0, bottom: 0, height: "10px", cursor: "ns-resize", touchAction: "none" });

      el.appendChild(hTop);
      el.appendChild(hBot);

      el.addEventListener("dblclick", () => editBlock(b.id));
      el.addEventListener("contextmenu", (ev) => { ev.preventDefault(); removeBlockConfirm(b.id); });
    }

    col.appendChild(el);
  }
}

function findBlock(id) { return schedule.blocks.find((b) => String(b.id) === String(id)) || null; }

function addBlockAt(dayIndex, startMin) {
  const ws = winStart(), we = winEnd();
  const s = clamp(snapMin(startMin), ws, we - 10);
  const e = clamp(s + Math.max(30, schedule.settings.slotMinutes), s + 10, we);

  schedule.blocks.push({
    id: uid(),
    dayIndex,
    startMin: s,
    endMin: e,
    label: "New Block",
    color: pickColor(schedule.blocks.length),
  });
  saveLocal();
  render();
}

function addBlock() {
  const dayIndex = schedule.type === "daily" ? schedule.ui.dailyDayIndex : 0;
  addBlockAt(dayIndex, winStart() + 120);
  toast("Block added.");
}

function clearAll() {
  schedule = defaultSchedule();
  saveLocal();
  render();
  toast("Cleared.");
}

async function shareNow() {
  try {
    const result = await apiShare(schedule);
    const shareUrl = result.url || `/s/${result.id}`;
    const embedUrl = result.embedUrl || `/embed/${result.id}`;
    const text = `Share: ${location.origin}${shareUrl}\nEmbed: ${location.origin}${embedUrl}`;

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      toast("Copied share links.");
    } else {
      alert(text);
    }
  } catch (e) {
    toast(String(e?.message || "Share failed."));
  }
}

function removeBlockConfirm(id) {
  if (!confirm("Delete this block?")) return;
  schedule.blocks = schedule.blocks.filter((b) => String(b.id) !== String(id));
  saveLocal();
  render();
}

function editBlock(id) {
  const b = findBlock(id);
  if (!b) return;

  const label = prompt("Title:", String(b.label || "Block"));
  if (label === null) return;

  const startStr = prompt("Start (HH:MM):", minToTime(Number(b.startMin || 480)));
  if (startStr === null) return;

  const endStr = prompt("End (HH:MM):", minToTime(Number(b.endMin || 540)));
  if (endStr === null) return;

  const toMin = (hhmm) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
    if (!m) return null;
    const h = Number(m[1]), mm = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
    return h * 60 + mm;
  };

  const s = toMin(startStr);
  const e = toMin(endStr);
  if (s == null || e == null || e <= s) return toast("Invalid time range.");

  b.label = String(label).slice(0, 60);
  b.startMin = snapMin(s);
  b.endMin = snapMin(e);

  // keep within visible window
  const ws = winStart(), we = winEnd();
  b.startMin = clamp(b.startMin, ws, we - 5);
  b.endMin = clamp(b.endMin, b.startMin + 5, we);

  saveLocal();
  render();
}

let drag = null;

function blockFromTarget(t) { return (t instanceof Element) ? t.closest(".block") : null; }

function pointerToMin(clientY, colEl) {
  const rect = colEl.getBoundingClientRect();
  const y = clamp(clientY - rect.top, 0, rect.height);
  return winStart() + y / getPxPerMin();
}

function onPointerDown(ev) {
  if (mode !== "editor") return;

  const blockEl = blockFromTarget(ev.target);
  if (!blockEl) return;

  const id = blockEl.dataset.blockId;
  const b = findBlock(id);
  if (!b) return;

  const handle = (ev.target instanceof Element) ? ev.target.getAttribute("data-handle") : null;
  const action = handle === "top" ? "resize-top" : handle === "bottom" ? "resize-bottom" : "drag";

  const col = blockEl.parentElement;
  if (!col || !col.classList.contains("daycol")) return;

  blockEl.setPointerCapture?.(ev.pointerId);

  drag = {
    id: String(id),
    action,
    col,
    dur: Number(b.endMin) - Number(b.startMin),
  };

  ev.preventDefault();
}

function onPointerMove(ev) {
  if (!drag) return;
  const b = findBlock(drag.id);
  if (!b) return;

  const ws = winStart(), we = winEnd();
  const minDur = 10;

  let t = snapMin(pointerToMin(ev.clientY, drag.col));

  if (drag.action === "drag") {
    const dur = Math.max(minDur, drag.dur);
    const ns = clamp(t, ws, we - dur);
    b.startMin = ns;
    b.endMin = ns + dur;

    // allow moving across day columns
    const over = document.elementFromPoint(ev.clientX, ev.clientY);
    const overCol = (over instanceof Element) ? over.closest(".daycol") : null;
    if (overCol) {
      // map day by data-day or index position
      const cols = qsa(".daycol");
      const dAttr = overCol.getAttribute("data-day");
      const day = dAttr != null ? Number(dAttr) : cols.indexOf(overCol);
      if (Number.isInteger(day) && day >= 0 && day <= 6) {
        b.dayIndex = day;
        drag.col = overCol;
      }
    }
  } else if (drag.action === "resize-top") {
    b.startMin = clamp(t, ws, Number(b.endMin) - minDur);
  } else if (drag.action === "resize-bottom") {
    b.endMin = clamp(t, Number(b.startMin) + minDur, we);
  }

  // lightweight update
  render();
  ev.preventDefault();
}

function onPointerUp() {
  if (!drag) return;
  drag = null;
  saveLocal();
}

function wire() {
  const btnAdd = qs("#btnAddBlock");
  if (btnAdd && !btnAdd._wired) { btnAdd._wired = true; btnAdd.addEventListener("click", addBlock); }

  const btnClear = qs("#btnClear");
  if (btnClear && !btnClear._wired) { btnClear._wired = true; btnClear.addEventListener("click", clearAll); }

  const btnShare = qs("#btnShare");
  if (btnShare && !btnShare._wired) { btnShare._wired = true; btnShare.addEventListener("click", shareNow); }

  const titleInput = qs("#title");
  if (titleInput && !titleInput._wired) {
    titleInput._wired = true;
    titleInput.addEventListener("input", () => { schedule.title = String(titleInput.value || "").slice(0, 80); saveLocal(); });
  }

  const startSel = qs("#startHour");
  const endSel = qs("#endHour");
  const slotSel = qs("#slotMinutes");

  if (startSel && !startSel._wired) {
    startSel._wired = true;
    startSel.addEventListener("change", () => { schedule.settings.startHour = Number(startSel.value); saveLocal(); render(); });
  }
  if (endSel && !endSel._wired) {
    endSel._wired = true;
    endSel.addEventListener("change", () => { schedule.settings.endHour = Number(endSel.value); saveLocal(); render(); });
  }
  if (slotSel && !slotSel._wired) {
    slotSel._wired = true;
    slotSel.addEventListener("change", () => { schedule.settings.slotMinutes = Number(slotSel.value); saveLocal(); toast(`Snap: ${schedule.settings.slotMinutes} min`); });
  }

  qsa(".seg__btn").forEach((btn) => {
    if (btn._wired) return;
    btn._wired = true;
    btn.addEventListener("click", () => {
      schedule.type = btn.getAttribute("data-mode") === "daily" ? "daily" : "weekly";
      saveLocal();
      render();
    });
  });

  // Double-click empty column to add block at that time
  qsa(".daycol").forEach((col) => {
    if (col._wiredDbl) return;
    col._wiredDbl = true;
    col.addEventListener("dblclick", (ev) => {
      if (mode !== "editor") return;
      const cols = qsa(".daycol");
      const dAttr = col.getAttribute("data-day");
      const day = dAttr != null ? Number(dAttr) : cols.indexOf(col);
      addBlockAt(clamp(day, 0, 6), pointerToMin(ev.clientY, col));
      toast("Block added.");
    });
  });

  if (!document._sbPointerWired) {
    document._sbPointerWired = true;
    document.addEventListener("pointerdown", onPointerDown, { passive: false });
    document.addEventListener("pointermove", onPointerMove, { passive: false });
    document.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("pointercancel", onPointerUp, { passive: true });
  }
}

async function boot() {
  mode = detectMode();

  if (window.__SCHEDULE__ && typeof window.__SCHEDULE__ === "object") {
    schedule = window.__SCHEDULE__;
    normalizeSchedule();
    render();
    wire();
    return;
  }

  const id = getQueryParam("id");
  if (id) {
    try {
      schedule = await apiLoad(id);
    } catch {
      schedule = loadLocal();
      toast("Could not load id. Showing local schedule.");
    }
    normalizeSchedule();
    render();
    wire();
    return;
  }

  schedule = loadLocal();
  normalizeSchedule();
  render();
  wire();
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((e) => {
    console.error(e);
    schedule = defaultSchedule();
    render();
    wire();
    toast("Recovered from an error.");
  });
});
