import { HELP_SECTIONS, type HelpSection } from "./help-content.ts";

function appendText<K extends keyof HTMLElementTagNameMap>(parent: HTMLElement, tag: K, className: string, text: string) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  parent.appendChild(node);
  return node;
}

function sectionText(section: HelpSection) {
  return [
    section.title,
    section.roadmap,
    section.summary,
    ...section.steps,
    ...section.connections,
    ...section.links.map((link) => link.label),
    section.media.label,
  ].join(" ");
}

function renderSection(section: HelpSection) {
  const article = document.createElement("article");
  article.className = "help-section-card";
  article.id = `help-${section.id}`;
  article.dataset.helpSection = section.id;

  const header = document.createElement("header");
  header.className = "help-section-header";
  appendText(header, "span", "help-roadmap-badge", section.roadmap);
  appendText(header, "h3", "help-section-title", section.title);
  appendText(header, "p", "help-section-summary", section.summary);
  article.appendChild(header);

  const media = document.createElement("figure");
  media.className = "help-figure";
  media.innerHTML = `${section.media.svg}<figcaption>${section.media.label}</figcaption>`;
  article.appendChild(media);

  const grid = document.createElement("div");
  grid.className = "help-section-grid";

  const stepsBlock = document.createElement("div");
  stepsBlock.className = "help-block";
  appendText(stepsBlock, "h4", "help-block-title", "Как работать");
  const steps = document.createElement("ol");
  steps.className = "help-steps";
  section.steps.forEach((step) => appendText(steps, "li", "", step));
  stepsBlock.appendChild(steps);

  const connectionsBlock = document.createElement("div");
  connectionsBlock.className = "help-block";
  appendText(connectionsBlock, "h4", "help-block-title", "Связь между функциями");
  const connections = document.createElement("ul");
  connections.className = "help-connections";
  section.connections.forEach((connection) => appendText(connections, "li", "", connection));
  connectionsBlock.appendChild(connections);

  const related = document.createElement("div");
  related.className = "help-related";
  appendText(related, "strong", "", "Перейти дальше:");
  section.links.forEach((link) => {
    const anchor = document.createElement("a");
    anchor.href = `#help-${link.to}`;
    anchor.textContent = link.label;
    related.appendChild(anchor);
  });
  connectionsBlock.appendChild(related);

  grid.append(stepsBlock, connectionsBlock);
  article.appendChild(grid);
  return article;
}

export function renderHelpPage(output: HTMLElement) {
  if (!output || typeof document === "undefined") return;
  const searchableText = ["BIM Manager Workbench", "Связь между функциями", ...HELP_SECTIONS.map(sectionText)].join("\n");
  const mutableOutput = output as HTMLElement & { children?: unknown[]; replaceChildren?: () => void };
  if (typeof mutableOutput.replaceChildren === "function") {
    mutableOutput.replaceChildren();
  } else {
    output.innerHTML = searchableText;
    mutableOutput.children?.splice?.(0, mutableOutput.children.length);
  }

  const hero = document.createElement("div");
  hero.className = "help-hero";
  appendText(hero, "p", "help-kicker", "BIM Manager Workbench");
  appendText(hero, "h2", "help-title", "Справка по функциям roadmap");
  appendText(
    hero,
    "p",
    "help-lead",
    "Пошаговое руководство по разделам интерфейса: от загрузки модели и таблиц до чертежей, листов, связей model↔drawing и безопасного deploy.",
  );

  const nav = document.createElement("nav");
  nav.className = "help-nav help-nav-sidebar";
  nav.setAttribute?.("aria-label", "Навигация по справке");
  appendText(nav, "strong", "help-nav-title", "Разделы справки");
  HELP_SECTIONS.forEach((section) => {
    const anchor = document.createElement("a");
    anchor.href = `#help-${section.id}`;
    anchor.textContent = section.title;
    nav.appendChild(anchor);
  });

  const sections = document.createElement("div");
  sections.className = "help-sections";
  HELP_SECTIONS.forEach((section) => sections.appendChild(renderSection(section)));

  const layout = document.createElement("div");
  layout.className = "help-layout";
  layout.append(nav, sections);

  output.append(hero, layout);
}
