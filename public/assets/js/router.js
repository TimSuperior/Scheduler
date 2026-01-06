// /public/assets/js/router.js
import { CONFIG } from "./core/config.js";
import { Store } from "./core/store.js";
import { renderSchedule } from "./core/render.js";
import { initEditorPage } from "./features/editor.js";
import { initInteractions } from "./features/interactions.js";
import { initExport } from "./features/export.js";
import { apiLoad } from "./core/api.js";
import { qs, getQueryParam } from "./core/utils.js";
import { initThemeSettings } from "./features/settings.js";
import { setScheduleMode, getScheduleMode } from "./core/timeformat.js";

export function initRouter() {
  const path = window.location.pathname;

  if (path.endsWith("/public/index.html") || path.endsWith("/public/")) {
    return;
  }

  const store = new Store(CONFIG);

  initExport({ store });

  if (path.endsWith("/public/app/editor.html") || path.endsWith("/public/app/edit.html")) {
    initThemeSettings();
    initEditorPage({ store });

    // Expose for UI layer (settings modal)
    window.__SB_STORE = store;

    const timeAxis = qs("#timeAxis");
    const dayHeader = qs("#dayHeader");
    const canvas = qs("#canvas");

    // Apply saved UI settings into store.meta (from main.js key)
    applySavedUiSettings(store);

    function doRender() {
      renderSchedule({
        store,
        root: qs("#grid"),
        timeAxis,
        dayHeader,
        canvas,
        readOnly: false
      });

      const titleEl = qs("#stageTitle");
      const metaEl = qs("#stageMeta");
      if (titleEl) titleEl.textContent = store.state.meta.title || "Schedule";
      if (metaEl) metaEl.textContent = store.getMetaLine();
    }

    window.__SB_RENDER = doRender;

    doRender();
    initInteractions({ store, canvas });

    return;
  }

  if (path.endsWith("/public/app/view.html") || path.endsWith("/public/app/embed.html")) {
    const isEmbed = path.endsWith("/public/app/embed.html");
    const id = getQueryParam("id");

    renderSchedule({
      store,
      root: qs("#grid") || null,
      timeAxis: qs("#timeAxis"),
      dayHeader: qs("#dayHeader"),
      canvas: qs("#canvas"),
      readOnly: true
    });

    const btnLoad = qs("#btnLoad");
    const inputId = qs("#scheduleId");
    const status = qs("#loadStatus");

    if (btnLoad && inputId) {
      btnLoad.addEventListener("click", async () => {
        const val = inputId.value.trim();
        if (!val) return;
        await loadAndRender(val);
      });
    }

    if (id) {
      loadAndRender(id);
    } else {
      if (isEmbed) {
        // nothing
      }
    }

    async function loadAndRender(loadId) {
      try {
        if (status) status.textContent = "Loading…";
        const data = await apiLoad(loadId);
        store.replaceAll(data);

        renderSchedule({
          store,
          timeAxis: qs("#timeAxis"),
          dayHeader: qs("#dayHeader"),
          canvas: qs("#canvas"),
          readOnly: true
        });

        if (status) status.textContent = "Loaded.";
        const titleEl = qs("#stageTitle");
        const metaEl = qs("#stageMeta");
        if (titleEl) titleEl.textContent = store.state.meta.title || "Schedule";
        if (metaEl) metaEl.textContent = store.getMetaLine();
      } catch (err) {
        console.error(err);
        if (status) status.textContent = "Failed to load. Check the ID.";
      }
    }

    return;
  }

  const canvas = qs("#canvas");
  if (canvas) {
    renderSchedule({ store, timeAxis: qs("#timeAxis"), dayHeader: qs("#dayHeader"), canvas, readOnly: true });
  }
}

function applySavedUiSettings(store) {
  // This key is used by main.js
  const KEY = "sb_editor_ui_settings_v1";
  let cfg = null;

  try {
    const raw = localStorage.getItem(KEY);
    cfg = raw ? JSON.parse(raw) : null;
  } catch {
    cfg = null;
  }

  // clock
  const clockMode = cfg && (cfg.clockMode === "12" || cfg.clockMode === "24") ? cfg.clockMode : getScheduleMode();
  setScheduleMode(clockMode);

  // meta options for rendering
  if (store && store.state && store.state.meta) {
    const m = store.state.meta;
    m.minuteStep = Number(cfg?.minuteStep) || m.minuteStep || 15;
    m.showDates = !!(cfg?.showDates === "yes");
    m.week = String(cfg?.week || "");
    m.showTimeInEvents = cfg?.showTimeInEvents !== "no";
    m.autoColor = cfg?.autoColor !== "no";
    m.fontFamily = String(cfg?.fontFamily || "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif");
    m.eventTextColor = String(cfg?.eventTextColor || "#1b1f2a");

    // ✅ NEW: apply per-day visibility if saved
    if (Array.isArray(cfg?.daysVisible) && cfg.daysVisible.length === 7) {
      const v = cfg.daysVisible.map((b) => !!b);
      m.visibleDays = v;
      m.hiddenDays = v.map((on, i) => (on ? null : i)).filter((x) => x != null);
      m.showWeekend = !!(v[5] || v[6]);
    }
  }

  // Apply CSS vars + classes
  document.documentElement.style.setProperty("--sb-font", String(cfg?.fontFamily || "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"));
  document.documentElement.style.setProperty("--sb-event-text", String(cfg?.eventTextColor || "#1b1f2a"));

  document.body.classList.toggle("sb-hide-title", cfg?.showTitle === "no");
  document.body.classList.toggle("sb-center-text", cfg?.centerText === "yes");
  document.body.classList.toggle("sb-stretch-text", cfg?.stretchText === "yes");
}
