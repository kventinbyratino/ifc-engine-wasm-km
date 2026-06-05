import { APP_BASE } from "../config";
import type { FragmentRecord } from "../types";
import type { BimAppContext } from "./app-context";

export function createShareController(ctx: BimAppContext) {
  const { workspace } = ctx;
  const { shareLinkInput, shareModelName, shareCopyStatus, shareModal, shareModelBtn } = ctx.dom;

  function openShareModal() {
    if (!workspace.activeShareRecord) return;
    shareLinkInput.value = createShareLink(workspace.activeShareRecord.id);
    shareModelName.textContent = workspace.activeShareRecord.name;
    shareCopyStatus.textContent = "";
    shareModal.hidden = false;
    shareLinkInput.focus();
    shareLinkInput.select();
  }

  function closeShareModal() {
    shareModal.hidden = true;
  }

  async function copyShareLink() {
    const link = shareLinkInput.value;
    if (!link) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        shareLinkInput.focus();
        shareLinkInput.select();
        document.execCommand("copy");
      }
      shareCopyStatus.textContent = "Ссылка скопирована";
    } catch (error) {
      console.error(error);
      shareCopyStatus.textContent = "Не удалось скопировать. Скопируйте вручную.";
    }
  }

  function setActiveShareRecord(record: FragmentRecord | null) {
    workspace.activeShareRecord = record;
    shareModelBtn.hidden = !record;
    if (!record) closeShareModal();
  }

  function createShareLink(fragmentId: string) {
    const profileSegment = workspace.activeProfile === "bim" ? "bim" : "viewer";
    const url = new URL(`${APP_BASE || ""}/${profileSegment}/`, window.location.origin);
    url.searchParams.set("fragment", fragmentId);
    return url.toString();
  }

  return {
    openShareModal,
    closeShareModal,
    copyShareLink,
    setActiveShareRecord,
    createShareLink,
  };
}
