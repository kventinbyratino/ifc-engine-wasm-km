import { APP_BASE, API_BASE, IFC_EXAMPLES, MAX_FRAGMENT_BYTES } from "../config";
import type { FragmentRecord, IfcExample } from "../types";
import { createMessage, escapeHtml, formatBytes } from "../ui/dom-utils";
import type { BimAppContext } from "./app-context";

export interface LibraryControllerOptions {
  ctx: BimAppContext;
  loadIfc: (file: File, source?: { kind: "ifc" | "frag"; origin: "upload" | "example" | "library" | "url"; label: string; reference: string; restorable: boolean }) => Promise<void>;
  loadFragBuffer: (buffer: ArrayBuffer, name: string, source?: { kind: "ifc" | "frag"; origin: "upload" | "example" | "library" | "url"; label: string; reference: string; restorable: boolean }) => Promise<unknown>;
  selectProfile: (profile: "pending" | "km" | "bim") => void;
  setActiveShareRecord: (record: FragmentRecord | null) => void;
}

export function createLibraryController({
  ctx,
  loadIfc,
  loadFragBuffer,
  selectProfile,
  setActiveShareRecord,
}: LibraryControllerOptions) {
  const { workspace } = ctx;
  const { fragments } = ctx.viewer;
  const {
    libraryModal,
    libraryStart,
    libraryListPanel,
    fragmentList,
    exampleList,
    fileName,
    saveFragmentBtn,
  } = ctx.dom;

  function openLibraryModal() {
    libraryModal.hidden = false;
    showLibraryStart();
  }

  function closeLibraryModal() {
    libraryModal.hidden = true;
  }

  function showLibraryStart() {
    libraryStart.hidden = false;
    libraryListPanel.hidden = true;
    fragmentList.replaceChildren();
  }

  function renderExampleList() {
    const title = document.createElement("div");
    title.className = "example-list-title";
    title.textContent = "Открыть пример";

    const cards = IFC_EXAMPLES.map((example) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "library-action example-action";
      button.innerHTML = `
        <strong>${escapeHtml(example.name)}</strong>
        <span>${escapeHtml(example.filename)} · ${formatBytes(example.sizeBytes)}</span>
      `;
      button.onclick = () => void loadIfcExample(example);
      return button;
    });

    exampleList.replaceChildren(title, ...cards);
  }

  async function loadIfcExample(example: IfcExample) {
    ctx.setBusy(true, "Загрузка примера IFC");
    try {
      const blob = await fetchExampleBlob(example.filename);
      await loadIfc(new File([blob], example.filename, { type: "application/octet-stream" }), {
        kind: "ifc",
        origin: "example",
        label: example.name,
        reference: example.filename,
        restorable: true,
      });
    } catch (error) {
      ctx.showError(error);
    } finally {
      ctx.setBusy(false);
    }
  }

  async function fetchExampleBlob(filename: string) {
    const encodedFilename = encodeURIComponent(filename);
    const paths = APP_BASE ? [`${APP_BASE}/examples/${encodedFilename}`, `/examples/${encodedFilename}`] : [`/examples/${encodedFilename}`];

    for (const path of paths) {
      const response = await fetch(path);
      const contentType = response.headers.get("content-type") ?? "";
      if (response.ok && !contentType.includes("text/html")) return response.blob();
    }

    throw new Error(`Не удалось загрузить пример IFC: ${filename}`);
  }

  async function showFragmentLibrary() {
    libraryStart.hidden = true;
    libraryListPanel.hidden = false;
    fragmentList.replaceChildren(createMessage("Загрузка списка..."));

    try {
      const records = await fetchFragments();
      if (records.length === 0) {
        fragmentList.replaceChildren(createMessage("Сохранённых fragments пока нет."));
        return;
      }

      const list = document.createElement("div");
      list.className = "fragment-cards";
      for (const record of records) list.append(createFragmentCard(record));
      fragmentList.replaceChildren(list);
    } catch (error) {
      fragmentList.replaceChildren(createMessage(error instanceof Error ? error.message : String(error)));
      ctx.showToast(error instanceof Error ? error.message : String(error), "error");
    }
  }

  function createFragmentCard(record: FragmentRecord) {
    const card = document.createElement("article");
    card.className = "fragment-card";
    const date = new Date(record.created_at);
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(record.name)}</strong>
        <span>${Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("ru-RU")} · ${formatBytes(record.size_bytes)}</span>
      </div>
    `;

    const actions = document.createElement("div");
    actions.className = "fragment-actions";

    const openButton = document.createElement("button");
    openButton.type = "button";
    openButton.textContent = "Открыть";
    openButton.onclick = () => void openSavedFragment(record);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "danger-button";
    deleteButton.textContent = "Удалить";
    deleteButton.onclick = () => void deleteSavedFragment(record);

    actions.append(openButton, deleteButton);
    card.append(actions);
    return card;
  }

  async function fetchFragments() {
    const response = await fetch(apiUrl("/fragments"));
    if (!response.ok) throw new Error("Не удалось получить список fragments");
    return (await response.json()) as FragmentRecord[];
  }

  async function openFragmentFromUrl() {
    const fragmentId = new URLSearchParams(window.location.search).get("fragment")?.trim();
    if (!fragmentId) return;

    if (workspace.viewer.activeProfile === "pending") {
      selectProfile("km");
    }
    ctx.setBusy(true, "Загрузка модели по ссылке");
    try {
      const records = await fetchFragments();
      const record = records.find((item) => item.id === fragmentId);
      if (!record) throw new Error("Модель по ссылке не найдена");
      await openSavedFragment(record);
    } catch (error) {
      ctx.showError(error);
    } finally {
      ctx.setBusy(false);
    }
  }

  async function openSavedFragment(record: FragmentRecord) {
    ctx.setBusy(true, "Загрузка fragment");
    try {
      const response = await fetch(apiUrl(`/fragments/${record.id}/download`));
      if (!response.ok) throw new Error("Не удалось загрузить fragment");
      await loadFragBuffer(await response.arrayBuffer(), record.name, {
        kind: "frag",
        origin: "library",
        label: record.name,
        reference: record.id,
        restorable: true,
      });
      fileName.textContent = record.name;
      setActiveShareRecord(record);
      ctx.setStatus("FRAG загружен из библиотеки");
      closeLibraryModal();
    } catch (error) {
      ctx.showError(error);
    } finally {
      ctx.setBusy(false);
    }
  }

  async function deleteSavedFragment(record: FragmentRecord) {
    if (!confirm(`Удалить ${record.name}?`)) return;
    const response = await fetch(apiUrl(`/fragments/${record.id}`), { method: "DELETE" });
    if (!response.ok) {
      fragmentList.replaceChildren(createMessage("Не удалось удалить fragment."));
      ctx.showToast("Не удалось удалить fragment", "error");
      return;
    }
    await showFragmentLibrary();
    ctx.showToast(`Fragment удалён: ${record.name}`, "success");
  }

  async function saveCurrentFragment() {
    if (!workspace.viewer.lastConvertedModelId || !workspace.viewer.lastSourceIfcName) return;

    const model = fragments.list.get(workspace.viewer.lastConvertedModelId);
    if (!model) {
      ctx.setStatus("Нет модели для сохранения");
      ctx.showToast("Нет модели для сохранения", "error");
      return;
    }

    saveFragmentBtn.loading = true;
    ctx.setStatus("Сохранение fragment");
    try {
      const fragsBuffer = await model.getBuffer(true);
      if (fragsBuffer.byteLength > MAX_FRAGMENT_BYTES) {
        ctx.setStatus("Fragment больше 100 МБ");
        ctx.showToast("Fragment больше 100 МБ", "error");
        return;
      }

      const form = new FormData();
      form.set("name", workspace.viewer.lastSourceIfcName);
      form.set("file", new File([fragsBuffer], `${workspace.viewer.lastSourceIfcName}.frag`, { type: "application/octet-stream" }));

      const response = await fetch(apiUrl("/fragments"), { method: "POST", body: form });
      if (!response.ok) throw new Error(await response.text());
      const savedRecord = (await response.json()) as FragmentRecord;

      saveFragmentBtn.hidden = true;
      setActiveShareRecord(savedRecord);
      ctx.setStatus("Fragment сохранён");
      ctx.showToast("Fragment сохранён", "success");
    } catch (error) {
      ctx.showError(error);
    } finally {
      saveFragmentBtn.loading = false;
    }
  }

  return {
    openLibraryModal,
    closeLibraryModal,
    showLibraryStart,
    renderExampleList,
    loadIfcExample,
    fetchExampleBlob,
    showFragmentLibrary,
    createFragmentCard,
    fetchFragments,
    openFragmentFromUrl,
    openSavedFragment,
    deleteSavedFragment,
    saveCurrentFragment,
  };
}

function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}
