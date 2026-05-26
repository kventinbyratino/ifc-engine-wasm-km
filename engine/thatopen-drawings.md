# Как ThatOpen работает с чертежами

Краткая инструкция по модулю чертежей в `@thatopen/components` и `@thatopen/components-front`.

## Основные компоненты

| Компонент | Где находится | Назначение |
| --- | --- | --- |
| `TechnicalDrawings` | `@thatopen/components` | Менеджер чертежей. Создает и хранит `TechnicalDrawing`. |
| `TechnicalDrawing` | `@thatopen/components` | Один чертеж как `THREE.Group` в 3D-сцене. В нем лежат проекции, слои, аннотации и viewport-ы. |
| `DrawingLayers` | `@thatopen/components` | Слои чертежа: цвет, видимость, группировка графики. |
| `DrawingViewports` / `DrawingViewport` | `@thatopen/components` | Ортографические окна просмотра чертежа. Нужны для листов и DXF-экспорта. |
| `LinearAnnotations`, `AngleAnnotations`, `SlopeAnnotations`, `LeaderAnnotations`, `CalloutAnnotations`, `BlockAnnotations` | `@thatopen/components` | Системы аннотаций. Хранят данные размеров, выносок, углов, уклонов и блоков. |
| `DrawingEditor` | `@thatopen/components-front` | Браузерный интерактивный редактор: мышь, snap, hover, выбор, текстовые подписи. |
| `DxfManager` | `@thatopen/components` | Экспорт чертежей и viewport-ов в DXF. |
| `EdgeProjector` | `@thatopen/components` | Получает ребра/контуры BIM-модели для 2D-проекций. |

## Рабочая схема

1. Создать обычный `World`: scene, camera, renderer.
2. Загрузить BIM-модель через `FragmentsManager`.
3. Получить `TechnicalDrawings` и создать чертеж:

```ts
const techDrawings = components.get(OBC.TechnicalDrawings);
const drawing = techDrawings.create(world);
```

4. Сориентировать чертеж. Плоскость чертежа - локальная `XZ`, направление проекции - локальная `-Y`.

```ts
drawing.orientTo(new THREE.Vector3(0, -1, 0)); // план сверху
drawing.orientTo(new THREE.Vector3(0, 0, -1)); // фасад
```

5. Добавить линии проекции. Их можно:

- загрузить из готового JSON;
- построить через `EdgeProjector`;
- добавить как `THREE.LineSegments`.

```ts
drawing.layers.create("projection", {
  material: new THREE.LineBasicMaterial({ color: 0x222222 }),
});

drawing.addProjectionLines(lineSegments, "projection");
```

6. Подключить систему аннотаций:

```ts
const dimensions = techDrawings.use(OBC.LinearAnnotations);
```

7. Для ручного размещения использовать `DrawingEditor`:

```ts
const editor = components.get(OBF.DrawingEditor);
await editor.fonts.load("/fonts/PlusJakartaSans-Medium.ttf");
editor.activeDrawing = drawing;
editor.setSource(world);
editor.activeTool = OBF.LinearAnnotationsTool;
```

8. На клики пользователя вызывать шаг инструмента:

```ts
container.addEventListener("click", () => editor.step());
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") editor.cancel();
});
```

9. Для экспорта получить `DxfManager`:

```ts
const dxf = components.get(OBC.DxfManager);
const file = dxf.exporter.export([
  { drawing, viewports: [...drawing.viewports.values()].map((viewport) => ({ viewport })) },
]);
```

## Важные правила

- Чертеж не является картинкой. Это 2D-геометрия и аннотации, привязанные к 3D-модели.
- Вся графика чертежа должна быть дочерней для `drawing.three`, иначе слои, raycast и экспорт будут работать некорректно.
- Аннотации хранят данные, но текстовые mesh-labels в core создаются на стороне приложения. В браузере проще использовать `DrawingEditor`.
- Для точного выбора линий используйте `drawing.raycast(...)` или `DrawingEditor`, а не общий raycast сцены.
- Для CAD-выгрузки используйте `DxfManager`, а не скриншот canvas.
- Для производительности сначала конвертируйте IFC в Fragments, затем строьте проекции и чертежи по Fragments-модели.
