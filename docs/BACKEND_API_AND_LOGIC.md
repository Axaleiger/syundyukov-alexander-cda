# Backend: API и прикладная логика (предложение)

Документ в `Sin/docs/`. Сверка с [`DATA_AND_BUSINESS_LOGIC_TO_BE.md`](./DATA_AND_BUSINESS_LOGIC_TO_BE.md) и текущим каркасом FastAPI в `syundyukov-alexander-cda/backend/`.

**Сейчас в коде:** FastAPI с `/health`, `/health/db`, миграции Alembic, сиды PostgreSQL, группа **`/api/v1/...`** (me, users, taxonomy/production-stages и **business-directions**, assets, scenarios, **PATCH сценария**, planning/cases, **GET/PUT …/board** и др.). Ниже — принципы и полный черновик API; детали реализации — в `syundyukov-alexander-cda/backend/`.

**Локальный Docker:** сервис `api` собирается из `./backend` **без** bind-mount кода; после изменений в Python нужен **`docker compose -f docker-compose.local.yml build api`** (при необходимости `--no-cache`) и **`up -d api`**, иначе контейнер может отдавать старую версию маршрутов.

**Связь с фронтом (фактическое состояние):** в шапке и списке сценариев пользователь отображается **строками** (`HeaderMain.jsx`, `scenariosData.js` → поле `author`); исполнитель и согласующий на доске планирования — **строки ФИО** из общего списка `PERSONNEL` (`bpmData.js`), выбор в `BPMRightPanelExecutor.jsx`. В целевой модели это сводится к одному справочнику **`app_user`** и внешним ключам на него; см. `docs/scenario_exports/README.md` и раздел 2.1 ниже.

---

## 1. Принципы API

1. **Версионирование:** префикс `/api/v1` для всех ресурсов. В **локальной разработке** (Vite) запросы идут на `/api/v1/...` и проксируются на FastAPI **с сохранением пути** (`/api/v1/...` на бэкенде). В проде схема задаётся reverse-proxy (nginx и т.п.) — согласовать `root_path`/префикс с деплоем.
2. **`dataSource`:** в ответах доменных сущностей поле `dataSource` (например `"demo"` для сидированных данных в БД, `"api"` для боевого источника), чтобы при необходимости помечать происхождение строк в ответе. **Фронт в продакшене получает данные только через этот API**, а не из static-модулей (см. `FRONTEND_DATA_LAYER_PROPOSAL.md`).
3. **Идентификаторы:** публичные сущности — **UUID** в path/query/body; `canonicalKey` — только в справочниках, где зафиксировано в TO BE.
4. **Ошибки:** JSON `{"detail": "...", "code": "VALIDATION_ERROR"}`; для бизнес-инвариантов — 409/422 с кодом.

---

## 2. Пользователи и единая модель данных

### 2.1 Сущность `AppUser` (таблица `app_user`)

Один узел для:

- **текущая сессия** — ответ `GET /api/v1/me` (ФИО, должность, фото, подразделение, как в правом верхнем углу);
- **автор сценария** — `scenario.author_user_id`;
- **утверждение** — `scenario.approved_by_user_id`, `approved_at` (колонка «Утвержден» в реестре);
- **исполнитель / согласующий по карточке BPM** — `planning_board_card.executor_user_id`, `approver_user_id`;
- **аудит** — `audit_event.user_id`.

Подразделение — через `org_unit_id` (как в `cda_physical_model.dbml`). Импорт из Excel: колонки `Исполнитель` / `Согласующий` сопоставляют строку с `app_user.display_name` (или создают черновую запись при политике мастер-данных).

### 2.2 Доска планирования (нормализация вместо «кусочков»)

Каноническое хранение — таблицы **`planning_board_stage`**, **`planning_board_card`**, **`planning_board_card_entry`**, **`planning_board_connection`**, соответствующие формату `bpmExcel.js` (лист «Доска», блок «Связи»). Поле `planning_case.board_snapshot` (JSONB) — опциональный денормализованный кэш; источник истины — строки в этих таблицах; UI читает доску через **`GET /api/v1/planning/cases/{id}`**, а не из локального Excel.

### 2.3 Слой приложения (сервисы) — дополнения

| Операция / сервис | Заметки |
|-------------------|--------|
| `AuthContext.resolveCurrentUser()` | JWT → `app_user` по `external_subject`; при отсутствии строки — upsert по профилю IdP |
| `UserDirectoryService.searchByDisplayName(q)` | Подбор исполнителей/согласующих в правой панели (пагинация, фильтр) |
| `PlanningService.importBoardFromExcel(case_id, file)` | Парсинг колонок как в `parseBoardFromExcel`; маппинг ФИО → `user_id` |
| `PlanningService.saveBoard` / `replace_board_from_payload` | Полная замена доски в `planning_board_*` (см. `PUT .../board`, § 4.10); `board_snapshot` при необходимости отдельно |

