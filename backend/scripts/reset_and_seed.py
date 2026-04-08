#!/usr/bin/env python3
"""
Сброс данных и наполнение демо-контентом.

  DATABASE_URL=postgresql://... python scripts/reset_and_seed.py

Опции окружения:
  SCENARIO_EXPORTS_DIR — каталог с hantos.xlsx и «Управление добычей….xlsx»
  (по умолчанию backend/seed_data/scenario_exports или Sin/docs/scenario_exports)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# корень backend на PYTHONPATH
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from sqlalchemy.orm import Session

from app.db.session import engine
from app.seed.seed_db import run_seed


def main() -> None:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        print("Задайте DATABASE_URL", file=sys.stderr)
        sys.exit(1)
    if engine is None:
        print("engine не инициализирован", file=sys.stderr)
        sys.exit(1)
    session = Session(bind=engine)
    try:
        run_seed(session)
    finally:
        session.close()
    print("OK: таблицы очищены и заполнены демо-данными.")


if __name__ == "__main__":
    main()
