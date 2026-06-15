import * as THREE from "three";
import { countSelection, isEmptySelection, subtractModelIdMap } from "../selection/selection.ts";
import type { ModelIdMap } from "../types.ts";
import { createMessage, escapeHtml, getAttrText } from "../ui/dom-utils.ts";
import { dimHighlightStyle, searchHighlightStyle } from "../viewer/viewer.ts";
import type { BimAppContext } from "./app-context.ts";

export function createSearchController(ctx: BimAppContext) {
  const { fragments, highlighter, world } = ctx.viewer;
  const { searchInput, searchOutput, searchPanel, searchBtn } = ctx.dom;

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
      searchOutput.replaceChildren(createMessage(error instanceof Error ? error.message : String(error)));
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
        visit(nestedValue);
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

  return {
    searchItems,
    toggleSearchPanel,
    expandSearchPanel,
    closeSearchPanel,
    collapseSearchPanel,
    clearSearch,
    clearSceneHighlight,
    getGeometryItemsMap,
    applySearchHighlight,
    fitToItems,
  };
}