---

## 3. Слой приложения (сервисы)

Операции из TO BE (раздел 3) маппятся на **сервисы** (классы/модули), вызываемые из роутеров и (позже) из очередей/ИИ:

| Операция TO BE | Сервис / метод (условно) | Заметки |
|----------------|---------------------------|---------|
| `selectAsset` | `SessionContextService.set_asset(asset_id)` + подгрузка связанных кейсов/цепочек | Пишет в сессию/кэш; читает `asset`, последние `planning_case` |
| `openScenarioInPlanning` | `PlanningService.open_or_create_case(scenario_id)` | Создаёт `planning_case` по шаблону, возвращает `caseId` |
| `applyStageFilterToScenarioList` | `ScenarioService.list(filter)` | Фильтр по `production_stage_id[]`, не по строке |
| `runMetricDashboardView` | `MetricsService.query_slice(scope, period, metric_ids)` | Возвращает `MetricSlice` + провенанс |
| `submitPlanningBoardChange` | `PlanningService.patch_board(case_id, patch)` | Валидация, запись в `planning_board_*` (и при необходимости `board_snapshot`) |
| `syncOntologyFromPlanning` | `OntologyService.sync_from_case(case_id)` | Детерминированный handoff, новая версия графа |
| `refreshScenarioComparison` | `ComparisonService.refresh(asset_id, assumptions_id \| run_id)` | Новый `scenario_comparison_run`, не фиктивный `revision` |

ИИ после классификации намерения вызывает **те же** методы с параметрами из NLU (контракт как у UI-кнопок).

---

## 4. Группы REST-эндпоинтов (черновик)

### 4.1 Система

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/health` | Живость процесса |
| GET | `/health/db` | Проверка БД |

### 4.2 Identity и пользователи

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/v1/me` | Текущий пользователь (`app_user` + `org_unit` кратко) для шапки |
| GET | `/api/v1/users` | Каталог для выбора исполнителя/согласующего: `q`, `limit`, `org_unit_id?` |

### 4.3 Справочники (read-mostly)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/v1/taxonomy/production-stages` | Список этапов + локализованные подписи |
| GET | `/api/v1/taxonomy/business-directions` | Плоский список направлений (`id`, `name`, `sortOrder`); иерархия `parent_id` в БД зарезервирована, в ответе пока не раскрывается |
| GET | `/api/v1/taxonomy/metrics` | `MetricDefinition` для дашборда |
| GET | `/api/v1/systems` | ИТ-системы + опционально алиасы для матчинга |

### 4.4 Активы и карта

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/v1/assets` | Список/фильтр по региону, типу |
| GET | `/api/v1/assets/{asset_id}` | Детали + связанные регионы |
| GET | `/api/v1/assets/{asset_id}/chains` | Цепочки ЦД (эквивалент `chains.json`) |
| GET | `/api/v1/map/points` | Точки для карты (если не встроены в assets) |

### 4.5 Сценарии

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/v1/scenarios` | Список реестра. Query (опционально): `productionStageId`, `assetId` (UUID) |
| GET | `/api/v1/scenarios/{scenario_id}` | Деталь (**ScenarioOut**): все поля элемента списка + `approvedAt` |
| PATCH | `/api/v1/scenarios/{scenario_id}` | Частичное обновление сценария. Тело JSON (camelCase): опционально `name`, `externalCode`, `status`, `productionStageId`, `businessDirectionId`, `assetId`, `isApproved`, `calculationDurationText`. Пустое `{}` не меняет строку. Ответ — **ScenarioOut** |
| POST | `/api/v1/scenarios/{scenario_id}/open-in-planning` | *(план)* Триггер `openScenarioInPlanning` → `planning_case` |

### 4.6 Планирование (BPM)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/v1/planning/cases` | Список кейсов. Query (опционально): `assetId` |
| GET | `/api/v1/planning/cases/{case_id}` | Кейс + полная сборка доски (`board`) из нормализованных таблиц |
| GET | `/api/v1/planning/cases/{case_id}/board` | Только снимок доски: `{ "board": { ... } }` (тот же `board`, что в GET кейса). Удобно для проверки в браузере; **чтение доски** в UI обычно идёт через GET кейса |
| PUT | `/api/v1/planning/cases/{case_id}/board` | Полная замена доски: body `{ "board": { ... } }` — см. § 4.10. Реализация: `replace_board_from_payload` → пересборка строк `planning_board_*` |
| PATCH | `/api/v1/planning/cases/{case_id}` | *(план)* Частичное обновление кейса / `submitPlanningBoardChange` |
| GET | `/api/v1/planning/templates` | *(план)* `BoardTemplate` |
| POST | `/api/v1/planning/cases/{case_id}/import-excel` | *(план)* Загрузка `.xlsx` доски; маппинг ФИО → `app_user` |

