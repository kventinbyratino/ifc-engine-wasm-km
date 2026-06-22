# IFC Engine WASM KM — Roadmap

Дата: 2026-06-22  
Статус: отдельный roadmap для КМ-профиля после аудита `https://dev.lab-tim.ru/blue/km/`.

## 0. Текущий статус

- `https://dev.lab-tim.ru/blue/km/` открывается.
- Профиль страницы: `IFC Engine KM`.
- GitHub-ссылка ведёт в репозиторий `kventinbyratino/ifc-engine-wasm-km`.
- Vite-модули на dev-URL отдаются с корректным MIME:
  - `/blue/km/src/main.ts` → `text/javascript`;
  - `/blue/km/@vite/client` → `text/javascript`;
  - `/blue/km/web-ifc/web-ifc.wasm` → `application/wasm`.
- Backend API доступен через общий путь `/ifc-engine-wasm/api`.
- TypeScript gate проходит: `npx tsc --noEmit`.
- Тестовый gate проходит: `npm test` — 108/108.

## 1. Главный риск

КМ сейчас работает как dev-запуск Vite, а не как закреплённый production-сервис:

- nginx проксирует `/blue/km/` на локальный Vite dev-server;
- процесс запущен как `npm run dev:node`;
- запуск не закреплён отдельным `systemd`-сервисом;
- после рестарта машины или процесса КМ может отвалиться.

Приоритет №1 — перевести КМ в устойчивый режим: production static deploy или постоянный сервис.

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

### Phase 1 — Stabilize deploy/runtime (P0)

**Goal:** КМ не должен зависеть от ручного Vite dev-process.

**Варианты:**

1. Preferred: починить `vite build` и отдавать `dist` через nginx.
2. Temporary: оформить Vite dev-server как отдельный `systemd`-сервис.

**Acceptance:**

- `/blue/km/` переживает рестарт процесса/машины;
- assets не отдаются как `text/html`;
- WASM отдаётся как `application/wasm`;
- есть понятная команда restart/status для КМ.

### Phase 2 — Normalize KM config (P0)

**Goal:** убрать разбросанные вычисления URL и root-path.

**Сделать:**

- ввести единый config для:
  - `APP_BASE`;
  - `API_BASE`;
  - `WEB_IFC_BASE`;
  - profile id/name;
- заменить hardcoded `/ifc-engine-wasm/...` там, где это относится к КМ runtime;
- явно зафиксировать, остаётся ли backend общий или появляется `/blue/km/api`.

**Acceptance:**

- deep link `/blue/km/` работает;
- IFC/WASM грузится с корректного base path;
- нет случайного перехода в BIM root.

### Phase 3 — Make tests repo-local (P0)

**Goal:** зелёный тестовый gate должен проверять именно `ifc-engine-wasm-km`.

**Сделать:**

- убрать абсолютные ссылки на `/home/maks/projects/IFC_engine_wasm`;
- читать fixtures и entrypoints из текущего repo;
- добавить KM-specific проверки:
  - `/blue/km/` выбирает `profile-km`;
  - BIM-кнопка/экран выбора не появляется в KM shell;
  - module scripts не получают `text/html`;
  - `web-ifc.wasm` отдаётся как `application/wasm`.

**Acceptance:**

- `npm test` проходит;
- `npx tsc --noEmit` проходит;
- тесты не зависят от sibling repo.

### Phase 4 — Remove BIM-only UI from KM (P1)

**Goal:** КМ-профиль становится чистым продуктовым shell без BIM-веток.

**Сделать:**

- удалить/изолировать BIM route и profile switcher;
- убрать BIM-only panels из KM entrypoint;
- удалить неиспользуемые wiring hooks;
- сохранить текущий UX просмотра IFC/FRAG.

**Acceptance:**

- КМ открывается сразу как KM viewer;
- нет BIM-кнопок и BIM-экранов;
- загрузка IFC/FRAG работает;
- визуально нет лишних BIM-секций.

### Phase 5 — Split KM viewer core (P1)

**Goal:** отделить ядро viewer от приложения и UI.

**Предлагаемая структура:**

```text
src/km/
  app/
  config/
  viewer/
  model-library/
  ui/
  services/
```

**Сделать:**

- вынести инициализацию viewer;
- вынести загрузку IFC/FRAG;
- вынести persistence/model-library;
- оставить entrypoint тонким.

**Acceptance:**

- entrypoint только собирает приложение;
- viewer core можно тестировать отдельно;
- BIM-код не импортируется в KM bundle без необходимости.

### Phase 6 — Production build optimization (P1)

**Goal:** `vite build` должен стабильно завершаться.

**Сделать:**

- найти, где build зависает на transform;
- проверить тяжёлые импорты ThatOpen/web-ifc;
- разнести heavy modules через lazy imports;
- настроить chunk strategy;
- проверить memory usage build-процесса.

**Acceptance:**

- `npm run build` проходит в разумное время;
- `dist` создаётся стабильно;
- nginx может отдавать production artifact.

### Phase 7 — Clean legacy files and docs (P2)

**Goal:** репозиторий выглядит как отдельный КМ-проект.

**Сделать:**

- удалить stale BIM docs/plans или перенести их в archive;
- обновить README под КМ;
- оставить один основной roadmap KM;
- добавить короткий runbook для deploy/restart/verify.

**Acceptance:**

- новый разработчик понимает, что это KM repo;
- README не обещает BIM-функции как основные;
- roadmap и deploy-инструкция не конфликтуют.

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
