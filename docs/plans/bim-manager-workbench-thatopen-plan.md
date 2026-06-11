# BIM Manager Workbench — ThatOpen Technical Base and Implementation Plan

> **For Hermes:** Use `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** развить `/ifc-engine-wasm/bim/` в единый BIM-профиль для BIM manager: viewer, свойства, проверки качества, issues, federation/clash и формирование чертежей/DXF из IFC-модели.

**Architecture:** ThatOpen Engine является технической базой проекта. IFC загружается через текущий `IfcLoader`/Fragments pipeline, BIM-данные индексируются в приложении, а чертежи строятся через `TechnicalDrawings` + `DxfManager` без самописного DXF-движка.

**Tech Stack:** TypeScript, Vite, Three.js, `@thatopen/components`, `@thatopen/components-front`, `@thatopen/fragments`, `@thatopen/ui`, `@thatopen/ui-obc`, `web-ifc`.

**Статус реализации:** обновлено 2026-06-11 по ветке `ux/phase-3-product-polish`. Проверка: `npm run build` проходит.

**Сводка:**

- ✅ Sprint 1 — архитектура BIM-профиля: выполнено.
- ✅ Sprint 2 — BIM Data Layer: выполнено.
- ✅ Sprint 3 — Drawings/DXF MVP: выполнено.
- ✅ Sprint 4 — Drawing annotations: MVP выполнен; backlog частично выполнен, native ThatOpen API остаётся ограничением текущих пакетов.
- ✅ Sprint 5 — Model Health Checks: выполнено.
- ✅ Sprint 6 — Issues / BCF foundation: выполнено.
- ✅ Sprint 7 — Federation + Clash MVP: выполнено.
- ✅ Sprint 8 — Sheets, PDF/PNG, specifications: MVP выполнен; развитие листов остаётся следующим улучшением.

**UX/Product Phase 3:**

- ✅ Task 3.1 — empty-state onboarding card: выполнено, commit `32a79c0`.
- ✅ Task 3.2 — русская терминология: выполнено, commit `735ad21`.
- ✅ Task 3.3 — status/error toast: выполнено; добавлен `src/bim/ui/toast.ts`, визуальные toast-уведомления для ошибок, успешной загрузки/сохранения/удаления, проверок, коллизий, issues и экспорта чертежей/DXF.
- ✅ Phase 3 — завершена.

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
6. DXF paper-space export через `DxfPaperOptions`.
   - Статус: MVP реализован в `src/bim/sheets/dxf-paper-export.ts`.

Acceptance:

- можно создать лист A3/A1;
- добавить план;
- добавить подпись/title block;
- экспортировать.

---

### Sprint 9 — Bundle splitting без изменения поведения BIM/КМ профиля

**Цель:** уменьшить warning о больших чанках и улучшить кэширование, не меняя UX/маршруты/функциональность текущего профиля КМ и BIM.

**Файлы:**

- Modify: `vite.config.ts`
- Review: `src/bim/app.ts`
- Review: `src/bim/app/profile-router.ts`
- Review: `src/bim/drawings/*`
- Review: `src/bim/sheets/*`

## Task 9.1 — Baseline и карта тяжёлых чанков

**Цель:** понять, что именно даёт warning, до любых правок логики.

**Шаги:**
1. Зафиксировать текущий размер build-артефактов и список самых крупных чанков.
2. Отметить, какие из них относятся к vendor/bibliotecaм, а какие — к собственному коду.
3. Проверить, что baseline не меняет поведение `/bim/` и текущего профиля КМ.
4. Сохранить только наблюдение, без функциональных правок.

**Тестирование:**
- `npm run build`
- `git diff --check`
- browser smoke `/ifc-engine-wasm/bim/` и текущего профиля КМ

**План отката:**
- если baseline выявил неожиданный регресс, ничего не коммитить и вернуть рабочее дерево к чистому состоянию;
- если сделаны только наблюдения, откат не требуется.

## Task 9.2 — Разделение vendor-чанков

**Цель:** сократить крупные чанки только за счёт сборки, без изменения роутинга и UX.

**Шаги:**
1. Добавить `manualChunks` в `vite.config.ts` для тяжёлых библиотек: `three`, `@thatopen/*`, `web-ifc` и других крупных vendor-зависимостей.
2. Не трогать маршруты профилей и не менять поведение текущего профиля КМ.
3. Если потребуется, вынести только второстепенные модули на lazy import, но не стартовые части UI.
4. Проверить, что BIM-профиль и КМ-профиль продолжают открываться как раньше.

**Тестирование:**
- `npm run build`
- `git diff --check`
- browser smoke на `/ifc-engine-wasm/bim/` и текущем профиле КМ

**План отката:**
- убрать `manualChunks`/lazy import изменения и вернуть исходную схему сборки;
- если проблема в конкретном чанке, откатывать только этот кусок, не трогая роутинг и UX.

## Task 9.3 — Финальная валидация и решение по warning

**Цель:** убедиться, что оптимизация безопасна и warning либо уменьшен, либо осознанно оставлен.

**Шаги:**
1. Повторно сравнить размеры чанков до/после.
2. Зафиксировать итог по warning: уменьшен, локализован или оставлен как non-blocking.
3. Проверить `/ifc-engine-wasm/bim/` и текущий профиль КМ в браузере.
4. Если warning остаётся, не ослаблять функциональность ради косметики.

**Тестирование:**
- `npm run build`
- `git diff --check`
- browser smoke на обоих профилях

**План отката:**
- если после изменений поведение профиля КМ/BIM отличается, откатить последний коммит или `git restore` соответствующих файлов;
- если всё стабильно, откат не нужен и задача закрывается.

**Acceptance:**

- warning по size либо уменьшается, либо становится понятным и локализованным;
- поведение BIM-профиля не меняется;
- текущий профиль КМ работает как раньше;
- build успешен;
- browser smoke на обоих профилях проходит.

**Статус выполнения:**
- Task 9.1: baseline снят, найден крупный монолитный `index` chunk и `worker`/`web-ifc` wasm assets.
- Task 9.2: `manualChunks` добавлен для `three`, `@thatopen/*`, `web-ifc`, `camera-controls`.
- Task 9.3: build и browser smoke пройдены; warning локализован в vendor-чанках, функциональность профиля КМ сохранена.

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
