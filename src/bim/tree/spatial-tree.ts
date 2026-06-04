import * as CUI from "@thatopen/ui-obc";

export function mountSpatialTree(options: {
  components: unknown;
  models: Iterable<unknown>;
  output: HTMLDivElement;
}) {
  const [spatialTree] = CUI.tables.spatialTree({
    components: options.components as Parameters<typeof CUI.tables.spatialTree>[0]["components"],
    models: options.models as Parameters<typeof CUI.tables.spatialTree>[0]["models"],
    selectHighlighterName: "select",
  });
  spatialTree.classList.add("spatial-tree");
  options.output.replaceChildren(spatialTree);
  return spatialTree;
}
