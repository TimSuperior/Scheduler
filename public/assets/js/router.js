// /public/assets/js/router.js
import { CONFIG } from "./core/config.js";
import { Store } from "./core/store.js";
import { renderSchedule } from "./core/render.js";
import { initEditorPage } from "./features/editor.js";
import { initInteractions } from "./features/interactions.js";
import { initExport } from "./features/export.js";
import { apiLoad } from "./core/api.js";
import { qs, getQueryParam } from "./core/utils.js";

export function initRouter() {
  const path = window.location.pathname;

  // Detect which page we're on by filename
  if (path.endsWith("/public/index.html") || path.endsWith("/public/")) {
    // Home page: nothing special needed
    return;
  }

  // Shared store across pages
  const store = new Store(CONFIG);

  // Common export/print behavior on pages that have it
  initExport({ store });

  if (path.endsWith("/public/app/editor.html")) {
    initEditorPage({ store });

    // Render basic grid
    renderSchedule({
      store,
      root: qs("#grid"),
      timeAxis: qs("#timeAxis"),
      dayHeader: qs("#dayHeader"),
      canvas: qs("#canvas"),
      readOnly: false
    });

    // Enable drag/resize/click interactions
    initInteractions({ store, canvas: qs("#canvas") });

    return;
  }

  if (path.endsWith("/public/app/view.html") || path.endsWith("/public/app/embed.html")) {
    const isEmbed = path.endsWith("/public/app/embed.html");

    // Read id from ?id=
    const id = getQueryParam("id");

    // Render empty grid first
    renderSchedule({
      store,
      root: qs("#grid") || null,
      timeAxis: qs("#timeAxis"),
      dayHeader: qs("#dayHeader"),
      canvas: qs("#canvas"),
      readOnly: true
    });

    // If view page has load UI, wire it
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
      // Auto load
      loadAndRender(id);
    } else {
      // In embed mode, don't show extra UI anyway.
      if (isEmbed) {
        // do nothing
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

  // Default fallback: try to render if schedule elements exist
  const canvas = qs("#canvas");
  if (canvas) {
    renderSchedule({ store, timeAxis: qs("#timeAxis"), dayHeader: qs("#dayHeader"), canvas, readOnly: true });
  }
}
