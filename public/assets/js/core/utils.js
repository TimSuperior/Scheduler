// /public/assets/js/core/utils.js
import { applySavedTheme } from "./theme.js";
import { formatMins } from "./timeformat.js";

export function qs(sel, root = document) {
  return root.querySelector(sel);
}
export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function el(tag, { className = "", text = "", attrs = {} } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

export function clearEl(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function roundToStep(v, step) {
  return Math.round(v / step) * step;
}

// UPDATED: respects 12/24 mode from timeformat.js
export function minsToLabel(mins) {
  return formatMins(mins);
}

export function timeInputToMins(val) {
  if (!val || !val.includes(":")) return 0;
  const [h, m] = val.split(":").map(Number);
  return (h * 60) + (m || 0);
}

export function minsToTimeInput(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

export function bootCommon() {
  // Apply saved theme globally (index/editor/view/embed)
  applySavedTheme();

  const btnPrint = qs("#btnPrint");
  if (btnPrint) btnPrint.addEventListener("click", () => window.print());
}
