import type { SheetRecord } from "./sheet-types.ts";
import { renderSheetSvg } from "./sheet-board.ts";

export function downloadSheetSvg(sheet: SheetRecord) {
  downloadText(`${sanitize(sheet.title)}-${sheet.format}.svg`, renderSheetSvg(sheet), "image/svg+xml");
}

export async function downloadSheetPng(sheet: SheetRecord) {
  const svg = renderSheetSvg(sheet);
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * 2);
    canvas.height = Math.round(image.height * 2);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas недоступен");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("PNG export failed"))), "image/png"),
    );
    downloadBlob(`${sanitize(sheet.title)}-${sheet.format}.png`, blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function openSheetPdfPrint(sheet: SheetRecord) {
  const svg = renderSheetSvg(sheet);
  const frame = document.createElement("iframe");
  frame.title = `PDF/print: ${sheet.title}`;
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.setAttribute("aria-hidden", "true");
  document.body.append(frame);

  const doc = frame.contentDocument ?? frame.contentWindow?.document;
  if (!doc) {
    frame.remove();
    throw new Error("Не удалось подготовить PDF/print");
  }

  doc.open();
  doc.write(createPrintableSheetHtml(sheet, svg));
  doc.close();

  const printFrame = () => {
    const contentWindow = frame.contentWindow;
    if (!contentWindow) {
      frame.remove();
      throw new Error("Не удалось открыть PDF/print");
    }
    contentWindow.focus();
    contentWindow.print();
    window.setTimeout(() => frame.remove(), 1000);
  };

  if (doc.readyState === "complete") {
    window.setTimeout(printFrame, 0);
  } else {
    frame.onload = printFrame;
  }
}

function createPrintableSheetHtml(sheet: SheetRecord, svg: string) {
  return `<!doctype html><html><head><title>${escapeHtml(sheet.title)}</title><style>@page{size:${sheet.format} landscape;margin:0}body{margin:0;background:#fff}svg{width:100vw;height:100vh}</style></head><body>${svg}</body></html>`;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Не удалось подготовить PNG"));
    image.src = url;
  });
}

function downloadText(name: string, content: string, type: string) {
  downloadBlob(name, new Blob([content], { type }));
}

function downloadBlob(name: string, blob: Blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

function sanitize(value: string) {
  return value.replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^-+|-+$/g, "") || "sheet";
}

function escapeHtml(value: string) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}
