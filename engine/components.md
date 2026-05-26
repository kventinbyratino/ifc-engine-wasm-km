# IFC Engine: компоненты

Карта составлена по четырем проектам в текущей папке.

## Общая схема

| Проект | Пакеты | Назначение |
| --- | --- | --- |
| `engine_web-ifc-main` | `web-ifc` 0.0.78 | Низкоуровневое чтение, запись и геометрия IFC через C++/WASM и TypeScript API. |
| `engine_fragment-main` | `@thatopen/fragments` 3.4.5 | Формат Fragments, загрузка, хранение, редактирование и быстрый рендер BIM-данных. |
| `engine_components-main` | `@thatopen/components` 3.4.6, `@thatopen/components-front` 3.4.3 | Сервисные BIM-компоненты для 3D-приложений на Three.js. |
| `engine_ui-components-main` | `@thatopen/ui` 3.4.1, `@thatopen/ui-obc` 3.4.2 | Web Components для интерфейса и готовые UI-блоки для `@thatopen/components`. |

Зависимости по смыслу: `web-ifc` -> `fragments` -> `components` / `components-front` -> `ui-obc`. Пакет `@thatopen/ui` можно использовать отдельно как UI-библиотеку.

## `engine_web-ifc-main`

Базовый слой работы с IFC. C++ ядро компилируется в WASM, TypeScript API дает доступ из браузера и Node.js.

| Компонент | Для чего нужен | Возможности |
| --- | --- | --- |
| `src/cpp/web-ifc/parsing` | Разбор IFC-файла. | Токенизация, потоковое чтение, загрузка STEP/IFC-строк. |
| `src/cpp/web-ifc/schema` | Работа со схемами IFC. | Поддержка IFC2X3, IFC4, IFC4X3, сопоставление типов и имен. |
| `src/cpp/web-ifc/geometry` | Генерация геометрии. | Меши, кривые, профили, булевы операции, трансформации. |
| `src/cpp/web-ifc/modelmanager` | Управление моделями в памяти. | Открытие, закрытие, доступ к элементам, матрицам и геометрии. |
| `src/cpp/web-ifc/cache` | Ускорение повторного доступа. | Кэширование данных модели и вычислений. |
| `src/ts/web-ifc-api.ts` | Публичный API. | `OpenModel`, `CreateModel`, `SaveModel`, `GetLine`, `WriteLine`, `StreamMeshes`, `GetGeometry`, `CloseModel`. |
| `src/ts/helpers/properties.ts` | Удобный доступ к свойствам. | Property sets, материалы, связи элемента со свойствами. |
| `src/schema-generator` | Генерация TypeScript-типов IFC. | EXPRESS-схемы в типы и helpers для API. |

Основные возможности: читать и писать IFC, получать геометрию и свойства, стримить меши, редактировать IFC-строки, создавать GUID, работать с transform matrix, запускаться в browser/Node через WASM.

## `engine_fragment-main`

Слой эффективного хранения и отображения BIM-моделей. Использует Three.js, FlatBuffers и `web-ifc`.

| Компонент | Для чего нужен | Возможности |
| --- | --- | --- |
| `Schema` / FlatBuffers | Бинарный формат Fragments. | Компактное хранение геометрии, свойств, связей, индексов и метаданных. |
| `FragmentsModels` | Главная точка управления моделями. | Загрузка `.frag`, worker pool, обновление сцены, dispose, прогресс загрузки, авто-координация. |
| `FragmentsModel` | Работа с одной BIM-моделью. | Элементы, атрибуты, связи, материалы, visibility, highlight, raycast, snap, sections, grids, alignments. |
| `virtual-model` / `lod` | Производительность отображения. | LOD, отсечение по камере, виртуальные меши, обновление видимой части модели. |
| `multithreading` | Вынос тяжелых операций из UI-потока. | Worker-соединение, запросы, очереди, группы потоков. |
| `Importers/IfcImporter` | Конвертация IFC в Fragments. | Импорт геометрии и свойств, обработка civil/grid/space boundary данных, progress events. |
| `GeometryEngine` | Генерация типовой BIM-геометрии. | Extrusion, sweep, wall, profile, boolean, bbox, arc, parabola, clothoid, revolve. |
| `Utils` | Общие структуры и геометрия. | Events, DataMap/DataSet, shell geometry, edit requests, IFC splitter. |

