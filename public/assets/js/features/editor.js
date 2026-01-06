// /public/assets/js/features/editor.js
import { renderSchedule } from "../core/render.js";
import { qs, uid, timeInputToMins, minsToTimeInput, minsToLabel } from "../core/utils.js";

export function initEditorPage({ store }) {
  const canvas = qs("#canvas");
  const timeAxis = qs("#timeAxis");
  const dayHeader = qs("#dayHeader");

  const stageTitle = qs("#stageTitle");
  const stageMeta = qs("#stageMeta");

  // Settings modal inputs (same IDs you already use)
  const inpTitle = qs("#scheduleTitle");
  const inpStart = qs("#startTime");
  const inpEnd = qs("#endTime");
  const chkWeekend = qs("#showWeekend");

  // Add/Edit modal inputs (same IDs you already use)
  const inpText = qs("#blockText");
  const inpColor = qs("#blockColor");
  const inpTaskStart = qs("#taskStartTime");
  const inpTaskEnd = qs("#taskEndTime");
  const btnSubmit = qs("#btnAddBlock");

  // ✅ Add/Edit modal header + buttons
  const modalHeadingText = qs("#modalAddHeadingText");
  const btnCopySelection = qs("#sbCopySelection");
  const btnDeleteBlock = qs("#btnDeleteBlock");

  // ✅ Top/side buttons you asked to fix
  const btnTopNew = qs("#btnNew");
  const btnSideNew = qs("#sideNew");
  const btnSideReset = qs("#sideReset");
  const btnSideAdd = qs("#sideAdd");
  const btnResetNewSchedule = qs("#resetNewSchedule");
  const btnResetThemeOnly = qs("#resetThemeOnly");

  // Optional description if you add it later (won't break if missing)
  const inpDesc =
    qs("#blockDesc") || qs("#blockDescription") || qs("#description") || null;

  // Selection UI (inside Selection modal)
  const selectedText = qs("#selectedText");
  const selectionHint = qs("#selectionHint");
  const btnDuplicate = qs("#btnDuplicate");
  const btnDelete = qs("#btnDelete");

  // Internal UI state
  let selectedId = null;

  // For click-a-tile => open add modal with suggested time/day
  let pendingPlacement = null; // { dayIndex, start, end }

  // Edit mode
  let editId = null;

  // Old flow: "Add" then click on grid to place
  // interactions.js listens to this event and places using this data
  let armedAdd = null; // { text, color, start, end, description? }

  // ---------- Render glue ----------
  let renderQueued = false;

  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderNow();
    });
  }

  function renderNow() {
    renderSchedule({
      store,
      timeAxis,
      dayHeader,
      canvas,
      readOnly: false
    });

    // Keep header updated
    const meta = store.state.meta;
    if (stageTitle) stageTitle.textContent = meta.title || "Schedule";
    if (stageMeta) stageMeta.textContent = getMetaLine(store);

    // Notify interactions to re-apply selection highlight after DOM re-creates blocks
    document.dispatchEvent(
      new CustomEvent("sb:rendered", { detail: { selectedId } })
    );
  }

  // Router already renders once, but we want header consistent
  renderNow();

  // interactions.js will ask for renders during drag/resize
  document.addEventListener("sb:request-render", requestRender);

  // ---------- Modal helpers (compatible with your main.js modal style) ----------
  function openModal(id) {
    const ov = document.getElementById(id);
    if (!ov) return;
    ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add("is-open"));
    document.body.classList.add("is-modal-open");
  }

  function closeModal(id) {
    const ov = document.getElementById(id);
    if (!ov) return;
    ov.classList.remove("is-open");
    setTimeout(() => {
      ov.hidden = true;
      // If no other open overlays exist, remove marker class
      const anyOpen = !!document.querySelector(".modal-overlay.is-open");
      if (!anyOpen) document.body.classList.remove("is-modal-open");
    }, 180);
  }

  // ✅ Add/Edit modal mode switching (ONLY what you asked)
  function setEventModalMode(mode) {
    const isEdit = mode === "edit";

    if (modalHeadingText) modalHeadingText.textContent = isEdit ? "Edit event" : "Add event";
    if (btnSubmit) btnSubmit.textContent = isEdit ? "Update" : "Add";

    if (btnCopySelection) btnCopySelection.hidden = !isEdit;   // hide on Add, show on Edit
    if (btnDeleteBlock) btnDeleteBlock.hidden = !isEdit;       // only show on Edit
  }

  // ---------- Store helpers (work with or without Store methods) ----------
  function persist() {
    // Prefer store built-ins if they exist
    if (typeof store.save === "function") return store.save();
    if (typeof store.persist === "function") return store.persist();
    if (typeof store.saveToStorage === "function") return store.saveToStorage();
    if (typeof store._save === "function") return store._save();

    // Fallback: localStorage
    try {
      const key = store.config?.storageKey || "schedule_builder_v1";
      localStorage.setItem(key, JSON.stringify(store.state));
    } catch {
      // ignore
    }
  }

  function findItem(id) {
    const arr = store.state?.items || [];
    return arr.find((x) => x.id === id) || null;
  }

  function addItem(item) {
    if (typeof store.addItem === "function") {
      store.addItem(item);
    } else if (Array.isArray(store.state?.items)) {
      store.state.items.push(item);
    }
    persist();
  }

  function updateItem(id, patch) {
    if (typeof store.updateItem === "function") {
      store.updateItem(id, patch);
      persist();
      return;
    }
    const it = findItem(id);
    if (!it) return;
    Object.assign(it, patch);
    persist();
  }

  function removeItem(id) {
    if (typeof store.removeItem === "function") {
      store.removeItem(id);
    } else if (typeof store.deleteItem === "function") {
      store.deleteItem(id);
    } else if (Array.isArray(store.state?.items)) {
      store.state.items = store.state.items.filter((x) => x.id !== id);
    }
    persist();
  }

  function updateMeta(patch) {
    if (typeof store.updateMeta === "function") {
      store.updateMeta(patch);
    } else if (store.state?.meta) {
      Object.assign(store.state.meta, patch);
    }
    persist();
  }

  // ---------- Inputs <-> meta ----------
  function syncSettingsUIFromStore() {
    const meta = store.state.meta;

    if (inpTitle) inpTitle.value = meta.title || "";
    if (inpStart) inpStart.value = minsToTimeInput(meta.startMinute ?? store.config.defaultStart);
    if (inpEnd) inpEnd.value = minsToTimeInput(meta.endMinute ?? store.config.defaultEnd);
    if (chkWeekend) chkWeekend.checked = meta.showWeekend !== false;
  }

  syncSettingsUIFromStore();

  if (inpTitle) {
    inpTitle.addEventListener("input", () => {
      updateMeta({ title: inpTitle.value.trim() || store.config.defaultTitle });
      requestRender();
    });
  }

  if (inpStart) {
    inpStart.addEventListener("change", () => {
      const start = timeInputToMins(inpStart.value);
      const end = store.state.meta.endMinute;
      if (start >= end) return; // keep valid
      updateMeta({ startMinute: start });
      requestRender();
    });
  }

  if (inpEnd) {
    inpEnd.addEventListener("change", () => {
      const end = timeInputToMins(inpEnd.value);
      const start = store.state.meta.startMinute;
      if (end <= start) return; // keep valid
      updateMeta({ endMinute: end });
      requestRender();
    });
  }

  if (chkWeekend) {
    chkWeekend.addEventListener("change", () => {
      updateMeta({ showWeekend: !!chkWeekend.checked });
      requestRender();
    });
  }

  // ---------- Selection (from interactions.js) ----------
  document.addEventListener("sb:select", (e) => {
    selectedId = e.detail?.id || null;
    const it = selectedId ? findItem(selectedId) : null;

    if (selectedText) {
      selectedText.disabled = !it;
      selectedText.value = it ? it.text || "" : "";
    }

    if (selectionHint) {
      selectionHint.textContent = it ? "Selected." : "Select a block to edit its details.";
    }

    if (btnDuplicate) btnDuplicate.disabled = !it;
    if (btnDelete) btnDelete.disabled = !it;
  });

  if (btnDuplicate) {
    btnDuplicate.addEventListener("click", () => {
      if (!selectedId) return;
      const it = findItem(selectedId);
      if (!it) return;

      const meta = store.state.meta;
      const step = meta.minuteStep || store.config.defaultStep;

      const dur = (it.end - it.start);
      let start = it.start + step;
      let end = start + dur;

      // Clamp
      if (end > meta.endMinute) {
        end = meta.endMinute;
        start = Math.max(meta.startMinute, end - dur);
      }

      const copy = {
        ...it,
        id: uid(),
        start,
        end
      };

      addItem(copy);
      selectedId = copy.id;

      document.dispatchEvent(new CustomEvent("sb:select", { detail: { id: selectedId } }));
      requestRender();
    });
  }

  if (btnDelete) {
    btnDelete.addEventListener("click", () => {
      if (!selectedId) return;
      removeItem(selectedId);
      selectedId = null;

      document.dispatchEvent(new CustomEvent("sb:select", { detail: { id: null } }));
      requestRender();
    });
  }

  // ---------- ✅ Fix New / Reset ----------
  function openResetModal() {
    openModal("modalReset");
  }

  btnTopNew?.addEventListener("click", openResetModal);
  btnSideNew?.addEventListener("click", openResetModal);
  btnSideReset?.addEventListener("click", openResetModal);

  btnResetNewSchedule?.addEventListener("click", () => {
    // "New schedule"
    selectedId = null;
    pendingPlacement = null;
    editId = null;
    armedAdd = null;

    if (typeof store.reset === "function") {
      store.reset();
    } else {
      // fallback
      store.state.items = [];
      updateMeta({
        title: store.config.defaultTitle,
        startMinute: store.config.defaultStart,
        endMinute: store.config.defaultEnd,
        minuteStep: store.config.defaultStep,
        showWeekend: store.config.defaultShowWeekend
      });
      persist();
    }

    document.dispatchEvent(new CustomEvent("sb:select", { detail: { id: null } }));
    closeModal("modalReset");
    requestRender();
  });

  btnResetThemeOnly?.addEventListener("click", () => {
    // reuse existing theme reset handler if present
    document.getElementById("btnThemeReset")?.click();
    closeModal("modalReset");
  });

  // ---------- ✅ Ensure side Add opens the modal (and hides Copy in Add mode) ----------
  btnSideAdd?.addEventListener("click", () => {
    pendingPlacement = null;
    editId = null;
    setEventModalMode("add");
    openModal("modalAdd");
    if (inpText) setTimeout(() => inpText.focus(), 0);
  });

  // ---------- Requests from interactions.js ----------
  // Click empty grid tile => open Add modal (prefill time)
  document.addEventListener("sb:request-add", (e) => {
    const d = e.detail || null;
    if (!d) return;

    pendingPlacement = {
      dayIndex: d.dayIndex,
      start: d.start,
      end: d.end
    };
    editId = null;

    setEventModalMode("add");

    // Prefill inputs based on clicked tile
    if (inpTaskStart) inpTaskStart.value = minsToTimeInput(d.start);
    if (inpTaskEnd) inpTaskEnd.value = minsToTimeInput(d.end);

    // If your day selector exists, and nothing is selected yet, preselect clicked day
    preselectAddDaysIfEmpty(d.dayIndex);

    openModal("modalAdd");

    // focus title
    if (inpText) setTimeout(() => inpText.focus(), 0);
  });

  // Click existing block => open Add modal but in Edit mode (prefill all)
  document.addEventListener("sb:request-edit", (e) => {
    const id = e.detail?.id;
    const it = id ? findItem(id) : null;
    if (!it) return;

    pendingPlacement = null;
    editId = id;

    setEventModalMode("edit");

    if (inpText) inpText.value = it.text || "";
    if (inpColor) inpColor.value = it.color || "#4f46e5";
    if (inpTaskStart) inpTaskStart.value = minsToTimeInput(it.start);
    if (inpTaskEnd) inpTaskEnd.value = minsToTimeInput(it.end);
    if (inpDesc && typeof it.description === "string") inpDesc.value = it.description;

    openModal("modalAdd");

    if (inpText) setTimeout(() => inpText.focus(), 0);
  });

  // ✅ Delete button in Edit modal
  btnDeleteBlock?.addEventListener("click", () => {
    if (!editId) return;
    removeItem(editId);
    editId = null;

    document.dispatchEvent(new CustomEvent("sb:select", { detail: { id: null } }));
    closeModal("modalAdd");
    requestRender();
  });

  // Old flow: user pressed Add without clicking tile first => arm placement
  document.addEventListener("sb:place-armed-add", (e) => {
    if (!armedAdd) return;

    const dayIndex = e.detail?.dayIndex;
    if (typeof dayIndex !== "number") return;

    const item = {
      id: uid(),
      dayIndex,
      start: armedAdd.start,
      end: armedAdd.end,
      text: armedAdd.text,
      color: armedAdd.color
    };
    if (armedAdd.description != null) item.description = armedAdd.description;

    addItem(item);

    armedAdd = null;
    document.dispatchEvent(new CustomEvent("sb:armed-add-cleared"));
    document.dispatchEvent(new CustomEvent("sb:select", { detail: { id: item.id } }));

    requestRender();
  });

  // ---------- Submit button in Add/Edit modal ----------
  if (btnSubmit) {
    btnSubmit.addEventListener("click", () => {
      const text = (inpText?.value || "").trim() || "Event";
      const color = inpColor?.value || "#4f46e5";
      const start = timeInputToMins(inpTaskStart?.value || "09:00");
      const end = timeInputToMins(inpTaskEnd?.value || "10:00");
      const description = inpDesc ? (inpDesc.value || "").trim() : null;

      // sanitize times
      const meta = store.state.meta;
      const step = meta.minuteStep || store.config.defaultStep;

      let s = start;
      let e = end;

      if (e <= s) e = s + step;
      if (s < meta.startMinute) s = meta.startMinute;
      if (e > meta.endMinute) e = meta.endMinute;
      if (e <= s) e = Math.min(meta.endMinute, s + step);

      // EDIT mode
      if (editId) {
        const it = findItem(editId);
        if (!it) return;

        updateItem(editId, {
          text,
          color,
          start: s,
          end: e,
          ...(description != null ? { description } : {})
        });

        closeModal("modalAdd");
        requestRender();
        return;
      }

      // ✅ ADD mode with known placement (clicked tile)
      // If user selected multiple days in Add modal, create copies for each selected day.
      if (pendingPlacement) {
        const selectedDays = getAddModalSelectedDays();
        const dayList = (selectedDays.length ? selectedDays : [pendingPlacement.dayIndex])
          .filter((d) => Number.isFinite(d) && d >= 0 && d <= 6);

        const uniqueDays = Array.from(new Set(dayList));
        if (uniqueDays.length === 0) return;

        const createdIds = [];

        for (const dayIndex of uniqueDays) {
          const item = {
            id: uid(),
            dayIndex,
            start: s,
            end: e,
            text,
            color
          };
          if (description != null) item.description = description;

          addItem(item);
          createdIds.push(item.id);
        }

        pendingPlacement = null;
        closeModal("modalAdd");

        // Select first created (keeps selection logic consistent)
        document.dispatchEvent(new CustomEvent("sb:select", { detail: { id: createdIds[0] || null } }));
        requestRender();
        return;
      }

      // ADD mode without placement: keep your old “pick a day on grid” workflow
      armedAdd = { text, color, start: s, end: e };
      if (description != null) armedAdd.description = description;

      document.dispatchEvent(new CustomEvent("sb:armed-add", { detail: armedAdd }));

      // Let user click grid to place (same as your old behavior)
      closeModal("modalAdd");
    });
  }

  // If modal is closed manually, reset add/edit state
  document.addEventListener("click", (e) => {
    const closeBtn = e.target?.closest?.("[data-modal-close]");
    if (!closeBtn) return;
    // only clear if closing the add modal
    const ov = closeBtn.closest(".modal-overlay");
    if (!ov || ov.id !== "modalAdd") return;

    pendingPlacement = null;
    editId = null;
    setEventModalMode("add"); // ensure next open starts clean (Copy hidden)
  });

  // ---- helpers for multi-day Add modal ----
  function getAddModalSelectedDays() {
    const wrap = document.getElementById("sbAddDays");
    if (!wrap) return [];
    const btns = Array.from(wrap.querySelectorAll(".sb-day.is-on"));
    const out = [];
    for (const b of btns) {
      const v = Number(b.getAttribute("data-day"));
      if (Number.isFinite(v)) out.push(v);
    }
    return Array.from(new Set(out)).sort((a, b) => a - b);
  }

  function preselectAddDaysIfEmpty(dayIndex) {
    const wrap = document.getElementById("sbAddDays");
    if (!wrap) return;
    const anyOn = !!wrap.querySelector(".sb-day.is-on");
    if (anyOn) return;
    const btn = wrap.querySelector(`.sb-day[data-day="${dayIndex}"]`);
    if (btn) btn.classList.add("is-on");
  }
}

function getMetaLine(store) {
  if (typeof store.getMetaLine === "function") return store.getMetaLine();

  const meta = store.state.meta;
  const start = minsToLabel(meta.startMinute);
  const end = minsToLabel(meta.endMinute);
  const step = meta.minuteStep || store.config.defaultStep;

  return `${start} – ${end} • ${step} min steps`;
}
