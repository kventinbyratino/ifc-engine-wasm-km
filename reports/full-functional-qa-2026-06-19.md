# Full functional QA report — 2026-06-19

Time: 2026-06-19T20:11:06+03:00

## Scope

Targeted build and route:

- Repository: `/home/maks/projects/IFC_engine_wasm`
- Branch: `feature/help-navigation-scenarios`
- Commit under test: `b8e7ec8`
- Local preview: `http://127.0.0.1:4173/ifc-engine-wasm/bim/?v=b8e7ec8`
- Dev route checked: `https://dev.lab-tim.ru/ifc-engine-wasm/bim/?v=b8e7ec8`
- Example IFC used for browser QA: `Renga_House.ifc · 1.3 MB`

## Executive summary

Status: **mostly PASS, with 1 functional bug found and 2 product/QA limitations**.

- Automated build/test gates: PASS.
- Deployed dev asset/route health: PASS.
- Example IFC load/conversion: PASS.
- Data Browser/indexing: PASS on example model, 185 elements indexed.
- Federation panel: PASS after element index is ready, 1 model / 185 elements shown.
- Checks: PASS, model health produced 209 issues.
- Issues/BCF panel: PASS for panel/store baseline; issue creation from check result needs deeper manual retest.
- Clash panel: PASS for selectors and run path; example model produced 0 clashes.
- Drawings/sheets/spec/exports: PASS for SVG/PNG/DXF; PDF path is popup/print-window dependent and was blocked by browser automation.
- Help: PASS, 17 sections and navigation previously covered and re-opened manually.
- Context menu: covered by automated tests; manual 3D selection/right-click was not reliably reproducible in the headless QA browser.

## Automated gates

Commands run from `/home/maks/projects/IFC_engine_wasm`:

- `npm run build` — PASS.
  - `tsc --noEmit` passed.
  - `vite build` passed.
  - Note: Vite still warns about several chunks >500 KB; not a test failure.
- `npm test` — PASS, 104/104 tests.
- `npm run test:performance` — PASS, 13/13 tests.
- `npm run smoke:regression` — PASS, 12 dist assets checked.
- `node scripts/predeploy-check.mjs --dry-run` — PASS, prints release gate plan.
- `git diff --check` — PASS.
- Focused feature suite — PASS, 80/80 tests:
  - help page
  - context menu
  - selection
  - model index
  - federation
  - clash pipeline
  - drawings
  - sheets/specs
  - issues store
  - IFC overrides/export
  - IFC load strategy
  - performance/cache

Repository stayed clean after testing:

- `git status --short --branch` → `## feature/help-navigation-scenarios...origin/feature/help-navigation-scenarios`

## Deployment/HTTP checks

- `https://dev.lab-tim.ru/ifc-engine-wasm/bim/?v=b8e7ec8` — HTTP 200.
- Dev HTML asset points to `assets/index-SQL6MRH-.js`.
- `/ifc-engine-wasm/api/health` — HTTP 200, JSON `{"status":"ok"}`.
- Important note: root `/api/health` returns HTML app fallback, not health JSON. Correct scoped endpoint is `/ifc-engine-wasm/api/health`.

## Browser QA results

### 1. App start and example model load — PASS

Steps:

1. Opened BIM route in local preview.
2. Opened example model/library flow.
3. Loaded `Renga_House.ifc`.

Observed:

- Header status: `IFC загружен и преобразован · федерация сохранена`.
- Browser console: 0 JS errors.
- UI rendered 3D grid/model workspace without crash.

### 2. Federation panel — PASS, minor UX observation

Steps:

1. Loaded example model.
2. Opened `Федерация`.
3. Checked filters, model card, visibility/focus/isolate/delete/opacity controls.

Observed after indexing:

- `1 models · 1 visible · 185 elements · preset: Все модели`.
- Model card: `AR/KR · Renga House`, source `example · IFC`.
- Filters populated:
  - model
  - discipline `AR/KR`
  - storeys `1-й этаж`, `2-й этаж`, `Кровля`
  - IFC classes.

Minor observation:

- Immediately after model restore/load, federation briefly showed `0 elements / restoring`; after Data Browser indexing it updated to `185 elements`. This is acceptable if intended as lazy indexing, but UX could show `Индексация...` in the federation panel instead of `0 elements`.

### 3. Data Browser — PASS

Steps:

