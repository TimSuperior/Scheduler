// /public/assets/js/main.js
import { initRouter } from "./router.js";
import { bootCommon } from "./core/utils.js";
import { setScheduleMode, getScheduleMode } from "./core/timeformat.js";

bootCommon();
initRouter();

// Small UI layer: right-side actions + modals (keeps all existing IDs)
setupEditorChrome();

function setupEditorChrome() {
  const isEditor = document.body.classList.contains("page--editor") || !!document.getElementById("canvas");
  if (!isEditor) return;

  const { openModal, closeModal, closeTopModal } = setupModals();

  // Sidebar buttons -> open modals / trigger existing topbar buttons
  wire("sideAdd", () => openModal("modalAdd"));
  wire("sideSettings", () => openModal("modalSettings"));
  wire("sideBackground", () => openModal("modalTheme"));
  wire("sideSelection", () => openModal("modalSelection"));
  wire("sideShare", () => clickIfExists("btnShare"));
  wire("sideReset", () => openModal("modalReset"));

  // Mini tiles (still trigger existing logic)
  wire("sideNew", () => clickIfExists("btnNew"));
  wire("sidePrint", () => clickIfExists("btnPrint"));
  wire("sideQuickShare", () => clickIfExists("btnShare"));

  // Reset modal actions
  wire("resetNewSchedule", () => {
    closeModal("modalReset");
    clickIfExists("btnNew");
  });
  wire("resetThemeOnly", () => {
    closeModal("modalReset");
    const btn = document.getElementById("btnThemeReset");
    if (btn) btn.click();
  });

  // Theme dropdown (guaranteed working)
  const themeToggle = document.getElementById("themeToggle");
  const themeBody = document.getElementById("themeBody");
  if (themeToggle && themeBody) {
    themeToggle.addEventListener("click", () => {
      const expanded = themeToggle.getAttribute("aria-expanded") === "true";
      themeToggle.setAttribute("aria-expanded", expanded ? "false" : "true");
      themeBody.hidden = expanded ? true : false;
    });
  }

  // ESC closes modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeTopModal();
  });

  // Settings tabs + bindings
  setupSettingsTabs({ closeModal });
  setupSettingsBindings({ closeModal });

  // Add modal: copy button + auto color + optional forced-day helper
  setupAddModalEnhancements({ closeModal });

  function wire(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("click", fn);
  }

  function clickIfExists(id) {
    const btn = document.getElementById(id);
    if (btn) btn.click();
  }
}

function setupModals() {
  const overlays = Array.from(document.querySelectorAll(".modal-overlay"));
  const stack = [];

  overlays.forEach((ov) => {
    ov.addEventListener("click", (e) => {
      if (e.target === ov) closeOverlay(ov);
    });

    ov.querySelectorAll("[data-modal-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeOverlay(ov));
    });
  });

  function openModal(id) {
    const ov = document.getElementById(id);
    if (!ov) return;

    ov.hidden = false;
    requestAnimationFrame(() => ov.classList.add("is-open"));

    stack.push(ov);
    document.body.classList.add("is-modal-open");
  }

  function closeModal(id) {
    const ov = document.getElementById(id);
    if (!ov) return;
    closeOverlay(ov);
  }

  function closeTopModal() {
    const ov = stack.pop();
    if (!ov) return;
    closeOverlay(ov);
  }

  function closeOverlay(ov) {
    ov.classList.remove("is-open");
    setTimeout(() => {
      ov.hidden = true;

      const idx = stack.indexOf(ov);
      if (idx >= 0) stack.splice(idx, 1);

      if (stack.length === 0) document.body.classList.remove("is-modal-open");
    }, 180);
  }

  return { openModal, closeModal, closeTopModal };
}

/** -------- Settings tabs -------- */
function setupSettingsTabs({ closeModal }) {
  const root = document.getElementById("modalSettings");
  if (!root) return;

  const tabs = Array.from(root.querySelectorAll(".sb-tab"));
  const panels = Array.from(root.querySelectorAll(".sb-panel"));

  function activate(name) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === name));
  }

  tabs.forEach((t) => t.addEventListener("click", () => activate(String(t.dataset.tab || "layout"))));

  // Update buttons just close the modal (changes are applied live)
  ["sbSettingsCloseA", "sbSettingsCloseB", "sbSettingsCloseC", "sbSettingsCloseD"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => closeModal("modalSettings"));
  });

  // default
  activate("layout");
}

/** -------- Settings functionality --------
 * We store new UI settings in localStorage and also push into store.meta (via window.__SB_STORE).
 * Existing settings (title/start/end/weekend) still use your original inputs & listeners (unchanged).
 */