### 4.7 Онтология

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/v1/ontology/graphs/{graph_id}` | Версия графа |
| POST | `/api/v1/ontology/sync-from-planning` | body: `{ "case_id": "..." }` → `syncOntologyFromPlanning` |

### 4.8 Метрики и результаты

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/v1/metrics/slice` | query: `asset_id`, `period`, `metric_ids[]` → `MetricSlice` |
| GET | `/api/v1/assets/{asset_id}/scenario-comparison` | query: `assumptions_id` \| `run_id` — провенанс + данные панели |

### 4.9 ИИ (опционально, второй этап)

| Метод | Путь | Назначение |
|-------|------|------------|
| POST | `/api/v1/ai/classify-intent` | Текст → `{ operation, params }` (схема Zod/OpenAPI) |
| POST | `/api/v1/ai/execute` | Выполнение уже валидированной операции (или прямой вызов сервисов из фронта после classify) |

Разделение **classify** и **execute** снижает риск произвольных действий от LLM.

### 4.10 Контракты JSON (реализовано в коде)

Имена полей в JSON — **camelCase** (алиасы Pydantic `serialization_alias`). UUID — строки в кавычках в примерах ниже для читаемости.

#### `GET /api/v1/me` → объект

| Поле | Тип | Описание |
|------|-----|----------|
| `userId` | UUID | Идентификатор `app_user` |
| `displayName` | string | ФИО |
| `jobTitle` | string \| null | Должность |
| `email` | string \| null | |
| `orgUnitName` | string \| null | Название организации (через `org_unit`) |

#### `GET /api/v1/taxonomy/production-stages` → массив

| Поле элемента | Тип | Описание |
|---------------|-----|----------|
| `id` | UUID | |
| `canonicalKey` | string | Стабильный ключ этапа |
| `sortOrder` | number | Порядок сортировки |
| `labelFull` | string | Подпись для UI (например фильтры реестра) |
| `labelShort` | string \| null | |

#### `GET /api/v1/taxonomy/business-directions` → массив

| Поле элемента | Тип | Описание |
|---------------|-----|----------|
| `id` | UUID | |
| `name` | string | Название направления |
| `sortOrder` | number \| null | Порядок в справочнике |

#### `GET /api/v1/scenarios` → массив элементов **ScenarioListItem**

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | Первичный ключ сценария |
| `externalCode` | string \| null | Внешний код (например `SC-…`) для колонки «ID» |
| `name` | string | Наименование |
| `status` | string | Статус в реестре |
| `productionStageId` | UUID | Ссылка на этап |
| `assetId` | UUID \| null | Актив |
| `authorUserId` | UUID \| null | Автор |
| `authorDisplayName` | string \| null | ФИО автора (денормализовано в ответе) |
| `isApproved` | boolean | Утверждён ли сценарий |
| `calculationDurationText` | string \| null | Текст длительности расчёта |
| `createdAt`, `updatedAt` | string (ISO 8601) | |
| `dataSource` | string | Например `"demo"` |
| `businessDirectionId` | UUID \| null | Ссылка на направление |
| `businessDirectionName` | string \| null | Название направления (JOIN для списка и колонки «Направление бизнеса») |

#### `GET /api/v1/scenarios/{scenario_id}` → **ScenarioOut**

Наследует все поля списка и добавляет:

| Поле | Тип | Описание |
|------|-----|----------|
| `approvedAt` | string (ISO 8601) \| null | Дата утверждения |

`businessDirectionId` / `businessDirectionName` дублируют связь с тем же смыслом, что в списке.

#### `GET /api/v1/planning/cases` → массив кратких кейсов

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | UUID | `planning_case.id` |
| `scenarioId` | UUID \| null | Связанный сценарий |
| `assetId` | UUID | Актив |
| `createdAt`, `updatedAt` | string (ISO 8601) | |
| `dataSource` | string | |

#### `GET /api/v1/planning/cases/{case_id}` и ответ `PUT .../board` → объект

Поля кейса как в списке, плюс:

| Поле | Тип | Описание |
|------|-----|----------|
| `board` | object | Снимок доски (сборка `build_board_payload`) |

**Объект `board`:**

| Поле | Тип | Описание |
|------|-----|----------|
| `stages` | string[] | Имена этапов по порядку колонок |
| `tasks` | object | Ключ — имя этапа (строка), значение — массив карточек |
| `connections` | object[] | Связи между карточками |

