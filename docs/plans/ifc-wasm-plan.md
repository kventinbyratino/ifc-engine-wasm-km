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
- Sprint 2.5 is complete and verified.
- Sprint 3 is complete and verified.
- Sprint 4 is complete and verified.
- Sprint 5 is complete and verified.
- Sprint 6 is complete and verified.
- Sprint 7 is complete and verified.
- Detailed phase statuses are tracked in the phase sections below.
- Phase 9 is complete and verified.
- Phase 10 is complete and verified.
- Phase 11 is complete and verified.
- Phase 12 is complete and verified.
- Sprint 9 is complete and verified.
- Sprint 10 is complete and verified.
- Sprint 11 is complete and verified.
- Sprint 12 is complete and verified.
- Sprint 15 is complete and verified.
- Detailed roadmapped work continues below.

## 0. Priorities / working mode

**Now:** Sprint 16 — Backend conversion for IFC files over 200 MB.

**Next:** Production LOD / progressive loading for large IFC models.

**Later:** TBD.

**Done:** Sprint 1; Sprint 2; Sprint 3; Sprint 4; Sprint 5; Sprint 6; Sprint 7; Sprint 9; Sprint 10; Sprint 11; Sprint 12; Sprint 15; Phase 9; Phase 10; Phase 11; Phase 12; Phase 13; Phase 14; Phase 15; Phase 16.

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
- Create: `src/bim/data/relation-types.ts`
- Create: `src/bim/data/element-relations.ts`
- Modify: `src/bim/data/model-index.ts`
- Modify: `src/bim/data/element-index.ts`
- Modify: `src/bim/state/data-state.ts`
- Modify: `src/bim/app/data-controller.ts`

**Status:** completed — relations are extracted during model indexing, stored in workspace state, and verified by tests/build.

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

### Sprint 15 — Real IFC export to a new modified file (P0)

**Status:** выполнено — экспорт переведён на полноценный source-based IFC path: при загрузке `.ifc` сохраняются исходные bytes, кнопка `IFC` в data browser открывает исходную модель через `web-ifc`, применяет pending property/class overrides, сохраняет полный `.ifc` через `SaveModel` и проверяет roundtrip. Упрощённый writer оставлен как fallback/fixture path.

**Цель:** научить BIM-профиль собирать и скачивать *новый* IFC-файл с применёнными overrides, сохраняя исходные GUID, структуру и пользовательские правки без мутации оригинального источника.

**Architecture:** экспорт должен работать как отдельный write-path поверх текущего model/override state. Исходные записи остаются immutable, а экспортный слой собирает новый `.ifc` артефакт из текущего состояния модели, class remap и property overrides. Реализация должна остаться клиентской и вызывать browser download, без server-side зависимости.

**Files:**
- Create: `src/bim/export/ifc-writer.ts`
- Modify: `src/bim/export/ifc-export.ts`
- Modify: `src/bim/data/exporters.ts`
- Modify: `src/bim/app/bootstrap.ts`
- Modify: `src/bim/app.ts`
- Modify: `src/bim/models/model-loader.ts`
- Modify: `src/bim/state/data-state.ts`
- Create: `src/bim/export/ifc-full-export.ts`
- Modify: `tests/export/ifc-export.test.mjs`
- Create: `tests/export/ifc-writer.test.mjs`
- Create: `tests/export/ifc-full-export.test.mjs`
- Create: `tests/fixtures/ifc/modified-roundtrip.ifc`

**Tasks:**
1. Inspect the available IFC writing/serialization path and define the output contract for a modified file.
2. Implement a writer that emits a new `.ifc` file from the current model state plus pending overrides, preserving GUIDs and the original hierarchy.
3. Wire the export action into the app so the user downloads a real IFC file, not only a JSON export package.
4. Add roundtrip tests and fixture coverage for preserved GUIDs, preserved source structure, and applied class/property overrides.

