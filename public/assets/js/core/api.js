import { CONFIG } from "./config.js";

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiShare(payload) {
  const res = await fetch("/server/api/share.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await readJsonSafe(res);

  if (!res.ok) {
    const msg = (data && (data.error || data.details)) ? `${data.error || "Share failed"}${data.details ? `: ${data.details}` : ""}` : `Share failed (${res.status})`;
    throw new Error(msg);
  }
  if (!data || typeof data.id !== "string") {
    throw new Error("Share failed: invalid server response.");
  }
  return data; // { id: "..." }
}

export async function apiLoad(id) {
  const url = new URL("/server/api/load.php", window.location.origin);
  url.searchParams.set("id", id);

  const res = await fetch(url.toString(), { method: "GET" });
  const data = await readJsonSafe(res);

  if (!res.ok) {
    const msg = (data && (data.error || data.details)) ? `${data.error || "Load failed"}${data.details ? `: ${data.details}` : ""}` : `Load failed (${res.status})`;
    throw new Error(msg);
  }
  if (!data || typeof data !== "object") {
    throw new Error("Load failed: invalid server response.");
  }
  return data; // schedule JSON
}
