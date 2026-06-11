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

---

## 9. Refactor roadmap continuation

> This section extends the main plan with implementation-ready refactor phases. The goal is not to add new BIM features first, but to make the existing workbench maintainable, testable, and easier to extend.

### Phase 9 — App bootstrap and controller orchestration

**Цель:** убрать центральную точку сборки из `src/bim/app.ts` и сделать запуск приложения явным.

**Файлы:**

- Modify: `src/bim/app.ts`
- Create: `src/bim/app/bootstrap.ts`
- Create: `src/bim/app/controller-registry.ts`
- Create: `src/bim/app/event-bus.ts` *(если понадобится)*

**Task 9.1 — Bootstrap extraction**

- Вынести `createBimViewer`, DOM lookup, workspace/issue store и профильный роутинг в отдельный bootstrap-слой.
- Оставить `app.ts` только как точку входа.
- Проверить, что начальная инициализация не меняет поведение.

**Task 9.2 — Controller registry**

- Завести единый registry для `open/close/render/reset` API контроллеров.
- Убрать `let closeX = () => {}` и похожие «заглушки».
- Подключать новые панели через единый реестр, а не через каскад локальных переменных.

**Task 9.3 — Event wiring cleanup**

- Собрать все обработчики кнопок, hotkeys и panel actions в один слой.
- Выделить общие helper-ы для loading/busy/status/progress.
- Убедиться, что UX, routes и console behavior не изменились.

**Verification:**

```bash
npx tsc --noEmit
npm run build
git diff --check
```

**Acceptance:**

- `src/bim/app.ts` превращается в тонкий entrypoint.
- Все панели и кнопки продолжают работать.
- Новые контроллеры можно подключать без правок в десятке мест.

---

### Phase 10 — Workspace state decomposition

**Цель:** разнести `WorkspaceState` по доменным срезам и убрать общий мешок данных.

**Файлы:**

- Modify: `src/bim/state/workspace-state.ts`
- Create: `src/bim/state/viewer-state.ts`
- Create: `src/bim/state/data-state.ts`
- Create: `src/bim/state/checks-state.ts`
- Create: `src/bim/state/issues-state.ts`
- Create: `src/bim/state/clash-state.ts`
- Create: `src/bim/state/drawings-state.ts`

**Task 10.1 — Domain split**

- Разделить state-модели на viewer/data/checks/issues/clash/drawings.
- Перенести поля по доменам, не ломая текущие потребители.

**Task 10.2 — Derived selectors**

- Добавить selectors для derived state вместо прямого доступа к массивам.
- Упростить вычисление filtered/selected/active сущностей.

**Task 10.3 — Runtime vs domain data**

- Отделить UI/runtime flags от domain data.
- Свести к минимуму cross-domain mutation из одного объекта состояния.

**Verification:**

```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**

- Состояние читается и обновляется по доменам.
- Нет единого файла/типа, в который складывается всё подряд.

Статус: выполнено — `WorkspaceState` разнесён на `viewer/data/checks/issues/clash/drawings` с selector-слоем для derived state.

---

### Phase 11 — DOM segmentation and UI module split

**Цель:** сделать DOM-слой менее монолитным и проще для тестирования.

**Файлы:**

- Modify: `src/bim/dom.ts`
- Create: `src/bim/dom/viewer-dom.ts`
- Create: `src/bim/dom/data-dom.ts`
- Create: `src/bim/dom/checks-dom.ts`
- Create: `src/bim/dom/issues-dom.ts`
- Create: `src/bim/dom/clash-dom.ts`
- Create: `src/bim/dom/drawings-dom.ts`

**Task 11.1 — UI section grouping**

- Разбить `getDomElements()` по фичам или секциям UI.
- Вернуть сгруппированные объекты DOM вместо одного огромного списка.

**Task 11.2 — Validation helpers**

- Упростить проверку обязательных элементов через helper-ы.
- Сделать ошибки DOM более локальными и понятными.

**Task 11.3 — Markup/controller contract**

- Снизить связность между HTML и feature controllers.
- Сделать contract между разметкой и JS более явным.

**Verification:**

```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**

