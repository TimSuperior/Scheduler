// /public/assets/js/features/editor.js
import { renderSchedule } from "../core/render.js";
import { qs, timeInputToMins, minsToTimeInput } from "../core/utils.js";

export function initEditorPage({ store }) {
  const titleInput = qs("#scheduleTitle");
  const startInput = qs("#startTime");
  const endInput = qs("#endTime");
  const weekendCheck = qs("#showWeekend");

  const stageTitle = qs("#stageTitle");
  const stageMeta = qs("#stageMeta");

  const btnNew = qs("#btnNew");
  const btnShare = qs("#btnShare");
  const btnAddBlock = qs("#btnAddBlock");

  const blockText = qs("#blockText");
  const blockColor = qs("#blockColor");
  const taskStart = qs("#taskStartTime");
  const taskEnd = qs("#taskEndTime");

  const canvas = qs("#canvas");
  const timeAxis = qs("#timeAxis");
  const dayHeader = qs("#dayHeader");

  // Init form from store
  const meta = store.state.meta;
  if (titleInput) titleInput.value = meta.title || "";
  if (startInput) startInput.value = minsToTimeInput(meta.startMinute);
  if (endInput) endInput.value = minsToTimeInput(meta.endMinute);
  if (weekendCheck) weekendCheck.checked = !!meta.showWeekend;

  if (taskStart && !taskStart.value) taskStart.value = "09:00";
  if (taskEnd && !taskEnd.value) taskEnd.value = "10:00";

  updateStageHeader();

  store.subscribe(() => {
    updateStageHeader();
    renderSchedule({ store, timeAxis, dayHeader, canvas, readOnly: false });
  });

  titleInput?.addEventListener("input", () => {
    store.setMeta({ title: titleInput.value.trim() || "Schedule" });
  });

  function onMetaChange() {
    const startMinute = timeInputToMins(startInput?.value);
    const endMinute = timeInputToMins(endInput?.value);
    const showWeekend = !!weekendCheck?.checked;

    const step = store.state.meta.minuteStep || 15;
    const safeEnd = Math.max(endMinute, startMinute + step);

    // This will also clamp existing items now (Store.setMeta does that)
    store.setMeta({ startMinute, endMinute: safeEnd, showWeekend });
  }

  // IMPORTANT: input event updates instantly; change is kept as fallback.
  startInput?.addEventListener("input", onMetaChange);
  endInput?.addEventListener("input", onMetaChange);
  startInput?.addEventListener("change", onMetaChange);
  endInput?.addEventListener("change", onMetaChange);

  weekendCheck?.addEventListener("change", onMetaChange);

  btnNew?.addEventListener("click", () => store.reset());

  // Add block: choose task start/end, then click grid to pick day
  btnAddBlock?.addEventListener("click", () => {
    const text = (blockText?.value || "").trim() || "Block";
    const color = blockColor?.value || "#4f46e5";
    const s = timeInputToMins(taskStart?.value);
    const e = timeInputToMins(taskEnd?.value);

    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) {
      alert("Task end time must be later than start time.");
      return;
    }

    window.__SB_ADD_BLOCK__ = {
      text,
      color,
      startMinute: s,
      endMinute: e,
      mode: "pick-day"
    };

    btnAddBlock.textContent = "Now click the grid to pick a day…";
    setTimeout(() => {
      if (btnAddBlock) btnAddBlock.textContent = "Add block (pick a day on grid)";
    }, 1600);
  });

  btnShare?.addEventListener("click", () => {});

  function updateStageHeader() {
    const m = store.state.meta;
    if (stageTitle) stageTitle.textContent = m.title || "Schedule";
    if (stageMeta) stageMeta.textContent = store.getMetaLine();
  }
}
