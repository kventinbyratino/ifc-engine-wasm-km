# IFC Engine WASM — Unified Plan

> **For Hermes:** This is the single canonical plan file for the project. Keep product roadmap and refactor phases in one place.

**Project:** `IFC_engine_wasm`

**Goal:** развить `ifc-engine-wasm` в единый BIM-профиль для BIM manager: viewer, свойства, проверки качества, issues, federation/clash, drawings, sheets и экспорт из IFC-модели.

**Architecture:** ThatOpen Engine является технической базой проекта. IFC загружается через текущий `IfcLoader`/Fragments pipeline, BIM-данные индексируются в приложении, а чертежи строятся через `TechnicalDrawings` + `DxfManager` без самописного DXF-движка.

**Tech stack:** TypeScript, Vite, Three.js, `@thatopen/components`, `@thatopen/components-front`, `@thatopen/fragments`, `@thatopen/ui`, `@thatopen/ui-obc`, `web-ifc`.

**Current status:**
- BIM profile and base viewer are in place.
- Sprint 1 is complete and verified.
- Sprint 2 is complete and verified.
- Sprint 3 is complete and verified.
- Sprint 4 is complete and verified.
- Sprint 5 is complete and verified.
- Sprint 6 is complete and verified.
- Sprint 7 is complete and verified.
- Detailed phase statuses are tracked in the phase sections below.
- Phase 9 is complete and verified.
- Phase 10 is complete and verified.
- Phase 11 is complete and verified.
- Next refactor phase: Phase 12.

## 0. Priorities / working mode

**Now:** Sprint 7–8 — federation/clash and sheets.

**Next:** Phase 12 refactor backlog.

**Later:** TBD.

**Done:** Sprint 1; Sprint 2; Sprint 3; Sprint 4; Sprint 5; Sprint 6; Sprint 7; Phase 9; Phase 10; Phase 11; Phase 12–16.

**Definition of done for any item:** scoped files are listed, acceptance is clear, verification commands pass, and `git diff --check` is clean.

---

## 1. Product roadmap

### Sprint 1 — Архитектура единого BIM-профиля (P0 / next)

**Цель:** подготовить код к росту и убрать монолитность `src/main.ts`.

**Files:**
- Modify: `src/main.ts`
- Create: `src/bim/app.ts`
- Create: `src/bim/viewer/viewer.ts`
- Create: `src/bim/models/model-loader.ts`
- Create: `src/bim/selection/selection.ts`
- Create: `src/bim/properties/properties-panel.ts`
- Create: `src/bim/tree/spatial-tree.ts`
- Create: `src/bim/state/workspace-state.ts`
- Modify: `src/styles.css`

### Task 1: Bootstrap app

**Objective:** вынести сборку приложения из `src/main.ts` в `src/bim/app.ts`.

**Files:**
- Modify: `src/main.ts`
- Create: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- `src/main.ts` содержит только точку входа.
- Создание app-контекста живёт в отдельном модуле.

### Task 2: Split viewer setup

**Objective:** вынести конфигурацию сцены, камеры и рендера в `src/bim/viewer/viewer.ts`.

**Files:**
- Create: `src/bim/viewer/viewer.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Viewer-конфигурация отделена от bootstrap.
- `main.ts` не зависит от деталей сцены напрямую.

### Task 3: Move model loading

**Objective:** вынести загрузку IFC / fragments в `src/bim/models/model-loader.ts`.

**Files:**
- Create: `src/bim/models/model-loader.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Логика загрузки модели отделена от orchestration.
- Загрузка IFC/fragments продолжает работать на BIM route.

### Task 4: Split selection helpers

**Objective:** вынести selection / highlighter / hider в `src/bim/selection/selection.ts`.

**Files:**
- Create: `src/bim/selection/selection.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Выбор элемента работает.
- hide / isolate / show all работают.

### Task 5: Extract UI panels

**Objective:** вынести spatial tree и properties panel в отдельные модули.

**Files:**
- Create: `src/bim/properties/properties-panel.ts`
- Create: `src/bim/tree/spatial-tree.ts`
- Modify: `src/bim/app.ts`
- Modify: `src/styles.css`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Свойства отображаются.
- Spatial tree строится и подключается через app layer.

### Task 6: Stabilize the route

**Objective:** сохранить `/ifc-engine-wasm/bim/` основным BIM route без регрессии.

**Files:**
- Modify: `src/main.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- `/ifc-engine-wasm/bim/` открывает viewer.
- IFC загружается.
- Существующий viewer-функционал не сломан.

