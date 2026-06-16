import * as CUI from "@thatopen/ui-obc";
import type { ModelIdMap } from "../types.ts";
import { createMessage } from "../ui/dom-utils.ts";
import { limitSelection } from "../selection/selection.ts";
import type { IfcPropertyOverrideDraft } from "../ifc-overrides/override-types.ts";
import { parseOverrideValue } from "../ifc-overrides/override-utils.ts";
import { logControllerError } from "../ui/controller-errors.ts";

export async function renderSelectedProperties(options: {
  components: unknown;
  modelIdMap: ModelIdMap;
  output: HTMLDivElement;
  pendingOverrideCount?: number;
  onSaveOverride?: (draft: IfcPropertyOverrideDraft) => void | Promise<void>;
}) {
  const { components, modelIdMap, output, pendingOverrideCount = 0, onSaveOverride } = options;
  output.replaceChildren(createMessage("Загрузка свойств..."));

  try {
    const filteredSelection = limitSelection(modelIdMap, 30);
    const primarySelection = pickPrimarySelection(filteredSelection);
    const wrapper = document.createElement("div");
    wrapper.className = "properties-panel-stack";

    if (onSaveOverride) {
      wrapper.appendChild(buildOverrideEditor(primarySelection, pendingOverrideCount, onSaveOverride));
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

function buildOverrideEditor(
  selection: { modelId: string; localId: number } | null,
  pendingOverrideCount: number,
  onSaveOverride: (draft: IfcPropertyOverrideDraft) => void | Promise<void>,
) {
  const container = document.createElement("section");
  container.className = "properties-override-editor";

  const title = document.createElement("h4");
  title.textContent = "Редактирование свойства";

  const hint = document.createElement("p");
  hint.className = "properties-panel-note";
  hint.textContent = selection
    ? `Выбран элемент ${selection.modelId} #${selection.localId}. Pending правок: ${pendingOverrideCount}.`
    : "Выберите один элемент, чтобы добавить pending-правку.";

  const status = document.createElement("div");
  status.className = "properties-panel-status";

  const form = document.createElement("form");
  form.className = "properties-override-form";

  const propertySetInput = createTextField("Property set", "Pset_WallCommon");
  const propertyNameInput = createTextField("Property name", "FireRating");
  const valueInput = createTextField("Value", "EI60");
  const submit = document.createElement("button");
  submit.type = "submit";
  submit.className = "button button-primary";
  submit.textContent = "Save pending override";
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
      status.textContent = "Property set and property name are required.";
      return;
    }

    await onSaveOverride({
      modelId: selection.modelId,
      localId: selection.localId,
      propertySet,
      propertyName,
      value: parseOverrideValue(valueInput.input.value),
    });

    status.textContent = `Saved ${propertySet}.${propertyName} as pending.`;
  });

  container.append(title, hint, form, status);
  return container;
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
