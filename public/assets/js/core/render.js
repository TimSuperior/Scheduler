// /public/assets/js/core/render.js
import { clearEl, el, minsToLabel } from "./utils.js";

export function renderSchedule({ store, timeAxis, dayHeader, canvas, readOnly = false }) {
  const state = store.state;
  const meta = state.meta;

  if (!timeAxis || !dayHeader || !canvas) return;

  const days = store.getVisibleDays();
  const totalMinutes = meta.endMinute - meta.startMinute;

  // --- Align background grid with step/hour sizes ---
  const pxPerMin = store.config.pxPerMinute;
  const step = meta.minuteStep;

  canvas.style.setProperty("--days", String(days.length));
  canvas.style.setProperty("--minor", `${step * pxPerMin}px`);
  canvas.style.setProperty("--hour", `${60 * pxPerMin}px`);

  // --- Day header ---
  clearEl(dayHeader);
  dayHeader.style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;

  const labels = buildDayLabels(days, meta);
  labels.forEach((label) => {
    dayHeader.appendChild(el("div", { className: "schedule__day", text: label }));
  });

  // --- Time axis (hour labels) ---
  clearEl(timeAxis);
  for (let t = meta.startMinute; t < meta.endMinute; t += 60) {
    timeAxis.appendChild(el("div", { className: "time-label", text: minsToLabel(t) }));
  }

  // --- Canvas height ---
  canvas.style.height = `${totalMinutes * pxPerMin}px`;

  // --- Blocks ---
  clearEl(canvas);

  const daysCount = days.length;

  // Use real width; fallback to clientWidth; fallback to constant
  const rect = canvas.getBoundingClientRect();
  const cw = rect.width || canvas.clientWidth || 0;
  const colWidth = (cw > 0 ? cw / daysCount : 120);
  const gap = 2;

  // Default behavior: show times (unless explicitly disabled)
  const showTimeInEvents = meta.showTimeInEvents !== false;

  state.items.forEach((item) => {
    // Keep old behavior: hide weekend blocks if weekend is hidden
    if (!meta.showWeekend && item.dayIndex >= 5) return;

    // Safety
    if (item.dayIndex < 0) return;

    // If weekend is hidden, daysCount is likely 5; weekend items already returned above
    // If weekend is shown, daysCount is 7; allow 0..6
    if (item.dayIndex >= daysCount) return;

    const top = (item.start - meta.startMinute) * pxPerMin;
    const height = Math.max(8, (item.end - item.start) * pxPerMin);

    const left = item.dayIndex * colWidth + gap;
    const width = Math.max(8, colWidth - gap * 2);

    const node = el("div", {
      className: "block",
      attrs: { "data-id": item.id }
    });

    node.style.top = `${top}px`;
    node.style.height = `${height}px`;
    node.style.left = `${left}px`;
    node.style.width = `${width}px`;

    node.style.background = withAlpha(item.color, 0.22);
    node.style.borderColor = withAlpha(item.color, 0.45);

    node.appendChild(el("div", { className: "block__title", text: item.text }));

    if (showTimeInEvents) {
      node.appendChild(
        el("div", { className: "block__meta", text: `${minsToLabel(item.start)} - ${minsToLabel(item.end)}` })
      );
    }

    if (!readOnly) {
      node.appendChild(el("div", { className: "block__handle", attrs: { "data-handle": "end" } }));
    }

    canvas.appendChild(node);
  });
}

function withAlpha(hex, a) {
  const v = (hex || "").replace("#", "").trim();
  if (v.length !== 6) return `rgba(79,70,229,${a})`;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Optional: show dates in the day header.
 * - If meta.showDates is falsy, keep original labels.
 * - If meta.week is set (e.g. "2025-W51"), render that ISO-week starting Monday.
 * - Otherwise use current week (Mon-based) for display only.
 */
function buildDayLabels(days, meta) {
  if (!meta || !meta.showDates) return days;

  const week = String(meta.week || "");
  const start = week ? isoWeekStartDate(week) : currentWeekStart();

  const fmt = new Intl.DateTimeFormat("en", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  });

  // days are in order Mon..(Fri/Sun) depending on visibility
  return days.map((_, i) => {
    const dt = new Date(start);
    dt.setDate(dt.getDate() + i);
    return fmt.format(dt);
  });
}

function currentWeekStart() {
  const now = new Date();
  // Mon-based week start
  const day = now.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1 - day);
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + diff);
  return d;
}

// isoWeek like "2025-W51"
function isoWeekStartDate(isoWeek) {
  const m = /^(\d{4})-W(\d{2})$/.exec(isoWeek);
  if (!m) return currentWeekStart();

  const year = Number(m[1]);
  const week = Number(m[2]);

  // ISO week: week 1 contains Jan 4th
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const day = jan4.getUTCDay() || 7; // Mon=1..Sun=7
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (day - 1) + (week - 1) * 7);

  // Convert to local date at midnight
  const local = new Date(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate());
  local.setHours(0, 0, 0, 0);
  return local;
}
