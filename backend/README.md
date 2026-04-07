# Backend (FastAPI + PostgreSQL)

Реализация черновика из `Sin/docs/BACKEND_API_AND_LOGIC.md` и схемы `Sin/docs/cda_physical_model.dbml`.

## Локально (Docker)

Из корня репозитория:

```bash
docker compose -f docker-compose.local.yml --env-file .env up --build -d db api
```

Миграции применяются при старте контейнера `api`. Затем один раз загрузить демо-данные:

```bash
docker compose -f docker-compose.local.yml exec api python scripts/reset_and_seed.py
```

Проверка:

- `GET http://localhost:8000/health`
- `GET http://localhost:8000/api/v1/me`
- `GET http://localhost:8000/api/v1/scenarios`

Переменная `SCENARIO_EXPORTS_DIR` (в compose уже `/app/seed_data/scenario_exports`) указывает на каталог с `hantos.xlsx` и `Управление добычей с учетом ближайшего бурения.xlsx` — копии лежат в `backend/seed_data/scenario_exports/`.

## Локально без Docker

Нужен Python 3.11+ и PostgreSQL. Установка зависимостей:

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgresql://user:pass@localhost:5432/dbname
alembic upgrade head
python scripts/reset_and_seed.py
uvicorn app.main:app --reload --port 8000
```

## Скрипт сброса БД

`scripts/reset_and_seed.py` выполняет `TRUNCATE … CASCADE` и заполняет:

- оргединицы, активы (Зимнее / Новогоднее / Аганское), этапы ЖЦ, направления, пользователей (`PERSONNEL` из фронта), ИТ-системы, метрики;
- сценарии по той же логике, что `generateScenarios()` во фронте;
- две доски планирования из Excel в `seed_data/scenario_exports/`.

## Структура

| Путь | Назначение |
|------|------------|
| `app/models/tables.py` | SQLAlchemy-модели |
| `app/api/` | Роуты `/api/v1/...` |
| `app/seed/` | Парсинг Excel и сид |
| `alembic/versions/` | Миграции |