Основные возможности: быстро загружать большие BIM-модели, отображать их на слабых устройствах, выбирать/фильтровать элементы, читать свойства, редактировать данные, импортировать IFC во Fragments.

## `engine_components-main`

Набор прикладных BIM-сервисов. Пакет `@thatopen/components` подходит для browser и Node.js, `@thatopen/components-front` содержит браузерные инструменты.

### `@thatopen/components`

| Компонент | Для чего нужен | Возможности |
| --- | --- | --- |
| `Components` | Контейнер компонентов приложения. | Регистрация, получение, инициализация, dispose. |
| `Worlds` | 3D-миры приложения. | Связка scene/camera/renderer, несколько миров, update loop. |
| `SimpleScene`, `SimpleRenderer`, `SimpleCamera` | Базовая Three.js-сцена. | Сцена, рендер, camera-controls, стандартная настройка просмотра. |
| `ConfigManager` | Управление настройками. | Схемы настроек, конфигураторы, runtime-изменения. |
| `Disposer` | Очистка ресурсов. | Dispose геометрии, материалов, текстур и компонентов. |
| `Raycasters` | Выбор объектов мышью. | Raycast по сцене, координаты указателя, базовый picking. |
| `OrthoPerspectiveCamera` | Камера с режимами навигации. | Perspective/Orthographic, Orbit, FirstPerson, Plan. |
| `Clipper` | Секущие плоскости. | Создание, настройка и скрытие clipping planes. |
| `Grids` | Сетки в сцене. | Создание простых рабочих grid-объектов. |
| `Views` / `Viewpoints` | Сохраненные виды. | Камера, видимость, clipping planes, BCF viewpoint-данные. |
| `ShadowedScene` | Сцена с тенями. | Distance renderer, pixel reader, настройки света/теней. |
| `FastModelPicker` | Быстрый picking BIM-элементов. | Выбор элементов модели с учетом BIM-структуры. |
| `SnapResolver` | Привязки. | Поиск snap-точек и snap-результатов. |
| `FragmentsManager` | Интеграция Fragments в компоненты. | Управление моделями, события, связь с `@thatopen/fragments`. |
| `IfcLoader` | Загрузка IFC в приложение. | Конвертация IFC в fragments, настройки импорта, dispose. |
| `Hider` | Управление видимостью. | Скрыть/показать элементы по выборкам. |
| `Classifier` | Классификация элементов. | Группы по типам, пространству, отношениям и пользовательским правилам. |
| `ItemsFinder` | Поиск элементов. | Запросы по атрибутам и связям, inclusive/exclusive агрегация. |
| `BoundingBoxer` | Габариты. | Bounding boxes для моделей и выборок элементов. |
| `EdgeProjector` | Проекция ребер. | Контуры, силуэты, пересечения, подготовка 2D-проекций. |
| `BCFTopics` | BCF-замечания. | Topics, comments, viewpoints, импорт/экспорт BCF 2.1/3. |
| `IDSSpecifications` | Проверка IDS. | Требования к IFC-данным, фасеты entity/property/material/classification/partOf. |
| `TechnicalDrawings` | Технические чертежи. | Viewports, layers, annotations: linear, angle, slope, leader, callout, block. |
| `DxfManager` | Экспорт DXF. | Запись чертежей, viewports, текстов и графики в DXF. |
| `MeasurementUtils` | Общие расчеты измерений. | Ребра, точки, единицы и служебная геометрия для измерений. |

### `@thatopen/components-front`

