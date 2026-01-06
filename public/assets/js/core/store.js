// /public/assets/js/core/store.js
import { CONFIG as DEFAULTS } from "./config.js";
import { uid, clamp, roundToStep } from "./utils.js";

export class Store {
  constructor(config = DEFAULTS) {
    this.config = config;
    this.state = this._load() || this._createDefault();
    this._ensureMetaDefaults();
    this.listeners = new Set();
  }

  _createDefault() {
    return {
      meta: {
        title: this.config.defaultTitle,
        days: [...this.config.daysFull],
        visibleDays: [0, 1, 2, 3, 4, 5, 6], // ✅ new: actual day indices that are visible
        startMinute: this.config.defaultStart,
        endMinute: this.config.defaultEnd,
        minuteStep: this.config.defaultStep,
        showWeekend: this.config.defaultShowWeekend
      },
      items: []
    };
  }

  _load() {
    try {
      const raw = localStorage.getItem(this.config.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.meta || !Array.isArray(parsed.items)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  save() {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify(this.state));
    } catch {
      // ignore
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    this.save();
    this.listeners.forEach((fn) => fn(this.state));
  }

  replaceAll(newState) {
    if (!newState || !newState.meta || !Array.isArray(newState.items)) return;
    this.state = newState;
    this._ensureMetaDefaults();
    this._emit();
  }

  reset() {
    this.state = this._createDefault();
    this._emit();
  }

  setMeta(partial) {
    // Merge
    this.state.meta = { ...this.state.meta, ...partial };
    this._ensureMetaDefaults();

    // Normalize block positions after time-range changes
    this._normalizeItemsToMeta();

    this._emit();
  }

  _ensureMetaDefaults() {
    const m = this.state.meta || (this.state.meta = {});
    if (!Array.isArray(m.days) || m.days.length !== 7) m.days = [...this.config.daysFull];

    // Backward compatibility: if visibleDays missing, derive from showWeekend legacy
    if (!Array.isArray(m.visibleDays)) {
      m.visibleDays = (m.showWeekend === false) ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6];
    }

    // sanitize visibleDays
    m.visibleDays = sanitizeVisibleDays(m.visibleDays);

    // keep showWeekend consistent (legacy meta used elsewhere)
    if (typeof m.showWeekend !== "boolean") m.showWeekend = this.config.defaultShowWeekend;
    if (m.showWeekend === false) {
      // if weekend off, ensure weekend indices are not visible
      m.visibleDays = m.visibleDays.filter((d) => d < 5);
      if (m.visibleDays.length === 0) m.visibleDays = [0, 1, 2, 3, 4];
    } else {
      // if weekend on, allow whatever is in visibleDays; but still ensure >=1
      if (m.visibleDays.length === 0) m.visibleDays = [0, 1, 2, 3, 4, 5, 6];
    }
  }

  _normalizeItemsToMeta() {
    const m = this.state.meta;
    const step = m.minuteStep;

    // Ensure meta itself is sane
    const safeStart = clamp(Number(m.startMinute) || 0, 0, 24 * 60);
    const safeEndRaw = clamp(Number(m.endMinute) || 0, 0, 24 * 60);
    const safeEnd = Math.max(safeEndRaw, safeStart + step);

    m.startMinute = safeStart;
    m.endMinute = safeEnd;

    // Clamp / drop items that are fully outside the new range
    const next = [];

    for (const it of this.state.items) {
      let s = Number(it.start);
      let e = Number(it.end);

      if (!Number.isFinite(s) || !Number.isFinite(e)) continue;

      // Fully outside -> drop
      if (e <= m.startMinute || s >= m.endMinute) continue;

      // Clamp into range
      s = clamp(s, m.startMinute, m.endMinute - step);
      e = clamp(e, s + step, m.endMinute);

      // Snap to step
      s = roundToStep(s, step);
      e = roundToStep(e, step);

      // Re-clamp after rounding
      s = clamp(s, m.startMinute, m.endMinute - step);
      e = clamp(e, s + step, m.endMinute);

      next.push({ ...it, start: s, end: e });
    }

    this.state.items = next;
  }

  addItem({ dayIndex, start, end, text, color, notes = "" }) {
    const m = this.state.meta;
    const step = m.minuteStep;

    const s = roundToStep(clamp(start, m.startMinute, m.endMinute - step), step);
    const e = roundToStep(clamp(end, s + step, m.endMinute), step);

    const item = {
      id: uid(),
      dayIndex,
      start: s,
      end: e,
      text: text || "Block",
      color: color || "#4f46e5",
      notes
    };

    this.state.items.push(item);
    this._emit();
    return item;
  }

  updateItem(id, partial) {
    const it = this.state.items.find((x) => x.id === id);
    if (!it) return;
    Object.assign(it, partial);

    // Keep updated item in range if meta changed recently
    this._normalizeItemsToMeta();

    this._emit();
  }

  deleteItem(id) {
    this.state.items = this.state.items.filter((x) => x.id !== id);
    this._emit();
  }

  // ✅ new: return actual visible day indices [0..6]
  getVisibleDayIndices() {
    const m = this.state.meta || {};
    let vis = Array.isArray(m.visibleDays) ? sanitizeVisibleDays(m.visibleDays) : null;

    if (!vis || vis.length === 0) {
      vis = (m.showWeekend === false) ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6];
    }

    if (m.showWeekend === false) vis = vis.filter((d) => d < 5);
    if (vis.length === 0) vis = [0, 1, 2, 3, 4];

    return vis;
  }

  // existing API kept: labels for header
  getVisibleDays() {
    const idx = this.getVisibleDayIndices();
    return idx.map((d) => this.config.daysFull[d] || "");
  }

  getMetaLine() {
    const { startMinute, endMinute, minuteStep } = this.state.meta;
    return `${minsToTime(startMinute)} – ${minsToTime(endMinute)} • ${minuteStep} min steps`;
  }
}

function minsToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function sanitizeVisibleDays(arr) {
  const out = [];
  const seen = new Set();
  for (const v of arr) {
    const n = Number(v);
    if (!Number.isInteger(n)) continue;
    if (n < 0 || n > 6) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  out.sort((a, b) => a - b);
  return out;
}
