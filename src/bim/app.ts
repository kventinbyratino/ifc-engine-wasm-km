import * as THREE from "three";
import workerUrl from "@thatopen/fragments/worker?url";
import "../styles.css";
import { APP_BASE, API_BASE, IFC_EXAMPLES, MAX_FRAGMENT_BYTES, MAX_IFC_BYTES } from "./config";
import { getDomElements } from "./dom";
import { loadFragBuffer as loadFragmentsBuffer, loadIfcModel } from "./models/model-loader";
import { renderSelectedProperties } from "./properties/properties-panel";
import { countSelection, isEmptySelection, subtractModelIdMap } from "./selection/selection";
import type { FragmentRecord, IfcExample, ModelIdMap, Profile } from "./types";
import { createWorkspaceState } from "./state/workspace-state";
import {
  buildElementIndex,
  filterElementIndex,
  getUniqueValues,
  recordsToModelIdMap,
  type BimElementRecord,
} from "./data/element-index";
import {
  exportElementsCsv,
  exportElementsJson,
  fillSelectOptions,
  renderElementTable,
} from "./data/data-browser";
import { createMessage, escapeHtml, formatBytes, getAttrText } from "./ui/dom-utils";
import { createBimViewer, dimHighlightStyle, searchHighlightStyle } from "./viewer/viewer";
import { mountSpatialTree } from "./tree/spatial-tree";

