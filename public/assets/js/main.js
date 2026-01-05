import { initRouter } from "./router.js";
import { bootCommon } from "./core/utils.js";
import { setScheduleMode, getScheduleMode } from "./core/timeformat.js";
import { apiShare } from "./core/api.js";

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

  // Add modal enhancements
  setupAddModalEnhancements({ closeModal });

  // ✅ Share modal
  setupShareModal({ openModal, closeModal });

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

  ["sbSettingsCloseA", "sbSettingsCloseB", "sbSettingsCloseC", "sbSettingsCloseD"].forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", () => closeModal("modalSettings"));
  });

  activate("layout");
}

/** -------- Settings functionality -------- */
function setupSettingsBindings({ closeModal }) {
  const KEY = "sb_editor_ui_settings_v1";

  const store = () => window.__SB_STORE || null;
  const rerender = () => {
    if (typeof window.__SB_RENDER === "function") window.__SB_RENDER();
  };

  const defaults = {
    showTitle: "yes",
    showDates: "no",
    week: "",
    clockMode: getScheduleMode(),
    minuteStep: 15,
    autoColor: "yes",
    showTimeInEvents: "yes",
    stretchText: "yes",
    centerText: "yes",
    fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
    eventTextColor: "#1b1f2a"
  };

  const state = load();

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

  const weekInput = document.getElementById("sbWeek");
  if (weekInput) {
    if (state.week) weekInput.value = state.week;
    weekInput.addEventListener("change", () => {
      state.week = weekInput.value || "";
      save();
      apply();
    });
  }

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

  if (startTime && startHour) {
    const v = String(startTime.value || "08:00").split(":")[0];
    startHour.value = String(Number(v) || 8);
  }
  if (endTime && endHour) {
    const v = String(endTime.value || "20:00").split(":")[0];
    endHour.value = String(Number(v) || 20);
  }

  paintSegs();
  syncWeekendButtons();
  apply();

  function paintSegs() {
    document.querySelectorAll("#modalSettings .sb-seg").forEach((seg) => {
      const setting = seg.getAttribute("data-setting");
      if (!setting) return;
      const want = String(state[setting] ?? "");
      const btns = Array.from(seg.querySelectorAll(".sb-segBtn"));
      btns.forEach((b) => b.classList.toggle("is-active", String(b.getAttribute("data-value")) === want));
    });
  }

  function apply() {
    if (state.clockMode === "12" || state.clockMode === "24") setScheduleMode(state.clockMode);

    document.body.classList.toggle("sb-hide-title", state.showTitle === "no");
    document.body.classList.toggle("sb-center-text", state.centerText === "yes");
    document.body.classList.toggle("sb-stretch-text", state.stretchText === "yes");

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

    document.documentElement.style.setProperty("--sb-font", state.fontFamily || defaults.fontFamily);
    document.documentElement.style.setProperty("--sb-event-text", state.eventTextColor || defaults.eventTextColor);

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

  const copyBtn = document.getElementById("sbCopySelection");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const dup = document.getElementById("btnDuplicate");
      if (dup && !dup.disabled) dup.click();
    });
  }

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

  const canvas = document.getElementById("canvas");
  const btnAddBlock = document.getElementById("btnAddBlock");

  let armed = false;

  if (btnAddBlock) {
    btnAddBlock.addEventListener("click", () => {
      armed = true;
      setTimeout(() => closeModal("modalAdd"), 0);
    });
  }

  if (canvas) {
    canvas.addEventListener("click", (e) => {
      if (!armed) return;
      armed = false;

      if (forcedDay == null) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      const rect = canvas.getBoundingClientRect();
      const dayHeader = document.getElementById("dayHeader");
      const daysCount = dayHeader ? dayHeader.children.length : 7;
      const colW = rect.width / (daysCount || 7);

      const x = rect.left + (forcedDay + 0.5) * colW;
      const y = e.clientY;

      const ev = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y
      });

      canvas.dispatchEvent(ev);
    }, true);
  }
}