| Компонент | Для чего нужен | Возможности |
| --- | --- | --- |
| `Highlighter` | Подсветка BIM-элементов. | Hover/select/highlight, события, цвета и выборки. |
| `Hoverer` | Реакция на наведение. | Автоматический hover по raycast. |
| `Outliner` | Обводка объектов. | Outline-группы, визуальное выделение в постобработке. |
| `Mesher` | Отрисовка пользовательской геометрии. | Создание/обновление мешей поверх BIM-сцены. |
| `Marker` | 2D/HTML-маркеры в 3D. | Метки, группировка, скрытие, синхронизация с камерой. |
| `PostproductionRenderer` | Рендер с постобработкой. | AO, outline, gloss, edge detection, исключение объектов из pass. |
| `ClipStyler` | Визуализация сечений. | Стили ребер и заливок для clipping planes. |
| `LengthMeasurement` | Измерение длины. | Свободный режим и измерение по ребру. |
| `AreaMeasurement` | Измерение площади. | Свободная, прямоугольная и face-площадь. |
| `AngleMeasurement` | Измерение углов. | Построение угла и визуальная разметка. |
| `VolumeMeasurement` | Измерение объема. | Расчет объема по выбранной геометрии. |
| `CivilNavigators` | Навигация по linear/civil данным. | Движение по трассам и alignment-данным. |
| `CivilRaycaster` | Выбор civil-геометрии. | Raycast по civil-объектам. |
| `CivilCrossSectionNavigator` | Поперечные сечения. | Навигация и просмотр cross-section данных. |
| `DrawingEditor` | Интерактивное редактирование чертежей. | Инструменты annotations, snap, placement modes, font manager. |

## `engine_ui-components-main`

UI-слой на Web Components и Lit. Подходит для любого frontend-фреймворка, так как компоненты регистрируются как HTML-теги.

### `@thatopen/ui`

| Компонент | Для чего нужен | Возможности |
| --- | --- | --- |
| `Manager` | Регистрация UI-компонентов. | Инициализация custom elements и общие настройки UI. |
| `Component` | База для stateful UI. | LitElement, состояние, update-функции, переиспользуемые шаблоны. |
| `Button`, `Icon`, `Tooltip` | Базовые действия и подсказки. | Кнопки, иконки Iconify, tooltip. |
| `Input`, `TextInput`, `NumberInput`, `ColorInput`, `Slider`, `Checkbox` | Ввод данных. | Текст, числа, цвет, диапазоны, булевые значения. |
| `Dropdown`, `Option`, `Selector`, `Tabs` | Выбор вариантов. | Списки, опции, single/multi selection, вкладки. |
| `Panel`, `Toolbar`, `ContextMenu` | Рабочие панели. | Секции, группы инструментов, контекстные команды. |
| `Grid`, `Viewport`, `PaperSpace` | Макет и рабочая область. | CSS grid layouts, область 3D/2D просмотра, листы. |
| `Table` | Табличные данные. | Строки, группы, selection, lazy load, templates. |
| `Chart`, `ChartLegend`, `Label` | Визуализация данных. | Диаграммы Chart.js, легенды, подписи. |

### `@thatopen/ui-obc`

| Компонент | Для чего нужен | Возможности |
| --- | --- | --- |
| `Manager` | Регистрация BIM UI-компонентов. | Инициализация UI, завязанного на `@thatopen/components`. |
| `World`, `World2D`, `ViewCube`, `SheetBoard` | Готовые области просмотра. | 3D/2D viewport, cube-навигация, листы. |
| `load-ifc`, `load-frag` | Кнопки загрузки моделей. | Загрузка IFC и Fragments через готовые UI-actions. |
| `ModelsList`, `SpatialTree`, `ItemsData` | Таблицы модели. | Список моделей, пространственная структура, свойства элементов. |
| `TopicsList`, `CommentsList`, `ViewpointsList` | BCF-таблицы. | Замечания, комментарии, viewpoints. |
| `WorldsConfiguration` | Настройка миров. | UI для конфигурации компонентов сцены. |
| `Attributes`, `Categories`, `IDS`, `Labels`, `Topics` charts | Аналитика BIM-данных. | Диаграммы по атрибутам, категориям, IDS-статусу, меткам и темам. |
| `TopicForm`, `TopicInformation`, `TopicComments`, `TopicRelations`, `TopicViewpoints` | Формы BCF. | Создание и редактирование topic-данных, связей, комментариев и видов. |

## Ключевые возможности всего стека

- IFC I/O: чтение, запись, редактирование строк и получение геометрии IFC.
- Конвертация: IFC -> Fragments для быстрого веб-отображения.
- Визуализация: Three.js сцены, камеры, рендер, LOD, workers, clipping, postprocessing.
- Работа с BIM-данными: свойства, связи, классификация, поиск, выборки, скрытие, подсветка.
- Измерения и чертежи: длина, площадь, объем, углы, annotations, DXF.
- OpenBIM workflow: BCF topics/viewpoints/comments и IDS-проверки.
- UI: базовый дизайн-системный набор и готовые BIM-интерфейсы.
