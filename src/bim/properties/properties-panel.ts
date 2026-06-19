import * as CUI from "@thatopen/ui-obc";
import type { ModelIdMap } from "../types.ts";
import { createMessage } from "../ui/dom-utils.ts";
import { limitSelection } from "../selection/selection.ts";
import { createEmptyIfcOverrideState, type IfcOverrideState, type IfcPropertyOverrideDraft } from "../ifc-overrides/override-types.ts";
import { parseOverrideValue } from "../ifc-overrides/override-utils.ts";
import { logControllerError } from "../ui/controller-errors.ts";
import { buildOverrideEditorViewModel } from "./properties-override-ux.ts";

export async function renderSelectedProperties(options: {
  components: unknown;
  modelIdMap: ModelIdMap;
  output: HTMLDivElement;
  pendingOverrideCount?: number;
  overrideState?: IfcOverrideState;
  onSaveOverride?: (draft: IfcPropertyOverrideDraft) => void | Promise<void>;
  onRemoveOverride?: (key: string) => void | Promise<void>;
  onClearOverrides?: () => void | Promise<void>;
}) {
  const {
    components,
    modelIdMap,
    output,
    pendingOverrideCount = 0,
    overrideState,
    onSaveOverride,
    onRemoveOverride,
    onClearOverrides,
  } = options;
  output.replaceChildren(createMessage("Загрузка свойств..."));

  try {
    const filteredSelection = limitSelection(modelIdMap, 30);
    const primarySelection = pickPrimarySelection(filteredSelection);
    const wrapper = document.createElement("div");
    wrapper.className = "properties-panel-stack";

    if (onSaveOverride) {
      wrapper.appendChild(buildOverrideEditor({
        selection: primarySelection,
        overrideState: overrideState ?? {
          ...createEmptyIfcOverrideState(),
          pendingCount: pendingOverrideCount,
        },
        onSaveOverride,
        onRemoveOverride,
        onClearOverrides,
      }));
    }

    const [table] = CUI.tables.itemsData({
      components: components as Parameters<typeof CUI.tables.itemsData>[0]["components"],
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

    if (onSaveOverride) {
      const note = document.createElement("p");
      note.className = "properties-panel-note";
      note.textContent = pendingOverrideCount > 0 ? `Pending changes: ${pendingOverrideCount}` : "Правки будут сохранены как pending до экспорта.";
      wrapper.append(note, table);
    } else {
      wrapper.appendChild(table);
    }

    output.replaceChildren(wrapper);
  } catch (error) {
    logControllerError(error);
    output.replaceChildren(
      createMessage(error instanceof Error ? error.message : String(error)),
    );
  }
}

function pickPrimarySelection(modelIdMap: ModelIdMap) {
  const [modelId, localIds] = Object.entries(modelIdMap).find(([, ids]) => ids.size > 0) ?? [];
  const localId = localIds ? [...localIds][0] : undefined;
  if (!modelId || localId === undefined) return null;
  return { modelId, localId };
}

function buildOverrideEditor(options: {
  selection: { modelId: string; localId: number } | null;
  overrideState: IfcOverrideState;
  onSaveOverride: (draft: IfcPropertyOverrideDraft) => void | Promise<void>;
  onRemoveOverride?: (key: string) => void | Promise<void>;
  onClearOverrides?: () => void | Promise<void>;
}) {
  const { selection, overrideState, onSaveOverride, onRemoveOverride, onClearOverrides } = options;
  const viewModel = buildOverrideEditorViewModel({ selection, state: overrideState });
  const container = document.createElement("section");
  container.className = "properties-override-editor";

  const header = document.createElement("div");
  header.className = "properties-override-header";
  const title = document.createElement("h4");
  title.textContent = "Свойства элемента";
  const summary = document.createElement("span");
  summary.className = "properties-override-summary";
  summary.textContent = viewModel.summary;
  header.append(title, summary);

  const hint = document.createElement("p");
  hint.className = "properties-panel-note";
  hint.textContent = selection
    ? `Выбран: ${viewModel.selectionLabel}. Статус: ${viewModel.selectedStatus}. Текущий override: ${viewModel.selectedPropertyKey}.`
    : "Выберите один элемент, чтобы добавить pending-правку.";

  const status = document.createElement("div");
  status.className = "properties-panel-status";

  const form = document.createElement("form");
  form.className = "properties-override-form";

  const propertySetInput = createTextField("Property set", "Pset_WallCommon");
  const propertyNameInput = createTextField("Property name", "FireRating");
  const valueInput = createTextField("Override value", "EI60");
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "button button-primary";
  submit.textContent = "Сохранить pending";
  submit.disabled = !selection;

  form.append(
    propertySetInput.wrapper,
    propertyNameInput.wrapper,
    valueInput.wrapper,
    submit,
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selection) return;

    const propertySet = propertySetInput.input.value.trim();
    const propertyName = propertyNameInput.input.value.trim();
    if (!propertySet || !propertyName) {
      status.textContent = "Нужны Property set и Property name.";
      return;
    }

    await onSaveOverride({
      modelId: selection.modelId,
      localId: selection.localId,
      propertySet,
      propertyName,
      value: parseOverrideValue(valueInput.input.value),
    });

    status.textContent = `Pending override сохранён: ${propertySet}.${propertyName}.`;
  });

  const pendingPanel = buildPendingOverridesPanel({
    viewModel,
    onRemoveOverride,
    onClearOverrides,
  });

  container.append(header, hint, form, pendingPanel, status);
  return container;
}