- DOM-слой отражает UI-модули, а не весь экран целиком.
- Добавление новой панели не требует расширять один мегасписок на сотни строк.

---

### Phase 12 — Element index extraction and data layer cleanup

**Цель:** сделать индекс элементов модели более чистым, переиспользуемым и тестируемым.

**Файлы:**

- Modify: `src/bim/data/element-index.ts`
- Create: `src/bim/data/extractors.ts`
- Create: `src/bim/data/search-index.ts`
- Create: `src/bim/data/property-sets.ts`
- Create: `src/bim/data/model-reader.ts`

**Task 12.1 — Pure extractors**

- Вынести извлечение `storey`, `material`, `psets`, searchable string в отдельные pure helpers.
- Сделать helper-ы независимыми от UI и controller-слоя.

**Task 12.2 — Reader vs index builder**

- Разделить чтение модели и построение индекса.
- Разнести I/O, нормализацию и search indexing.

**Task 12.3 — Performance and testability**

- Сократить цену рекурсивного обхода атрибутов.
- Добавить unit-тесты на edge cases extraction.

**Verification:**

```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**

- Извлечение данных можно тестировать отдельно от UI.
- Индекс остаётся функционально тем же, но код проще расширять.

---

### Phase 13 — Model health rules modularization

**Цель:** превратить набор проверок качества модели в набор отдельных правил и модулей.

**Файлы:**

- Modify: `src/bim/checks/rules.ts`
- Create: `src/bim/checks/rules/name-rules.ts`
- Create: `src/bim/checks/rules/identity-rules.ts`
- Create: `src/bim/checks/rules/structure-rules.ts`
- Create: `src/bim/checks/rules/material-rules.ts`

**Task 13.1 — Rule grouping**

- Разделить правила по смысловым группам.
- Отделить predicate-логику от текстов описания.

**Task 13.2 — Context and localization readiness**

- Подготовить правила к возможному i18n/локализации.
- Упростить добавление новых текстов без правки центрального списка.

**Task 13.3 — Rule tests**

- Добавить тесты на критичные правила и контекстные вычисления.
- Проверить duplicate IDs, proxy share, missing material/name and similar edge cases.

**Verification:**

```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**

- Каждое правило легко найти и изменить.
- Новые проверки добавляются без роста одного огромного файла.

---

### Phase 14 — Clash detection pipeline split

**Цель:** разделить broad phase, exact overlap, scoring и отчётность по коллизиям.

**Файлы:**

- Modify: `src/bim/clash/clash-detector.ts`
- Create: `src/bim/clash/broad-phase.ts`
- Create: `src/bim/clash/overlap.ts`
- Create: `src/bim/clash/clash-report.ts`
- Create: `src/bim/clash/clash-candidates.ts`

**Task 14.1 — Candidate generation**

- Вынести генерацию candidate pairs в отдельный модуль.
- Сделать фильтрацию прозрачной и тестируемой.

**Task 14.2 — Exact overlap engine**

- Вынести exact overlap/volume computation.
- Оставить detection logic без форматирования UI-текста.

**Task 14.3 — Reporting and tests**

- Отделить форматирование clash record от геометрии.
- Подготовить unit-тесты на 2D/3D edge cases и tolerance logic.

**Verification:**

```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**

- Геометрия и бизнес-логика не смешаны.
- Candidate filtering можно улучшать независимо от отчёта.

---

### Phase 15 — Drawings and annotations architecture cleanup

**Цель:** сделать drawings-подсистему документной моделью, а не набором разрозненных helper-ов.

**Файлы:**

- Modify: `src/bim/drawings/drawing-annotations.ts`
- Modify: `src/bim/drawings/drawing-persistence.ts`
- Modify: `src/bim/drawings/drawings-panel.ts`
- Create: `src/bim/drawings/drawing-document.ts`
- Create: `src/bim/drawings/annotation-factory.ts`
- Create: `src/bim/drawings/annotation-geometry.ts`

**Task 15.1 — Document model**

- Ввести общую модель `DrawingDocument` / `SheetDocument`.
- Привязать к ней annotations, viewport и export state.

**Task 15.2 — Annotation lifecycle**

- Разделить создание, синхронизацию и удаление аннотаций.
- Убрать эвристики из UI-текста в пользу явных типов.

**Task 15.3 — Export pipeline**

- Подготовить единый путь для SVG/PDF/DXF export.
- Свести экспорт к адаптерам от одной сущности.

**Verification:**

```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**

