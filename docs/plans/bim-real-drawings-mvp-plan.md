# BIM Real Drawings MVP Implementation Plan

> **For Hermes:** Implement directly in this session with project-local checks; no external deploy without explicit approval.

**Goal:** Replace the remaining drawing MVP gaps with a usable ThatOpen-native drawing workflow: real technical drawings, drawing viewports on sheets, interactive annotation placement, local persistence, and export continuity.

**Architecture:** Keep the current BIM Workbench UI, but route annotations through ThatOpen `TechnicalDrawings.use(...)` systems (`LinearAnnotations`, `LeaderAnnotations`, `CalloutAnnotations`) instead of custom detached THREE annotation stubs. Persist lightweight drawing metadata and native annotation data in `localStorage`; restore by regenerating projections for loaded IFC items and replaying annotation data into native systems.

**Tech Stack:** TypeScript, Vite, Three.js, `@thatopen/components` 3.4.x TechnicalDrawings/DrawingViewports/DxfManager.

---

## Task 1: Native drawing records and viewports

**Objective:** Ensure every generated drawing has a native `DrawingViewport` and serializable metadata.

**Files:**
- Modify: `src/bim/drawings/drawings-panel.ts`
- Modify: `src/bim/sheets/sheet-types.ts`
- Modify: `src/bim/sheets/dxf-paper-export.ts`

**Steps:**
1. Extend `DrawingView` with `section` and `back` views for MVP coverage of plans/facades/sections.
2. Add `viewport: OBC.DrawingViewport | null`, `bounds`, and `projection` metadata to `DrawingRecord`.
3. Create viewport from projected drawing bounds after line generation.
4. Make sheet DXF export reuse the drawing’s native viewport if present.
5. Verify with `npx tsc --noEmit`.

## Task 2: Native annotations service

**Objective:** Replace custom annotation geometry with ThatOpen-native systems while keeping UI labels and counts.

**Files:**
- Rewrite: `src/bim/drawings/drawing-annotations.ts`
- Modify: `src/bim/app.ts`

**Steps:**
1. Keep annotation type API used by the app.
2. Add native `addDrawingAnnotation(record, { components, type, text })` implementation using `LinearAnnotations.add`, `LeaderAnnotations.add`, `CalloutAnnotations.add`.
3. Add label fallback using `LeaderAnnotations` for text labels.
4. Implement `clearDrawingAnnotations(record, components)` through native systems.
5. Sync `record.annotations` from `drawing.annotations` after changes.
6. Verify with `npx tsc --noEmit`.

## Task 3: Interactive placement controller

**Objective:** Add click-on-drawing interaction for dimensions/leaders/callouts.

**Files:**
- Create: `src/bim/drawings/drawing-interaction.ts`
- Modify: `src/bim/app.ts`
- Modify: `index.html`, `src/bim/dom.ts`

**Steps:**
1. Add UI mode button/state: “Интерактивно”.
2. Attach pointer events to the viewer container/canvas.
3. Convert pointer to ray, call `drawing.raycast(ray, viewport)` and fall back to drawing plane intersection.
4. Forward points to ThatOpen annotation machines (`sendMachineEvent`), including text submit where required.
5. Add Escape cancel and status hints.
6. Verify by build and browser console smoke.

## Task 4: Persistence MVP

**Objective:** Persist/restores drawing metadata and native annotation data locally.

**Files:**
- Create: `src/bim/drawings/drawing-persistence.ts`
- Modify: `src/bim/app.ts`

**Steps:**
1. Serialize source/view/far/name/title/format and annotation data from native systems.
2. Save after generate/annotate/clear/sheet changes.
3. Restore after model load by regenerating drawings from stored source maps where possible and replaying annotations.
4. Add clear-on-project reset.
5. Verify with TypeScript/build and browser localStorage smoke.

## Task 5: Final verification and commit

**Objective:** Produce a safe branch artifact.

**Files:** all changed files.

**Steps:**
1. Run `npm run build`.
2. Run `git diff --check`.
3. Run local preview curl and browser console smoke.
4. Commit on `feature/bim-real-drawings`.
5. Report exact outputs and known MVP limits.