function buildPendingOverridesPanel(options: {
  viewModel: ReturnType<typeof buildOverrideEditorViewModel>;
  onRemoveOverride?: (key: string) => void | Promise<void>;
  onClearOverrides?: () => void | Promise<void>;
}) {
  const { viewModel, onRemoveOverride, onClearOverrides } = options;
  const section = document.createElement("div");
  section.className = "properties-pending-overrides";

  const header = document.createElement("div");
  header.className = "properties-pending-header";
  const title = document.createElement("strong");
  title.textContent = "Pending правки";
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "button button-secondary";
  clear.textContent = "Сбросить все";
  clear.disabled = !viewModel.canClear || !onClearOverrides;
  clear.addEventListener("click", () => void onClearOverrides?.());
  header.append(title, clear);

  const list = document.createElement("div");
  list.className = "properties-pending-list";
  if (viewModel.pendingItems.length === 0) {
    const empty = document.createElement("p");
    empty.className = "properties-panel-note";
    empty.textContent = "Пока нет pending правок. Исходный IFC не изменён.";
    list.appendChild(empty);
  } else {
    for (const item of viewModel.pendingItems) {
      const row = document.createElement("div");
      row.className = "properties-pending-item";
      const body = document.createElement("div");
      const rowTitle = document.createElement("strong");
      rowTitle.textContent = item.title;
      const meta = document.createElement("span");
      meta.textContent = `${item.target} · ${item.statusLabel} → ${item.valueLabel}`;
      body.append(rowTitle, meta);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button button-secondary";
      remove.textContent = "Отменить";
      remove.disabled = !onRemoveOverride;
      remove.addEventListener("click", () => void onRemoveOverride?.(item.key));
      row.append(body, remove);
      list.appendChild(row);
    }
  }

  const exportNote = document.createElement("p");
  exportNote.className = "properties-panel-note";
  exportNote.textContent = "Экспорт IFC применит pending правки в новый файл; исходник остаётся неизменным.";

  section.append(header, list, exportNote);
  return section;
}

function createTextField(label: string, value: string) {
  const wrapper = document.createElement("label");
  wrapper.className = "properties-field";
  const span = document.createElement("span");
  span.textContent = label;
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  wrapper.append(span, input);
  return { wrapper, input };
}
