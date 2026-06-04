# BIM Manager Workbench — ThatOpen Technical Base and Implementation Plan

> **For Hermes:** Use `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** развить `/ifc-engine-wasm/bim/` в единый BIM-профиль для BIM manager: viewer, свойства, проверки качества, issues, federation/clash и формирование чертежей/DXF из IFC-модели.

**Architecture:** ThatOpen Engine является технической базой проекта. IFC загружается через текущий `IfcLoader`/Fragments pipeline, BIM-данные индексируются в приложении, а чертежи строятся через `TechnicalDrawings` + `DxfManager` без самописного DXF-движка.

**Tech Stack:** TypeScript, Vite, Three.js, `@thatopen/components`, `@thatopen/components-front`, `@thatopen/fragments`, `@thatopen/ui`, `@thatopen/ui-obc`, `web-ifc`.

---

## 1. Техническая база

Основной GitHub/документация:

- ThatOpen org: https://github.com/ThatOpen
- `engine_components`: https://github.com/ThatOpen/engine_components
- `engine_docs`: https://github.com/ThatOpen/engine_docs
- Старый reference `web-ifc-viewer`: https://github.com/ThatOpen/web-ifc-viewer

Ключевые ThatOpen компоненты для BIM-профиля:

- `OBC.FragmentsManager` — работа с Fragment-моделями.
- `OBC.IfcLoader` — загрузка IFC в fragments.
- `CUI.tables.spatialTree` — spatial tree модели.
- `OBF.Highlighter` — выбор/подсветка элементов.
- `OBC.Hider` — hide/isolate/show.
- `OBC.TechnicalDrawings` — технические 2D-чертежи в 3D-сцене.
- `OBC.TechnicalDrawing.addProjectionFromItems()` — проекция BIM-элементов в линии чертежа.
- `OBC.DxfManager` / `OBC.DxfExporter` — экспорт технических чертежей в DXF.
- `OBC.DrawingViewport` — viewport/область чертежа/лист.
- `OBF.DrawingEditor` — интерактивное редактирование размеров и аннотаций.
- `OBC.LinearAnnotations`, `AngleAnnotations`, `LeaderAnnotations`, `CalloutAnnotations`, `BlockAnnotations` — аннотационные системы.

Ключевые исходники ThatOpen:

- `packages/core/src/drawings/DxfManager/index.ts`
- `packages/core/src/drawings/DxfManager/src/DxfExporter.ts`
- `packages/core/src/drawings/TechnicalDrawings/example.ts`
- `packages/core/src/drawings/TechnicalDrawings/src/DrawingViewport.ts`
- `packages/front/src/drawings/DrawingEditor/example.ts`

Ключевая идея:

```text
IFC / Fragments
→ ModelIdMap выбранных элементов
→ TechnicalDrawing
→ drawing.addProjectionFromItems(...)
→ DrawingEditor / annotations
→ DxfManager.exporter.export(...)
→ DXF download
```

Старый `web-ifc-viewer` floorplan DXF использовать только как reference по логике этажей: `computeAllPlanViews`, `IfcBuildingStorey`, projected/sectioned categories. Основная реализация должна идти через новый `engine_components`.

---

## 2. Целевой продукт

Один профиль: **BIM Manager Workbench**.

Внутри одного BIM-профиля:

- 3D viewer;
- дерево модели;
- свойства элемента;
- таблица элементов;
- фильтры;
- проверки качества модели;
- чертежи из модели;
- DXF/PDF/PNG export;
- issues/BCF;
- federation;
- clash detection;
- спецификации;
- AI-аудит.

Профиль не должен быть набором отдельных режимов-страниц. Это единый рабочий стол с вкладками/панелями.

---

## 3. Целевой UI layout

- Top toolbar: загрузка, сохранить fragments, открыть библиотеку, fit, home, экспорт, режимы.
- Left sidebar: модели, spatial tree, этажи, фильтры.
- Center: 3D viewer / drawing workspace.
- Right sidebar: свойства, проверки, issues, параметры чертежа.
- Bottom panel: таблица элементов, результаты проверок, clash/issues list.
- Drawings tab: список видов, список листов, генерация плана/разреза, экспорт DXF.

---

## 4. Итоговая дорожная карта

### Sprint 1 — Архитектура единого BIM-профиля

**Цель:** подготовить код к росту и убрать монолитность `src/main.ts`.

**Файлы:**

- Modify: `src/main.ts`
- Create: `src/bim/app.ts`
- Create: `src/bim/viewer/viewer.ts`
- Create: `src/bim/models/model-loader.ts`
- Create: `src/bim/selection/selection.ts`
- Create: `src/bim/properties/properties-panel.ts`
- Create: `src/bim/tree/spatial-tree.ts`
- Create: `src/bim/state/workspace-state.ts`
- Modify: `src/styles.css`

**Задачи:**

1. Вынести инициализацию ThatOpen components/world/camera/renderer из `main.ts`.
2. Вынести загрузку IFC/fragments в `model-loader.ts`.
3. Вынести selection/highlighter/hider в `selection.ts`.
4. Вынести spatial tree и properties panel.
5. Оставить `/ifc-engine-wasm/bim/` как основной BIM route.
6. Сохранить существующий viewer-функционал без регресса.

**Проверка:**

```bash
npm run build
git diff --check
```

Acceptance:

- `/ifc-engine-wasm/bim/` открывает viewer;
- IFC загружается;
- выбор элемента работает;
- свойства отображаются;
- hide/isolate/show all работают.

---

### Sprint 2 — BIM Data Layer

**Цель:** создать индекс элементов модели для таблиц, фильтров, проверок и AI.

**Файлы:**

- Create: `src/bim/data/model-index.ts`
- Create: `src/bim/data/element-record.ts`
- Create: `src/bim/data/property-extractor.ts`
- Create: `src/bim/data/exporters.ts`
- Create: `src/bim/ui/elements-table.ts`
- Modify: `src/bim/app.ts`

**ElementRecord:**

```ts
export type ElementRecord = {
  modelId: string;
  expressId: number;
  globalId?: string;
  ifcClass?: string;
  name?: string;
  typeName?: string;
  predefinedType?: string;
  storeyName?: string;
  psets: Record<string, Record<string, unknown>>;
  qsets: Record<string, Record<string, unknown>>;
};
```

**Задачи:**

1. После загрузки модели построить список элементов.
2. Извлечь базовые свойства и psets/qsets.
3. Добавить таблицу элементов.
4. Добавить фильтры: модель, IFC class, этаж, поиск.
5. Добавить экспорт CSV/JSON.

**Проверка:**

```bash
npm run build
git diff --check
```

Acceptance:

- таблица показывает элементы модели;
- выбор строки подсвечивает элемент в 3D;
- фильтры работают;
- CSV/JSON скачивается.

---

### Sprint 3 — Drawings/DXF MVP на ThatOpen

**Цель:** добавить формирование плана этажа и экспорт DXF из модели.

**Файлы:**

- Create: `src/bim/drawings/drawing-manager.ts`
- Create: `src/bim/drawings/dxf-export.ts`
- Create: `src/bim/drawings/floor-plan.ts`
- Create: `src/bim/drawings/drawing-types.ts`
- Create: `src/bim/ui/drawings-panel.ts`
- Modify: `src/bim/app.ts`
- Modify: `src/styles.css`

**Основной алгоритм плана этажа:**

```ts
const techDrawings = components.get(OBC.TechnicalDrawings);
const drawing = techDrawings.create(world);

