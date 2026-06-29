# KM Minimal Viewer Plan

## Goal

Reduce the KM viewer to a single minimal product surface under `/blue/km/`:

1. Load IFC.
2. Convert IFC to `.frag`.
3. Delete/forget the source IFC after conversion.
4. View the `.frag` model.
5. Cache and reopen `.frag` models.
6. Search intelligently across the model.
7. Create a public link to the server-stored `.frag` model.

The refactor must preserve the working viewer path while removing unrelated BIM/workbench functionality.

## Product scope to keep

### Route

- Keep one public route: `/blue/km/`.
- Remove or disable profile selection and other viewer profiles/routes from the KM product flow.

### Model loading

Keep:

- local IFC file selection;
- IFC to `.frag` conversion;
- `.frag` model loading;
- `.frag` browser cache/storage;
- repeated reopening from cached `.frag`;
- loading a `.frag` from a public link.

Do not keep IFC as a stored artifact after conversion.

### Storage rule

- The source `.ifc` file is an input only.
- After successful conversion, the app keeps/stores only `.frag`.
- Public links point to server-stored `.frag` files.
- IFC files must not be uploaded or persisted as part of the sharing flow.

### UI

Initial screen:

```text
[Загрузить IFC]
```

After model load:

```text
Домой | Поиск | Создать ссылку
Viewer
```

Button behavior:

- `Домой` centers/fits the camera to the whole loaded model. It does not navigate away and does not reset/delete the model.
- `Поиск` opens a minimal search affordance without extra filter panels.
- `Создать ссылку` uploads/saves the current `.frag` to the server and returns a public URL.

### Smart search

The search should be one minimal user-facing feature, not a complex panel system.

It should search across:

- element name;
- element type/class;
- GlobalId;
- all available properties;
- property values;
- natural-language-like requests.

Example queries:

```text
стены
двери на 2 этаже
элемент с GlobalId ...
бетонные колонны
помещения больше 20 м2
```

First implementation should prefer local/rule-based interpretation over external LLM dependencies unless a later decision explicitly approves an external AI service.

### Public `.frag` links

Target behavior:

```text
POST /blue/km/api/fragments
→ accepts the current .frag
→ stores it on the server
→ returns { modelId, publicUrl }

GET /blue/km/fragments/:modelId.frag
→ returns the .frag publicly
```

Preferred public URL shape:

```text
https://dev.lab-tim.ru/blue/km/?model=<id>
```

The link is public for anyone who has the URL.

## Functionality to remove

Remove from the KM product flow and then delete dead code when safe:

- BIM profile and profile picker;
- drawings;
- sheets;
- federation;
- clashes;
- issues;
- checks;
- exports not required for `.frag` sharing;
- help pages/panels;
- extra sidebars/toolbars/buttons unrelated to load/view/search/share.

## Proposed execution phases

### Phase 0 — Protect current work

Current local state has an HMR/WebSocket dev-proxy patch in:

- `vite.config.ts`
- `scripts/dev-server.mjs`

Before large refactoring, commit or otherwise isolate that patch so the minimal-viewer refactor does not mix infrastructure fixes with product deletion.

Verification:

```bash
npm test
git diff --check
```

### Phase 1 — Commit this minimal viewer plan

Add this plan as the canonical scope for the KM minimal-viewer refactor.

Verification:

```bash
git diff --check
```

### Phase 2 — Collapse to one route/viewer

Objective:

- keep `/blue/km/` as the only KM viewer entry;
- remove profile selection from the user flow;
- keep model loading and viewer startup intact.

Acceptance:

- `/blue/km/` opens the minimal KM viewer;
- no profile picker appears;
- removed routes do not remain reachable from the UI;
- tests pass.

Verification:

```bash
npm test
git diff --check
```

Browser verification:

- open `/blue/km/`;
- confirm only the minimal load screen appears;
- check browser console for errors.

### Phase 3 — Minimal UI shell

Objective:

- replace the current multi-panel UI with the minimal shell;
- keep only `Загрузить IFC`, `Домой`, `Поиск`, `Создать ссылку`.

Acceptance:

- initial state shows only upload action;
- after model load, only the three actions and viewer are visible;
- `Домой` fits the camera to the whole model;
- no deleted feature buttons remain visible.

