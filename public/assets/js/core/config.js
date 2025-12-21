// /public/assets/js/core/config.js
export const CONFIG = {
  daysFull: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  defaultTitle: "My Schedule",
  defaultStart: 8 * 60,  // 08:00
  defaultEnd: 20 * 60,   // 20:00
  defaultStep: 15,
  defaultShowWeekend: true,
  defaultBlockMinutes: 60,

  // Rendering
  pxPerMinute: 1.6,   // 60 min => 96px (matches css row feel)
  axisRowMinutes: 60, // show axis label each hour
  storageKey: "schedule_builder_v1"
};
