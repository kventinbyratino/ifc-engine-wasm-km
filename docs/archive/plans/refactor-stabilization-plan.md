# IFC Engine WASM — Refactor & Stabilization Plan

> **For Hermes:** Use `phase-based-project-execution` + `subagent-driven-development` if this plan is implemented with agents. Execute strictly phase-by-phase, one task at a time, with focused verification after every task.

**Goal:** стабилизировать тестовый контур и разрезать основные монолиты `IFC_engine_wasm`, не меняя текущий UX/роуты/профили BIM и КМ.

**Architecture:** сначала фиксируем тестовую инфраструктуру и единый verification gate, затем постепенно дробим orchestration-слой (`app/*-controller.ts`) на маленькие сервисы/контроллеры. Рефакторинг должен быть поведенчески нейтральным: существующая загрузка IFC/FRAG, BIM-профиль, КМ-профиль, drawings, federation, checks, issues и export продолжают работать как до изменений.

**Tech Stack:** TypeScript, Vite, Node test runner, Three.js, ThatOpen Components, web-ifc, FastAPI backend.

**Branch recommendation:** `refactor/stabilization-plan` или отдельные ветки по фазам: `refactor/test-gate`, `refactor/bootstrap-split`, `refactor/drawings-controller`, `refactor/model-controller`, `refactor/css-modules`.

**Protected behavior:**
- Не менять маршруты и текущую логику выбора профилей.
- Не ломать BIM route и КМ behavior.
- Не менять формат публичных экспортов без отдельного решения.
- Не вводить внешние сервисы/хостинг/деплой без явного разрешения.
- Не переписывать ThatOpen/web-ifc pipeline с нуля; только изолировать и стабилизировать.

---

## 0. Current audit snapshot

Дата аудита: 2026-06-15.

**Git state:** рабочее дерево было чистым перед записью этого плана.

**Verification факты:**
- `npm run build` — проходит.
- `npm run test:performance` — проходит, 7/7.
- `node --test tests/**/*.test.mjs tests/*.test.mjs` — 56/62 passed, 6 failed.

**Причина падения полного тестового запуска:** тестовые sandbox-helper’ы патчат import specifiers через `replaceAll`, из-за чего часть импортов становится `.ts.ts`.

Примеры падений:
- `/tmp/ifc-checks-settings-tests-.../checks/rules.ts.ts`
- `.tmp-drawing-annotations-tests/drawings/annotation-factory.ts.ts`
- `/tmp/ifc-data-tests-.../element-relations.ts.ts`
- `/tmp/ifc-health-tests-.../rule-registry.ts.ts`
- `/tmp/ifc-model-index-tests-.../model-reader.ts.ts`
- `/tmp/export/ifc-export.ts`

**Главные hotspots:**
- `src/bim/app/bootstrap.ts` — 742 строки, 35 импортов, слишком много orchestration.
- `src/bim/app/drawings-controller.ts` — 626 строк, смешаны panel/studio/export/persistence/sync.
- `src/bim/app/model-controller.ts` — 490 строк, смешаны загрузка, federation, reset, UI state.
- `src/styles.css` — 1775 строк, стили всех зон в одном файле.
- `package.json` — нет единого полного `npm test` gate.

---

## 1. Definition of done

Рефакторинг считается готовым, когда:

1. Есть единый стабильный тестовый gate:
   ```bash
   npm test
   ```
   и он запускает все релевантные Node `.mjs` тесты без `.ts.ts` sandbox-падений.
2. `npm run build` проходит.
3. `git diff --check` чистый.
4. Основные монолиты разрезаны без изменения поведения:
   - `bootstrap.ts` стал только сборкой приложения.
   - `drawings-controller.ts` разнесён по ответственностям.
   - `model-controller.ts` готов к Sprint 16 backend conversion.
   - CSS разделён по зонам.
5. В плане/документации зафиксирован новый verification порядок.
6. Каждая фаза имеет отдельный commit и короткий отчёт.

---

## 2. Execution order