Verification:

```bash
npm test
git diff --check
```

Browser verification:

- screenshot/visual check;
- console check;
- click each remaining action.

### Phase 4 — IFC to `.frag` only pipeline

Objective:

- keep IFC as conversion input only;
- store/cache only `.frag`;
- support repeated `.frag` reopening.

Acceptance:

- user can load IFC;
- model appears after conversion;
- source IFC is not persisted after conversion;
- `.frag` is cached;
- page reload can reopen cached `.frag`.

Verification:

```bash
npm test
git diff --check
```

Manual scenario:

1. Load IFC.
2. Confirm model renders.
3. Reload page.
4. Reopen the cached `.frag`.

### Phase 5 — Server-backed public `.frag` links

Objective:

- implement server storage for `.frag` files;
- implement `Создать ссылку`;
- support loading model by URL param.

Acceptance:

- `Создать ссылку` uploads/saves only `.frag`;
- returned URL is public;
- a fresh browser context can open the public link and load the model;
- IFC is never uploaded for this flow.

Suggested endpoint shape:

```text
POST /blue/km/api/fragments
GET /blue/km/fragments/:modelId.frag
```

Verification:

```bash
npm test
git diff --check
```

Browser/manual verification:

1. Load IFC.
2. Convert to `.frag`.
3. Click `Создать ссылку`.
4. Open returned URL in a fresh context.
5. Confirm model loads.

### Phase 6 — Smart search only

Objective:

- keep one minimal search interface;
- index all useful model properties;
- support natural-language-like queries with local/rule-based parsing first.

Acceptance:

- search works by name/type/GlobalId/properties/values;
- simple natural-language queries return useful results;
- selecting a result highlights/focuses the matching element;
- no old complex panels are required.

Verification:

```bash
npm test
git diff --check
```

Focused scenarios:

```text
стены
двери на 2 этаже
бетонные колонны
GlobalId <known-id>
```

### Phase 7 — Delete dead modules and CSS

Objective:

Remove code that is no longer reachable or needed after the minimal flow works.

Candidates:

- drawings modules/tests/styles;
- sheets modules/tests/styles;
- federation modules/tests/styles;
- issues modules/tests/styles;
- checks modules/tests/styles;
- clash modules/tests/styles;
- help modules/tests/styles;
- export modules not needed for `.frag` sharing;
- profile-selection code;
- stale docs that describe removed UI as current behavior.

Acceptance:

- imports do not reference removed modules;
- UI does not expose removed features;
- tests are updated to match the minimal product;
- no dead feature labels remain in active UI/CSS.

Verification:

```bash
npm test
git diff --check
```

Search checks:

```text
drawings
sheets
federation
issues
checks
clash
help
```

Any remaining occurrence must be either historical documentation or intentionally retained low-level code.

### Phase 8 — Build timeout investigation

Current known blocker:

```text
npm run build
vite build
transforming...
timeout after 600s
```

After deleting unused feature areas, rerun:

```bash
npm run build
```

If it still hangs, handle it as a separate `fix/vite-build-timeout` task.

Acceptance:

- `npm run build` completes successfully; or
- the remaining blocker is documented with the exact module/import responsible.

## Final acceptance criteria

The refactor is complete when:

1. `/blue/km/` opens only the minimal viewer.
2. IFC upload works.
3. IFC converts to `.frag`.
4. IFC is deleted/forgotten after conversion.
5. `.frag` is cached and can be reopened.
6. `Домой` centers/fits the camera to the whole model.
7. `Поиск` searches across the whole model and supports simple natural-language-like queries.
8. `Создать ссылку` stores `.frag` on the server and returns a public URL.
9. Public links open the `.frag` model for anyone with the URL.
10. Removed features are not visible and not active in the KM UI.
11. Tests pass with `npm test`.
12. `git diff --check` is clean.
13. `npm run build` passes, or the build timeout is isolated as a separate blocker.

## Working rules

- Do not change production without explicit approval.
- Prefer one phase per branch/commit.
- Keep behavior changes small and verified.
- Do not mix infrastructure fixes, UI deletion, backend storage, and search changes in one commit.
- Preserve the current working `/blue/km/` route while refactoring.
