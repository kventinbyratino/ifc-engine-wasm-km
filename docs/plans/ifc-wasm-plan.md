# IFC Engine WASM — Unified Plan

> **For Hermes:** This is the single canonical plan file for the project. Keep product roadmap and refactor phases in one place.

**Project:** `IFC_engine_wasm`

**Goal:** развить `ifc-engine-wasm` в единый BIM-профиль для BIM manager: viewer, свойства, проверки качества, issues, federation/clash, drawings, sheets и экспорт из IFC-модели.

**Architecture:** ThatOpen Engine является технической базой проекта. IFC загружается через текущий `IfcLoader`/Fragments pipeline, BIM-данные индексируются в приложении, а чертежи строятся через `TechnicalDrawings` + `DxfManager` без самописного DXF-движка.

**Tech stack:** TypeScript, Vite, Three.js, `@thatopen/components`, `@thatopen/components-front`, `@thatopen/fragments`, `@thatopen/ui`, `@thatopen/ui-obc`, `web-ifc`.

**Current status:**
- BIM profile and base viewer are in place.
- Drawings / annotations / sheets MVP are in place.
- Phase 12 completed: element-index cleanup.
- Phase 13 completed: model health rules modularization.
- Phase 14 completed: clash detection pipeline split.
- Phase 15 completed: drawings and annotations architecture cleanup.
- Next refactor phase: **Phase 16 — Issue store and backend layering**.

---

## 1. Product roadmap

### Sprint 1 — Архитектура единого BIM-профиля

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

**Tasks:**
1. Вынести инициализацию ThatOpen components/world/camera/renderer из `main.ts`.
2. Вынести загрузку IFC/fragments в `model-loader.ts`.
3. Вынести selection/highlighter/hider в `selection.ts`.
4. Вынести spatial tree и properties panel.
5. Оставить `/ifc-engine-wasm/bim/` как основной BIM route.
6. Сохранить существующий viewer-функционал без регресса.

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- `/ifc-engine-wasm/bim/` открывает viewer.
- IFC загружается.
- Выбор элемента работает.
- Свойства отображаются.
- hide/isolate/show all работают.

---

### Sprint 2 — BIM Data Layer

**Цель:** создать индекс элементов модели для таблиц, фильтров, проверок и AI.

**Files:**
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

**Tasks:**
1. После загрузки модели построить список элементов.
2. Извлечь базовые свойства и psets/qsets.
3. Добавить таблицу элементов.
4. Добавить фильтры: модель, IFC class, этаж, поиск.
5. Добавить экспорт CSV/JSON.

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Таблица показывает элементы модели.
- Выбор строки подсвечивает элемент в 3D.
- Фильтры работают.
- CSV/JSON скачивается.

---

### Sprint 3 — Drawings/DXF MVP на ThatOpen

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

**Tasks:**
1. Создать генерацию плана этажа из IFC элементов.
2. Сформировать 2D проекцию в TechnicalDrawings.
3. Подключить DXF export через DxfManager.
4. Добавить панель drawings.
5. Проверить рендер и экспорт.

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- Генерация плана работает.
- DXF экспортируется.
- Пользователь видит список drawing’ов.

---

### Sprint 4 — Drawing annotations

**Цель:** сделать аннотации для чертежей usable и редактируемыми.

**Tasks:**
- Native annotations on drawings.
- Interactive placement.
- Persistence for annotation data.
- Edit/delete/clear flows.

**Verification:**
```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**
- Размеры, выноски, подписи можно ставить на drawings.
- Аннотации сохраняются локально.

---

### Sprint 5 — Model Health Checks

**Цель:** вынести проверки качества модели в отдельный слой правил.

**Tasks:**
- Structural rules.
- Identity rules.
- Material and naming rules.
- Reports and filtering.

**Verification:**
```bash
npx tsc --noEmit
npm run build
```

**Acceptance:**
- Health checks запускаются по модели.
- Пользователь видит список issues.

---

### Sprint 6 — Issues / BCF foundation

**Цель:** создать основу issue management.

**Tasks:**
- Issue store.
- Create/update/resolve flows.
- Link issues to elements.
- Prepare BCF-compatible exports.

---

### Sprint 7 — Federation + Clash MVP

**Цель:** объединение моделей и базовая детекция коллизий.

**Tasks:**
- Load multiple models.
- Federation view.
- Broad phase / exact overlap.
- Clash list and highlights.

---

### Sprint 8 — Sheets, PDF/PNG, specifications

**Цель:** довести листы, экспорт и спецификации до рабочего MVP.

**Tasks:**
- Sheets.
- PDF/PNG export.
- Spec tables.
- Polished title blocks.

---

## 2. Refactor / architecture phases

### Phase 9 — App bootstrap and controller orchestration

**Цель:** убрать центральную точку сборки из `src/bim/app.ts` и сделать запуск приложения явным.

---

### Phase 10 — Workspace state decomposition

**Цель:** разнести `WorkspaceState` по доменным срезам и убрать общий мешок данных.

---

### Phase 11 — DOM segmentation and UI module split

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

---

## 3. Current canonical state

- **Current canonical plan file:** `docs/plans/ifc-wasm-plan.md`
- **Old split plan files removed**; this file is now the single source of truth for the IFC WASM plan.

**Next phase to execute:** Phase 16.

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
