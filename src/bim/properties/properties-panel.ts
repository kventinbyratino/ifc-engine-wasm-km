import * as CUI from "@thatopen/ui-obc";
import type { ModelIdMap } from "../types.ts";
import { createMessage } from "../ui/dom-utils.ts";
import { limitSelection } from "../selection/selection.ts";

export async function renderSelectedProperties(options: {
  components: unknown;
  modelIdMap: ModelIdMap;
  output: HTMLDivElement;
}) {
  const { components, modelIdMap, output } = options;
  output.replaceChildren(createMessage("Загрузка свойств..."));

  try {
    const filteredSelection = limitSelection(modelIdMap, 30);
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
    output.replaceChildren(table);
  } catch (error) {
    console.error(error);
    output.replaceChildren(
      createMessage(error instanceof Error ? error.message : String(error)),
    );
  }
}