**P0 / First:** Phase 1 — стабилизировать тесты и `npm test`.

**P0 / Next:** Phase 2 — разрезать `bootstrap.ts`.

**P0 / Next:** Phase 3 — разрезать `drawings-controller.ts`.

**P1:** Phase 4 — подготовить `model-controller.ts` к backend conversion >200 MB.

**P1:** Phase 5 — CSS split.

**P1:** Phase 6 — убрать повторяющийся `innerHTML`/storage/error handling там, где это безопасно.

**P2:** Phase 7 — build chunk strategy / lazy loading.

---

## Phase 1 — Full test gate stabilization (P0)

**Goal:** полный набор тестов должен запускаться одной командой без sandbox import ошибок.

**Files:**
- Modify: `package.json`
- Modify: `tests/checks-settings.test.mjs`
- Modify: `tests/drawing-annotations.test.mjs`
- Modify: `tests/element-index.test.mjs`
- Modify: `tests/exporters-elements.test.mjs`
- Modify: `tests/model-health-rules.test.mjs`
- Modify: `tests/model-index.test.mjs`
- Optional create: `tests/helpers/copy-patched-module.mjs`

### Task 1.1: Add shared safe import patch helper

**Objective:** заменить ручные `replaceAll("./x", "./x.ts")`, которые создают `.ts.ts`, на безопасный helper.

**Files:**
- Create: `tests/helpers/copy-patched-module.mjs`

**Implementation notes:**
- Helper должен копировать TS-файл во временную директорию.
- Helper должен патчить только точные import/export specifiers.
- Нельзя патчить уже расширенные пути повторно.
- Поддержать оба варианта:
  - `from "./rules"` → `from "./rules.ts"`
  - `from "./rules.ts"` → оставить как есть

**Suggested API:**
```js
export async function copyPatchedModule({ srcRoot, tempRoot, sourceRelative, targetRelative = sourceRelative, specifierMap = {} }) {
  // read source
  // replace only import/export specifier strings
  // write target
}
```

**Verification:**
```bash
node --test tests/checks-settings.test.mjs
```
Expected: если helper пока не подключён — не обязательно pass; задача считается готовой после подключения в Task 1.2.

**Acceptance:**
- Helper создан.
- В helper нет глобального `replaceAll` по произвольной подстроке без проверки specifier boundary.

### Task 1.2: Fix checks settings test sandbox

**Objective:** убрать `.ts.ts` в `tests/checks-settings.test.mjs`.

**Files:**
- Modify: `tests/checks-settings.test.mjs`
- Use: `tests/helpers/copy-patched-module.mjs`

**Current failure:**
```text
Cannot find module .../checks/rules.ts.ts
```

**Steps:**
1. Перевести `copyPatched` на shared helper.
2. Проверить specifier map для:
   - `../types`
   - `./rules`
   - `./check-types`
   - `./rule-registry`
   - `./rule-utils`
3. Запустить focused test.

**Verification:**
```bash
node --test tests/checks-settings.test.mjs
```
Expected: pass.

**Acceptance:**
- Нет импортов `.ts.ts`.
- Тест проходит изолированно.

### Task 1.3: Fix drawing annotations test sandbox

**Objective:** убрать `.ts.ts` и временную tracked-директорию `.tmp-drawing-annotations-tests`.

**Files:**
- Modify: `tests/drawing-annotations.test.mjs`
- Use: `tests/helpers/copy-patched-module.mjs`
- Optional modify: `.gitignore`

**Current failure:**
```text
Cannot find module .../.tmp-drawing-annotations-tests/drawings/annotation-factory.ts.ts
```

**Steps:**
1. Перевести test temp root на `mkdtemp(path.join(os.tmpdir(), ...))`, а не repo-local `.tmp-*`.
2. Подключить shared helper.
3. Сохранить stub `thatopen-components.ts` во временной директории.
4. Проверить focused test.

**Verification:**
```bash
node --test tests/drawing-annotations.test.mjs
```
Expected: pass.

