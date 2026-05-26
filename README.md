# IFC WASM Viewer

Клиентский IFC viewer на ThatOpen Engine. Backend не используется: IFC читается через `web-ifc` WASM в браузере, затем конвертируется в Fragments и отображается в Three.js-сцене.

## Запуск

Требования: Node.js 18+ и npm.

1. Перейти в папку проекта:

```bash
cd "IFC wasm"
```

2. Установить зависимости:

```bash
npm install
```

Во время установки скрипт `scripts/copy-web-ifc.mjs` копирует WASM-файлы `web-ifc` в `public/web-ifc`.

3. Запустить dev server:

```bash
npm run dev
```

4. Открыть URL из консоли Vite, обычно:

```text
http://127.0.0.1:5173/
```

## Запуск из виртуальной среды

На Windows можно запустить проект одной командой через локальную `.venv`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-venv.ps1
```

Скрипт делает следующее:

- создает `.venv`, если ее еще нет;
- добавляет `.venv\Scripts` в `PATH` текущего процесса;
- устанавливает npm-зависимости, если нет `node_modules`;
- копирует WASM-файлы `web-ifc` в `public/web-ifc`;
- запускает Vite dev server.

Важно: viewer остается frontend-приложением. Виртуальная среда нужна только для изолированного запуска команд; IFC по-прежнему обрабатывается в браузере через WASM.

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
- 3D-навигация, grid, view cube, fit-to-model;
- выбор элементов, просмотр атрибутов и property sets;
- скрытие, изоляция и возврат видимости;
- экспорт загруженных моделей в `.frag`.