1. Opened `Данные`.
2. Waited for index.
3. Checked search/filter/table/export controls.

Observed:

- `185 из 185 элементов`.
- IFC class filters populated:
  - `IFCBEAM`, `IFCCOLUMN`, `IFCDOOR`, `IFCRAILING`, `IFCROOF`, `IFCSANITARYTERMINAL`, `IFCSLAB`, `IFCSPACE`, `IFCSTAIRFLIGHT`, `IFCWALL`, `IFCWINDOW`.
- Storey filters populated:
  - `1-й этаж`, `2-й этаж`, `Кровля`.
- Table rows include class/name/globalId/storey/psets.
- First rows are doors with valid GUIDs and pset count.

Limitation:

- Clicking a table row did not open the properties panel; this may be by design. User-facing route to properties is currently context menu / selected element.

### 4. Search button — FAIL / functional bug

Steps:

1. With model loaded, clicked floating `Поиск`.
2. Inspected `#searchPanel` state.

Expected:

- Search panel opens, input becomes visible/focused, user can type query.

Actual:

- `#searchPanel.hidden` stayed `true`.
- `display` stayed `none`.
- No visible input appeared.
- No console errors.

Root cause evidence from code:

- `src/bim/app/search-controller.ts` exposes `toggleSearchPanel()` / `expandSearchPanel()`.
- But `src/bim/app/ui-wiring.ts:247` binds floating search button to `search.searchItems()` instead of `search.toggleSearchPanel()`.

Impact:

- User cannot open search from the visible `Поиск` button unless another path focuses the hidden input.

Severity: **High UX / functional**.

### 5. Model Health checks — PASS

Steps:

1. Opened `Проверки`.
2. Ran `Проверить модель`.

Observed:

- Status: `Model Health: 209 проблем`.
- Summary: `209 проблем · critical 19 · warning 138 · info 52`.
- Rule settings visible and persisted UI ready:
  - 10/10 rules enabled.
  - Critical/warning/info rules displayed.
- Results show issue cards with `К элементу` and `Issue` actions.
- Browser console: 0 JS errors.

Browser automation note:

- Native browser click on `Проверить модель` timed out once, but JS click completed successfully and UI produced results. Treat as automation/large-DOM timing issue unless reproduced by a human.

### 6. Issues / BCF — PARTIAL PASS

Steps:

1. Opened `Замеч/BCF`.
2. Checked empty state and export controls.
3. Attempted issue creation from check result via `Issue` action.

Observed:

- Empty panel state works:
  - `0 issues · open 0 · review 0 · closed 0`.
  - `JSON`, `BCF JSON`, `Очистить` controls present.
- Automated issue store tests pass.

Limitation:

- In the browser QA session, clicking an `Issue` action inside the long model-health result list timed out and did not complete. Needs a focused retest after fixing/optimizing long-result interactions or using a stable selected element path.

### 7. Clash detection — PASS on example model

Steps:

1. Opened `Коллизии`.
2. Checked group selectors.
3. Ran `Найти коллизии`.

Observed:

- Selectors include model, IFC class, storey, discipline scopes.
- Federation summary: `185 elements · AR/KR`.
- Result status: `Clash detection: 0 найдено, 0 пар`.
- Browser console: 0 JS errors.

Note:

- Example model is a single small architecture model, so this does not validate cross-discipline real clash quality. Automated federation/clash tests cover cross-model behavior.

### 8. Drawings / DXF / sheets / specs — PASS except PDF popup limitation

Steps:

1. Opened `Чертежи`.
2. Generated plan from whole model.
3. Created sheet.
4. Added specification blocks.
5. Added annotation.
6. Exported SVG, PNG, PDF, DXF sheet.

Observed:

- Drawing generated: `Чертёж готов: 335 линий`.
- Panel summary: `1 черт. · 0 лист. · 335 линий · 0 анн.`.
- Sheet created: `Лист создан: A3`.
- Specification placed: `Спецификация размещена на листе: 3 блоков`.
- Annotation added: `Размер добавлена · всего 1`.
- SVG export: `SVG экспортирован: A3`.
- PNG export: `PNG экспортирован: A3`.
- DXF paper-space export: `DXF paper-space экспортирован: A3`.
- PDF path: `Браузер заблокировал окно PDF/print`.

Assessment:

