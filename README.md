# IFC KM Viewer

Минимальный KM viewer для `dev.lab-tim.ru/blue/km/`.

## Что это

- фронтенд на TypeScript + Vite + Three.js + ThatOpen;
- один публичный KM route: `/blue/km/`;
- загрузка `.ifc`, конвертация в Fragments, просмотр модели, поиск и ссылка на сохранённый `.frag`;
- backend fragments API хранит `.frag` и метаданные.

## Основные маршруты

- `/blue/km/` — KM viewer;
- `/blue/km/viewer/` — viewer route для прямых ссылок;
- `/blue/km/fragments/:modelId.frag` — публичная отдача сохранённого `.frag`;
- `/ifc-engine-wasm/api` — общий backend API.

## Запуск фронтенда

Требования: Node.js 18+ и npm.

```bash
npm install
npm run dev
```

Локальный URL Vite:

```text
http://127.0.0.1:5173/blue/km/
```

## Backend fragments API

Backend хранит сохранённые `.frag` файлы и SQLite-метаданные.

Endpoints:

- `GET /api/health` — health check;
- `GET /api/fragments` — список сохранённых fragments;
- `POST /api/fragments` — загрузка `.frag`, требует admin token;
- `GET /api/fragments/{fragment_id}/download` — скачивание `.frag`;
- `DELETE /api/fragments/{fragment_id}` — удаление `.frag`, требует admin token.

Локальный запуск backend:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r server/requirements.txt
PYTHONPATH=server .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Environment variables

- `IFC_FRAGMENTS_DB` — путь к SQLite DB, default `./data/fragments.sqlite3`;
- `IFC_FRAGMENTS_DIR` — директория хранения `.frag`, default `./data/fragments`;
- `IFC_MAX_FRAGMENT_BYTES` — лимит upload, default `104857600` bytes;
- `IFC_ALLOWED_ORIGINS` — comma-separated CORS origins. Если не задано, разрешены только локальные Vite origins: `http://127.0.0.1:5173`, `http://localhost:5173`;
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
npm test
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

```bash
npm run build
npm run preview
npm run smoke:deploy
```

## Если WASM не найден

```bash
node scripts/copy-web-ifc.mjs
```

Файлы должны появиться в `public/web-ifc`: `web-ifc.wasm`, `web-ifc-mt.wasm`, `web-ifc-node.wasm`.

## Состояние продукта

- KM roadmap: `docs/plans/km-roadmap.md`;
- KM minimal viewer plan: `docs/plans/km-minimal-viewer-plan.md`;
- runtime runbook: `docs/deploy/km-runtime.md`;
- legacy plans are archived under `docs/archive/plans/`.
