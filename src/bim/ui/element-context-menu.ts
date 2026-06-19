export interface ElementContextMenuOptions {
  target: HTMLElement;
  getSelectionCount: () => number;
  onOpenProperties: () => void;
  onMissingSelection?: () => void;
  container?: HTMLElement;
}

export interface ElementContextMenuController {
  element: HTMLDivElement;
  close: () => void;
  destroy: () => void;
}

export function createElementContextMenu(options: ElementContextMenuOptions): ElementContextMenuController {
  const container = options.container ?? document.body;
  const menu = document.createElement("div");
  menu.className = "element-context-menu";
  menu.hidden = true;
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Действия элемента");

  const propertiesButton = document.createElement("button");
  propertiesButton.type = "button";
  propertiesButton.textContent = "Свойства";
  propertiesButton.setAttribute("role", "menuitem");

  const hint = document.createElement("span");
  hint.className = "element-context-menu-hint";
  hint.textContent = "Сначала выберите элемент";
  hint.hidden = true;

  menu.append(propertiesButton, hint);
  container.append(menu);

  const close = () => {
    menu.hidden = true;
  };

  const show = (event: MouseEvent) => {
    event.preventDefault();
    const hasSelection = options.getSelectionCount() > 0;
    propertiesButton.disabled = !hasSelection;
    hint.hidden = hasSelection;
    positionMenu(menu, event.clientX, event.clientY);
    menu.hidden = false;
    propertiesButton.focus();
  };

  const onDocumentClick = (event: MouseEvent) => {
    if (!menu.contains(event.target as Node)) close();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
  };

  propertiesButton.onclick = () => {
    if (propertiesButton.disabled) {
      options.onMissingSelection?.();
      return;
    }
    options.onOpenProperties();
    close();
  };

  options.target.addEventListener("contextmenu", show);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeyDown);

  return {
    element: menu,
    close,
    destroy: () => {
      options.target.removeEventListener("contextmenu", show);
      document.removeEventListener("click", onDocumentClick);
      document.removeEventListener("keydown", onKeyDown);
      menu.remove();
    },
  };
}

function positionMenu(menu: HTMLElement, clientX: number, clientY: number) {
  const padding = 8;
  const maxX = Math.max(padding, window.innerWidth - 180 - padding);
  const maxY = Math.max(padding, window.innerHeight - 96 - padding);
  menu.style.left = `${Math.min(Math.max(padding, clientX), maxX)}px`;
  menu.style.top = `${Math.min(Math.max(padding, clientY), maxY)}px`;
}