**Status:** ✅ выполнено

---

### Sprint 2 — BIM Data Layer (P1)

**Цель:** создать индекс элементов модели для таблиц, фильтров, проверок и AI.

**Files:**
- Create: `src/bim/data/model-index.ts`
- Create: `src/bim/data/element-record.ts`
- Create: `src/bim/data/property-extractor.ts`
- Create: `src/bim/data/exporters.ts`
- Create: `src/bim/ui/elements-table.ts`
- Modify: `src/bim/app.ts`

**Status:** ✅ completed

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

### Task 1: Build element index

**Objective:** после загрузки модели построить `ModelIndex` с перечнем элементов.

**Files:**
- Create: `src/bim/data/model-index.ts`
- Create: `src/bim/data/element-record.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Индекс элементов строится автоматически после загрузки модели.
- Данные доступны без прямого обхода сцены в UI.

### Task 2: Extract properties and sets

**Objective:** извлечь базовые свойства, `psets` и `qsets` в единый record слой.

**Files:**
- Create: `src/bim/data/property-extractor.ts`
- Modify: `src/bim/data/model-index.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- `ElementRecord` содержит основные свойства элемента.
- `psets` и `qsets` собираются стабильно для разных IFC классов.

### Task 3: Add elements table and filters

**Objective:** добавить таблицу элементов и базовые фильтры по модели, классу, этажу и поиску.

**Files:**
- Create: `src/bim/ui/elements-table.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Таблица показывает элементы модели.
- Фильтры обновляют список без поломки viewer.

### Task 4: Add export formats

**Objective:** добавить экспорт таблицы элементов в CSV и JSON.

**Files:**
- Create: `src/bim/data/exporters.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- CSV/JSON скачивается.
- Экспорт использует данные из `ModelIndex`, а не отдельный ручной обход.


---

### Sprint 2.5 — Element Relationship Graph (P1)

**Цель:** связать элементы модели в семантический граф отношений, чтобы планировщик и UI понимали связи вида `стена → окно → помещение`.

**Files:**
- Create: `src/bim/data/element-relations.ts`
- Create: `src/bim/data/relation-types.ts`
- Modify: `src/bim/data/model-index.ts`
- Modify: `src/bim/data/element-record.ts`
- Modify: `src/bim/app.ts`

**Status:** planned

### Task 1: Define relation model

**Objective:** добавить типы и хранение связей между элементами модели.

**Files:**
- Create: `src/bim/data/relation-types.ts`
- Create: `src/bim/data/element-relations.ts`
- Modify: `src/bim/data/element-record.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- В модели можно хранить связи `hosted_by`, `fills_opening`, `bounded_by`, `contains`, `adjacent_to`.
- `ElementRecord` может ссылаться на связанные элементы без дублирования геометрии.

### Task 2: Index wall/window/room relations

**Objective:** извлекать базовые связи между стеной, окном и помещением из IFC-данных.

**Files:**
- Modify: `src/bim/data/model-index.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Стена связывается с окнами/дверями, которые она содержит.
- Помещение получает границы по ограждающим элементам.
- Пример `стена → окно → помещение` представлен в индексе модели.

### Sprint 3 — Drawings/DXF MVP на ThatOpen (P2)

**Цель:** добавить формирование плана этажа и экспорт DXF из модели.

**Files:**
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
```

### Task 1: Build floor-plan generator

**Objective:** создать генератор плана этажа из IFC элементов.

**Files:**
- Create: `src/bim/drawings/floor-plan.ts`
- Create: `src/bim/drawings/drawing-types.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- План этажа вычисляется из модели.
- Типы drawings отделены от UI.

### Task 2: Wire TechnicalDrawings

**Objective:** сформировать 2D проекцию через `TechnicalDrawings`.

**Files:**
- Create: `src/bim/drawings/drawing-manager.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Drawing создаётся и ориентируется корректно.
- Рендер не ломает основной viewer.

### Task 3: Add DXF export

**Objective:** подключить экспорт DXF через `DxfManager`.

**Files:**
- Create: `src/bim/drawings/dxf-export.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- DXF файл экспортируется из drawing layer.