export async function startBimApp() {
  const {
    app,
    profileKmBtn,
    profileBimBtn,
    backToProfilesBtn,
    bimStub,
    statusText,
    loadingOverlay,
    loadingStatus,
    fileName,
    modelCount,
    selectionCount,
    propertiesOutput,
    treeOutput,
    searchInput,
    searchOutput,
    searchPanel,
    progress,
    progressBar,
    viewport,
    libraryModal,
    libraryStart,
    libraryListPanel,
    fragmentList,
    exampleList,
    closeLibraryBtn,
    chooseFragmentBtn,
    addIfcBtn,
    libraryBackBtn,
    saveFragmentBtn,
    shareModelBtn,
    shareModal,
    shareLinkInput,
    shareModelName,
    shareCopyStatus,
    closeShareBtn,
    copyShareBtn,
    topBackBtn,
    ifcInput,
    fragInput,
    loadIfcBtn,
    loadFragBtn,
    fitBtn,
    clearBtn,
    downloadFragBtn,
    hideSelectedBtn,
    isolateSelectedBtn,
    showAllBtn,
    searchToggleBtn,
    homeViewBtn,
    dataBrowserBtn,
    dataPanel,
    dataSummary,
    closeDataPanelBtn,
    dataSearchInput,
    dataCategoryFilter,
    dataStoreyFilter,
    highlightFilteredBtn,
    exportCsvBtn,
    exportJsonBtn,
    dataTableOutput,
    searchBtn,
    clearSearchBtn,
  } = getDomElements();

  const { components, world, fragments, ifcLoader, highlighter, hider } = await createBimViewer({
    viewport,
    workerUrl,
    appBase: APP_BASE,
  });

  mountSpatialTree({
    components,
    models: fragments.list.values(),
    output: treeOutput,
  });

  const workspace = createWorkspaceState();

  world.camera.controls.addEventListener("update", () => {
    fragments.core.update();
  });

  world.onCameraChanged.add((camera) => {
    for (const [, model] of fragments.list) {
      model.useCamera(camera.three);
    }
    fragments.core.update(true);
  });

  fragments.core.onModelLoaded.add((model) => {
    model.useCamera(world.camera.three);
    world.scene.three.add(model.object);
    refreshModelState();
    void (async () => {
      await fragments.core.update(true);
      await fitToModels();
      await rebuildDataIndex();
    })();
  });

  fragments.list.onItemDeleted.add(() => {
    refreshModelState();
    clearSelectionInfo();
    void clearSearch();
  });

  fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
    if (!("isLodMaterial" in material && material.isLodMaterial)) {
      material.polygonOffset = true;
      material.polygonOffsetUnits = 1;
      material.polygonOffsetFactor = Math.random();
    }
  });

  highlighter.events.select.onHighlight.add(async (modelIdMap) => {
    workspace.activeSelection = modelIdMap;
    selectionCount.textContent = String(countSelection(modelIdMap));
    await renderSelectedProperties({ components, modelIdMap, output: propertiesOutput });
  });

  highlighter.events.select.onClear.add(() => {
    clearSelectionInfo();
  });

  loadIfcBtn.onclick = () => openLibraryModal();
  loadFragBtn.onclick = () => fragInput.click();
  fitBtn.onclick = () => void fitToModels();
  clearBtn.onclick = () => void clearModels();
  downloadFragBtn.onclick = () => void downloadFragments();
  hideSelectedBtn.onclick = () => void hideSelected();
  isolateSelectedBtn.onclick = () => void isolateSelected();
  showAllBtn.onclick = () => void hider.set(true);
  searchToggleBtn.onclick = () => toggleSearchPanel();
  homeViewBtn.onclick = () => void resetHomeView();
  dataBrowserBtn.onclick = () => toggleDataPanel();
  closeDataPanelBtn.onclick = () => closeDataPanel();
  dataSearchInput.oninput = () => applyDataFilters();
  dataCategoryFilter.onchange = () => applyDataFilters();
  dataStoreyFilter.onchange = () => applyDataFilters();
  highlightFilteredBtn.onclick = () => void highlightFilteredElements();
  exportCsvBtn.onclick = () => exportElementsCsv(workspace.filteredElements);
  exportJsonBtn.onclick = () => exportElementsJson(workspace.filteredElements);
  searchBtn.onclick = () => void searchItems();
  clearSearchBtn.onclick = () => void closeSearchPanel();
  searchPanel.onclick = () => {
    if (searchPanel.classList.contains("is-collapsed")) expandSearchPanel();
  };
  profileKmBtn.onclick = () => navigateToProfile("km");
  profileBimBtn.onclick = () => navigateToProfile("bim");
  backToProfilesBtn.onclick = () => navigateToProfile("pending");
  closeLibraryBtn.onclick = () => closeLibraryModal();
  chooseFragmentBtn.onclick = () => void showFragmentLibrary();
  addIfcBtn.onclick = () => ifcInput.click();
  libraryBackBtn.onclick = () => showLibraryStart();
  saveFragmentBtn.onclick = () => void saveCurrentFragment();
  shareModelBtn.onclick = () => openShareModal();
  closeShareBtn.onclick = () => closeShareModal();
  copyShareBtn.onclick = () => void copyShareLink();
  topBackBtn.onclick = () => navigateToProfile("pending");

  ifcInput.onchange = () => {
    const [file] = ifcInput.files ?? [];
    if (file) void loadIfc(file);
    ifcInput.value = "";
  };

  fragInput.onchange = () => {
    const [file] = fragInput.files ?? [];
    if (file) void loadFrag(file);
    fragInput.value = "";
  };

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      closeShareModal();
      void highlighter.clear("select");
      void highlighter.clear("search");
    }

    if (event.code === "Enter" && document.activeElement === searchInput) {
      void searchItems();
    }
  });

  syncProfileWithLocation();
  resetDataIndex();
  renderExampleList();
  refreshModelState();
  void openFragmentFromUrl();

  function profilePath(profile: Profile) {
    if (profile === "km") return "/ifc-engine-wasm/viewer/";
    if (profile === "bim") return "/ifc-engine-wasm/bim/";
    return "/ifc-engine-wasm/";
  }

  function navigateToProfile(profile: Profile) {
    window.location.assign(profilePath(profile));
  }

  function syncProfileWithLocation() {
    const path = window.location.pathname.replace(/\/+$/, "");

    if (path === "/ifc-engine-wasm/viewer") {
      selectProfile("km");
      return;
    }

    if (path === "/ifc-engine-wasm/bim") {
      selectProfile("bim");
      return;
    }

    selectProfile("pending");
  }

  function selectProfile(profile: Profile) {
    app.classList.remove("profile-pending", "profile-km", "profile-bim");
    bimStub.hidden = true;

    if (profile === "pending") {
      app.classList.add("profile-pending");
      return;
    }

    app.classList.add(profile === "km" ? "profile-km" : "profile-bim");
  }

  async function loadIfc(file: File) {
    setActiveShareRecord(null);
    if (file.size > MAX_IFC_BYTES) {
      statusText.textContent = "IFC больше 200 МБ";
      return;
    }

    setBusy(true, "Конвертация IFC в браузере");
    fileName.textContent = file.name;
    propertiesOutput.textContent = "IFC читается через web-ifc WASM. Серверная обработка не используется.";

    try {
      const { modelId, sourceName } = await loadIfcModel({
        file,
        ifcLoader,
        onProgress: (value, process) => {
          statusText.textContent = `${formatProcess(process)}: ${Math.round(value * 100)}%`;
          setProgress(value);
        },
      });

      workspace.lastConvertedModelId = modelId;
      workspace.lastSourceIfcName = sourceName;
      saveFragmentBtn.hidden = false;
      closeLibraryModal();
      statusText.textContent = "IFC загружен и преобразован. Можно сохранить fragment";
      setProgress(1);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function loadFrag(file: File) {
    setActiveShareRecord(null);
    setBusy(true, "Загрузка Fragments");
    fileName.textContent = file.name;

    try {
      await loadFragBuffer(await file.arrayBuffer(), file.name);
      statusText.textContent = "FRAG загружен";
      setProgress(1);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function loadFragBuffer(buffer: ArrayBuffer, name: string) {
    await clearModels({ keepStatus: true });
    await loadFragmentsBuffer({
      buffer,
      name,
      fragments,
      camera: world.camera.three,
      onProgress: (value, stage) => {
        statusText.textContent = `${formatFragmentStage(stage)}: ${Math.round(value * 100)}%`;
        setProgress(value);
      },
    });
  }

  function openLibraryModal() {
    libraryModal.hidden = false;
    showLibraryStart();
  }

  function closeLibraryModal() {
    libraryModal.hidden = true;
  }

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
    const url = new URL(`${APP_BASE || ""}/viewer/`, window.location.origin);
    url.searchParams.set("fragment", fragmentId);
    return url.toString();
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
    setBusy(true, "Загрузка примера IFC");
    try {
      const blob = await fetchExampleBlob(example.filename);
      await loadIfc(new File([blob], example.filename, { type: "application/octet-stream" }));
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
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

    selectProfile("km");
    setBusy(true, "Загрузка модели по ссылке");
    try {
      const records = await fetchFragments();
      const record = records.find((item) => item.id === fragmentId);
      if (!record) throw new Error("Модель по ссылке не найдена");
      await openSavedFragment(record);
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function openSavedFragment(record: FragmentRecord) {
    setBusy(true, "Загрузка fragment");
    try {
      const response = await fetch(apiUrl(`/fragments/${record.id}/download`));
      if (!response.ok) throw new Error("Не удалось загрузить fragment");
      await loadFragBuffer(await response.arrayBuffer(), record.name);
      fileName.textContent = record.name;
      setActiveShareRecord(record);
      statusText.textContent = "FRAG загружен из библиотеки";
      closeLibraryModal();
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSavedFragment(record: FragmentRecord) {
    if (!confirm(`Удалить ${record.name}?`)) return;
    const response = await fetch(apiUrl(`/fragments/${record.id}`), { method: "DELETE" });
    if (!response.ok) {
      fragmentList.replaceChildren(createMessage("Не удалось удалить fragment."));
      return;
    }
    await showFragmentLibrary();
  }

  async function saveCurrentFragment() {
    if (!workspace.lastConvertedModelId || !workspace.lastSourceIfcName) return;

    const model = fragments.list.get(workspace.lastConvertedModelId);
    if (!model) {
      statusText.textContent = "Нет модели для сохранения";
      return;
    }

    saveFragmentBtn.loading = true;
    statusText.textContent = "Сохранение fragment";
    try {
      const fragsBuffer = await model.getBuffer(true);
      if (fragsBuffer.byteLength > MAX_FRAGMENT_BYTES) {
        statusText.textContent = "Fragment больше 100 МБ";
        return;
      }

      const form = new FormData();
      form.set("name", workspace.lastSourceIfcName);
      form.set("file", new File([fragsBuffer], `${workspace.lastSourceIfcName}.frag`, { type: "application/octet-stream" }));

      const response = await fetch(apiUrl("/fragments"), { method: "POST", body: form });
      if (!response.ok) throw new Error(await response.text());
      const savedRecord = (await response.json()) as FragmentRecord;

      saveFragmentBtn.hidden = true;
      setActiveShareRecord(savedRecord);
      statusText.textContent = "Fragment сохранён";
    } catch (error) {
      showError(error);
    } finally {
      saveFragmentBtn.loading = false;
    }
  }

  async function hideSelected() {
    if (isEmptySelection(workspace.activeSelection)) return;
    await hider.set(false, workspace.activeSelection);
    await highlighter.clear("select");
  }

  async function isolateSelected() {
    if (isEmptySelection(workspace.activeSelection)) return;
    await hider.isolate(workspace.activeSelection);
  }

  async function clearModels(options: { keepStatus?: boolean } = {}) {
    for (const [modelId] of fragments.list) {
      await fragments.core.disposeModel(modelId);
    }
    await highlighter.clear("select");
    await clearSearch();
    searchPanel.hidden = true;
    saveFragmentBtn.hidden = true;
    setActiveShareRecord(null);
    resetDataIndex();
    fileName.textContent = "-";
    if (!options.keepStatus) statusText.textContent = "Загрузите IFC";
    refreshModelState();
  }

  function toggleDataPanel() {
    if (dataPanel.hidden) {
      openDataPanel();
      return;
    }

    closeDataPanel();
  }

  function openDataPanel() {
    dataPanel.hidden = false;
    if (workspace.elementIndex.length === 0 && fragments.list.size > 0) {
      void rebuildDataIndex();
      return;
    }
    applyDataFilters();
  }

  function closeDataPanel() {
    dataPanel.hidden = true;
  }

  async function rebuildDataIndex() {
    if (fragments.list.size === 0) {
      resetDataIndex();
      return;
    }

    dataSummary.textContent = "Индексация элементов...";
    dataTableOutput.replaceChildren(createMessage("Сбор IFC атрибутов..."));

    try {
      workspace.elementIndex = await buildElementIndex({
        fragments,
        onProgress: (processed, total) => {
          dataSummary.textContent = `Индексация: ${processed}/${total}`;
        },
      });
      fillSelectOptions(dataCategoryFilter, getUniqueValues(workspace.elementIndex, "category"), "Все IFC Class");
      fillSelectOptions(dataStoreyFilter, getUniqueValues(workspace.elementIndex, "storey"), "Все этажи");
      applyDataFilters();
    } catch (error) {
      console.error(error);
      dataSummary.textContent = "Ошибка индексации";
      dataTableOutput.replaceChildren(
        createMessage(error instanceof Error ? error.message : String(error)),
      );
    }
  }

  function resetDataIndex() {
    workspace.elementIndex = [];
    workspace.filteredElements = [];
    dataSummary.textContent = "Загрузите модель";
    dataSearchInput.value = "";
    fillSelectOptions(dataCategoryFilter, [], "Все IFC Class");
    fillSelectOptions(dataStoreyFilter, [], "Все этажи");
    dataTableOutput.replaceChildren(createMessage("Загрузите IFC или fragment."));
  }

  function applyDataFilters() {
    workspace.filteredElements = filterElementIndex(workspace.elementIndex, {
      query: dataSearchInput.value,
      category: dataCategoryFilter.value,
      storey: dataStoreyFilter.value,
    });

    dataSummary.textContent = `${workspace.filteredElements.length} из ${workspace.elementIndex.length} элементов`;
    renderElementTable({
      records: workspace.filteredElements,
      totalCount: workspace.filteredElements.length,
      output: dataTableOutput,
      onSelect: selectDataRecord,
    });
  }

  async function selectDataRecord(record: BimElementRecord) {
    const modelIdMap = recordsToModelIdMap([record]);
    await applySearchHighlight(modelIdMap);
    await fitToItems(modelIdMap);
    await renderSelectedProperties({ components, modelIdMap, output: propertiesOutput });
    workspace.activeSelection = modelIdMap;
    selectionCount.textContent = "1";
  }

  async function highlightFilteredElements() {
    if (workspace.filteredElements.length === 0) return;
    highlightFilteredBtn.loading = true;
    try {
      const limitedRecords = workspace.filteredElements.slice(0, 1500);
      const modelIdMap = recordsToModelIdMap(limitedRecords);
      await applySearchHighlight(modelIdMap);
      await fitToItems(modelIdMap);
      statusText.textContent = `Подсвечено элементов: ${limitedRecords.length}`;
    } finally {
      highlightFilteredBtn.loading = false;
    }
  }

  async function searchItems() {
    const term = searchInput.value.trim();
    if (!term) {
      searchOutput.replaceChildren(createMessage("Введите текст поиска."));
      return;
    }

    if (fragments.list.size === 0) {
      searchOutput.replaceChildren(createMessage("Сначала загрузите модель."));
      return;
    }

    searchBtn.loading = true;
    searchOutput.replaceChildren(createMessage("Поиск..."));

    try {
      const geometryItems = await getGeometryItemsMap();
      const result = await findItemsByAllAttributes(term, geometryItems);

      if (isEmptySelection(result)) {
        await clearSceneHighlight();
        searchOutput.replaceChildren(createMessage("Ничего не найдено."));
        return;
      }

      await applySearchHighlight(result, geometryItems);
      await fitToItems(result);
      await renderSearchResults(result);
    } catch (error) {
      console.error(error);
      searchOutput.replaceChildren(
        createMessage(error instanceof Error ? error.message : String(error)),
      );
    } finally {
      searchBtn.loading = false;
    }
  }

  function toggleSearchPanel() {
    if (searchPanel.hidden) {
      expandSearchPanel();
      return;
    }

    closeSearchPanel();
  }

  function expandSearchPanel() {
    searchPanel.hidden = false;
    searchPanel.classList.remove("is-collapsed");
    searchInput.focus();
  }

  function closeSearchPanel() {
    searchPanel.hidden = true;
    searchPanel.classList.remove("is-collapsed");
    searchInput.value = "";
    searchOutput.replaceChildren(createMessage("Введите текст поиска."));
  }

  function collapseSearchPanel() {
    searchPanel.hidden = false;
    searchPanel.classList.add("is-collapsed");
  }

  async function clearSearch() {
    searchInput.value = "";
    searchOutput.replaceChildren(createMessage("Введите текст поиска."));
    await clearSceneHighlight();
  }

  async function clearSceneHighlight() {
    await highlighter.clear("search");
    await highlighter.clear("select");
    await fragments.resetHighlight();
  }

  async function getGeometryItemsMap() {
    const result: ModelIdMap = {};
    for (const [modelId, model] of fragments.list) {
      const ids = await model.getItemsIdsWithGeometry();
      result[modelId] = new Set(ids);
    }
    return result;
  }

  async function findItemsByAllAttributes(term: string, geometryItems: ModelIdMap) {
    const result: ModelIdMap = {};
    const needle = term.toLocaleLowerCase();
    const chunkSize = 500;

    for (const [modelId, localIds] of Object.entries(geometryItems)) {
      const model = fragments.list.get(modelId);
      if (!model) continue;

      const ids = [...localIds];
      for (let index = 0; index < ids.length; index += chunkSize) {
        const chunk = ids.slice(index, index + chunkSize);
        const items = await model.getItemsData(chunk, {
          attributesDefault: true,
          relationsDefault: { attributes: true, relations: false },
        });

        for (let itemIndex = 0; itemIndex < chunk.length; itemIndex++) {
          const localId = chunk[itemIndex];
          const item = items[itemIndex];
          const haystack = stringifySearchableItem(localId, item);
          if (!haystack.toLocaleLowerCase().includes(needle)) continue;

          result[modelId] ??= new Set<number>();
          result[modelId].add(localId);
        }
      }
    }

    return result;
  }

  function stringifySearchableItem(localId: number, item: unknown) {
    const chunks: string[] = [String(localId)];
    const seen = new WeakSet<object>();

    const visit = (value: unknown) => {
      if (value === null || value === undefined) return;

      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        chunks.push(String(value));
        return;
      }

      if (Array.isArray(value)) {
        for (const entry of value) visit(entry);
        return;
      }

      if (typeof value !== "object" || seen.has(value)) return;
      seen.add(value);

      for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        chunks.push(key);
        if (key === "value" || key === "name" || key === "type" || key.startsWith("_")) {
          visit(nestedValue);
        } else {
          visit(nestedValue);
        }
      }
    };

    visit(item);
    return chunks.join(" ");
  }

  async function applySearchHighlight(found: ModelIdMap, geometryItems?: ModelIdMap) {
    const allItems = geometryItems ?? (await getGeometryItemsMap());
    const dimmed = subtractModelIdMap(allItems, found);

    await clearSceneHighlight();
    if (!isEmptySelection(dimmed)) await fragments.highlight(dimHighlightStyle, dimmed);
    await fragments.highlight(searchHighlightStyle, found);
  }

  async function fitToItems(modelIdMap: ModelIdMap) {
    const boxes = await fragments.getBBoxes(modelIdMap);
    const box = new THREE.Box3();
    for (const itemBox of boxes) box.union(itemBox);

    if (!box.isEmpty()) {
      await world.camera.controls.fitToBox(box, true, {
        paddingLeft: 1.2,
        paddingRight: 1.2,
        paddingTop: 1.2,
        paddingBottom: 1.2,
      });
    }
  }

  async function renderSearchResults(modelIdMap: ModelIdMap) {
    const total = countSelection(modelIdMap);
    const wrapper = document.createElement("div");
    wrapper.className = "search-results";

    const summary = document.createElement("span");
    summary.className = "search-summary";
    summary.textContent = `Найдено: ${total}`;
    wrapper.append(summary);

    const list = document.createElement("div");
    list.className = "search-list";
    wrapper.append(list);

    let rendered = 0;
    for (const [modelId, localIds] of Object.entries(modelIdMap)) {
      if (rendered >= 50) break;
      const model = fragments.list.get(modelId);
      if (!model) continue;

      const ids = [...localIds].slice(0, 50 - rendered);
      const items = await model.getItemsData(ids, {
        attributesDefault: true,
        relationsDefault: { attributes: false, relations: false },
      });

      for (let index = 0; index < ids.length; index++) {
        const localId = ids[index];
        const item = items[index] as Record<string, { value?: unknown }> | undefined;
        const name = getAttrText(item, "Name") || getAttrText(item, "_category") || `#${localId}`;
        const category = getAttrText(item, "_category");
        const guid = getAttrText(item, "_guid");
        const singleItem = { [modelId]: new Set([localId]) };

        const button = document.createElement("button");
        button.className = "search-result";
        button.type = "button";
        button.innerHTML = `
          <strong>${escapeHtml(name)}</strong>
          <span>${escapeHtml(category || modelId)} · ${localId}</span>
          ${guid ? `<small>${escapeHtml(guid)}</small>` : ""}
        `;
        button.onclick = (event) => {
          event.stopPropagation();
          void applySearchHighlight(singleItem)
            .then(() => fitToItems(singleItem))
            .then(() => collapseSearchPanel());
        };
        list.append(button);
        rendered++;
      }
    }

    if (total > rendered) {
      const more = document.createElement("span");
      more.className = "search-more";
      more.textContent = `Показаны первые ${rendered} из ${total}. Уточните запрос.`;
      wrapper.append(more);
    }

    searchOutput.replaceChildren(wrapper);
  }

  async function downloadFragments() {
    if (fragments.list.size === 0) return;

    for (const [, model] of fragments.list) {
      const fragsBuffer = await model.getBuffer(true);
      const file = new File([fragsBuffer], `${model.modelId}.frag`);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(file);
      link.download = file.name;
      link.click();
      URL.revokeObjectURL(link.href);
    }
  }

  async function fitToModels() {
    const objects = [...fragments.list.values()].map((model) => model.object);
    if (objects.length === 0) return;

    const box = new THREE.Box3();
    for (const object of objects) {
      object.updateWorldMatrix(true, true);
      box.expandByObject(object);
    }

    if (!box.isEmpty()) {
      await world.camera.controls.fitToBox(box, true, {
        paddingLeft: 1,
        paddingRight: 1,
        paddingTop: 1,
        paddingBottom: 1,
      });
    }
  }

  async function resetHomeView() {
    await world.camera.controls.setLookAt(24, 18, 24, 0, 0, 0, true);
    await fitToModels();
  }

  function refreshModelState() {
    const hasModels = fragments.list.size > 0;
    modelCount.textContent = String(fragments.list.size);
    loadIfcBtn.hidden = hasModels;
    searchToggleBtn.hidden = !hasModels;
    homeViewBtn.hidden = !hasModels;
    dataBrowserBtn.hidden = !hasModels;
    if (!hasModels) dataPanel.hidden = true;
  }

  function clearSelectionInfo() {
    workspace.activeSelection = {};
    selectionCount.textContent = "0";
    propertiesOutput.replaceChildren(createMessage("Выберите элемент модели."));
  }

  function setBusy(isBusy: boolean, message?: string) {
    loadIfcBtn.loading = isBusy;
    loadFragBtn.loading = isBusy;
    loadingOverlay.hidden = !isBusy;
    progress.hidden = !isBusy;
    if (isBusy) setProgress(0);
    if (message) {
      statusText.textContent = message;
      loadingStatus.textContent = message;
    }
  }

  function setProgress(value: number) {
    const percentage = Math.max(0, Math.min(100, value * 100));
    progressBar.style.width = `${percentage}%`;
    loadingStatus.textContent = `${statusText.textContent || "Обработка модели"} · ${Math.round(percentage)}%`;
  }

  function showError(error: unknown) {
    console.error(error);
    statusText.textContent = "Ошибка загрузки модели";
    propertiesOutput.replaceChildren(
      createMessage(error instanceof Error ? error.message : String(error)),
    );
  }

  function formatProcess(process: string) {
    const labels: Record<string, string> = {
      geometries: "Геометрия",
      attributes: "Атрибуты",
      relations: "Связи",
      conversion: "Конвертация",
    };
    return labels[process] ?? process;
  }

  function formatFragmentStage(stage: string) {
    const labels: Record<string, string> = {
      decompressing: "Распаковка fragment",
      parsing: "Чтение fragment",
      generating: "Построение сцены",
      done: "Fragment загружен",
    };
    return labels[stage] ?? "Загрузка fragment";
  }

  function apiUrl(path: string) {
    return `${API_BASE}${path}`;
  }

}
