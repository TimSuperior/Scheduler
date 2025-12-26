// /public/assets/js/features/export.js
import { apiShare } from "../core/api.js";
import { qs } from "../core/utils.js";

/**
 * Handles:
 * - Share button (POST /server/api/share.php)
 * Print is handled in bootCommon() (utils.js) via #btnPrint
 * Zoom removed (no #btnZoomIn / #btnZoomOut)
 */
export function initExport({ store }) {
  const btnShare = qs("#btnShare");

  if (btnShare) {
    btnShare.addEventListener("click", async () => {
      btnShare.disabled = true;
      const prev = btnShare.textContent;
      btnShare.textContent = "Sharing…";

      try {
        const payload = store.state;
        const res = await apiShare(payload); // { id }
        const id = res?.id;
        if (!id) throw new Error("No id returned");

        const viewUrl = `${window.location.origin}/s/${encodeURIComponent(id)}`;

        // Copy link (best effort)
        try {
          await navigator.clipboard.writeText(viewUrl);
          btnShare.textContent = "Link copied!";
        } catch {
          btnShare.textContent = "Shared!";
          alert(`Share link:\n${viewUrl}`);
        }
      } catch (err) {
        console.error(err);
        btnShare.textContent = "Share failed";
      } finally {
        setTimeout(() => {
          btnShare.textContent = prev;
          btnShare.disabled = false;
        }, 1200);
      }
    });
  }
}
