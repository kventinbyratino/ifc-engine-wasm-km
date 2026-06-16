import { createMessage } from "../ui/dom-utils.ts";
import { errorToMessage, showToast } from "../ui/toast.ts";
import type { BimDomElements } from "./app-context.ts";
import { logControllerError } from "../ui/controller-errors.ts";

export function createAppStatusController(dom: BimDomElements) {
  const {
    statusText,
    loadingOverlay,
    loadingStatus,
    loadingCancelBtn,
    loadIfcBtn,
    loadFragBtn,
    progress,
    progressBar,
    propertiesOutput,
  } = dom;

  let activeOperation: AbortController | null = null;

  function setStatus(message: string) {
    statusText.textContent = message;
  }

  function setBusy(isBusy: boolean, message?: string) {
    loadIfcBtn.loading = isBusy;
    loadFragBtn.loading = isBusy;
    loadingOverlay.hidden = !isBusy;
    progress.hidden = !isBusy;
    if (!isBusy) loadingCancelBtn.hidden = true;
    if (isBusy) setProgress(0);
    if (message) {
      statusText.textContent = message;
      loadingStatus.textContent = message;
    }
  }

  function startOperation(message: string) {
    activeOperation?.abort();
    activeOperation = new AbortController();
    setBusy(true, message);
    loadingCancelBtn.hidden = false;
    return activeOperation.signal;
  }

  function finishOperation(signal: AbortSignal) {
    if (activeOperation?.signal !== signal) return;
    activeOperation = null;
    setBusy(false);
  }

  function cancelActiveOperation() {
    if (!activeOperation) return;
    activeOperation.abort();
    statusText.textContent = "Операция отменяется...";
    loadingStatus.textContent = "Операция отменяется...";
    showToast("Операция отменяется...", "info");
  }

  function setProgress(value: number) {
    const percentage = Math.max(0, Math.min(100, value * 100));
    progressBar.style.width = `${percentage}%`;
    loadingStatus.textContent = `${statusText.textContent || "Обработка модели"} · ${Math.round(percentage)}%`;
  }

  function showError(error: unknown) {
    logControllerError(error);
    statusText.textContent = "Ошибка загрузки модели";
    showToast(errorToMessage(error), "error");
    propertiesOutput.replaceChildren(
      createMessage(errorToMessage(error)),
    );
  }

  return {
    setStatus,
    setBusy,
    setProgress,
    startOperation,
    finishOperation,
    cancelActiveOperation,
    showToast,
    showError,
  };
}
