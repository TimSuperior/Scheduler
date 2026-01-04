// /public/assets/js/features/settings.js
import {
  DEFAULT_THEME,
  PRESETS,
  readCssVar,
  setThemeVar,
  resetThemeToDefault,
  applyTheme,
  saveTheme
} from "../core/theme.js";
import { qs, qsa } from "../core/utils.js";

const UI_STORAGE_KEY = "sb_ui_v1";

function loadUiState() {
  try {
    return JSON.parse(localStorage.getItem(UI_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}
function saveUiState(next) {
  try {
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function initThemeSettings() {
  const root = qs("#themeSettings");
  if (!root) return;

  // --- Dropdown toggle ---
  const toggle = qs("#themeToggle");
  const body = qs("#themeBody");

  const ui = loadUiState();
  const openByDefault = !!ui.themeOpen;

  if (toggle && body) {
    setOpen(openByDefault);

    toggle.addEventListener("click", () => {
      const isOpen = toggle.getAttribute("aria-expanded") === "true";
      setOpen(!isOpen);

      const nextUi = loadUiState();
      nextUi.themeOpen = !isOpen;
      saveUiState(nextUi);
    });
  }

  function setOpen(open) {
    if (!toggle || !body) return;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    body.hidden = !open;
  }

  // --- Theme controls ---
  const inputs = qsa("[data-theme-var]", root);

  // Initialize inputs from computed CSS vars
  for (const input of inputs) {
    const cssVar = input.getAttribute("data-theme-var");
    const current = readCssVar(cssVar);
    if (current && current.startsWith("#")) input.value = current;
  }

  // Live apply + persist
  for (const input of inputs) {
    input.addEventListener("input", () => {
      const cssVar = input.getAttribute("data-theme-var");
      const val = input.value;
      if (!cssVar) return;
      setThemeVar(cssVar, val);
    });
  }

  // Presets
  qs("#btnThemeDark")?.addEventListener("click", () => applyPreset("dark"));
  qs("#btnThemeLight")?.addEventListener("click", () => applyPreset("light"));
  qs("#btnThemeOcean")?.addEventListener("click", () => applyPreset("ocean"));

  // Reset
  qs("#btnThemeReset")?.addEventListener("click", () => {
    resetThemeToDefault();
    for (const input of inputs) {
      const cssVar = input.getAttribute("data-theme-var");
      input.value = (DEFAULT_THEME[cssVar] || "#000000").toLowerCase();
    }
  });

  function applyPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;

    applyTheme(preset);
    saveTheme(preset);

    for (const input of inputs) {
      const cssVar = input.getAttribute("data-theme-var");
      const v = preset[cssVar];
      if (v && v.startsWith("#")) input.value = v.toLowerCase();
    }
  }
}
