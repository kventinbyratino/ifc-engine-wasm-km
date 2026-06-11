# BIM Real Drawings — Phase 6 Hardening Plan

> **For Hermes:** Implement task-by-task with local checks; test after each task and keep the diff small.

**Goal:** Harden the real drawings workflow after Phase 4/5 so storage, sheet export, and browser smoke stay stable under real usage.

**Architecture:** Keep the existing ThatOpen-native drawings pipeline and improve the edges around it: robust localStorage persistence, deterministic sheet rendering, and a final verification pass before merging to `dev`.

**Tech Stack:** TypeScript, Vite, Three.js, `@thatopen/components`, localStorage, browser smoke.

---

## Phase 6 Status Snapshot

- Base branch: `feature/bim-real-drawings`
- Snapshot commit: `e606b21 merge: phase 4 real drawings hardening`
- Verification baseline: `npm run build` and browser smoke were already green before Phase 6 changes.

---

## Task 6.1: Harden drawing workspace persistence

**Objective:** Make saved drawings/sheets resilient to malformed or older localStorage payloads.

**Files:**
- Modify: `src/bim/drawings/drawing-persistence.ts`
- Modify: `src/bim/app/drawings-controller.ts`

**Steps:**
1. Add an explicit storage schema version to the persisted workspace payload.
2. Guard JSON parsing with `try/catch` and reject malformed payloads safely.
3. Normalize older payloads so existing users can still restore saved drawings.
4. Keep clear/reset behavior intact.
5. Verify with `npx tsc --noEmit`.

## Task 6.2: Make sheet rendering deterministic

**Objective:** Remove locale-dependent output from sheet SVG metadata and keep the title block stable.

**Files:**
- Modify: `src/bim/sheets/sheet-board.ts`

**Steps:**
1. Format sheet dates with a stable `ru-RU` helper instead of implicit locale output.
2. Keep the title block labels concise and consistent across exports.
3. Ensure empty/placeholder projections still render cleanly.
4. Verify with `npx tsc --noEmit`.

## Task 6.3: Final verification and merge to dev

**Objective:** Prove the phase is safe and move it into `dev`.

**Files:** all modified files.

**Steps:**
1. Run `npm run build`.
2. Run `git diff --check`.
3. Run browser smoke on the updated dev build.
4. Commit on the current feature branch.
5. Merge/push to `origin/dev`.
6. Report exact outputs, branch, and hash.