- SVG/PNG/DXF flows pass.
- PDF uses browser popup/print window and was blocked in the automation browser. This is not necessarily a product bug, but it is a UX risk. Prefer direct Blob/download PDF generation if PDF export must be reliable.

### 9. Help — PASS

Steps:

1. Opened `Справка`.
2. Confirmed roadmap/user-scenario help page appears.

Observed:

- Help opens successfully.
- Previous dedicated report verified:
  - 17/17 sections.
  - 17/17 nav links.
  - 35/35 related links.
  - no console errors.

### 10. Context menu / properties — AUTOMATED PASS, manual partial

Automated coverage:

- `element context menu opens all selection actions and runs their callbacks` — PASS.
- `element context menu disables Properties when no element is selected` — PASS.

Manual browser limitation:

- Headless browser session could not reliably select a 3D object/right-click a real mesh to manually open the context menu.
- Data table row click did not open properties, and this appears to be outside the current intended properties entrypoint.

Assessment:

- Context menu contract is covered by tests.
- Full manual E2E still needs a real browser/human step: click 3D element → right click → `Свойства` → verify property/override panel.

## Findings

### F-01 — Floating `Поиск` button does not open search panel

Severity: **High**
Category: Functional / UX

Evidence:

- Browser state after clicking search:
  - `#searchPanel.hidden === true`
  - computed display `none`
  - no visible search input.
- Source binding:
  - `src/bim/app/ui-wiring.ts:247`: `searchBtn.onclick = () => void search.searchItems();`
  - Search controller has `toggleSearchPanel()` and `expandSearchPanel()`, but floating button does not use them.

Expected:

- Floating `Поиск` opens panel and focuses input.
- Search submit button inside panel runs `searchItems()`.

Actual:

- Floating `Поиск` tries to run search while input panel is hidden.

Suggested fix:

- Bind floating search button to `search.toggleSearchPanel()` or split controls:
  - outer/floating button → open panel;
  - arrow button inside panel → run `searchItems()`.

### F-02 — PDF export depends on popup/print window

Severity: **Medium / UX risk**
Category: Export / Browser compatibility

Evidence:

- Browser QA status: `Браузер заблокировал окно PDF/print`.

Expected:

- PDF export should reliably produce a downloadable file without requiring popup allowance.

Actual:

- In automation/headless browser, popup was blocked.

Suggested improvement:

- Generate/download PDF as Blob directly, or clearly explain popup permission requirement in UI.

### F-03 — Issue creation from long check result needs focused retest

Severity: **Medium / QA gap**
Category: Issues / Performance / Interaction

Evidence:

- Model-health check produced 209 result cards.
- Clicking `Issue` from the long list timed out in browser automation and did not visibly create an issue.
- Console remained clean.

Assessment:

- Not proven as a product bug yet; could be automation timing/large DOM.
- Needs focused E2E with a single selected element or a reduced test fixture.

## Coverage matrix

- Start/BIM profile: PASS — route opens, example model loads.
- IFC/FRAG load: PASS — example IFC conversion/load path works.
- Data Browser/table/index: PASS — 185/185 elements.
- Properties: automated PASS, manual partial.
- Search: FAIL — floating search button does not open panel.
- Checks/IDS/model health: PASS — 209 issues generated.
- Issues/BCF: partial PASS — store/panel/export controls present; create-from-check needs retest.
- Federation: PASS — model/discipline/storey/category filters populated.
- Clash: PASS — selectors/run path works, 0 clashes on example.
- Drawings/DXF: PASS — 335-line plan generated.
- Sheets/specifications: PASS — A3 sheet and 3 spec blocks.
- Annotations: PASS — one dimension annotation added.
- SVG/PNG/DXF export: PASS.
- PDF export: partial — blocked by popup/print window.
- Help/navigation: PASS.
- Progressive loading/LOD/cache: automated PASS.
- Large IFC/backend conversion: automated strategy PASS, not manually retested with a real large IFC.
- Deploy/smoke: PASS.

## Recommended next actions

1. Fix F-01 search button wiring first; it is a clear functional bug.
2. Add/adjust automated UI test for search panel opening.
3. Do a focused issue-creation E2E after F-01, ideally with a small selected-element fixture.
4. Decide whether PDF export via popup is acceptable; if not, move to direct Blob/download export.
5. For full production confidence, run one separate heavy QA pass with:
   - a large IFC;
   - two or more discipline models;
   - real cross-model clash set.