function setupSettingsBindings({ closeModal }) {
  const KEY = "sb_editor_ui_settings_v1";

  const store = () => window.__SB_STORE || null;
  const rerender = () => {
    if (typeof window.__SB_RENDER === "function") window.__SB_RENDER();
  };

  const defaults = {
    showTitle: "yes",
    showDates: "no",
    week: "", // type=week value like "2025-W51"
    clockMode: getScheduleMode(), // "12" | "24"
    minuteStep: 15,
    autoColor: "yes",
    showTimeInEvents: "yes",
    stretchText: "yes",
    centerText: "yes",
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    eventTextColor: "#1b1f2a"
  };

  const state = load();

  // wire segmented controls
  document.querySelectorAll("#modalSettings .sb-seg").forEach((seg) => {
    seg.addEventListener("click", (e) => {
      const btn = e.target instanceof HTMLElement ? e.target.closest(".sb-segBtn") : null;
      if (!btn) return;

      const setting = seg.getAttribute("data-setting");
      const value = btn.getAttribute("data-value");
      if (!setting || !value) return;

      seg.querySelectorAll(".sb-segBtn").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      state[setting] = value;
      save();
      apply();
    });
  });

  // show weekend -> drive existing checkbox so your editor logic stays unchanged
  const showWeekend = document.getElementById("showWeekend");
  const satBtn = document.getElementById("sbSat");
  const sunBtn = document.getElementById("sbSun");

  function syncWeekendButtons() {
    const on = !!(showWeekend && showWeekend.checked);
    if (satBtn) satBtn.classList.toggle("is-on", on);
    if (sunBtn) sunBtn.classList.toggle("is-on", on);
    if (satBtn) satBtn.setAttribute("aria-pressed", on ? "true" : "false");
    if (sunBtn) sunBtn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  if (showWeekend) {
    showWeekend.addEventListener("change", () => {
      syncWeekendButtons();
      rerender();
    });
  }
  if (satBtn) satBtn.addEventListener("click", () => {
    if (!showWeekend) return;
    showWeekend.checked = !showWeekend.checked;
    showWeekend.dispatchEvent(new Event("change", { bubbles: true }));
  });
  if (sunBtn) sunBtn.addEventListener("click", () => {
    if (!showWeekend) return;
    showWeekend.checked = !showWeekend.checked;
    showWeekend.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // week input
  const weekInput = document.getElementById("sbWeek");
  if (weekInput) {
    if (state.week) weekInput.value = state.week;
    weekInput.addEventListener("change", () => {
      state.week = weekInput.value || "";
      save();
      apply();
    });
  }

  // start/end hour -> drive existing startTime/endTime inputs (keeps your logic)
  const startHour = document.getElementById("sbStartHour");
  const endHour = document.getElementById("sbEndHour");
  const startTime = document.getElementById("startTime");
  const endTime = document.getElementById("endTime");

  function hourToTime(h) {
    const hh = Math.max(0, Math.min(23, Number(h) || 0));
    return `${String(hh).padStart(2, "0")}:00`;
  }

  function pushHoursToOriginalInputs() {
    if (!startHour || !endHour || !startTime || !endTime) return;
    startTime.value = hourToTime(startHour.value);
    endTime.value = hourToTime(endHour.value);
    startTime.dispatchEvent(new Event("input", { bubbles: true }));
    endTime.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (startHour) startHour.addEventListener("change", pushHoursToOriginalInputs);
  if (endHour) endHour.addEventListener("change", pushHoursToOriginalInputs);

  // font + color
  const fontSel = document.getElementById("sbFont");
  const colorSel = document.getElementById("sbEventTextColor");
  if (fontSel) {
    fontSel.value = state.fontFamily || defaults.fontFamily;
    fontSel.addEventListener("change", () => {
      state.fontFamily = fontSel.value;
      save();
      apply();
    });
  }
  if (colorSel) {
    colorSel.value = state.eventTextColor || defaults.eventTextColor;
    colorSel.addEventListener("input", () => {
      state.eventTextColor = colorSel.value;
      save();
      apply();
    });
  }

  // Initialize start/end hour controls from existing time inputs (if they exist)
  if (startTime && startHour) {
    const v = String(startTime.value || "08:00").split(":")[0];
    startHour.value = String(Number(v) || 8);
  }
  if (endTime && endHour) {
    const v = String(endTime.value || "20:00").split(":")[0];
    endHour.value = String(Number(v) || 20);
  }

  // Apply now
  paintSegs();
  syncWeekendButtons();
  apply();

  function paintSegs() {
    // for each seg, set active button based on saved state
    document.querySelectorAll("#modalSettings .sb-seg").forEach((seg) => {
      const setting = seg.getAttribute("data-setting");
      if (!setting) return;
      const want = String(state[setting] ?? "");
      const btns = Array.from(seg.querySelectorAll(".sb-segBtn"));
      btns.forEach((b) => b.classList.toggle("is-active", String(b.getAttribute("data-value")) === want));
    });
  }

  function apply() {
    // clock mode
    if (state.clockMode === "12" || state.clockMode === "24") setScheduleMode(state.clockMode);

    // apply UI-only classes
    document.body.classList.toggle("sb-hide-title", state.showTitle === "no");
    document.body.classList.toggle("sb-center-text", state.centerText === "yes");
    document.body.classList.toggle("sb-stretch-text", state.stretchText === "yes");

    // push into store.meta for render options
    const s = store();
    if (s && s.state && s.state.meta) {
      s.state.meta.minuteStep = Number(state.minuteStep) || 15;
      s.state.meta.showDates = state.showDates === "yes";
      s.state.meta.week = state.week || "";
      s.state.meta.showTimeInEvents = state.showTimeInEvents !== "no";
      s.state.meta.autoColor = state.autoColor !== "no";
      s.state.meta.fontFamily = state.fontFamily || defaults.fontFamily;
      s.state.meta.eventTextColor = state.eventTextColor || defaults.eventTextColor;
    }

    // css vars for font & block text color
    document.documentElement.style.setProperty("--sb-font", state.fontFamily || defaults.fontFamily);
    document.documentElement.style.setProperty("--sb-event-text", state.eventTextColor || defaults.eventTextColor);

    // week label
    const weekLabel = document.getElementById("sbWeekLabel");
    if (weekLabel) weekLabel.textContent = state.week ? `Week ${state.week}` : "This week";

    rerender();
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { ...defaults };
      const obj = JSON.parse(raw);
      return { ...defaults, ...(obj || {}) };
    } catch {
      return { ...defaults };
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }
}

/** -------- Add modal enhancements -------- */
function setupAddModalEnhancements({ closeModal }) {
  const store = () => window.__SB_STORE || null;

  // Copy button -> uses your existing Duplicate logic
  const copyBtn = document.getElementById("sbCopySelection");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const dup = document.getElementById("btnDuplicate");
      if (dup && !dup.disabled) dup.click();
    });
  }

  // Auto-color button: picks a stable color from text
  const autoColorBtn = document.getElementById("sbAutoColorBtn");
  const txt = document.getElementById("blockText");
  const color = document.getElementById("blockColor");

  function hashColor(str) {
    const s = String(str || "");
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    // generate a nice-ish hue
    const hue = Math.abs(h) % 360;
    return hslToHex(hue, 74, 55);
  }

  function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    const toHex = (v) => {
      const n = Math.round((v + m) * 255);
      return n.toString(16).padStart(2, "0");
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  function shouldAutoColor() {
    const s = store();
    return !!(s && s.state && s.state.meta && s.state.meta.autoColor);
  }

  function applyAutoColor() {
    if (!txt || !color) return;
    if (!shouldAutoColor()) return;
    const t = txt.value.trim();
    if (!t) return;
    color.value = hashColor(t);
    color.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (autoColorBtn) autoColorBtn.addEventListener("click", applyAutoColor);
  if (txt) txt.addEventListener("blur", applyAutoColor);

  // Day buttons: optional forced-day helper (does NOT break your original flow)
  let forcedDay = null;
  const dayWrap = document.getElementById("sbAddDays");
  if (dayWrap) {
    dayWrap.addEventListener("click", (e) => {
      const btn = e.target instanceof HTMLElement ? e.target.closest(".sb-day") : null;
      if (!btn) return;
      const d = Number(btn.getAttribute("data-day"));
      if (!Number.isFinite(d)) return;

      forcedDay = d;

      dayWrap.querySelectorAll(".sb-day").forEach((b) => b.classList.remove("is-on"));
      btn.classList.add("is-on");
    });
  }

  // Keep your existing "pick a day on grid" logic, but if user selected a day,
  // we force the click to land inside that day column by dispatching a synthetic click.
  const canvas = document.getElementById("canvas");
  const btnAddBlock = document.getElementById("btnAddBlock");

  let armed = false;

  if (btnAddBlock) {
    btnAddBlock.addEventListener("click", () => {
      // existing logic in your editor.js will run; we just "arm" the next grid click
      armed = true;
      // close modal so grid is visible
      setTimeout(() => closeModal("modalAdd"), 0);
    });
  }

  if (canvas) {
    canvas.addEventListener("click", (e) => {
      if (!armed) return;
      armed = false;

      if (forcedDay == null) return; // no forcing

      // Stop original click and re-dispatch at a forced X inside the chosen column
      e.preventDefault();
      e.stopImmediatePropagation();

      const rect = canvas.getBoundingClientRect();
      const dayHeader = document.getElementById("dayHeader");
      const daysCount = dayHeader ? dayHeader.children.length : 7;
      const colW = rect.width / (daysCount || 7);

      const x = rect.left + (forcedDay + 0.5) * colW;
      const y = e.clientY; // keep same y

      const ev = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
      });

      canvas.dispatchEvent(ev);
    }, true); // capture, so we can replace before interactions handler
  }
}
