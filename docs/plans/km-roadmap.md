# IFC Engine WASM KM — Roadmap

Дата: 2026-06-22  
Статус: отдельный roadmap для КМ-профиля после аудита `https://dev.lab-tim.ru/blue/km/`.

## 0. Текущий статус

- `https://dev.lab-tim.ru/blue/km/` открывается.
- Профиль страницы: `IFC Engine KM`.
- GitHub-ссылка ведёт в репозиторий `kventinbyratino/ifc-engine-wasm-km`.
- `ifc-engine-wasm-km.service` поднят и держит `/blue/km/` как systemd-managed runtime на `127.0.0.1:5181`.
- Vite-модули на dev-URL отдаются с корректным MIME:
  - `/blue/km/src/main.ts` → `text/javascript`;
  - `/blue/km/@vite/client` → `text/javascript`;
  - `/blue/km/web-ifc/web-ifc.wasm` → `application/wasm`.
- Backend API доступен через общий путь `/ifc-engine-wasm/api`.
- TypeScript gate проходит: `npx tsc --noEmit`.
- Тестовый gate проходит: `npm test` — 117/117.

## 1. Главный риск

КМ сейчас работает как Vite runtime, но уже закреплён как systemd-сервис:

- nginx проксирует `/blue/km/` на локальный Vite server;
- процесс запущен через `ifc-engine-wasm-km.service`;
- запуск не зависит от ручного терминала;
- после рестарта машины или процесса КМ поднимается автоматически.

Приоритет №1 дальше — нормализовать base path и runtime config (Phase 2).

## 2. Архитектурные проблемы

### 2.1. КМ ещё слишком связан с BIM

В кодовой базе остались BIM-слои, которые для КМ являются лишним весом и источником регрессий:

- BIM profile/route;
- drawings;
- checks;
- issues;
- clash;
- federation;
- BIM-specific UI и контроллеры.

### 2.2. Общий API привязан к старому пути

Текущий API base использует общий путь:

```ts
/ifc-engine-wasm/api
```

Это рабочее состояние, но КМ не является автономным приложением. Нужно явно решить: КМ остаётся клиентом общего backend API или получает собственный namespace.

### 2.3. Тесты частично смотрят в исходный BIM-проект

Часть тестов использует абсолютные пути к `/home/maks/projects/IFC_engine_wasm`, поэтому зелёный `npm test` не полностью доказывает автономность `ifc-engine-wasm-km`.

Нужно перевести тесты на текущий репозиторий.

### 2.4. Production build не подтверждён

- `tsc` проходит.
- `vite build` ранее не завершился в лимит 600 секунд на `transforming...`.
- Также наблюдался `Killed 137`.

До исправления build pipeline КМ нельзя считать готовым к статическому production deploy.

### 2.5. Остались старые root-пути

В коде ещё встречаются пути вида `/ifc-engine-wasm/...`. Особенно рискованны места, где рассчитывается путь к `web-ifc`/WASM-ресурсам: под `/blue/km/` они могут увести загрузку не туда.

## 3. Целевая архитектура КМ

КМ должен стать отдельным минимальным IFC/Fragments viewer без BIM-избыточности.

Оставить:

- загрузку IFC;
- загрузку/сохранение fragments;
- базовый просмотр модели;
- дерево/список моделей, если нужно для КМ-сценария;
- библиотеку моделей;
- минимальный поиск/выделение, если используется в КМ.

Убрать или вынести из КМ:

- BIM route и экран выбора BIM/КМ;
- drawings;
- checks;
- issues;
- clash;
- federation;
- BIM-specific panels;
- неиспользуемые стили и контроллеры.

## 4. Execution roadmap

### Phase 1 — Stabilize deploy/runtime (P0) — DONE

**Goal:** КМ не должен зависеть от ручного Vite dev-process.

**What landed:**

- `ifc-engine-wasm-km.service` now keeps the KM runtime up on `127.0.0.1:5181`.
- nginx still serves `/blue/km/` through the same public route.
- `vite build` now passes, so the runtime can be restarted and verified through the systemd unit.

**Acceptance:**

- `/blue/km/` переживает рестарт процесса/машины; ✅
- assets не отдаются как `text/html`; ✅
- WASM отдаётся как `application/wasm`; ✅
- есть понятная команда restart/status для КМ; ✅

### Phase 2 — Normalize KM config (P0) — DONE

**Goal:** убрать разбросанные вычисления URL и root-path.

**What landed:**

