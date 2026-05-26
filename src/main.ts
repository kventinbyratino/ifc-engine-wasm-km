import * as THREE from "three";
import * as BUI from "@thatopen/ui";
import * as CUI from "@thatopen/ui-obc";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import type * as FRAGS from "@thatopen/fragments";
import workerUrl from "@thatopen/fragments/worker?url";
import "./styles.css";

type ModelIdMap = OBC.ModelIdMap;

const statusText = document.getElementById("statusText") as HTMLSpanElement;
const fileName = document.getElementById("fileName") as HTMLElement;
const modelCount = document.getElementById("modelCount") as HTMLElement;
const selectionCount = document.getElementById("selectionCount") as HTMLElement;
const propertiesOutput = document.getElementById("propertiesOutput") as HTMLDivElement;
const treeOutput = document.getElementById("treeOutput") as HTMLDivElement;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const searchOutput = document.getElementById("searchOutput") as HTMLDivElement;
const progress = document.getElementById("progress") as HTMLDivElement;
const progressBar = document.getElementById("progressBar") as HTMLDivElement;
const viewport = document.getElementById("viewport") as HTMLDivElement;
const viewCube = document.getElementById("viewCube") as CUI.ViewCube;

const ifcInput = document.getElementById("ifcInput") as HTMLInputElement;
const fragInput = document.getElementById("fragInput") as HTMLInputElement;
const loadIfcBtn = document.getElementById("loadIfcBtn") as BUI.Button;
const loadFragBtn = document.getElementById("loadFragBtn") as BUI.Button;
const fitBtn = document.getElementById("fitBtn") as BUI.Button;
const clearBtn = document.getElementById("clearBtn") as BUI.Button;
const downloadFragBtn = document.getElementById("downloadFragBtn") as BUI.Button;
const hideSelectedBtn = document.getElementById("hideSelectedBtn") as BUI.Button;
const isolateSelectedBtn = document.getElementById("isolateSelectedBtn") as BUI.Button;
const showAllBtn = document.getElementById("showAllBtn") as BUI.Button;
const searchBtn = document.getElementById("searchBtn") as BUI.Button;
const clearSearchBtn = document.getElementById("clearSearchBtn") as BUI.Button;

BUI.Manager.init();
CUI.Manager.init();

const components = new OBC.Components();
const worlds = components.get(OBC.Worlds);
const world = worlds.create<
  OBC.SimpleScene,
  OBC.OrthoPerspectiveCamera,
  OBF.PostproductionRenderer
>();

world.scene = new OBC.SimpleScene(components);
world.scene.setup();
world.scene.three.background = new THREE.Color("#f3f5f8");
world.renderer = new OBF.PostproductionRenderer(components, viewport);
world.camera = new OBC.OrthoPerspectiveCamera(components);
await world.camera.controls.setLookAt(24, 18, 24, 0, 0, 0);

components.init();
components.get(OBC.Grids).create(world);
components.get(OBC.Raycasters).get(world);

const fragments = components.get(OBC.FragmentsManager);
fragments.init(workerUrl);

const ifcLoader = components.get(OBC.IfcLoader);
await ifcLoader.setup({
  autoSetWasm: false,
  wasm: {
    path: "/web-ifc/",
    absolute: true,
  },
});

const highlighter = components.get(OBF.Highlighter);
highlighter.setup({
  world,
  selectMaterialDefinition: {
    color: new THREE.Color("#00a7b5"),
    opacity: 0.95,
    transparent: false,
    renderedFaces: 0,
  },
});
highlighter.styles.set("search", {
  color: new THREE.Color("#ffb84d"),
  opacity: 0.9,
  transparent: false,
  renderedFaces: 0,
});

const [spatialTree] = CUI.tables.spatialTree({
  components,
  models: fragments.list.values(),
  selectHighlighterName: "select",
});
spatialTree.classList.add("spatial-tree");
treeOutput.replaceChildren(spatialTree);

const hider = components.get(OBC.Hider);
const itemsFinder = components.get(OBC.ItemsFinder);
let activeSelection: ModelIdMap = {};

world.camera.controls.addEventListener("update", () => {
  fragments.core.update();
  viewCube.updateOrientation();
});

world.onCameraChanged.add((camera) => {
  for (const [, model] of fragments.list) {
    model.useCamera(camera.three);
  }
  fragments.core.update(true);
});

