// /public/assets/js/core/store.js
import { CONFIG as DEFAULTS } from "./config.js";
import { uid, clamp, roundToStep } from "./utils.js";

export class Store {
  constructor(config = DEFAULTS) {
    this.config = config;
    this.state = this._load() || this._createDefault();
    this.listeners = new Set();
  }

  _createDefault() {
    return {
      meta: {
        title: this.config.defaultTitle,
        days: [...this.config.daysFull],
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
    this._emit();
  }

  reset() {
    this.state = this._createDefault();
    this._emit();
  }

  setMeta(partial) {
    // Merge
    this.state.meta = { ...this.state.meta, ...partial };

    // Normalize block positions after time-range changes
    this._normalizeItemsToMeta();

    this._emit();
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

  getVisibleDays() {
    const base = [...this.state.meta.days];
    if (!this.state.meta.showWeekend) return base.slice(0, 5);
    return base;
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