**Acceptance:**
- Тест не создаёт untracked `.tmp-*` в repo.
- Тест проходит изолированно.

### Task 1.4: Fix data/index/export/model health sandboxes

**Objective:** починить оставшиеся 4 падения полного тестового запуска.

**Files:**
- Modify: `tests/element-index.test.mjs`
- Modify: `tests/exporters-elements.test.mjs`
- Modify: `tests/model-health-rules.test.mjs`
- Modify: `tests/model-index.test.mjs`

**Known failure patterns:**
- `element-relations.ts.ts`
- `/tmp/export/ifc-export.ts` not found
- `rule-registry.ts.ts`
- `model-reader.ts.ts`

**Steps:**
1. В каждом тесте заменить локальный copy/patch helper на shared helper.
2. Проверить, что все dependent modules реально копируются в tempRoot.
3. Для `exporters-elements.test.mjs` отдельно проверить path mapping `../export/ifc-export` / `./export/ifc-export`.
4. Запустить каждый focused test.

**Verification:**
```bash
node --test tests/element-index.test.mjs
node --test tests/exporters-elements.test.mjs
node --test tests/model-health-rules.test.mjs
node --test tests/model-index.test.mjs
```
Expected: pass for all.

**Acceptance:**
- Все 4 теста проходят изолированно.
- Нет `.ts.ts` в ошибках Node resolution.

### Task 1.5: Add full test script

**Objective:** закрепить единый test gate в `package.json`.

**Files:**
- Modify: `package.json`

**Suggested scripts:**
```json
{
  "scripts": {
    "test": "node --test tests/**/*.test.mjs tests/*.test.mjs",
    "test:performance": "node --test tests/performance/*.test.mjs tests/storage/model-cache.test.mjs"
  }
}
```

**Verification:**
```bash
npm test
npm run test:performance
npm run build
git diff --check
```
Expected: all pass; build may still warn about large chunks.

**Acceptance:**
- `npm test` exists.
- Full suite passes.
- `npm run build` still passes.

---

## Phase 2 — Bootstrap orchestration split (P0)

**Goal:** `src/bim/app/bootstrap.ts` должен стать тонкой сборкой приложения, а не монолитом бизнес-логики.

**Files:**
- Modify: `src/bim/app/bootstrap.ts`
- Create: `src/bim/app/app-context-factory.ts`
- Create: `src/bim/app/federation-restore.ts`
- Create: `src/bim/app/ifc-overrides-wiring.ts`
- Create: `src/bim/app/app-status.ts`
- Optional create: `src/bim/app/app-controller-factory.ts`

### Task 2.1: Extract status/progress/busy helpers

**Objective:** вынести UI status/progress/error helpers из `bootstrap.ts`.

**Files:**
- Create: `src/bim/app/app-status.ts`
- Modify: `src/bim/app/bootstrap.ts`

**Implementation notes:**
- Вынести `setBusy`, `setProgress`, `showError` и связанные helpers.
- Не менять тексты статусов.
- Сохранить API через функции, принимающие нужные DOM элементы.

**Verification:**
```bash
npx tsc --noEmit
npm test
```

**Acceptance:**
- `bootstrap.ts` меньше и не содержит полной реализации status/progress.
- Поведение overlay/status/progress не меняется.

### Task 2.2: Extract federation restore/bootstrap

**Objective:** изолировать restore federation snapshot/workspace.

**Files:**
- Create: `src/bim/app/federation-restore.ts`
- Modify: `src/bim/app/bootstrap.ts`

**Implementation notes:**
- Вынести работу с:
  - `loadStoredFederationSnapshot`
  - `restoreFederationSnapshot`
  - `loadStoredFederationWorkspace`
  - `restoreFederationState`
- Вернуть normalized state или применить к `workspace` внутри функции.

**Verification:**
```bash
npx tsc --noEmit
node --test tests/federation/*.test.mjs
```

**Acceptance:**
- Federation restore покрыт existing tests.
- Нет изменения localStorage ключей/формата.