**Элемент `tasks[stageName][]` (карточка):**

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | Стабильный ключ карточки в рамках доски (`card_key`) |
| `name` | string | Заголовок карточки |
| `executor`, `approver` | string | ФИО (как в UI; при сохранении маппятся в `app_user` по `display_name`, иначе `null`) |
| `deadline` | string (ISO date/datetime) \| null | |
| `status` | string | |
| `date` | string \| null | Текст даты создания в UI |
| `entries` | array | Строки систем: `system`, `input`, `output` |

**Элемент `connections[]`:**

| Поле | Тип |
|------|-----|
| `fromStage`, `toStage` | string (имя этапа) |
| `fromId`, `toId` | string (id карточки в соответствующем этапе) |

#### `PUT /api/v1/planning/cases/{case_id}/board` → тело запроса

```json
{
  "board": {
    "stages": ["Подготовка", "Реализация"],
    "tasks": {
      "Подготовка": [
        {
          "id": "T-100",
          "name": "Задача",
          "executor": "Иванов И.И.",
          "approver": "Петров П.П.",
          "deadline": "2026-04-15T00:00:00.000Z",
          "status": "в работе",
          "date": "01.04.2026",
          "entries": [{ "system": "Б6К", "input": "", "output": "" }]
        }
      ],
      "Реализация": []
    },
    "connections": [
      { "fromStage": "Подготовка", "fromId": "T-100", "toStage": "Реализация", "toId": "T-200" }
    ]
  }
}
```

Ответ **200** — тот же объект, что и `GET /api/v1/planning/cases/{case_id}` (кейс с пересобранной `board` после записи в БД).

При сохранении сервер **полностью заменяет** строки `planning_board_stage`, `planning_board_card`, `planning_board_card_entry`, `planning_board_connection` для данного `case_id`; обновляется `planning_case.updated_at`.

---

## 5. Технологии (рекомендация)

| Слой | Вариант |
|------|---------|
| HTTP | FastAPI (как сейчас) |
| БД | PostgreSQL (уже в compose) |
| Миграции | Alembic |
| Модели | SQLAlchemy 2.0 Declarative или SQLModel |
| Валидация входа | Pydantic v2 |
| Доступ к данным | Репозитории/DAO на таблицы из `cda_physical_model.dbml` |

---

## 6. Согласование с фронтом

- Репозитории-порты (`ScenariosRepository`, `PlanningRepository`, `UsersRepository`, …) на клиенте реализуются **только как HTTP-клиент** к эндпоинтам выше. **Промежуточного режима** «static-данные в проде + опционально API» не предполагается: захардкоженные списки, JSON из `core/data/static` и загрузка Excel как основной источник доски **снимаются** с пользовательского пути; см. **`FRONTEND_DATA_LAYER_PROPOSAL.md`**.
- Сид PostgreSQL может заполнять БД «демо»-содержимым — это **данные на сервере**, отдаваемые тем же API (в т.ч. с `dataSource: "demo"` в JSON при необходимости), а не дублирование логики на фронте.
- Шапка и реестр: **`/api/v1/me`**, **`/api/v1/scenarios`** (в т.ч. `businessDirectionName`), справочники этапов и направлений — **`/api/v1/taxonomy/...`** (`production-stages`, `business-directions`); исполнители/согласующие в BPM при сохранении доски сопоставляются с **`app_user.display_name`** (см. § 4.10). Доска — **`GET /api/v1/planning/cases/{id}`** (или **`GET .../cases/{id}/board`** только за полем `board`); сохранение правок UI — **`PUT /api/v1/planning/cases/{case_id}/board`** с телом `{ "board": { ... } }` (дебаунс на фронте). Редактирование названия сценария в списке — **`PATCH /api/v1/scenarios/{scenario_id}`**; см. `FRONTEND_DATA_LAYER_PROPOSAL.md`.

---

## 7. Документы в `Sin/docs/`

| Файл | Содержание |
|------|------------|
| `DATA_AND_BUSINESS_LOGIC_TO_BE.md` | TO BE: домен, операции, дорожная карта |
| `cda_physical_model.dbml` | Предложение таблиц и связей (в т.ч. `app_user`, `planning_board_*`) |
| `BACKEND_API_AND_LOGIC.md` | Этот файл |
| `FRONTEND_DATA_LAYER_PROPOSAL.md` | Слой данных фронта: только API в проде |
| `scenario_exports/README.md` | Копии Excel из `public/` и контракт колонок доски |

Дальнейшие правки — по мере уточнения интеграций (ЕРП, расчётный движок, IdP).