- Аннотации и листы работают через единый data model.
- Экспорт больше не зависит от случайных helper-цепочек.

---

### Phase 16 — Issue store and backend layering

**Цель:** разделить storage, business rules и API surfaces для issues/fragments/backend.

**Файлы:**

- Modify: `src/bim/issues/issues-store.ts`
- Modify: `server/app/main.py`
- Create: `server/app/settings.py`
- Create: `server/app/repository.py`
- Create: `server/app/schemas.py`
- Create: `server/app/auth.py`

**Task 16.1 — Backend layering**

- Разнести backend на factory/settings/repository/routes.
- Вынести auth dependency и parsing env vars из роутов.

**Task 16.2 — Schemas and validation**

- Сделать schema validation для ответов и импортов.
- Отделить API-формат от внутреннего хранения.

**Task 16.3 — Issue storage separation**

- Отделить issue storage API от UI-состояния.
- Подготовить store к будущей persistence/BCF интеграции.

**Verification:**

```bash
PYTHONPATH=server pytest -q server/tests
```

**Acceptance:**

- Backend читабелен по слоям.
- Импорт/экспорт issues и fragments проще тестировать и расширять.

---

### Phase 17 — Profile registry, selection, and property pure logic

**Цель:** убрать лишние side effects из viewer/profile/selection/property logic.

**Файлы:**

- Modify: `src/bim/profiles/index.ts`
- Create: `src/bim/profiles/registry.ts`
- Modify: `src/bim/selection/selection.ts`
- Modify: `src/bim/properties/properties-panel.ts`
- Modify: `src/bim/viewer/viewer.ts`

**Task 17.1 — Profile registry**

- Сделать декларативный реестр профилей и capabilities.
- Свести маршруты и флаги возможностей в одно место.

**Task 17.2 — Pure selection helpers**

- Вынести чистые функции подсчёта/форматирования selection.
- Упростить повторное использование и тестирование.

**Task 17.3 — Property rendering split**

- Отделить render-логику от вычислений свойств.
- Снизить количество сайд-эффектов в viewer/property path.

**Verification:**

```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**

- Профили и их возможности описаны в одном месте.
- Pure helpers можно тестировать отдельно от DOM/Three.js.

---

### Phase 18 — Build, tests, docs, and config hardening

**Цель:** закрепить рефакторинг тестами, документацией и конфигурацией сборки.

**Файлы:**

- Modify: `vite.config.ts`
- Modify: `README.md`
- Create: `src/**/*.test.ts`
- Create: `tests/e2e/*.spec.ts`
- Modify: `package.json`

**Task 18.1 — Unit coverage**

- Добавить unit-тесты для data/clash/rules/drawings helpers.
- Приоритизировать pure modules и edge cases.

**Task 18.2 — E2E smoke**

- Добавить smoke e2e для загрузки BIM-профиля и одной модели.
- Проверить старт приложения и отсутствие критических ошибок.

**Task 18.3 — Docs and config**

- Проверить разумный chunking для тяжёлых vendor-частей.
- Обновить README под реальную архитектуру после рефакторинга.
- Свести все проверки в единый repeatable runbook.

**Verification:**

```bash
npx tsc --noEmit
npm run build
PYTHONPATH=server pytest -q server/tests
```

**Acceptance:**

- Есть повторяемые проверки для критичных модулей.
- README соответствует коду.
- Конфиг сборки и тестов не расходится с реальной архитектурой.

---

### Suggested refactor order

1. Phase 9 — bootstrap/orchestration
2. Phase 10 — workspace state
3. Phase 11 — DOM split
4. Phase 12 — data extraction
5. Phase 13 — health rules
6. Phase 14 — clash pipeline
7. Phase 15 — drawings/annotations
8. Phase 16 — issue/backend layering
9. Phase 17 — profiles/selection/properties
10. Phase 18 — tests/docs/config