### Task 2.3: Extract IFC override wiring

**Objective:** вынести `ifcOverrideStore`, sync и `savePropertyOverride` из bootstrap.

**Files:**
- Create: `src/bim/app/ifc-overrides-wiring.ts`
- Modify: `src/bim/app/bootstrap.ts`

**Implementation notes:**
- Функция должна вернуть:
  - `ifcOverrideStore`
  - `syncIfcOverrideState`
  - `savePropertyOverride`
- Не менять toast text и pending count behavior.

**Verification:**
```bash
npx tsc --noEmit
node --test tests/ifc-overrides/*.test.mjs tests/export/*.test.mjs
```

**Acceptance:**
- Property override flow работает как раньше.
- Export tests продолжают проходить.

### Task 2.4: Extract app context factory

**Objective:** сборка `BimAppContext` должна жить отдельно.

**Files:**
- Create: `src/bim/app/app-context-factory.ts`
- Modify: `src/bim/app/bootstrap.ts`
- Modify if needed: `src/bim/app/app-context.ts`

**Implementation notes:**
- Factory принимает DOM, viewer, workspace, stores, status handlers.
- `bootstrap.ts` остаётся readable: get DOM → create viewer → create workspace → create ctx → create controllers → bind UI.

**Verification:**
```bash
npx tsc --noEmit
npm test
npm run build
git diff --check
```

**Acceptance:**
- `bootstrap.ts` больше не содержит низкоуровневую wiring-логику.
- Public export `startBimApp` не меняется.

---

## Phase 3 — Drawings controller split (P0)

**Goal:** разделить `src/bim/app/drawings-controller.ts` по ответственностям, сохранив drawings UX.

**Files:**
- Modify: `src/bim/app/drawings-controller.ts`
- Create: `src/bim/app/drawings-panel-controller.ts`
- Create: `src/bim/app/drawing-studio-controller.ts`
- Create: `src/bim/app/drawing-export-controller.ts`
- Create: `src/bim/app/drawing-persistence-controller.ts`
- Create: `src/bim/app/drawing-selection-controller.ts`

### Task 3.1: Extract drawing studio split/preview

**Objective:** вынести split view, ratio и preview rendering.

**Files:**
- Create: `src/bim/app/drawing-studio-controller.ts`
- Modify: `src/bim/app/drawings-controller.ts`

**Move functions:**
- `toggleDrawingStudio`
- `setDrawingStudioActive`
- `updateDrawingSplitRatio`
- `handleDrawingSplitDrag`
- `renderDrawingPreview`
- `createPreviewFrame`
- `createPreviewMessage`

**Verification:**
```bash
npx tsc --noEmit
node --test tests/sheet-board.test.mjs tests/spec-layout.test.mjs tests/spec-placement.test.mjs
```

**Acceptance:**
- Кнопка «Оформление» и split behavior сохранены.
- Preview sheet rendering не изменился.

### Task 3.2: Extract drawing selection sync

**Objective:** вынести model↔drawing selection sync.

**Files:**
- Create: `src/bim/app/drawing-selection-controller.ts`
- Modify: `src/bim/app/drawings-controller.ts`

**Move functions:**
- `activateDrawing` selection-related part
- `syncModelSelectionFromDrawing`
- `syncDrawingSelectionFromModel`
- best matching drawing behavior

**Verification:**
```bash
node --test tests/drawing-selection-sync.test.mjs
npx tsc --noEmit
```

**Acceptance:**
- Выборка модели связывается с чертежом как раньше.
- Чертёж может активировать исходную выборку.

### Task 3.3: Extract drawing export actions

**Objective:** вынести SVG/PNG/PDF/DXF/spec export handlers.

**Files:**
- Create: `src/bim/app/drawing-export-controller.ts`
- Modify: `src/bim/app/drawings-controller.ts`