**Verification:**
```bash
node --test tests/export/ifc-export.test.mjs tests/export/ifc-writer.test.mjs tests/export/ifc-full-export.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Export creates a new `.ifc` file.
- The exported file keeps the original model intact and reflects overrides in the new file only.
- GUIDs and model structure are preserved.
- The file can be opened by a standard IFC viewer.

---

### Sprint 16 — Backend conversion for IFC files over 200 MB (P0)

**Status:** planned — move large IFC preprocessing out of the browser so models above the current 200 MB browser limit can be uploaded, converted to Fragments/server artifacts, tracked as jobs, and opened from optimized outputs while preserving the original IFC as source-of-truth for export.

**Цель:** поддержать IFC >200 MB без падения вкладки: тяжёлую конвертацию выполнять на backend/worker, а браузеру отдавать готовые `.frag`/manifest/metadata для быстрого открытия сцены.

**Architecture:** browser uploads a large IFC to same-repo backend storage, backend starts an async conversion job, worker runs the existing `web-ifc`/ThatOpen conversion pipeline in a controlled environment, stores generated fragments + metadata + original IFC reference on local server disk, frontend polls job status and loads optimized artifacts. Original IFC remains immutable source for future full IFC export.

**Locked scope decisions:**
- Backend location: same repository under `backend/*`.
- Storage: local server disk, no external object storage for this sprint.
- Conversion engine: existing `web-ifc`/ThatOpen path, not a separate new converter stack.
- Target file size: support up to 500 MB IFC.
- Access model: artifacts and source IFC are private to the current user.

**Files:**
- Modify: `src/bim/config.ts`
- Modify: `src/bim/models/model-loader.ts`
- Modify: `src/bim/app/model-controller.ts`
- Modify: `src/bim/federation/federation-registry.ts`
- Modify/Create: `src/bim/backend/*` API client layer
- Modify/Create: `backend/*` conversion API, worker, local-disk storage repository, schemas
- Create: `tests/backend/large-ifc-conversion*.test.*`
- Create: `tests/performance/large-ifc-conversion*.test.*`

**Tasks:**

1. **Define backend conversion contract**
   - **Objective:** зафиксировать API и lifecycle для больших IFC.
   - **Scope:** upload endpoint, conversion job ID, statuses, errors, artifact manifest, source IFC reference.
   - **Constraints:** same-repo backend, current-user-private resources, 500 MB max IFC size.
   - **Acceptance:** есть контракт `upload → job → progress → artifacts → load`, определены лимиты, права доступа и ошибки.

2. **Add large-file routing in frontend**
   - **Objective:** файлы до browser limit открывать локально, файлы выше лимита отправлять на backend conversion.
   - **Acceptance:** UI явно показывает `Загрузка на сервер`, `Конвертация`, `Готово`, `Ошибка`; 200 MB лимит перестаёт быть hard-stop для backend mode.

3. **Implement backend upload and storage layer**
   - **Objective:** принять большой IFC, сохранить оригинал на локальный диск сервера, вернуть conversion job.
   - **Acceptance:** upload потоковый/без полной загрузки в память, есть size/type validation, лимит 500 MB, source IFC не мутируется, доступ ограничен текущим пользователем.

4. **Implement async conversion worker**
   - **Objective:** конвертировать IFC в optimized fragments/metadata вне браузера существующим `web-ifc`/ThatOpen pipeline.
   - **Acceptance:** worker запускается асинхронно, пишет progress, сохраняет artifacts, корректно обрабатывает cancel/failure.

5. **Load converted artifacts in viewer**
   - **Objective:** после завершения job открыть сцену из backend-generated fragments.
   - **Acceptance:** viewer грузит `.frag`/manifest вместо исходного IFC, federation registry получает source metadata.

6. **Preserve export compatibility**
   - **Objective:** сохранить возможность полноценного IFC export с overrides.
   - **Acceptance:** original IFC доступен как source-of-truth; overrides остаются привязаны к `modelId + localId`; экспорт не зависит от viewer fragments.

7. **Add performance and reliability checks**
   - **Objective:** измерить 100/200/500 MB сценарии и отказоустойчивость.
   - **Acceptance:** метрики `upload time`, `conversion time`, `time to first scene`, `artifact size`, `memory notes`; тесты покрывают happy path, too large, failed conversion, missing artifact.

**Verification:**
```bash
node --test tests/backend/large-ifc-conversion*.test.* tests/performance/large-ifc-conversion*.test.*
npm run build
git diff --check
```

**Acceptance:**
- IFC >200 MB не блокируется browser limit, а уходит в backend conversion flow.
- Целевой размер IFC для этого sprint: до 500 MB.
- Backend реализован в этом же repository, без внешнего сервиса.
- Source IFC и artifacts хранятся на локальном диске сервера и доступны только текущему пользователю.
- Конвертация использует существующий `web-ifc`/ThatOpen pipeline.
- Браузер не держит весь тяжёлый preprocessing в main thread.
- Пользователь видит progress и может открыть результат после conversion.
- Исходный IFC сохранён для полноценного экспорта с overrides.
- Ошибки conversion понятны пользователю и логируются на backend.

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

**Status:** выполнено — `element-index` now re-exports the cleaned public facade, `search-index` no longer depends on `model-index`, `model-index` uses a dedicated record factory, and `data-controller` imports the normalized API.

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


### Sprint 9 — Federation loading and model registry (P0)

**Цель:** превратить текущую многомодельную сцену в управляемый федеративный workspace с очередью загрузки, registry и устойчивым восстановлением состава сцены.

**Task 1: Introduce a federation registry state**

**Objective:** хранить состав федерации как отдельную сущность со статусами, цветами, дисциплинами и видимостью моделей.

**Files:**
- Create: `src/bim/federation/federation-registry.ts`
- Modify: `src/bim/state/workspace-state.ts`
- Modify: `src/bim/state/viewer-state.ts`
- Create: `tests/federation/federation-registry.test.mjs`

**Verification:**
```bash
node --test tests/federation/federation-registry.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Каждая загруженная модель представлена в registry.
- Состояние модели включает имя, дисциплину, цвет, статус и видимость.

**Task 2: Add queued loading for IFC/FRAG models**

**Objective:** позволить добавлять несколько моделей подряд без потери уже загруженных моделей.

**Files:**
- Modify: `src/bim/app/model-controller.ts`
- Modify: `src/bim/app/library-controller.ts`
- Modify: `src/bim/models/model-loader.ts`
- Create: `src/bim/federation/federation-loader.ts`
- Create: `tests/federation/federation-loader.test.mjs`

**Verification:**
```bash
node --test tests/federation/federation-loader.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Новая модель добавляется в сцену, не очищая предыдущие.
- Пользователь видит прогресс и ошибки по каждой модели отдельно.

**Task 3: Restore federated scene composition on open**

**Objective:** сохранять и восстанавливать состав федерации между сессиями.

**Files:**
- Create: `src/bim/federation/federation-persistence.ts`
- Modify: `src/bim/app/bootstrap.ts`
- Modify: `src/bim/app/library-controller.ts`
- Create: `tests/federation/federation-persistence.test.mjs`

**Verification:**
```bash
node --test tests/federation/federation-persistence.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Список моделей можно восстановить из сохранённого состояния.
- После reload федерация открывается в ожидаемом составе.

**Status:** ✅ done and verified

---

### Sprint 10 — Federation management controls (P1)

**Цель:** дать пользователю явный контроль над каждой моделью в федерации: видимость, изоляция, фокус, opacity и быстрые действия.

**Task 1: Build a federation side panel**

**Objective:** показать список моделей с их статусами и быстрыми действиями.

**Files:**
- Create: `src/bim/ui/federation-panel.ts`
- Create: `src/bim/dom/federation-dom.ts`
- Modify: `src/bim/dom/viewer-dom.ts`
- Modify: `src/bim/app/bootstrap.ts`
- Modify: `src/bim/app/ui-wiring.ts`
- Create: `tests/federation/federation-panel.test.mjs`

**Verification:**
```bash
node --test tests/federation/federation-panel.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- В панели видны все модели федерации.
- Для каждой модели доступны базовые действия.

**Task 2: Add per-model visibility and opacity controls**

**Objective:** разрешить скрывать, показывать и делать прозрачной отдельную модель.

**Files:**
- Modify: `src/bim/federation/federation-registry.ts`
- Create: `src/bim/federation/federation-actions.ts`
- Modify: `src/bim/viewer/viewer.ts`
- Modify: `src/bim/app/model-controller.ts`
- Create: `tests/federation/federation-visibility.test.mjs`

**Verification:**
```bash
node --test tests/federation/federation-visibility.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Видимость модели управляется отдельно от других моделей.
- Opacity/visibility не ломают selection и clash flows.

**Task 3: Add isolate, focus and remove actions**

**Objective:** упростить работу с конкретной моделью в плотной федерации.

**Files:**
- Modify: `src/bim/app/model-controller.ts`
- Modify: `src/bim/app/clash-controller.ts`
- Modify: `src/bim/app/data-controller.ts`
- Create: `tests/federation/federation-actions.test.mjs`

**Verification:**
```bash
node --test tests/federation/federation-actions.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Можно изолировать одну модель и вернуть сцену обратно.
- Можно быстро удалить модель из текущей федерации без перезагрузки всей сцены.

**Status:** ✅ done and verified

---

### Sprint 11 — Cross-model coordination (P1)

**Цель:** добавить полезные координационные сценарии поверх федерации: кросс-модельные clash, фильтры по дисциплинам и сохранение federation snapshot.

**Task 1: Add federation-wide filters and presets**

**Objective:** фильтровать федерацию по дисциплинам, моделям, этажам и пользовательским пресетам.

**Files:**
- Create: `src/bim/federation/federation-filters.ts`
- Modify: `src/bim/app/clash-controller.ts`
- Modify: `src/bim/app/data-controller.ts`
- Create: `tests/federation/federation-filters.test.mjs`

**Verification:**
```bash
node --test tests/federation/federation-filters.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Набор моделей и фильтров можно быстро переключать.
- Пресеты воспроизводимы и не зависят от текущего UI state.

**Status:** ✅ done and verified

**Task 2: Support cross-model clash sets**

**Objective:** считать clash не только внутри модели, но и между выбранными моделями или дисциплинами.

**Files:**
- Modify: `src/bim/clash/clash-candidates.ts`
- Modify: `src/bim/clash/clash-detector.ts`
- Modify: `src/bim/app/clash-controller.ts`
- Create: `tests/federation/cross-model-clash.test.mjs`

**Verification:**
```bash
node --test tests/federation/cross-model-clash.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Можно ограничить clash проверку выбранными моделями.
- Результаты сохраняют привязку к modelId и дисциплинам.

**Status:** ✅ done and verified

**Task 3: Save and restore federation snapshots**

**Objective:** хранить снимок федерации: модели, видимость, цвета, фильтры и последние активные действия.

**Files:**
- Create: `src/bim/federation/federation-snapshot.ts`
- Modify: `src/bim/state/workspace-state.ts`
- Modify: `src/bim/app/bootstrap.ts`
- Create: `tests/federation/federation-snapshot.test.mjs`

**Verification:**
```bash
node --test tests/federation/federation-snapshot.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Снимок можно сохранить и восстановить без ручной перенастройки.
- Snapshot помогает быстро вернуть рабочую конфигурацию проекта.

**Status:** ✅ done and verified

---
### Sprint 12 — Performance pipeline and progressive loading (P0)

**Цель:** ускорить загрузку и отображение больших моделей за счёт progressive loading, LOD, видимости по камере и кеша в IndexedDB.

**Task 1: Measure the baseline and define budgets**

**Objective:** зафиксировать метрики первой загрузки, времени до первого отображения и объёма видимой сцены.

**Files:**
- Create: `src/bim/performance/performance-metrics.ts`
- Create: `tests/performance/performance-metrics.test.mjs`
- Modify: `src/bim/models/model-loader.ts`
- Modify: `src/bim/viewer/viewer.ts`

**Verification:**
```bash
node --test tests/performance/performance-metrics.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Есть измеримые метрики для baseline.
- Понятно, что считать регрессией по загрузке и первому рендеру.

**Status:** ✅ done and verified

**Task 2: Build a spatial visibility index**

**Objective:** определять, какие части модели должны быть загружены и отрисованы в текущем положении камеры.

**Files:**
- Create: `src/bim/performance/visibility-index.ts`
- Modify: `src/bim/state/viewer-state.ts`
- Modify: `src/bim/app/model-controller.ts`
- Modify: `src/bim/viewer/viewer.ts`

**Verification:**
```bash
node --test tests/performance/performance-metrics.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Для текущей камеры вычисляется список видимых сущностей/чанков.
- Скрытые части не участвуют в основном рендер-пайплайне.

**Status:** ✅ done and verified

**Task 3: Add progressive chunk / LOD loading**

**Objective:** сначала показывать грубое представление, затем догружать более детальные данные.

**Files:**
- Create: `src/bim/performance/lod-loader.ts`
- Modify: `src/bim/models/model-loader.ts`
- Modify: `src/bim/state/data-state.ts`
- Create: `tests/performance/lod-loader.test.mjs`

**Verification:**
```bash
node --test tests/performance/lod-loader.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Малые модели грузятся как раньше.
- Большие модели получают progressive loading без поломки viewer.

**Status:** ✅ done and verified

**Task 4: Cache loaded chunks in IndexedDB**

**Objective:** сохранять уже загруженные части модели локально и переиспользовать их между сессиями.

**Files:**
- Create: `src/bim/storage/model-cache.ts`
- Create: `src/bim/storage/indexeddb-schema.ts`
- Modify: `src/bim/models/model-loader.ts`
- Modify: `src/bim/state/workspace-state.ts`
- Create: `tests/storage/model-cache.test.mjs`

**Verification:**
```bash
node --test tests/storage/model-cache.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Повторная загрузка использует кеш.
- Версия схемы кеша позволяет безопасно сбрасывать устаревшие данные.

**Status:** ✅ done and verified

**Task 5: Add an end-to-end performance gate**

**Objective:** не допускать регрессий по времени загрузки и первому отображению.

**Files:**
- Create: `tests/performance/model-load-smoke.test.mjs`
- Modify: `package.json`

**Verification:**
```bash
node --test tests/performance/*.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Есть smoke-проверка на загрузку большой модели.
- Можно сравнивать прогресс по стабильным метрикам.

**Status:** ✅ done and verified

---

### Sprint 13 — IFC overrides, class remapping, and export (P1)

**Цель:** добавить неразрушающее редактирование параметров IFC, замену классов и экспорт изменений обратно в IFC.

**Sprint status:** completed — all five tasks implemented and verified with `node --test`, `npm run build`, and `git diff --check`.

**Task 1: Define the override data model**

**Objective:** хранить пользовательские правки отдельно от исходной IFC-модели.

**Files:**
- Create: `src/bim/ifc-overrides/override-types.ts`
- Create: `src/bim/ifc-overrides/override-store.ts`
- Modify: `src/bim/state/data-state.ts`
- Modify: `src/bim/state/workspace-state.ts`
- Create: `tests/ifc-overrides/override-store.test.mjs`

**Verification:**
```bash
node --test tests/ifc-overrides/override-store.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Оверрайды не ломают исходный `ElementRecord`.
- Есть отдельный слой для pending changes.

**Task 2: Wire property editing into the UI**

**Objective:** дать возможность редактировать параметры элемента из properties panel.

**Files:**
- Modify: `src/bim/properties/properties-panel.ts`
- Modify: `src/bim/app/model-controller.ts`
- Modify: `src/bim/dom/viewer-dom.ts`
- Create: `src/bim/ifc-overrides/override-actions.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Из UI можно менять разрешённые параметры элемента.
- Изменения видны как несохранённые правки до экспорта.

**Task 3: Add class replacement and mapping rules**

**Objective:** разрешить безопасную замену IFC-класса с валидацией совместимости.

**Files:**
- Create: `src/bim/ifc-overrides/class-mapping.ts`
- Modify: `src/bim/data/model-index.ts`
- Modify: `src/bim/checks/model-health.ts`

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Смена класса проходит через правила маппинга.
- Некорректные замены получают понятную диагностику.

**Task 4: Implement IFC export with overrides applied**

**Objective:** экспортировать изменённую модель в IFC без потери GUID и без повреждения несвязанных данных.

**Files:**
- Create: `src/bim/export/ifc-export.ts`
- Modify: `src/bim/data/exporters.ts`
- Modify: `src/bim/app.ts`
- Create: `tests/export/ifc-export.test.mjs`

**Verification:**
```bash
node --test tests/export/ifc-export.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Экспорт включает overrides.
- Исходные данные остаются нетронутыми до явного сохранения.

**Task 5: Add roundtrip regression fixtures**

**Objective:** проверить, что импорт → правка → экспорт сохраняет структуру модели и основные свойства.

**Files:**
- Create: `tests/fixtures/ifc/override-roundtrip.ifc`
- Modify: `tests/export/ifc-export.test.mjs`

**Verification:**
```bash
node --test tests/export/ifc-export.test.mjs
npm run build
git diff --check
```

**Acceptance:**
- Roundtrip не теряет основные свойства и связи.
- Экспортируемый IFC открывается в стороннем BIM-viewer.

---

## 3. Current canonical state

- **Current canonical plan file:** `docs/plans/ifc-wasm-plan.md`
- **Old split plan files removed**; this file is now the single source of truth for the IFC WASM plan.

- **Current sprint status:** Sprint 13 completed; next sprint TBD.

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
