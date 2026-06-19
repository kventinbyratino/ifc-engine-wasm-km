# Help user scenario test report — 2026-06-19

Target: https://dev.lab-tim.ru/ifc-engine-wasm/bim/?v=9daca92
Commit: 9daca92

## Automated gates

- `node --test tests/help-page.test.mjs`: PASS
- `npm run build`: PASS
- `npm test`: PASS — 104/104
- `node scripts/smoke-regression.mjs --dist dist`: PASS — 12 assets checked
- `git diff --check`: PASS
- Dev deploy: nginx config OK, service active
- HTTP smoke: HTML 200, API `/api/health` 200, deployed JS contains `Контекстное меню элемента`, CSS contains `help-nav-sidebar`

## Browser verification

- Opened BIM dev route.
- Opened `Справка`.
- Verified left sidebar navigation class: `help-nav help-nav-sidebar`.
- Verified layout grid: `240px 937px`.
- Verified sections: 17.
- Verified left nav links: 17/17 point to existing sections and update hash.
- Verified related links: 35/35 point to existing sections.
- Browser console after navigation and checks: 0 JS errors.
- Visual check: left menu is visible; help cards are on the right. No obvious visual blocker found.

## Per-section scenario results

1. Старт и BIM-профиль — PASS: 3 practical steps, illustration, nav link, related links.
2. BIM Data Browser и таблицы — PASS: 4 practical steps, illustration, nav link, related links.
3. Граф связей элементов — PASS: 3 practical steps, illustration, nav link, related links.
4. Чертежи и DXF MVP — PASS: 4 practical steps, illustration, nav link, related links.
5. Аннотации чертежей — PASS: 4 practical steps, illustration, nav link, related links.
6. Проверки качества модели — PASS: 4 practical steps, illustration, nav link, related links.
7. Замечания и BCF — PASS: 4 practical steps, illustration, nav link, related links.
8. Федерация и коллизии — PASS: 4 practical steps, illustration, nav link, related links.
9. Листы, PDF/PNG и спецификации — PASS: 4 practical steps, illustration, nav link, related links.
10. Редактирование и экспорт IFC — PASS: 4 practical steps, illustration, nav link, related links.
11. Большие IFC и backend conversion — PASS: 4 practical steps, illustration, nav link, related links.
12. Progressive loading и LOD — PASS: 4 practical steps, illustration, nav link, related links.
13. Рабочие чертежи и оформление — PASS: 4 practical steps, illustration, nav link, related links.
14. Связь модель ↔ чертёж — PASS: 4 practical steps, illustration, nav link, related links.
15. Контекстное меню элемента — PASS: 5 practical steps, documents `Свойства`, `Найти в данных`, `Создать замечание`, `Добавить в выборку`; illustration, nav link, related links.
16. Раздел 3 из IFC/Fragments — PASS: 4 practical steps, illustration, nav link, related links.
17. Регрессии, telemetry и безопасный deploy — PASS: 4 practical steps, illustration, nav link, related links.

## Notes

This pass verifies the help/documentation user scenarios and navigation behavior on the deployed dev build. Deep feature execution for heavy model-dependent scenarios remains covered by existing automated module tests and smoke regression; it was not repeated manually with a real IFC in this report.