**Move responsibility:**
- `downloadSheetSvg`
- `downloadSheetPng`
- `openSheetPdfPrint`
- `downloadSheetDxfPaperSpace`
- `downloadDrawingDxf`
- `generateSpecification` / `specificationToCsv` wiring

**Verification:**
```bash
node --test tests/sheet-board.test.mjs tests/spec-placement.test.mjs tests/drawing-persistence-specs.test.mjs
npx tsc --noEmit
```

**Acceptance:**
- Export buttons continue to call same export utilities.
- No change to generated file naming unless explicitly approved.

### Task 3.4: Extract drawing persistence wiring

**Objective:** вынести save/restore/clear workspace handling.

**Files:**
- Create: `src/bim/app/drawing-persistence-controller.ts`
- Modify: `src/bim/app/drawings-controller.ts`

**Verification:**
```bash
node --test tests/drawing-persistence-specs.test.mjs tests/drawing-annotations.test.mjs
npx tsc --noEmit
```

**Acceptance:**
- Existing drawing localStorage behavior preserved.
- Restore failure handling still warns without breaking app startup.

### Task 3.5: Keep facade controller thin

**Objective:** `createDrawingsController` становится фасадом, который собирает subcontrollers.

**Files:**
- Modify: `src/bim/app/drawings-controller.ts`

**Verification:**
```bash
npm test
npm run build
git diff --check
```

**Acceptance:**
- `drawings-controller.ts` стал существенно меньше.
- Public returned methods remain compatible with current `bootstrap.ts` usage.

---

## Phase 4 — Model controller split + Sprint 16 readiness (P1)

**Goal:** подготовить загрузку моделей к backend conversion for IFC >200 MB без немедленной реализации серверной конвертации.

**Files:**
- Modify: `src/bim/app/model-controller.ts`
- Create: `src/bim/app/model-load-controller.ts`
- Create: `src/bim/models/ifc-load-strategy.ts`
- Create: `src/bim/app/model-reset-service.ts`
- Create: `src/bim/app/federation-actions-controller.ts`
- Modify if needed: `src/bim/config.ts`

**Progress:**
- ✅ Task 4.1 done: `loadIfc` / `loadFrag` / `loadFragBuffer` moved into `src/bim/app/model-load-controller.ts`.
- ✅ Task 4.2 done: `clearModels` moved into `src/bim/app/model-reset-service.ts`.
- ✅ Task 4.3 done: federation panel/actions moved into `src/bim/app/federation-actions-controller.ts`.
- ✅ Task 4.4 done: large IFC routing seam lives in `src/bim/models/ifc-load-strategy.ts` with tests.
- Remaining: none in Phase 4.

### Task 4.1: Extract model loading controller

**Objective:** вынести `loadIfc`, `loadFrag`, `loadFragBuffer`.

**Files:**
- Create: `src/bim/app/model-load-controller.ts`
- Modify: `src/bim/app/model-controller.ts`

**Verification:**
```bash
npx tsc --noEmit
node --test tests/performance/*.test.mjs tests/storage/model-cache.test.mjs
```

**Acceptance:**
- Browser-side IFC/FRAG loading works through same public controller API.
- Queue behavior preserved.

### Task 4.2: Extract clear/reset service

**Objective:** вынести очистку models/search/drawings/checks/clash/data state.

**Files:**
- Create: `src/bim/app/model-reset-service.ts`
- Modify: `src/bim/app/model-controller.ts`

**Verification:**
```bash
npx tsc --noEmit
npm test
```

**Acceptance:**
- `clearModels` behavior preserved.
- Dependent panels reset as before.

### Task 4.3: Extract federation action controller

**Objective:** вынести isolate/remove/visibility/opacity/preset/filter actions.

**Files:**
- Create: `src/bim/app/federation-actions-controller.ts`
- Modify: `src/bim/app/model-controller.ts`

**Verification:**
```bash
node --test tests/federation/*.test.mjs tests/federation-view.test.mjs
npx tsc --noEmit
```

**Acceptance:**
- Federation panel actions remain behavior-compatible.
- Registry sync and persistence unchanged.