### Task 4: Add drawings panel and styling

**Objective:** добавить панель drawings и базовую интеграцию со стилями.

**Files:**
- Create: `src/bim/ui/drawings-panel.ts`
- Modify: `src/styles.css`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Пользователь видит список drawings.
- Панель не мешает viewer и загрузке модели.

**Status:** ✅ completed

---

### Sprint 4 — Drawing annotations (P3)

**Цель:** сделать аннотации для чертежей usable и редактируемыми.

### Task 1: Add annotation primitives

**Objective:** добавить базовые аннотации для drawings.

**Files:**
- Create: `src/bim/drawings/annotations.ts`
- Modify: `src/bim/drawings/drawing-manager.ts`

**Verification:**
```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**
- На drawing можно создать annotation объект.

### Task 2: Add interactive placement

**Objective:** сделать размещение аннотаций интерактивным.

**Files:**
- Create: `src/bim/ui/annotation-tools.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**
- Аннотации ставятся вручную на drawing.

### Task 3: Persist annotation state

**Objective:** сохранить данные аннотаций локально.

**Files:**
- Create: `src/bim/drawings/annotation-storage.ts`
- Modify: `src/bim/drawings/annotations.ts`

**Verification:**
```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**
- Аннотации восстанавливаются после перезагрузки.

### Task 4: Add edit/delete/clear flows

**Objective:** поддержать редактирование и очистку аннотаций.

**Files:**
- Modify: `src/bim/drawings/annotations.ts`
- Modify: `src/bim/ui/annotation-tools.ts`

**Verification:**
```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**
- Аннотации можно редактировать, удалять и очищать.

---

### Sprint 5 — Model Health Checks (P3)

**Цель:** вынести проверки качества модели в отдельный слой правил.

**Status:** ✅ completed

### Task 1: Split rule groups

**Objective:** разнести проверки по смысловым группам.

**Files:**
- Create: `src/bim/checks/structure-rules.ts`
- Create: `src/bim/checks/identity-rules.ts`
- Create: `src/bim/checks/material-rules.ts`
- Create: `src/bim/checks/name-rules.ts`
- Modify: `src/bim/checks/model-health.ts`

**Verification:**
```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**
- Каждая группа правил живёт в своём модуле.

### Task 2: Add rule registry and utils

**Objective:** отделить регистр правил и общие helper’ы.

**Files:**
- Create: `src/bim/checks/rule-registry.ts`
- Create: `src/bim/checks/rule-utils.ts`
- Create: `src/bim/checks/check-types.ts`
- Modify: `src/bim/checks/rules.ts`

**Verification:**
```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**
- Правила подключаются через registry, а не из одного файла.

### Task 3: Add reporting and filtering

**Objective:** собрать отчёты по health checks и фильтры по типам issues.

**Files:**
- Modify: `src/bim/checks/model-health.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**
- Health checks запускаются по модели.
- Пользователь видит и фильтрует список issues.

---

### Sprint 6 — Issues / BCF foundation (P4)

**Цель:** создать основу issue management.

**Status:** ✅ completed

### Task 1: Build issue store

**Objective:** создать отдельный issue store и слой нормализации.

**Files:**
- Create: `src/bim/issues/issue-repository.ts`
- Create: `src/bim/issues/issue-types.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Issues хранятся отдельно от UI.

### Task 2: Add CRUD flows

**Objective:** реализовать create / update / resolve flows для issues.

**Files:**
- Modify: `src/bim/issues/issue-repository.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Issue можно создавать, обновлять и закрывать.

### Task 3: Link issues to elements

**Objective:** привязать issues к элементам модели.

**Files:**
- Modify: `src/bim/issues/issue-repository.ts`
- Modify: `src/bim/data/model-index.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- У issue есть явная связь с element record.

### Task 4: Prepare BCF export

**Objective:** подготовить BCF-compatible export слой.

**Files:**
- Create: `src/bim/issues/bcf-export.ts`
- Modify: `src/bim/issues/issue-repository.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Экспорт issues не завязан на UI.

---

### Sprint 7 — Federation + Clash MVP (P4)

**Цель:** объединение моделей и базовая детекция коллизий.

**Status:** ✅ completed

### Task 1: Load multiple models

**Objective:** поддержать загрузку нескольких моделей в одном workspace.

**Files:**
- Modify: `src/bim/models/model-loader.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Несколько моделей загружаются без потери текущего viewer flow.

