// /public/assets/js/core/theme.js

const THEME_STORAGE_KEY = "sb_theme_v1";

// Must match your defaults in /public/assets/css/base.css :root
export const DEFAULT_THEME = {
  "--bg": "#0b1020",
  "--panel": "#0f1730",
  "--card": "#101a36",
  "--muted": "#9aa6c3",
  "--text": "#e9eeff",
  "--brand": "#4f46e5",
  "--brand2": "#22c55e",
  "--danger": "#ef4444"
};

export const PRESETS = {
  dark: { ...DEFAULT_THEME },
  light: {
    "--bg": "#f5f7ff",
    "--panel": "#ffffff",
    "--card": "#ffffff",
    "--muted": "#4b5563",
    "--text": "#0b1020",
    "--brand": "#4f46e5",
    "--brand2": "#16a34a",
    "--danger": "#dc2626"
  },
  ocean: {
    "--bg": "#061a2b",
    "--panel": "#07223a",
    "--card": "#082a48",
    "--muted": "#9fb6d3",
    "--text": "#e7f2ff",
    "--brand": "#38bdf8",
    "--brand2": "#22c55e",
    "--danger": "#fb7185"
  }
};

export function getSavedTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return null;
    return obj;
  } catch {
    return null;
  }
}

export function saveTheme(themeObj) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themeObj));
  } catch {
    // ignore
  }
}

export function clearSavedTheme() {
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function applyTheme(themeObj) {
  if (!themeObj || typeof themeObj !== "object") return;
  const root = document.documentElement;
  for (const [cssVar, value] of Object.entries(themeObj)) {
    if (typeof cssVar !== "string" || !cssVar.startsWith("--")) continue;
    if (typeof value !== "string" || value.trim() === "") continue;
    root.style.setProperty(cssVar, value.trim());
  }
}

export function applySavedTheme() {
  const saved = getSavedTheme();
  if (saved) applyTheme(saved);
}

export function setThemeVar(cssVar, value) {
  if (!cssVar?.startsWith("--")) return;
  document.documentElement.style.setProperty(cssVar, value);

  const saved = getSavedTheme() || {};
  saved[cssVar] = value;
  saveTheme(saved);
}

export function resetThemeToDefault() {
  // Clear custom vars and localStorage
  clearSavedTheme();
  const root = document.documentElement;
  for (const cssVar of Object.keys(DEFAULT_THEME)) {
    root.style.removeProperty(cssVar); // reverts to CSS :root defaults
  }
}

// Helpers for input initialization
export function readCssVar(cssVar) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return normalizeColorToHex(v);
}

function normalizeColorToHex(v) {
  if (!v) return "";
  if (v.startsWith("#")) {
    // allow #rgb and #rrggbb; normalize to #rrggbb
    if (v.length === 4) {
      const r = v[1], g = v[2], b = v[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    if (v.length === 7) return v.toLowerCase();
    return v;
  }

  // rgb(...) or rgba(...)
  const m = v.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+)\s*)?\)$/i);
  if (!m) return "";

  const r = clampByte(Number(m[1]));
  const g = clampByte(Number(m[2]));
  const b = clampByte(Number(m[3]));
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
}

function clampByte(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, Math.round(n)));
}
function toHex(n) {
  return n.toString(16).padStart(2, "0");
}
