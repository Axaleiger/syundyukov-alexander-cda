# Backend: API и прикладная логика (предложение)

Документ в `Sin/docs/`. Сверка с [`DATA_AND_BUSINESS_LOGIC_TO_BE.md`](./DATA_AND_BUSINESS_LOGIC_TO_BE.md) и текущим каркасом FastAPI в `syundyukov-alexander-cda/backend/`.

**Сейчас в коде:** FastAPI с `/health`, `/health/db`, миграции Alembic, сиды PostgreSQL, группа **`/api/v1/...`** (me, users, taxonomy/production-stages, assets, scenarios, planning/cases и др.). Ниже — принципы и полный черновик API; детали реализации — в `syundyukov-alexander-cda/backend/`.

**Связь с фронтом (фактическое состояние):** в шапке и списке сценариев пользователь отображается **строками** (`HeaderMain.jsx`, `scenariosData.js` → поле `author`); исполнитель и согласующий на доске планирования — **строки ФИО** из общего списка `PERSONNEL` (`bpmData.js`), выбор в `BPMRightPanelExecutor.jsx`. В целевой модели это сводится к одному справочнику **`app_user`** и внешним ключам на него; см. `docs/scenario_exports/README.md` и раздел 2.1 ниже.

---

## 1. Принципы API

1. **Версионирование:** префикс `/api/v1` для всех ресурсов (в nginx прокси сейчас снимается префикс `/api` — маршруты в приложении без дублирования или с `root_path`, согласовать с деплоем).
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
| `PlanningService.saveBoard(case_id, patch)` | Запись в `planning_board_*` + опционально пересборка `board_snapshot` |

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
| GET | `/api/v1/taxonomy/business-directions` | Дерево направлений |
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
| GET | `/api/v1/scenarios` | Фильтры: `production_stage_id`, `asset_id`, период |
| GET | `/api/v1/scenarios/{scenario_id}` | Одна запись реестра |
| POST | `/api/v1/scenarios/{scenario_id}/open-in-planning` | Триггер `openScenarioInPlanning` → `planning_case` |

### 4.6 Планирование (BPM)

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/v1/planning/cases` | Список кейсов по `asset_id` |
| GET | `/api/v1/planning/cases/{case_id}` | Снимок доски |
| PATCH | `/api/v1/planning/cases/{case_id}` | `submitPlanningBoardChange` |
| GET | `/api/v1/planning/templates` | `BoardTemplate` |
| POST | `/api/v1/planning/cases/{case_id}/import-excel` | Загрузка `.xlsx` доски (как «Загрузить из Excel»); маппинг ФИО → `app_user` |

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
- Шапка, реестр сценариев, исполнители/согласующие — из **`/api/v1/me`**, **`/api/v1/users`**, **`/api/v1/scenarios`**; доска планирования — из **`/api/v1/planning/cases/...`**; сохранение изменений доски — через **`PATCH`** (когда будет реализовано), с идентификаторами пользователей с сервера.

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
