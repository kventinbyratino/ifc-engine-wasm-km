export type ToastType = "info" | "success" | "error";

export function showToast(message: string, type: ToastType = "info") {
  if (!message.trim()) return;

  const container = getToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
  toast.textContent = message;

  const close = document.createElement("button");
  close.type = "button";
  close.className = "toast-close";
  close.setAttribute("aria-label", "Закрыть уведомление");
  close.textContent = "×";
  close.onclick = () => toast.remove();
  toast.append(close);

  container.append(toast);
  window.setTimeout(() => toast.remove(), type === "error" ? 8000 : 3500);
}

export function errorToMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getToastContainer() {
  const existing = document.querySelector<HTMLDivElement>(".toast-stack");
  if (existing) return existing;

  const container = document.createElement("div");
  container.className = "toast-stack";
  container.setAttribute("aria-label", "Уведомления");
  document.body.append(container);
  return container;
}