- KM runtime bases are centralized in `src/km/config/index.ts`.
- `APP_BASE`, `API_BASE`, `WEB_IFC_BASE`, profile names, and share paths are exported from one place.
- Share links now use explicit KM and BIM routes instead of constructing a mixed path.
- The backend decision is fixed: KM keeps using the shared `/ifc-engine-wasm/api` namespace.

**Acceptance:**

- deep link `/blue/km/` works; ✅
- IFC/WASM loads from the correct base path; ✅
- no accidental transition into the BIM root; ✅

### Phase 3 — Make tests repo-local (P0) — DONE

**Goal:** зелёный тестовый gate должен проверять именно `ifc-engine-wasm-km`.

**What landed:**

- тесты читают fixtures и entrypoints из текущего repo;
- legacy sibling-repo path `/home/maks/projects/IFC_engine_wasm` больше не нужен для загрузки fixtures/entrypoints; в тестах он остаётся только как регрессионная строка-проверка на отсутствие старого пути;
- добавлены KM-specific проверки:
  - `/blue/km/` выбирает `profile-km`;
  - BIM-кнопка/экран выбора не появляется в KM shell;
  - module scripts не получают `text/html`;
  - `web-ifc.wasm` отдаётся как `application/wasm`.

**Acceptance:**

- `npm test` проходит;
- `npx tsc --noEmit` проходит;
- тесты не зависят от sibling repo.

### Phase 4 — Remove BIM-only UI from KM (P1) — DONE

**Goal:** КМ-профиль становится чистым продуктовым shell без BIM-веток.

**What landed:**

- KM route now strips the profile picker and BIM stub from the DOM on the KM shell.
- BIM route logic remains available for direct BIM navigation.
- текущий UX просмотра IFC/FRAG сохранён.

**Acceptance:**

- КМ открывается сразу как KM viewer; ✅
- нет BIM-кнопок и BIM-экранов в KM shell; ✅
- загрузка IFC/FRAG работает; ✅
- визуально нет лишних BIM-секций; ✅

### Phase 5 — Split KM viewer core (P1) — DONE

**Goal:** отделить ядро viewer от приложения и UI.

**What landed:**

- `src/km/viewer/core.ts` теперь содержит KM-specific viewer façade, а не только прямой re-export.
- `src/km/viewer/loaders.ts` выносит binding загрузчиков IFC/FRAG в отдельный testable helper.
- Добавлен `createKmViewerCore()` для сборки viewer + bound loader seams.
- KM entrypoint по-прежнему тонкий и не знает деталей viewer/loaders.

**Acceptance:**

- entrypoint только собирает приложение; ✅
- viewer core можно тестировать отдельно; ✅
- BIM-код не импортируется в KM bundle без необходимости; ✅

### Phase 6 — Production build optimization (P1) — DONE

**Goal:** `vite build` должен стабильно завершаться.

**What landed:**

- production build now consistently passes on this repo;
- heavy KM vendor dependencies are isolated through explicit Rollup manual chunks;
- build output is stable enough for deployment/restart verification.

**Acceptance:**

- `npm run build` проходит в разумное время; ✅
- `dist` создаётся стабильно; ✅
- nginx может отдавать production artifact; ✅

### Phase 7 — Clean legacy files and docs (P2) — DONE

**Goal:** репозиторий выглядит как отдельный КМ-проект.

**What landed:**

- legacy plans moved under `docs/archive/plans/`;
- README rewritten to describe KM as the primary product surface;
- runtime/deploy verification now points to `docs/deploy/km-runtime.md` as the runbook.

**Acceptance:**

- новый разработчик понимает, что это KM repo; ✅
- README не обещает BIM-функции как основные; ✅
- roadmap и deploy-инструкция не конфликтуют; ✅

## 5. Минимальный следующий спринт

Рекомендуемый Sprint 1:

1. Починить или временно закрепить runtime `/blue/km/`.
2. Зафиксировать `APP_BASE/API_BASE/WEB_IFC_BASE`.
3. Убрать absolute test dependency на `/home/maks/projects/IFC_engine_wasm`.
4. Запустить:
   ```bash
   npx tsc --noEmit
   npm test
   npm run build
   ```
5. Если `npm run build` всё ещё падает/висит — оформить отдельный blocker с логом и memory profile.

## 6. Definition of Done для всего roadmap

- `/blue/km/` работает без ручного dev-server.
- КМ не показывает BIM-route/profile switcher.
- В KM bundle нет ненужных BIM-only контроллеров.
- Все runtime base paths задаются через config.
- Тесты repo-local и проходят.
- `tsc`, `npm test`, `npm run build` проходят.
- README и deploy/runbook описывают именно KM.
