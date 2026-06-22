# IFC KM Viewer

Клиентский IFC/BIM viewer на ThatOpen Engine с небольшим backend для библиотеки Fragments. IFC читается через `web-ifc` WASM в браузере, конвертируется в Fragments и отображается в Three.js-сцене; backend хранит уже сконвертированные `.frag` файлы и метаданные.

## Архитектура

- Frontend: TypeScript, Vite, Three.js, ThatOpen Components, `web-ifc` WASM.
- BIM profile: `/ifc-engine-wasm/bim/` — отдельный BIM Workbench-проект на текущем VM.
- KM/clean viewer: `/blue/km/` — отдельный KM viewer-проект на dev.lab-tim.
- Backend: FastAPI fragments API в `server/app/main.py`.

## Frontend запуск

Требования: Node.js 18+ и npm.

```bash
npm install
npm run dev
```

Во время установки скрипт `scripts/copy-web-ifc.mjs` копирует WASM-файлы `web-ifc` в `public/web-ifc`.

Обычный локальный URL Vite:

```text
http://127.0.0.1:5173/blue/km/
```

## Backend fragments API

Backend хранит сохранённые `.frag` файлы и SQLite-метаданные.

Endpoints:

- `GET /api/health` — health check.
- `GET /api/fragments` — список сохранённых fragments.
- `POST /api/fragments` — загрузка `.frag`, требует admin token.
- `GET /api/fragments/{fragment_id}/download` — скачивание `.frag`.
- `DELETE /api/fragments/{fragment_id}` — удаление `.frag`, требует admin token.

Локальный запуск backend:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r server/requirements.txt
PYTHONPATH=server .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Environment variables

- `IFC_FRAGMENTS_DB` — путь к SQLite DB, default `./data/fragments.sqlite3`.
- `IFC_FRAGMENTS_DIR` — директория хранения `.frag`, default `./data/fragments`.
- `IFC_MAX_FRAGMENT_BYTES` — лимит upload, default `104857600` bytes.
- `IFC_ALLOWED_ORIGINS` — comma-separated CORS origins. Если не задано, разрешены только локальные Vite origins: `http://127.0.0.1:5173`, `http://localhost:5173`.
- `IFC_ADMIN_TOKEN` — Bearer token для mutation endpoints (`POST`, `DELETE`). В deployment должен быть задан обязательно.

Пример dev deployment env:

```bash
IFC_ALLOWED_ORIGINS=https://dev.lab-tim.ru
IFC_ADMIN_TOKEN=[REDACTED]
```

Mutation requests must include an `Authorization` Bearer header with the deployment admin token. Do not commit real tokens or bake them into the frontend bundle.

## Deployment security notes

Минимальная nginx защита для fragments API должна ограничивать частоту mutation/upload запросов:

```nginx
limit_req_zone $binary_remote_addr zone=ifc_fragments_api:10m rate=5r/m;

location /ifc-engine-wasm/api/fragments {
    limit_req zone=ifc_fragments_api burst=10 nodelay;
    proxy_pass http://127.0.0.1:8000/api/fragments;
}
```

Обязательные deployment правила:

- не использовать wildcard CORS для dev/prod;
- задать `IFC_ADMIN_TOKEN` в environment backend-сервиса;
- не хранить token в frontend bundle;
- после изменения nginx проверять `nginx -t` и reload только при успешной проверке.

## Проверки

Frontend:

```bash
npx tsc --noEmit
npm run build
```

Backend:

```bash
PYTHONPATH=server .venv/bin/python -m pytest -q server/tests
```

Whitespace/diff:

```bash
git diff --check
```

## Production-проверка

Собрать статический frontend:

```bash
npm run build
```

Локально проверить production-сборку:

```bash
npm run preview
```

## Если WASM не найден

Повторно скопировать WASM можно так:

```bash
node scripts/copy-web-ifc.mjs
```

Файлы должны появиться в `public/web-ifc`: `web-ifc.wasm`, `web-ifc-mt.wasm`, `web-ifc-node.wasm`.

## Возможности

- загрузка `.ifc` и `.frag` через File API;
- конвертация IFC -> Fragments на клиенте;
- сохранение и открытие `.frag` через backend fragments API;
- Данные модели: таблица элементов, фильтры, экспорт CSV/JSON;
- проверки модели/IDS, замечания и BCF-like export;
- federation/clash detection;
- drawings, sheets, DXF/PDF/PNG export, спецификации CSV;
- 3D-навигация, grid, view cube, fit-to-model;
- выбор элементов, просмотр атрибутов и property sets;
- скрытие, изоляция и возврат видимости.

## Known MVP limitations

- frontend bundle большой из-за BIM/ThatOpen/Three.js зависимостей;
- clash detection и bbox workflows требуют дальнейшей оптимизации для крупных моделей;
- полноценный BCF server/workflow пока не реализован;
- frontend unit/e2e тесты ещё не покрывают все BIM сценарии.
