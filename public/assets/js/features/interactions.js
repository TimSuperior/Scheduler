// /public/assets/js/features/interactions.js
import { clamp, roundToStep, qs, qsa } from "../core/utils.js";

export function initInteractions({ store, canvas }) {
  if (!canvas) return;

  const grid = qs("#grid") || canvas.closest(".schedule__grid");

  let selectedId = null;
  let armedAdd = null;
  let ignoreClicksUntil = 0;

  let drag = null; // {type, id, ptrId, offsetY, startStart, startEnd, startDay}

  document.addEventListener("sb:armed-add", (e) => {
    armedAdd = e.detail || null;
  });
  document.addEventListener("sb:armed-add-cleared", () => {
    armedAdd = null;
  });

  document.addEventListener("sb:rendered", (e) => {
    const sid = e.detail?.selectedId ?? selectedId;
    if (sid) {
      selectedId = sid;
      highlightSelected();
    }
  });

  // ---------- Click behavior ----------
  canvas.addEventListener("click", (e) => {
    if (performance.now() < ignoreClicksUntil) return;

    const blockEl = e.target.closest(".block");

    if (blockEl) {
      const id = blockEl.getAttribute("data-id");
      if (!id) return;

      select(id);
      document.dispatchEvent(new CustomEvent("sb:request-edit", { detail: { id } }));
      return;
    }

    const m = metrics();
    const pos = pointerToPos(e, m);

    if (armedAdd) {
      document.dispatchEvent(
        new CustomEvent("sb:place-armed-add", { detail: { dayIndex: pos.dayIndex } })
      );
      return;
    }

    const start = clamp(roundToStep(pos.mins, m.step), m.meta.startMinute, m.meta.endMinute - m.step);
    const dur = store.config?.defaultBlockMinutes || 60;
    const end = clamp(roundToStep(start + dur, m.step), start + m.step, m.meta.endMinute);

    document.dispatchEvent(
      new CustomEvent("sb:request-add", {
        detail: { dayIndex: pos.dayIndex, start, end }
      })
    );
  });

  // ---------- Pointer drag/resize behavior ----------
  canvas.addEventListener("pointerdown", (e) => {
    const blockEl = e.target.closest(".block");
    if (!blockEl) return;

    const id = blockEl.getAttribute("data-id");
    if (!id) return;

    select(id);

    const item = findItem(id);
    if (!item) return;

    const isHandle = !!e.target.closest(".block__handle");
    const m = metrics();

    const p = pointerAbs(e, m);
    const topPx = (item.start - m.meta.startMinute) * m.pxPerMin;

    drag = {
      type: isHandle ? "resize" : "move",
      id,
      ptrId: e.pointerId,
      offsetY: p.yAbs - topPx,
      startStart: item.start,
      startEnd: item.end,
      startDay: item.dayIndex
    };

    try {
      blockEl.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.ptrId) return;

    const item = findItem(drag.id);
    if (!item) return;

    const m = metrics();
    const p = pointerAbs(e, m);

    if (drag.type === "move") {
      const dur = drag.startEnd - drag.startStart;

      const col = clamp(Math.floor(p.xAbs / m.colWidth), 0, m.daysCount - 1);
      const dayIndex = m.visibleDayIndices[col] ?? m.visibleDayIndices[0] ?? 0;

      let start = m.meta.startMinute + (p.yAbs - drag.offsetY) / m.pxPerMin;
      start = roundToStep(start, m.step);
      start = clamp(start, m.meta.startMinute, m.meta.endMinute - dur);

      const end = start + dur;

      item.dayIndex = dayIndex;
      item.start = start;
      item.end = end;

      ignoreClicksUntil = performance.now() + 250;
      requestRender();
      return;
    }

    if (drag.type === "resize") {
      let end = m.meta.startMinute + (p.yAbs / m.pxPerMin);
      end = roundToStep(end, m.step);

      const minEnd = item.start + m.step;
      end = clamp(end, minEnd, m.meta.endMinute);

      item.end = end;

      ignoreClicksUntil = performance.now() + 250;
      requestRender();
      return;
    }
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!drag || e.pointerId !== drag.ptrId) return;
    safePersist();
    drag = null;
  });

  canvas.addEventListener("pointercancel", (e) => {
    if (!drag || e.pointerId !== drag.ptrId) return;
    drag = null;
  });

  // ---------- Helpers ----------
  function requestRender() {
    document.dispatchEvent(new Event("sb:request-render"));
  }

  function select(id) {
    selectedId = id;
    highlightSelected();
    document.dispatchEvent(new CustomEvent("sb:select", { detail: { id } }));
  }

  function highlightSelected() {
    qsa(".block--selected", canvas).forEach((n) => n.classList.remove("block--selected"));
    if (!selectedId) return;
    const n = canvas.querySelector(`.block[data-id="${CSS.escape(selectedId)}"]`);
    if (n) n.classList.add("block--selected");
  }

  function findItem(id) {
    const items = store.state?.items || [];
    return items.find((x) => x.id === id) || null;
  }

  function metrics() {
    const meta = store.state.meta;

    const pxPerMin = store.config.pxPerMinute;
    const step = meta.minuteStep || store.config.defaultStep;

    const visibleDayIndices =
      typeof store.getVisibleDayIndices === "function"
        ? store.getVisibleDayIndices()
        : (meta.showWeekend === false ? [0, 1, 2, 3, 4] : [0, 1, 2, 3, 4, 5, 6]);

    const daysCount = visibleDayIndices.length;

    const rect = canvas.getBoundingClientRect();
    const scrollW = canvas.scrollWidth || rect.width || canvas.clientWidth || 1;
    const colWidth = scrollW / daysCount;

    const scrollTop = grid ? grid.scrollTop : 0;
    const scrollLeft = grid ? grid.scrollLeft : 0;

    return { meta, pxPerMin, step, daysCount, colWidth, rect, scrollTop, scrollLeft, visibleDayIndices };
  }

  function pointerAbs(ev, m) {
    const xAbs = (ev.clientX - m.rect.left) + (m.scrollLeft || 0);
    const yAbs = (ev.clientY - m.rect.top) + (m.scrollTop || 0);
    return { xAbs, yAbs };
  }

  function pointerToPos(ev, m) {
    const p = pointerAbs(ev, m);
    const col = clamp(Math.floor(p.xAbs / m.colWidth), 0, m.daysCount - 1);
    const dayIndex = m.visibleDayIndices[col] ?? m.visibleDayIndices[0] ?? 0;
    const mins = m.meta.startMinute + (p.yAbs / m.pxPerMin);
    return { dayIndex, mins };
  }

  function safePersist() {
    if (typeof store.save === "function") return store.save();
    if (typeof store.persist === "function") return store.persist();
    if (typeof store.saveToStorage === "function") return store.saveToStorage();
    if (typeof store._save === "function") return store._save();

    try {
      const key = store.config?.storageKey || "schedule_builder_v1";
      localStorage.setItem(key, JSON.stringify(store.state));
    } catch {
      // ignore
    }
  }
}
