// /public/assets/js/core/api.js
import { CONFIG } from "./config.js";

export async function apiShare(payload) {
  const res = await fetch("/server/api/share.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Share failed");
  return res.json(); // { id: "..." }
}

export async function apiLoad(id) {
  const url = new URL("/server/api/load.php", window.location.origin);
  url.searchParams.set("id", id);

  const res = await fetch(url.toString(), { method: "GET" });
  if (!res.ok) throw new Error("Load failed");
  return res.json(); // schedule JSON
}
