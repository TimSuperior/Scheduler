// /public/assets/js/core/render.js
import { clearEl, el, minsToLabel } from "./utils.js";

export function renderSchedule({ store, timeAxis, dayHeader, canvas, readOnly = false }) {
  const state = store.state;
  const meta = state.meta;

  if (!timeAxis || !dayHeader || !canvas) return;

  const days = store.getVisibleDays();
  const totalMinutes = meta.endMinute - meta.startMinute;

  // Render day header
  clearEl(dayHeader);
  dayHeader.style.gridTemplateColumns = `repeat(${days.length}, 1fr)`;
  days.forEach((d) => {
    dayHeader.appendChild(el("div", { className: "schedule__day", text: d }));
  });

  // Render axis
  clearEl(timeAxis);
  const hourStep = 60;
  for (let t = meta.startMinute; t < meta.endMinute; t += hourStep) {
    const label = minsToLabel(t);
    timeAxis.appendChild(el("div", { className: "time-label", text: label }));
  }

  // Canvas height based on minutes
  const pxPerMin = store.config.pxPerMinute;
  canvas.style.height = `${totalMinutes * pxPerMin}px`;

  // Background columns feel better if we set CSS var for width calc later
  canvas.dataset.days = String(days.length);

  // Render blocks
  clearEl(canvas);
  const colWidth = canvas.clientWidth / days.length || 120; // fallback
  const gap = 2;

  state.items.forEach((item) => {
    if (!meta.showWeekend && item.dayIndex > 4) return;
    if (item.dayIndex < 0 || item.dayIndex >= days.length) return;

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

    // apply color
    node.style.background = withAlpha(item.color, 0.22);
    node.style.borderColor = withAlpha(item.color, 0.45);

    const title = el("div", { className: "block__title", text: item.text });
    const metaLine = el("div", {
      className: "block__meta",
      text: `${minsToLabel(item.start)} - ${minsToLabel(item.end)}`
    });

    node.appendChild(title);
    node.appendChild(metaLine);

    // If interactive, add resize handle
    if (!readOnly) {
      const handle = el("div", { className: "block__handle", attrs: { "data-handle": "end" } });
      node.appendChild(handle);
    }

    canvas.appendChild(node);
  });
}

/** Convert hex to rgba string with alpha. Accepts #rrggbb. */
function withAlpha(hex, a) {
  const v = (hex || "").replace("#", "").trim();
  if (v.length !== 6) return `rgba(79,70,229,${a})`;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