### Task 4.4: Add large IFC routing seam

**Objective:** заменить жёсткий early return for `file.size > MAX_IFC_BYTES` на отдельную decision-функцию, чтобы Sprint 16 мог подключить backend conversion.

**Files:**
- Create: `src/bim/models/ifc-load-strategy.ts`
- Modify: `src/bim/app/model-load-controller.ts`
- Test: create `tests/ifc-load-strategy.test.mjs`

**Suggested behavior now:**
- For `file.size <= MAX_IFC_BYTES`: route = `browser`.
- For `file.size > MAX_IFC_BYTES`: route = `blocked_backend_not_ready` with existing user-facing message.

**Important:** это не включает backend conversion, только seam.

**Verification:**
```bash
node --test tests/large-ifc-routing.test.mjs
npx tsc --noEmit
npm run build
```

**Acceptance:**
- Текущий UX для >200 MB не меняется, но решение изолировано.
- Sprint 16 сможет заменить route на `backend` без переписывания model controller.

---

## Phase 5 — CSS modular split (P1)

**Goal:** разрезать `src/styles.css` на доменные CSS-файлы без визуального редизайна.

**Status:** done.

**Files:**
- Modify: `src/styles.css`
- Create: `src/styles/tokens.css`
- Create: `src/styles/layout.css`
- Create: `src/styles/viewer.css`
- Create: `src/styles/panels.css`
- Create: `src/styles/drawings.css`
- Create: `src/styles/federation.css`
- Create: `src/styles/mobile.css`

### Task 5.1: Extract tokens/base/layout

**Objective:** вынести CSS variables, reset/base и shell layout.

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- No visual redesign.
- `src/styles.css` imports new files in deterministic order.

### Task 5.2: Extract panels/viewer/federation/drawings/mobile

**Objective:** вынести остальные блоки по зонам.

**Verification:**
```bash
npm run build
git diff --check
```

**Acceptance:**
- CSS split compiles.
- Class names unchanged.
- No route/profile behavior changes.

---

## Phase 6 — Safe common utilities cleanup (P1)

**Goal:** убрать повторяющиеся unsafe/boilerplate patterns без крупной переписки UI.

**Status:** done.

**Files:**
- Modify/create under `src/bim/ui/`
- Modify/create under `src/bim/storage/`
- Modify controllers gradually

### Task 6.1: Introduce localStorage adapter

**Objective:** унифицировать JSON save/load/parse warning behavior.

**Targets:**
- `src/bim/federation/federation-snapshot.ts`
- `src/bim/federation/federation-persistence.ts`
- `src/bim/drawings/drawing-persistence.ts`
- `src/bim/checks/check-settings.ts`

**Verification:**
```bash
node --test tests/federation/*.test.mjs tests/drawing-persistence-specs.test.mjs tests/checks-settings.test.mjs
npx tsc --noEmit
```

**Acceptance:**
- Same keys and payloads.
- Same null-on-parse-failure behavior.

### Task 6.2: Standardize error logging/reporting

**Objective:** централизовать controller catch logging, не меняя UI messages.

**Verification:**
```bash
npx tsc --noEmit
npm test
```

**Acceptance:**
- No swallowed errors.
- Existing toasts/status messages preserved.

### Task 6.3: Gradually reduce raw `innerHTML`

**Objective:** заменить raw `innerHTML` там, где данные приходят из модели/пользовательского ввода; оставить безопасные SVG render/export места отдельно задокументированными.

**Priority files:**
- `src/bim/data/elements-table.ts`
- `src/bim/federation/federation-view.ts`
- `src/bim/drawings/drawings-panel.ts`
- `src/bim/ui/issues-panel.ts`
- `src/bim/ui/checks-panel.ts`
- `src/bim/ui/clash-panel.ts`
- `src/bim/ui/federation-panel.ts`

**Verification:**
```bash
npm test
npm run build
```

**Acceptance:**
- User/model text is inserted through `textContent` or DOM helper.
- Intentional SVG/html rendering sites are explicit and documented.

