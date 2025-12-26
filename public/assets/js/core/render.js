// /public/assets/js/core/render.js
import { clearEl, el, minsToLabel } from "./utils.js";

export function renderSchedule({ store, timeAxis, dayHeader, canvas, readOnly = false }) {
  const state = store.state;
  const meta = state.meta;

  if (!timeAxis || !dayHeader || !canvas) return;

  const days = store.getVisibleDays();
  const totalMinutes = meta.endMinute - meta.startMinute;

  // --- Set CSS vars so background grid aligns with data ---
  const pxPerMin = store.config.pxPerMinute;
  const step = meta.minuteStep;

  canvas.style.setProperty("--days", String(days.length));
  canvas.style.setProperty("--minor", `${step * pxPerMin}px`);
  canvas.style.setProperty("--hour", `${60 * pxPerMin}px`);

  // --- Day header ---
  clearEl(dayHeader);
  dayHeader.style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;
  days.forEach((d) => {
    dayHeader.appendChild(el("div", { className: "schedule__day", text: d }));
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

  // IMPORTANT: Use actual canvas width so columns match header
  const daysCount = days.length;
  const colWidth = canvas.getBoundingClientRect().width / daysCount || 120;
  const gap = 2;

  state.items.forEach((item) => {
    if (!meta.showWeekend && item.dayIndex > 4) return;

    // Map weekend hiding:
    // If weekend is hidden, dayIndex 5/6 should not render
    if (!meta.showWeekend && item.dayIndex >= 5) return;

    // When weekend is shown, dayIndex is 0..6
    if (item.dayIndex < 0 || item.dayIndex >= daysCount) return;

    const top = (item.start - meta.startMinute) * pxPerMin;
    const height = Math.max(8, (item.end - item.start) * pxPerMin);

    const left = item.dayIndex * colWidth + gap;
    const width = colWidth - gap * 2;

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
    node.appendChild(
      el("div", { className: "block__meta", text: `${minsToLabel(item.start)} - ${minsToLabel(item.end)}` })
    );

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
