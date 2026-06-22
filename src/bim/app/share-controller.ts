import { createShareUrl } from "../config.ts";
import type { FragmentRecord } from "../types.ts";
import type { BimAppContext } from "./app-context.ts";
import { logControllerError } from "../ui/controller-errors.ts";

export function createShareController(ctx: BimAppContext) {
  const { workspace } = ctx;
  const { shareLinkInput, shareModelName, shareCopyStatus, shareModal, shareModelBtn } = ctx.dom;

  function openShareModal() {
    if (!workspace.viewer.activeShareRecord) return;
    shareLinkInput.value = createShareLink(workspace.viewer.activeShareRecord.id);
    shareModelName.textContent = workspace.viewer.activeShareRecord.name;
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
      ctx.showToast("Ссылка скопирована", "success");
    } catch (error) {
      logControllerError(error);
      shareCopyStatus.textContent = "Не удалось скопировать. Скопируйте вручную.";
      ctx.showToast("Не удалось скопировать ссылку", "error");
    }
  }

  function setActiveShareRecord(record: FragmentRecord | null) {
    workspace.viewer.activeShareRecord = record;
    shareModelBtn.hidden = !record;
    if (!record) closeShareModal();
  }

  function createShareLink(fragmentId: string) {
    return createShareUrl(workspace.viewer.activeProfile, fragmentId, window.location.origin);
  }

  return {
    openShareModal,
    closeShareModal,
    copyShareLink,
    setActiveShareRecord,
    createShareLink,
  };
}
