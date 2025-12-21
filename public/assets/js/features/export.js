// /public/assets/js/features/export.js
import { apiShare } from "../core/api.js";
import { qs } from "../core/utils.js";

export function initExport({ store }) {
  // Print button is handled in bootCommon() in utils.js
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

        // Copy link to clipboard (best effort)
        const viewUrl = `${window.location.origin}/public/app/view.html?id=${encodeURIComponent(id)}`;

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

  // Zoom buttons (optional)
  const btnZoomIn = qs("#btnZoomIn");
  const btnZoomOut = qs("#btnZoomOut");

  if (btnZoomIn || btnZoomOut) {
    let scale = 1;

    const apply = () => {
      const canvas = qs("#canvas");
      if (!canvas) return;
      canvas.style.transformOrigin = "top left";
      canvas.style.transform = `scale(${scale})`;
    };

    btnZoomIn?.addEventListener("click", () => {
      scale = Math.min(1.5, scale + 0.1);
      apply();
    });
    btnZoomOut?.addEventListener("click", () => {
      scale = Math.max(0.7, scale - 0.1);
      apply();
    });
  }
}