fragments.list.onItemSet.add(({ value: model }) => {
  model.useCamera(world.camera.three);
  world.scene.three.add(model.object);
  fragments.core.update(true);
  refreshModelState();
  void fitToModels();
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
  activeSelection = modelIdMap;
  selectionCount.textContent = String(countSelection(modelIdMap));
  await renderSelectedProperties(modelIdMap);
});

highlighter.events.select.onClear.add(() => {
  clearSelectionInfo();
});

viewCube.camera = world.camera.three;
viewCube.addEventListener("rightclick", () => setCamera(30, 10, 0));
viewCube.addEventListener("leftclick", () => setCamera(-30, 10, 0));
viewCube.addEventListener("topclick", () => setCamera(0, 32, 0));
viewCube.addEventListener("bottomclick", () => setCamera(0, -32, 0));
viewCube.addEventListener("frontclick", () => setCamera(0, 10, 30));
viewCube.addEventListener("backclick", () => setCamera(0, 10, -30));

loadIfcBtn.onclick = () => ifcInput.click();
loadFragBtn.onclick = () => fragInput.click();
fitBtn.onclick = () => void fitToModels();
clearBtn.onclick = () => void clearModels();
downloadFragBtn.onclick = () => void downloadFragments();
hideSelectedBtn.onclick = () => void hideSelected();
isolateSelectedBtn.onclick = () => void isolateSelected();
showAllBtn.onclick = () => void hider.set(true);
searchBtn.onclick = () => void searchItems();
clearSearchBtn.onclick = () => void clearSearch();

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
    void highlighter.clear("select");
    void highlighter.clear("search");
  }

  if (event.code === "Enter" && document.activeElement === searchInput) {
    void searchItems();
  }
});

refreshModelState();

