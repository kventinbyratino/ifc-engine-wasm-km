export interface ElementContextMenuOptions {
  target: HTMLElement;
  getSelectionCount: () => number;
  onOpenProperties: () => void;
  onFindInData?: () => void | Promise<void>;
  onCreateIssue?: () => void | Promise<void>;
  onAddToSelectionSet?: () => void | Promise<void>;
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

  const actions = [
    { label: "Свойства", run: options.onOpenProperties },
    { label: "Найти в данных", run: options.onFindInData },
    { label: "Создать замечание", run: options.onCreateIssue },
    { label: "Добавить в выборку", run: options.onAddToSelectionSet },
  ].filter((action): action is { label: string; run: () => void | Promise<void> } => typeof action.run === "function");
  const actionButtons = actions.map((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    button.setAttribute("role", "menuitem");
    button.onclick = () => {
      if (button.disabled) {
        options.onMissingSelection?.();
        return;
      }
      void action.run();
      close();
    };
    return button;
  });

  const hint = document.createElement("span");
  hint.className = "element-context-menu-hint";
  hint.textContent = "Сначала выберите элемент";
  hint.hidden = true;

  menu.append(...actionButtons, hint);
  container.append(menu);

  const close = () => {
    menu.hidden = true;
  };

  const show = (event: MouseEvent) => {
    event.preventDefault();
    const hasSelection = options.getSelectionCount() > 0;
    for (const button of actionButtons) button.disabled = !hasSelection;
    hint.hidden = hasSelection;
    positionMenu(menu, event.clientX, event.clientY);
    menu.hidden = false;
    actionButtons[0]?.focus();
  };

  const onDocumentClick = (event: MouseEvent) => {
    if (!menu.contains(event.target as Node)) close();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") close();
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