drawing.orientTo(new THREE.Vector3(0, -1, 0));

drawing.layers.create("visible", {
  material: new THREE.LineBasicMaterial({ color: 0x000000 }),
});

drawing.layers.create("hidden", {
  material: new THREE.LineDashedMaterial({
    color: 0x888888,
    dashSize: 0.2,
    gapSize: 0.1,
  }),
});

await drawing.addProjectionFromItems(modelIdMap, {
  layers: {
    visible: "visible",
    hidden: "hidden",
  },
});
```

**DXF export:**

```ts
const dxf = components.get(OBC.DxfManager).exporter.export([
  { drawing, viewports: [{}] },
]);

const blob = new Blob([dxf], { type: "application/dxf" });
```

**Задачи:**

1. Добавить панель “Чертежи”.
2. Получить список этажей из spatial/model index.
3. Сформировать `ModelIdMap` элементов выбранного этажа.
4. Создать `TechnicalDrawing`.
5. Сгенерировать projection lines через `addProjectionFromItems()`.
6. Добавить кнопку “Export DXF”.
7. Скачать DXF client-side.
8. Добавить fallback “создать чертёж из всех видимых элементов”, если этажи не извлечены.

**Проверка:**

```bash
npm run build
git diff --check
```

Manual/browser acceptance:

- открыть BIM route;
- загрузить IFC;
- открыть “Чертежи”;
- выбрать этаж или all visible;
- нажать “Создать план”; 
- увидеть линии чертежа/проекции;
- нажать “Export DXF”;
- получить `.dxf` файл;
- DXF содержит LINE/entities, а не пустой файл.

---

### Sprint 4 — Drawing annotations

**Цель:** добавить размеры, выноски, подписи и редактирование чертежа.

**Файлы:**

- Create: `src/bim/drawings/drawing-editor.ts`
- Create: `src/bim/drawings/annotations.ts`
- Modify: `src/bim/ui/drawings-panel.ts`
- Modify: `src/styles.css`

**Техническая база:**

- `OBF.DrawingEditor`
- `OBC.LinearAnnotations`
- `OBC.AngleAnnotations`
- `OBC.LeaderAnnotations`
- `OBC.CalloutAnnotations`

**Задачи:**

1. Подключить `DrawingEditor`.
   - Статус: план.
2. Загрузить шрифт для текстовых подписей.
   - Статус: план.
3. Добавить инструмент “Линейный размер”.
   - Статус: план.
4. Добавить инструмент “Выноска/текст”.
   - Статус: план.
5. Добавить удаление/очистку аннотаций.
   - Статус: план.
6. Проверить, что размеры экспортируются в DXF.
   - Статус: план.

**Развитие Sprint 4 / backlog:**

1. Интерактивное размещение аннотаций: клик по чертежу → поставить размер/выноску/подпись.
   - Статус: план.
2. Редактирование аннотаций: выбрать, изменить текст, удалить конкретную, переместить.
   - Статус: план.
3. Размеры по двум точкам: пользователь выбирает 2 точки, система строит размерную линию и считает длину.
   - Статус: план.
4. Привязки: концы линий, углы проекции, центр элемента, простые snap-points.
   - Статус: план.
5. DXF-слои и стили: `A-DIMS`, `A-LEADERS`, `A-TEXT`, `A-CALLOUTS`, настройки размеров текста/линий.
   - Статус: план.
6. Сохранение аннотаций: export/import JSON вместе с drawing record.
   - Статус: план.
7. UI списка аннотаций: показать / редактировать / удалить для каждой аннотации.
   - Статус: план.
8. Переход на native ThatOpen `DrawingEditor`, `LinearAnnotations`, `LeaderAnnotations`, `CalloutAnnotations`, если API доступен в текущих пакетах.
   - Статус: план.

Acceptance:

- можно поставить размер по projection line;
- размер виден в viewer;
- размер попадает в DXF;
- развитие Sprint 4 зафиксировано в общем плане со статусом `план`.

---

### Sprint 5 — Model Health Checks

**Цель:** дать BIM manager инструмент проверки качества модели.

**Файлы:**

- Create: `src/bim/checks/check-types.ts`
- Create: `src/bim/checks/model-health.ts`
- Create: `src/bim/checks/rules.ts`
- Create: `src/bim/ui/checks-panel.ts`
- Modify: `src/bim/app.ts`

**Проверки v1:**

- пустой `Name`;
- отсутствует `GlobalId`;
- дубли `GlobalId`;
- нет этажа;
- нет типа;
- много `IfcBuildingElementProxy`;
- пустые psets;
- двери без `FireRating`;
- помещения без имени/номера;
- элементы без материала.

Acceptance:

- кнопка “Проверить модель”;
- список проблем;
- severity;
- переход к элементу;
- экспорт отчёта CSV/JSON.

---

### Sprint 6 — Issues / BCF foundation

**Цель:** замечания BIM manager внутри viewer.

**Файлы:**

- Create: `src/bim/issues/issue-types.ts`
- Create: `src/bim/issues/issues-store.ts`
- Create: `src/bim/issues/bcf-export.ts`
- Create: `src/bim/ui/issues-panel.ts`

**Задачи:**

1. Создать issue из выбранного элемента.
2. Создать issue из ошибки проверки.
3. Сохранить linked `modelId`, `expressId`, `GlobalId`.
4. Сохранить camera/viewpoint.
5. Список issues со статусами.
6. Экспорт JSON, затем BCF.

Acceptance:

- issue связан с элементом;
- клик по issue ведёт к элементу/виду;
- issue можно выгрузить.

---

### Sprint 7 — Federation + Clash MVP

**Цель:** BIM coordination workflow.

**Файлы:**

- Create: `src/bim/federation/federation.ts`
- Create: `src/bim/clash/clash-types.ts`
- Create: `src/bim/clash/clash-detector.ts`
- Create: `src/bim/ui/clash-panel.ts`

**Задачи:**

1. Поддержать несколько моделей.
2. Назначить дисциплину/цвет модели.
3. Выбрать две группы элементов.
4. Найти hard clashes.
5. Показать список clash.
6. Создать issue из clash.

Acceptance:

- несколько IFC/fragments в сцене;
- можно выбрать группы;
- найденные clash подсвечиваются;
- есть отчёт.

---

### Sprint 8 — Sheets, PDF/PNG, specifications

**Цель:** перейти от отдельного DXF-вида к выпуску листов.

**Файлы:**

- Create: `src/bim/sheets/sheet-types.ts`
- Create: `src/bim/sheets/sheet-board.ts`
- Create: `src/bim/sheets/pdf-export.ts`
- Create: `src/bim/specs/spec-generator.ts`

**Задачи:**

1. Форматы A4/A3/A2/A1/A0.
2. Title block.
3. Размещение drawing viewport на листе.
4. Ведомость помещений/дверей/окон.
5. Экспорт PNG/PDF.
6. Позже — DXF paper-space export через `DxfPaperOptions`.

Acceptance:

- можно создать лист A3/A1;
- добавить план;
- добавить подпись/title block;
- экспортировать.

---

## 5. Первый релиз, который имеет смысл выкатывать на dev

**Release v1 scope:**

1. Архитектура BIM-профиля разнесена по модулям.
2. Viewer не сломан.
3. Есть BIM Data Layer.
4. Есть таблица элементов.
5. Есть проверки качества v1.
6. Есть вкладка “Чертежи”.
7. Есть “Создать план этажа / всех видимых элементов”.
8. Есть `Export DXF` через ThatOpen `DxfManager`.

**Dev URL после реализации:**

```text
https://dev.lab-tim.ru/ifc-engine-wasm/bim/
```

---

## 6. Рабочий процесс реализации

Для каждого sprint:

1. Создать отдельную ветку от актуального dev/main.
2. Реализовать только scope sprint.
3. Запустить:

```bash
npm run build
git diff --check
```

4. Commit + push.
5. Deploy на dev.
6. Проверить URL и browser console.
7. Дать короткий отчёт и ждать approval.

Production не трогать без явного подтверждения.

---

## 7. Главные риски

- Не все IFC имеют корректные этажи/пространственную структуру; нужен fallback “all visible / selected items”.
- `addProjectionFromItems()` требует корректный `ModelIdMap`; потребуется аккуратная сборка expressId по модели.
- DXF export может быть пустым, если projection lines не созданы или drawing не имеет viewport/линий.
- Аннотации требуют шрифтов и настройки `DrawingEditor`.
- Большие IFC могут долго проецироваться; нужен progress и cancel/timeout.
- PDF/PNG — отдельный слой, не подменять им DXF MVP.

---

## 8. Definition of Done для DXF MVP

Готово, если:

- BIM route открывается;
- IFC загружается;
- можно выбрать этаж или all visible;
- создаётся `TechnicalDrawing`;
- projection lines появляются;
- DXF скачивается;
- DXF не пустой;
- `npm run build` проходит;
- `git diff --check` проходит;
- dev URL отдаёт новую сборку;
- browser console без критических ошибок.
