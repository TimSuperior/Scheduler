// /public/assets/js/features/editor.js
import { renderSchedule } from "../core/render.js";
import { qs, timeInputToMins, minsToTimeInput } from "../core/utils.js";

export function initEditorPage({ store }) {
  const titleInput = qs("#scheduleTitle");
  const startInput = qs("#startTime");
  const endInput = qs("#endTime");
  const stepSelect = qs("#minuteStep");
  const weekendCheck = qs("#showWeekend");

  const stageTitle = qs("#stageTitle");
  const stageMeta = qs("#stageMeta");

  const btnNew = qs("#btnNew");
  const btnShare = qs("#btnShare");
  const btnAddBlock = qs("#btnAddBlock");

  const blockText = qs("#blockText");
  const blockColor = qs("#blockColor");

  const canvas = qs("#canvas");
  const timeAxis = qs("#timeAxis");
  const dayHeader = qs("#dayHeader");

  // Initialize form from store
  const meta = store.state.meta;
  if (titleInput) titleInput.value = meta.title || "";
  if (startInput) startInput.value = minsToTimeInput(meta.startMinute);
  if (endInput) endInput.value = minsToTimeInput(meta.endMinute);
  if (stepSelect) stepSelect.value = String(meta.minuteStep);
  if (weekendCheck) weekendCheck.checked = !!meta.showWeekend;

  updateStageHeader();

  // Subscribe to store changes to update header
  store.subscribe(() => {
    updateStageHeader();
    // Re-render schedule when meta changes
    renderSchedule({ store, timeAxis, dayHeader, canvas, readOnly: false });
  });

  // Meta changes
  titleInput?.addEventListener("input", () => {
    store.setMeta({ title: titleInput.value.trim() || "Schedule" });
  });

  function onMetaChange() {
    const startMinute = timeInputToMins(startInput?.value);
    const endMinute = timeInputToMins(endInput?.value);
    const minuteStep = Number(stepSelect?.value || 15);
    const showWeekend = !!weekendCheck?.checked;

    // Basic safety: ensure end > start
    const safeEnd = Math.max(endMinute, startMinute + minuteStep);

    store.setMeta({ startMinute, endMinute: safeEnd, minuteStep, showWeekend });
  }

  startInput?.addEventListener("change", onMetaChange);
  endInput?.addEventListener("change", onMetaChange);
  stepSelect?.addEventListener("change", onMetaChange);
  weekendCheck?.addEventListener("change", onMetaChange);

  // New schedule
  btnNew?.addEventListener("click", () => {
    store.reset();
  });

  // Add block mode hint (real click-to-add is in interactions.js)
  btnAddBlock?.addEventListener("click", () => {
    // store temporary defaults on window for interactions
    window.__SB_ADD_BLOCK__ = {
      text: (blockText?.value || "").trim() || "Block",
      color: blockColor?.value || "#4f46e5"
    };
    // UI feedback
    btnAddBlock.textContent = "Click a cell to place block…";
    setTimeout(() => (btnAddBlock.textContent = "Add block (click grid)"), 1800);
  });

  // Share is implemented in export.js, but we can label it here
  btnShare?.addEventListener("click", () => {
    // export.js listens for this id too
  });

  function updateStageHeader() {
    const m = store.state.meta;
    if (stageTitle) stageTitle.textContent = m.title || "Schedule";
    if (stageMeta) stageMeta.textContent = store.getMetaLine();
  }
}