### Task 2: Build federation view

**Objective:** показать объединённый federation view.

**Files:**
- Create: `src/bim/federation/federation-view.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Пользователь видит федерацию моделей в одном workspace.

### Task 3: Split clash pipeline

**Objective:** реализовать broad phase и exact overlap отдельными шагами.

**Files:**
- Modify: `src/bim/clash/clash-detector.ts`
- Create: `src/bim/clash/broad-phase.ts`
- Create: `src/bim/clash/overlap.ts`

**Verification:**
```bash
node --test tests/clash-pipeline.test.mjs
npm run build
```

**Acceptance:**
- Коллизии считаются через отдельные уровни pipeline.

### Task 4: Add clash list and highlights

**Objective:** добавить список коллизий и подсветку в viewer.

**Files:**
- Create: `src/bim/clash/clash-report.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
node --test tests/clash-pipeline.test.mjs
npm run build
```

**Acceptance:**
- Пользователь видит clash list и подсветку в 3D.

---

### Sprint 8 — Sheets, PDF/PNG, specifications (P4)

**Цель:** довести листы, экспорт и спецификации до рабочего MVP, включая размещение таблицы/спецификации на листе при оформлении.

**Status:** ✅ completed

### Task 1: Build sheets layer

**Objective:** добавить слой sheets для наборов листов.

**Files:**
- Create: `src/bim/sheets/sheet-manager.ts`
- Create: `src/bim/sheets/sheet-types.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Листы можно создавать и перечислять в UI.

### Task 2: Add PDF/PNG export

**Objective:** подключить экспорт листов в PDF и PNG.

**Files:**
- Create: `src/bim/sheets/exporters.ts`
- Modify: `src/bim/app.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Лист экспортируется в PDF и PNG.

### Task 3: Add spec tables

**Objective:** сформировать спецификации из индексированных данных модели.

**Files:**
- Create: `src/bim/sheets/spec-tables.ts`
- Modify: `src/bim/data/model-index.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Спецификации строятся из индексированных данных.
- Пользователь может разместить таблицу/спецификацию на листе при оформлении.

### Task 3.1: Place spec tables on sheet

**Objective:** встроить таблицу/спецификацию в лист как отдельный элемент оформления.

**Files:**
- Create: `src/bim/sheets/spec-placement.ts`
- Modify: `src/bim/sheets/sheet-board.ts`
- Modify: `src/bim/app/drawings-controller.ts`
- Modify: `src/bim/sheets/sheet-types.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Спецификация может быть добавлена на лист вместе с чертежом.
- Размещение спецификации не ломает PDF/PNG/DXF экспорт.
- Лист остаётся пригодным для печати и просмотра.

### Task 3.2: Support multiple spec blocks

**Objective:** позволить размещать несколько таблиц/спецификаций на одном листе и управлять их порядком.

**Files:**
- Create: `src/bim/sheets/spec-layout.ts`
- Modify: `src/bim/sheets/spec-placement.ts`
- Modify: `src/bim/sheets/sheet-board.ts`
- Modify: `src/bim/app/drawings-controller.ts`
- Modify: `src/bim/sheets/sheet-types.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- На одном листе можно разместить несколько spec blocks.
- Блоки можно переупорядочивать без поломки рендера.
- Экспорт листа остаётся стабильным во всех форматах.

### Task 4: Polish title blocks

**Objective:** довести оформление листов и title blocks до рабочего вида.

