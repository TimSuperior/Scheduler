// /public/assets/js/core/validate.js
// Optional helper: client-side validation (not required, but included for completeness)
export function isValidSchedule(data) {
  if (!data || typeof data !== "object") return false;
  if (!data.meta || typeof data.meta !== "object") return false;
  if (!Array.isArray(data.items)) return false;
  if (typeof data.meta.startMinute !== "number") return false;
  if (typeof data.meta.endMinute !== "number") return false;
  return true;
}
