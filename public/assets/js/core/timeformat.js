// /public/assets/js/core/timeformat.js
const KEY = "sb_schedule_mode_v1"; // "12" | "24"
let cached = null;

export function getScheduleMode() {
  if (cached) return cached;
  try {
    const v = localStorage.getItem(KEY);
    cached = (v === "12" || v === "24") ? v : "24";
  } catch {
    cached = "24";
  }
  return cached;
}

export function setScheduleMode(mode) {
  const next = (mode === "12") ? "12" : "24";
  cached = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
}

/** Used for axis + block labels + meta line */
export function formatMins(mins, mode = getScheduleMode()) {
  const total = Number(mins);
  if (!Number.isFinite(total)) return "";

  const h24 = Math.floor(total / 60) % 24;
  const m = Math.round(total % 60);

  if (mode === "12") {
    const period = h24 >= 12 ? "PM" : "AM";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
  }

  return `${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