**Files:**
- Modify: `src/styles.css`
- Modify: `src/bim/sheets/sheet-manager.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Title blocks выглядят аккуратно и стабильно.

---

## 2. Refactor / architecture phases

### Phase 9 — App bootstrap and controller orchestration (P5)

**Status:** выполнено — `src/bim/app.ts` reduced to a thin export while `src/bim/app/bootstrap.ts` now owns app startup and controller orchestration.

**Цель:** убрать центральную точку сборки из `src/bim/app.ts` и сделать запуск приложения явным.

---

### Phase 10 — Workspace state decomposition (P5)

**Status:** выполнено — `WorkspaceState` has been split into domain-focused slices and the shared data bag was removed.

**Цель:** разнести `WorkspaceState` по доменным срезам и убрать общий мешок данных.

---

### Phase 11 — DOM segmentation and UI module split (P5)

**Status:** выполнено — UI event wiring moved into `src/bim/app/ui-wiring.ts`, reducing bootstrap monolithism and making feature-grouped bindings easier to maintain.

**Цель:** сделать DOM-слой менее монолитным и проще для тестирования.

---

### Phase 12 — Element index extraction and data layer cleanup

**Цель:** сделать индекс элементов модели более чистым, переиспользуемым и тестируемым.

---

### Phase 13 — Model health rules modularization

**Status:** выполнено — rules split into a registry plus grouped modules; model-health checks now use discrete rule files and persisted rule settings; unit tests cover duplicate IDs, missing material/name and similar edge cases.

**Цель:** превратить набор проверок качества модели в набор отдельных правил и модулей.

**Files:**
- Modify: `src/bim/checks/rules.ts`
- Modify: `src/bim/checks/model-health.ts`
- Create: `src/bim/checks/rule-registry.ts`
- Create: `src/bim/checks/rule-utils.ts`
- Create: `src/bim/checks/name-rules.ts`
- Create: `src/bim/checks/identity-rules.ts`
- Create: `src/bim/checks/structure-rules.ts`
- Create: `src/bim/checks/material-rules.ts`
- Create: `src/bim/checks/check-types.ts`

**Tasks:**
1. Разделить правила по смысловым группам.
2. Отделить predicate-логику от текстов описания.
3. Подготовить правила к локализации.
4. Добавить тесты на duplicate IDs, missing material/name and similar edge cases.
5. Подготовить список правил с включением/выключением и приоритизацией.

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

**Status:** выполнено — pipeline коллизий разделён на broad phase, candidate generation, exact overlap и reporting; добавлены unit-тесты на broad phase, overlap engine и clash report.

**Цель:** разделить broad phase, exact overlap, scoring и отчётность по коллизиям.

**Files:**
- Modify: `src/bim/clash/clash-detector.ts`
- Create: `src/bim/clash/broad-phase.ts`
- Create: `src/bim/clash/overlap.ts`
- Create: `src/bim/clash/clash-report.ts`
- Create: `src/bim/clash/clash-candidates.ts`

**Tasks:**
1. Вынести генерацию candidate pairs в отдельный модуль.
2. Вынести exact overlap/volume computation.
3. Отделить форматирование clash record от геометрии.
4. Подготовить unit-тесты на 2D/3D edge cases и tolerance logic.

**Verification:**
```bash
node --test tests/clash-pipeline.test.mjs
npm run build
```

**Acceptance:**
- Геометрия и бизнес-логика не смешаны.
- Candidate filtering можно улучшать независимо от отчёта.

---

### Phase 15 — Drawings and annotations architecture cleanup

**Цель:** сделать drawings-подсистему документной моделью, а не набором разрозненных helper-ов.

**Status:** выполнено — `DrawingDocument`/`SheetDocument`, аннотации и листы сведены к общей data model, экспорт и сохранение опираются на единый document layer; добавлен режим *Оформление* со split-view для модели и чертежа.

---

### Phase 16 — Issue store and backend layering

**Цель:** разделить storage, business rules и API surfaces для issues/fragments/backend.

**Completed:**
- Issue store вынесен в отдельный слой `issue-repository` с нормализацией create/import/update/remove.
- Backend fragments API разложен на `settings`, `auth`, `repository`, `schemas` и тонкий `main.py`.
- Добавлены тесты для issue store и backend layering, покрывающие нормализацию и CRUD-флоу.

---

## 3. Current canonical state

- **Current canonical plan file:** `docs/plans/ifc-wasm-plan.md`
- **Old split plan files removed**; this file is now the single source of truth for the IFC WASM plan.

**Next phase to execute:** Phase 11.

## 4. Recommended verification loop

For any phase or sprint:
1. Implement the scoped task.
2. Run the relevant checks.
3. Update the plan status.
4. Commit.
5. Push to `dev` if the user asked for it.

Typical checks:
```bash
npx tsc --noEmit
npm run build
git diff --check
```
