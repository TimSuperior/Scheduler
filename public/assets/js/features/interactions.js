// /public/assets/js/features/interactions.js
import { clamp, roundToStep, qs, qsa } from "../core/utils.js";

export function initInteractions({ store, canvas }) {
  if (!canvas) return;

  const grid = qs("#grid") || canvas.closest(".schedule__grid");

  let selectedId = null;

  // Old "Add then click grid" flow support
  let armedAdd = null;

  // Prevent edit-opening click after a drag
  let ignoreClicksUntil = 0;

  // Drag state
  let drag = null; // {type, id, ptrId, offsetY, startStart, startEnd, startDay}

  // Listen for armed-add from editor.js
  document.addEventListener("sb:armed-add", (e) => {
    armedAdd = e.detail || null;
  });
  document.addEventListener("sb:armed-add-cleared", () => {
    armedAdd = null;
  });

  // Reapply selection highlight after re-render
  document.addEventListener("sb:rendered", (e) => {
    const sid = e.detail?.selectedId ?? selectedId;
    if (sid) {
      selectedId = sid;
      highlightSelected();
    }
  });

  // ---------- Click behavior ----------
  // - Click empty tile => open add modal (NEW)
  // - Click block => open edit modal (NEW)
  canvas.addEventListener("click", (e) => {
    if (performance.now() < ignoreClicksUntil) return;

    const blockEl = e.target.closest(".block");

    // Click on existing block => edit
    if (blockEl) {
      const id = blockEl.getAttribute("data-id");
      if (!id) return;

      select(id);

      document.dispatchEvent(new CustomEvent("sb:request-edit", { detail: { id } }));
      return;
    }

    // Click on empty canvas => either place armed add OR open add modal
    const m = metrics();
    const pos = pointerToPos(e, m);

    if (armedAdd) {
      // Place immediately using armedAdd times (old workflow)
      document.dispatchEvent(
        new CustomEvent("sb:place-armed-add", { detail: { dayIndex: pos.dayIndex } })
      );
      return;
    }

    // Open add modal (new workflow) with suggested time based on click y
    const start = clamp(roundToStep(pos.mins, m.step), m.meta.startMinute, m.meta.endMinute - m.step);
    const dur = store.config?.defaultBlockMinutes || 60;
    const end = clamp(roundToStep(start + dur, m.step), start + m.step, m.meta.endMinute);

    document.dispatchEvent(
      new CustomEvent("sb:request-add", {
        detail: { dayIndex: pos.dayIndex, start, end }
      })
    );
  });

  // ---------- Pointer drag/resize behavior (keep move/resizing) ----------
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
      offsetY: p.yAbs - topPx, // for move
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

      // day from pointer X
      const dayIndex = clamp(Math.floor(p.xAbs / m.colWidth), 0, m.daysCount - 1);

      // start from pointer Y with grab offset
      let start = m.meta.startMinute + (p.yAbs - drag.offsetY) / m.pxPerMin;
      start = roundToStep(start, m.step);

      // clamp start so end stays within range
      start = clamp(start, m.meta.startMinute, m.meta.endMinute - dur);

      const end = start + dur;

      item.dayIndex = dayIndex;
      item.start = start;
      item.end = end;

      ignoreClicksUntil = performance.now() + 250;
      requestRender();
      return;
    }

    // resize end
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

    // persist if store has methods; otherwise editor.js persist is already used on add/update.
    // Here we only request a render; persistence depends on your Store.
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

    const daysCount = store.getVisibleDays().length;

    // IMPORTANT: use scrollWidth for accurate horizontal mapping when grid scrolls
    const rect = canvas.getBoundingClientRect();
    const scrollW = canvas.scrollWidth || rect.width || canvas.clientWidth || 1;
    const colWidth = scrollW / daysCount;

    const scrollTop = grid ? grid.scrollTop : 0;
    const scrollLeft = grid ? grid.scrollLeft : 0;

    return { meta, pxPerMin, step, daysCount, colWidth, rect, scrollTop, scrollLeft };
  }

  function pointerAbs(ev, m) {
    const xAbs = (ev.clientX - m.rect.left) + (m.scrollLeft || 0);
    const yAbs = (ev.clientY - m.rect.top) + (m.scrollTop || 0);
    return { xAbs, yAbs };
  }

  function pointerToPos(ev, m) {
    const p = pointerAbs(ev, m);
    const dayIndex = clamp(Math.floor(p.xAbs / m.colWidth), 0, m.daysCount - 1);
    const mins = m.meta.startMinute + (p.yAbs / m.pxPerMin);
    return { dayIndex, mins };
  }

  function safePersist() {
    if (typeof store.save === "function") return store.save();
    if (typeof store.persist === "function") return store.persist();
    if (typeof store.saveToStorage === "function") return store.saveToStorage();
    if (typeof store._save === "function") return store._save();

    // fallback
    try {
      const key = store.config?.storageKey || "schedule_builder_v1";
      localStorage.setItem(key, JSON.stringify(store.state));
    } catch {
      // ignore
    }
  }
}