/** ✅ Share modal implementation (no auth -> "My links" stored in localStorage) */
function setupShareModal({ openModal, closeModal }) {
  const btnShare = document.getElementById("btnShare");
  const modal = document.getElementById("modalShare");
  if (!btnShare || !modal) return;

  const LS_KEY = "sb_my_share_links_v1";

  const tabBtns = Array.from(modal.querySelectorAll(".share-tab"));
  const panels = Array.from(modal.querySelectorAll(".share-panel"));

  const btnCreate = document.getElementById("shareCreateLink");
  const btnEmbed = document.getElementById("shareGetEmbed");

  const statusEl = document.getElementById("shareStatus");

  const resultBox = document.getElementById("shareResult");
  const directInput = document.getElementById("shareDirectInput");
  const copyDirectBtn = document.getElementById("shareCopyDirect");
  const openDirectA = document.getElementById("shareOpenDirect");

  const embedBox = document.getElementById("shareEmbed");
  const embedTextarea = document.getElementById("shareEmbedTextarea");
  const copyEmbedBtn = document.getElementById("shareCopyEmbed");
  const openEmbedA = document.getElementById("shareOpenEmbed");

  const linksList = document.getElementById("shareLinksList");
  const linksEmpty = document.getElementById("shareLinksEmpty");

  let currentId = null;

  // IMPORTANT: intercept any old Share handler to remove "Share failed"
  btnShare.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();

    // reset button text if someone changed it before
    btnShare.textContent = "Share";
    btnShare.classList.remove("btn--danger");

    openModal("modalShare");
    activateTab("share");
    resetShareUI();
    renderMyLinks();
  }, true);

  // Tabs
  tabBtns.forEach((b) => b.addEventListener("click", () => activateTab(String(b.dataset.tab || "share"))));

  function activateTab(name) {
    tabBtns.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === name));

    if (name === "links") renderMyLinks();
  }

  function resetShareUI() {
    currentId = null;
    if (statusEl) statusEl.textContent = "";
    if (resultBox) resultBox.hidden = true;
    if (embedBox) embedBox.hidden = true;
    if (directInput) directInput.value = "";
    if (embedTextarea) embedTextarea.value = "";
    if (openDirectA) openDirectA.href = "#";
    if (openEmbedA) openEmbedA.href = "#";
  }

  function setStatus(msg) {
    if (!statusEl) return;
    statusEl.textContent = msg || "";
  }

  function setBusy(on) {
    const v = !!on;
    if (btnCreate) btnCreate.disabled = v;
    if (btnEmbed) btnEmbed.disabled = v;
  }

  function getSchedulePayload() {
    // safest payload for your validate_schedule(): only meta + items
    const s = window.__SB_STORE && window.__SB_STORE.state ? window.__SB_STORE.state : null;
    if (!s || typeof s !== "object") throw new Error("No schedule data found.");

    const meta = s.meta && typeof s.meta === "object" ? s.meta : {};
    const items = Array.isArray(s.items) ? s.items : [];

    return { meta, items };
  }

  function getTitleForLink() {
    const titleEl = document.getElementById("stageTitle");
    const t = titleEl ? titleEl.textContent : "";
    return (t && t.trim()) ? t.trim() : "Schedule";
  }

  function urlsFor(id) {
    const o = window.location.origin;
    const safe = encodeURIComponent(id);
    const directUrl = `${o}/server/pages/s.php?id=${safe}`;
    const embedUrl = `${o}/server/pages/embed.php?id=${safe}`;
    return { directUrl, embedUrl };
  }

  function embedCodeFor(embedUrl) {
    return `<iframe src="${embedUrl}" style="width:100%;height:650px;border:0;border-radius:12px;overflow:hidden" loading="lazy"></iframe>`;
  }

  function loadLinks() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveLinks(arr) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(arr));
    } catch {
      // ignore
    }
  }

  function upsertLink(id, title) {
    const list = loadLinks();
    const now = Date.now();
    const existing = list.find((x) => x && x.id === id);
    if (existing) {
      existing.title = title || existing.title;
      existing.updatedAt = now;
    } else {
      list.unshift({ id, title: title || "Schedule", createdAt: now, updatedAt: now });
    }
    saveLinks(list.slice(0, 50));
  }

  async function ensureShareId() {
    if (currentId) return currentId;

    setBusy(true);
    setStatus("Creating link…");
    try {
      const payload = getSchedulePayload();
      const r = await apiShare(payload);
      currentId = r.id;

      upsertLink(currentId, getTitleForLink());

      setStatus("");
      return currentId;
    } finally {
      setBusy(false);
    }
  }

  async function showDirect() {
    try {
      const id = await ensureShareId();
      const { directUrl, embedUrl } = urlsFor(id);

      if (directInput) directInput.value = directUrl;
      if (openDirectA) openDirectA.href = directUrl;

      if (resultBox) resultBox.hidden = false;

      // keep embed ready too (so switching is instant)
      if (embedTextarea) embedTextarea.value = embedCodeFor(embedUrl);
      if (openEmbedA) openEmbedA.href = embedUrl;
    } catch (err) {
      setStatus(String(err && err.message ? err.message : err));
      flashShareButtonError();
    }
  }

  async function showEmbed() {
    try {
      const id = await ensureShareId();
      const { embedUrl } = urlsFor(id);

      if (embedTextarea) embedTextarea.value = embedCodeFor(embedUrl);
      if (openEmbedA) openEmbedA.href = embedUrl;

      if (embedBox) embedBox.hidden = false;
    } catch (err) {
      setStatus(String(err && err.message ? err.message : err));
      flashShareButtonError();
    }
  }

  function flashShareButtonError() {
    // shows the old behavior only briefly, then returns to Share
    btnShare.textContent = "Share failed";
    btnShare.classList.add("btn--danger");
    setTimeout(() => {
      btnShare.textContent = "Share";
      btnShare.classList.remove("btn--danger");
    }, 1400);
  }

  async function copyText(text) {
    const t = String(text || "");
    if (!t) return false;

    try {
      await navigator.clipboard.writeText(t);
      return true;
    } catch {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  }

  // Buttons
  if (btnCreate) btnCreate.addEventListener("click", showDirect);
  if (btnEmbed) btnEmbed.addEventListener("click", showEmbed);

  if (copyDirectBtn) {
    copyDirectBtn.addEventListener("click", async () => {
      const ok = await copyText(directInput ? directInput.value : "");
      setStatus(ok ? "Copied direct link." : "Copy failed.");
      setTimeout(() => setStatus(""), 900);
    });
  }

  if (copyEmbedBtn) {
    copyEmbedBtn.addEventListener("click", async () => {
      const ok = await copyText(embedTextarea ? embedTextarea.value : "");
      setStatus(ok ? "Copied embed code." : "Copy failed.");
      setTimeout(() => setStatus(""), 900);
    });
  }

  function renderMyLinks() {
    if (!linksList || !linksEmpty) return;

    const list = loadLinks();
    linksList.innerHTML = "";

    const has = list.length > 0;
    linksEmpty.style.display = has ? "none" : "block";

    if (!has) return;

    const fmt = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "2-digit" });

    list.forEach((x) => {
      if (!x || !x.id) return;
      const { directUrl, embedUrl } = urlsFor(x.id);
      const embedCode = embedCodeFor(embedUrl);

      const row = document.createElement("div");
      row.className = "share-link";

      const left = document.createElement("div");
      left.className = "share-link__left";

      const title = document.createElement("div");
      title.className = "share-link__title";
      title.textContent = x.title || "Schedule";

      const meta = document.createElement("div");
      meta.className = "share-link__meta";
      meta.textContent = `ID: ${x.id} • ${x.createdAt ? fmt.format(new Date(x.createdAt)) : ""}`;

      left.appendChild(title);
      left.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "share-link__actions";

      const bOpen = mkBtn("Open", () => window.open(directUrl, "_blank", "noopener"));
      const bCopy = mkBtn("Copy link", async () => { await copyText(directUrl); setStatus("Copied."); setTimeout(() => setStatus(""), 800); });
      const bEmbed = mkBtn("Copy embed", async () => { await copyText(embedCode); setStatus("Copied embed."); setTimeout(() => setStatus(""), 900); });
      const bDel = mkBtn("Remove", () => {
        const next = loadLinks().filter((y) => y && y.id !== x.id);
        saveLinks(next);
        renderMyLinks();
      });
      bDel.classList.add("share-btn--danger");

      actions.appendChild(bOpen);
      actions.appendChild(bCopy);
      actions.appendChild(bEmbed);
      actions.appendChild(bDel);

      row.appendChild(left);
      row.appendChild(actions);

      linksList.appendChild(row);
    });

    function mkBtn(label, fn) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "share-btn share-btn--sm";
      b.textContent = label;
      b.addEventListener("click", fn);
      return b;
    }
  }
}