async function loadIfc(file: File) {
  setBusy(true, "Конвертация IFC в браузере");
  fileName.textContent = file.name;
  propertiesOutput.textContent = "IFC читается через web-ifc WASM. Серверная обработка не используется.";

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const modelId = createModelId(file.name);

    await ifcLoader.load(buffer, true, modelId, {
      userData: { sourceName: file.name, sourceType: "ifc" },
      instanceCallback: (importer) => {
        importer.addAllAttributes();
        importer.addAllRelations();
      },
      processData: {
        progressCallback: (value, data) => {
          setProgress(value);
          statusText.textContent = `${formatProcess(data.process)}: ${Math.round(value * 100)}%`;
        },
      },
    });

    statusText.textContent = "IFC загружен и преобразован в Fragments";
    setProgress(1);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function loadFrag(file: File) {
  setBusy(true, "Загрузка Fragments");
  fileName.textContent = file.name;

  try {
    const buffer = await file.arrayBuffer();
    const modelId = createModelId(file.name);
    await fragments.core.load(buffer, {
      modelId,
      userData: { sourceName: file.name, sourceType: "frag" },
    });
    statusText.textContent = "FRAG загружен";
    setProgress(1);
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
}

async function renderSelectedProperties(modelIdMap: ModelIdMap) {
  propertiesOutput.replaceChildren(createMessage("Загрузка свойств..."));

  try {
    const filteredSelection = limitSelection(modelIdMap, 30);
    const [table] = CUI.tables.itemsData({
      components,
      modelIdMap: filteredSelection,
      emptySelectionWarning: false,
      itemsDataConfig: {
        attributesDefault: true,
        relationsDefault: { attributes: false, relations: false },
        relations: {
          IsDefinedBy: { attributes: true, relations: true },
          DefinesOccurrence: { attributes: false, relations: false },
          ContainedInStructure: { attributes: true, relations: true },
          ContainsElements: { attributes: false, relations: false },
          Decomposes: { attributes: false, relations: false },
          HasAssociations: { attributes: true, relations: true },
          ObjectTypeOf: { attributes: false, relations: false },
        },
      },
    });

    table.classList.add("properties-table");
    table.columns = [
      { name: "Name", width: "minmax(8rem, 44%)" },
      { name: "Value", width: "minmax(7rem, 1fr)" },
    ];
    table.visibleColumns = ["Name", "Value"];
    table.headersHidden = true;
    propertiesOutput.replaceChildren(table);
  } catch (error) {
    console.error(error);
    propertiesOutput.replaceChildren(
      createMessage(error instanceof Error ? error.message : String(error)),
    );
  }
}

async function hideSelected() {
  if (isEmptySelection(activeSelection)) return;
  await hider.set(false, activeSelection);
  await highlighter.clear("select");
}

async function isolateSelected() {
  if (isEmptySelection(activeSelection)) return;
  await hider.isolate(activeSelection);
}

async function clearModels() {
  for (const [modelId] of fragments.list) {
    await fragments.core.disposeModel(modelId);
  }
  await highlighter.clear("select");
  await clearSearch();
  fileName.textContent = "-";
  statusText.textContent = "Сцена очищена";
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
    const pattern = new RegExp(escapeRegExp(term), "i");
    const queries: FRAGS.GetItemsByAttributeParams[] = [
      { name: /^(Name|LongName|Tag|ObjectType|PredefinedType|_guid|_category)$/i, value: pattern },
    ];
    const numericTerm = Number(term);
    if (Number.isFinite(numericTerm)) {
      queries.push({ name: /^_localId$/i, value: numericTerm });
    }

    const geometryItems = await getGeometryItemsMap();
    const result = await itemsFinder.getItems(
      [
        {
          attributes: {
            aggregation: "inclusive",
            queries,
          },
        },
      ],
      {
        aggregation: "inclusive",
        items: geometryItems,
      },
    );

    await highlighter.clear("search");
    if (isEmptySelection(result)) {
      searchOutput.replaceChildren(createMessage("Ничего не найдено."));
      return;
    }

    await highlighter.highlightByID("search", result, true);
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

async function clearSearch() {
  searchInput.value = "";
  searchOutput.replaceChildren(createMessage("Введите текст поиска."));
  await highlighter.clear("search");
}

async function getGeometryItemsMap() {
  const result: ModelIdMap = {};
  for (const [modelId, model] of fragments.list) {
    const ids = await model.getItemsIdsWithGeometry();
    result[modelId] = new Set(ids);
  }
  return result;
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

      const button = document.createElement("button");
      button.className = "search-result";
      button.type = "button";
      button.innerHTML = `
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(category || modelId)} · ${localId}</span>
        ${guid ? `<small>${escapeHtml(guid)}</small>` : ""}
      `;
      button.onclick = () => {
        void highlighter.highlightByID("select", { [modelId]: new Set([localId]) }, true);
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
    const fragsBuffer = await model.getBuffer(false);
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

function setCamera(x: number, y: number, z: number) {
  void world.camera.controls.setLookAt(x, y, z, 0, 0, 0, true);
}

function refreshModelState() {
  modelCount.textContent = String(fragments.list.size);
}

function clearSelectionInfo() {
  activeSelection = {};
  selectionCount.textContent = "0";
  propertiesOutput.replaceChildren(createMessage("Выберите элемент модели."));
}

function createModelId(name: string) {
  const clean = name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "_");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${clean || "model"}_${suffix}`;
}

function countSelection(modelIdMap: ModelIdMap) {
  return Object.values(modelIdMap).reduce((sum, ids) => sum + ids.size, 0);
}

function isEmptySelection(modelIdMap: ModelIdMap) {
  return countSelection(modelIdMap) === 0;
}

function setBusy(isBusy: boolean, message?: string) {
  loadIfcBtn.loading = isBusy;
  loadFragBtn.loading = isBusy;
  progress.hidden = !isBusy;
  if (isBusy) setProgress(0);
  if (message) statusText.textContent = message;
}

function setProgress(value: number) {
  const percentage = Math.max(0, Math.min(100, value * 100));
  progressBar.style.width = `${percentage}%`;
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

function limitSelection(modelIdMap: ModelIdMap, maxItems: number) {
  const result: ModelIdMap = {};
  let remaining = maxItems;

  for (const [modelId, localIds] of Object.entries(modelIdMap)) {
    if (remaining <= 0) break;
    const ids = [...localIds].slice(0, remaining);
    result[modelId] = new Set(ids);
    remaining -= ids.length;
  }

  return result;
}

function createMessage(text: string) {
  const message = document.createElement("span");
  message.className = "empty-state";
  message.textContent = text;
  return message;
}

function getAttrText(item: Record<string, { value?: unknown }> | undefined, key: string) {
  const value = item?.[key]?.value;
  if (value === undefined || value === null) return "";
  return String(value);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}
