// /public/assets/js/features/interactions.js
import { renderSchedule } from "../core/render.js";
import { qs, clamp, roundToStep } from "../core/utils.js";

/**
 * Enables:
 * - click to add block (using window.__SB_ADD_BLOCK__ defaults)
 * - click to select block
 * - drag block to move
 * - drag handle to resize end
 */
export function initInteractions({ store, canvas }) {
  if (!canvas) return;

  const timeAxis = qs("#timeAxis");
  const dayHeader = qs("#dayHeader");

  let selectedId = null;

  // For drag
  let drag = null;

  canvas.addEventListener("click", (e) => {
    const block = e.target.closest(".block");
    if (block) {
      select(block.dataset.id);
      return;
    }

    // If user clicked empty space, maybe add block
    const add = window.__SB_ADD_BLOCK__;
    if (!add) return;

    const pos = getGridPosition(e, canvas, store);
    if (!pos) return;

    const { dayIndex, startMinute } = pos;
    const meta = store.state.meta;
    const end = startMinute + store.config.defaultBlockMinutes;

    store.addItem({
      dayIndex,
      start: startMinute,
      end,
      text: add.text,
      color: add.color
    });

    // Stop add mode after one placement
    window.__SB_ADD_BLOCK__ = null;

    // Rerender
    renderSchedule({ store, timeAxis, dayHeader, canvas, readOnly: false });
  });

  canvas.addEventListener("mousedown", (e) => {
    const handle = e.target.closest("[data-handle='end']");
    const block = e.target.closest(".block");

    if (!block) return;

    const id = block.dataset.id;
    select(id);

    const mode = handle ? "resize" : "move";

    drag = {
      id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: getItemRect(id, store)
    };

    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!drag) return;

    const meta = store.state.meta;
    const step = meta.minuteStep;
    const pxPerMin = store.config.pxPerMinute;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    const days = store.getVisibleDays().length;
    const colWidth = canvas.clientWidth / days || 120;

    const it = store.state.items.find((x) => x.id === drag.id);
    if (!it) return;

    if (drag.mode === "move") {
      // Update day by dx
      let newDay = drag.orig.dayIndex + Math.round(dx / colWidth);
      newDay = clamp(newDay, 0, days - 1);

      // Update time by dy
      const deltaMins = dy / pxPerMin;
      const newStart = roundToStep(drag.orig.start + deltaMins, step);
      const duration = drag.orig.end - drag.orig.start;
      const newStartClamped = clamp(newStart, meta.startMinute, meta.endMinute - duration);
      const newEnd = newStartClamped + duration;

      store.updateItem(it.id, { dayIndex: newDay, start: newStartClamped, end: newEnd });
    } else {
      // resize end only
      const deltaMins = dy / pxPerMin;
      const proposedEnd = roundToStep(drag.orig.end + deltaMins, step);
      const minEnd = drag.orig.start + step;
      const newEnd = clamp(proposedEnd, minEnd, meta.endMinute);
      store.updateItem(it.id, { end: newEnd });
    }

    // render after update
    renderSchedule({ store, timeAxis, dayHeader, canvas, readOnly: false });
  });

  window.addEventListener("mouseup", () => {
    drag = null;
  });

  // Keyboard delete
  window.addEventListener("keydown", (e) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
      store.deleteItem(selectedId);
      selectedId = null;
      renderSchedule({ store, timeAxis, dayHeader, canvas, readOnly: false });
    }
  });

  function select(id) {
    selectedId = id;
    // Visual selection highlight
    Array.from(canvas.querySelectorAll(".block")).forEach((b) => {
      b.classList.toggle("block--selected", b.dataset.id === id);
    });

    // Update selection UI if exists
    const selectedText = qs("#selectedText");
    const btnDelete = qs("#btnDelete");
    const btnDuplicate = qs("#btnDuplicate");

    const it = store.state.items.find((x) => x.id === id);
    if (it && selectedText) {
      selectedText.disabled = false;
      selectedText.value = it.text;
      selectedText.oninput = () => store.updateItem(id, { text: selectedText.value });
    }

    if (btnDelete) {
      btnDelete.disabled = !it;
      btnDelete.onclick = () => {
        store.deleteItem(id);
        selectedId = null;
        renderSchedule({ store, timeAxis, dayHeader, canvas, readOnly: false });
      };
    }

    if (btnDuplicate) {
      btnDuplicate.disabled = !it;
      btnDuplicate.onclick = () => {
        if (!it) return;
        store.addItem({
          dayIndex: it.dayIndex,
          start: it.start,
          end: it.end,
          text: it.text,
          color: it.color,
          notes: it.notes || ""
        });
        renderSchedule({ store, timeAxis, dayHeader, canvas, readOnly: false });
      };
    }
  }
}

function getGridPosition(e, canvas, store) {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const days = store.getVisibleDays().length;
  const colWidth = canvas.clientWidth / days || 120;

  const dayIndex = Math.floor(x / colWidth);
  if (dayIndex < 0 || dayIndex >= days) return null;

  const meta = store.state.meta;
  const pxPerMin = store.config.pxPerMinute;
  const step = meta.minuteStep;

  const minutesFromTop = y / pxPerMin;
  const startMinute = roundToStep(meta.startMinute + minutesFromTop, step);
  const clampedStart = clamp(startMinute, meta.startMinute, meta.endMinute - step);

  return { dayIndex, startMinute: clampedStart };
}

function getItemRect(id, store) {
  const it = store.state.items.find((x) => x.id === id);
  return {
    dayIndex: it?.dayIndex ?? 0,
    start: it?.start ?? store.state.meta.startMinute,
    end: it?.end ?? store.state.meta.startMinute + store.state.meta.minuteStep
  };
}