---

## Phase 7 — Build chunk strategy (P2)

**Goal:** уменьшить шум build warnings и подготовить lazy loading тяжёлых BIM-зависимостей.

**Status:** done.

**Files:**
- Modify: `vite.config.*` if exists, otherwise create `vite.config.ts`
- Optional modify: `src/bim/app/bootstrap.ts`
- Optional create: lazy route modules

### Task 7.1: Inspect current Vite config and bundle shape

**Objective:** понять, есть ли existing manual chunks and chunk warning config.

**Verification:**
```bash
npm run build
```

**Acceptance:**
- Зафиксированы текущие chunk names/sizes.

### Task 7.2: Add conservative manualChunks

**Objective:** отделить vendor chunks without changing runtime behavior.

**Suggested chunks:**
- `vendor-three`
- `vendor-thatopen`
- `vendor-web-ifc`
- `vendor-camera-controls`

**Verification:**
```bash
npm run build
```

**Acceptance:**
- Build passes.
- Warnings reduced or explicitly accepted as non-blocking if libraries remain naturally large.

### Task 7.3: Evaluate lazy loading only after controller split

**Objective:** не делать lazy loading до стабилизации controllers.

**Acceptance:**
- Decision documented: implement lazy loading or defer.
- No speculative route rewrites.

---

## 3. Verification matrix

Run after every phase:

```bash
git status --short
npx tsc --noEmit
npm test
git diff --check
```

Run after UI/CSS/controller phases:

```bash
npm run build
```

Run after federation/model changes:

```bash
node --test tests/federation/*.test.mjs tests/federation-view.test.mjs
node --test tests/performance/*.test.mjs tests/storage/model-cache.test.mjs
```

Run after drawings changes:

```bash
node --test tests/drawing-annotations.test.mjs tests/drawing-selection-sync.test.mjs tests/drawing-persistence-specs.test.mjs tests/sheet-board.test.mjs tests/spec-layout.test.mjs tests/spec-placement.test.mjs
```

Run after export/IFC override changes:

```bash
node --test tests/ifc-overrides/*.test.mjs tests/export/*.test.mjs tests/exporters-elements.test.mjs
```

Final gate:

```bash
npm test
npm run test:performance
npm run build
git diff --check
```

---

## 4. Commit plan

Recommended commits:

1. `test: stabilize full node test gate`
2. `refactor: split bim app bootstrap wiring`
3. `refactor: split drawings controller responsibilities`
4. `refactor: split model loading and federation actions`
5. `test: add large ifc routing seam coverage`
6. `refactor: split global styles by domain`
7. `refactor: standardize storage and ui rendering helpers`
8. `build: tune vendor chunk strategy`
9. `docs: record refactor stabilization status`

Each commit must pass at least:
```bash
npx tsc --noEmit
git diff --check
```

Prefer full gate before pushing:
```bash
npm test
npm run build
```

---

## 5. Rollback plan

For every phase:

1. Keep phase changes in a dedicated commit.
2. If verification fails and fix is not obvious, revert only the current phase commit:
   ```bash
   git revert <commit>
   ```
3. Do not continue to the next phase with a broken `npm test` or `npm run build` unless the breakage is explicitly documented and approved.
4. For CSS split, rollback is simple: revert CSS split commit; no business state migration involved.
5. For storage adapter, verify payload compatibility before commit; if payload differs, revert immediately.

---

## 6. Open decisions before implementation

These should be confirmed only if implementation reaches the relevant phase:

1. Should `npm test` include backend Python tests too, or only frontend Node tests?
2. Should Phase 7 only tune chunks, or also implement real route-level lazy loading?
3. Should Sprint 16 backend conversion be implemented immediately after Phase 4, or remain a separate sprint?
4. Should refactor commits be pushed to `dev` after each phase or only after the full plan passes?

Default assumption if not clarified: local-only implementation, no push/deploy/merge, frontend Node tests in `npm test`, backend tests separate.
