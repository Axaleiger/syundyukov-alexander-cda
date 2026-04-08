"""
Однократное заполнение демо-данными при пустой таблице scenario (локальный Docker / dev).
Полный сброс вручную: python scripts/reset_and_seed.py
"""

from __future__ import annotations

import logging
import os

logger = logging.getLogger("uvicorn.error")


def ensure_demo_seed_if_empty() -> None:
    v = os.getenv("AUTO_SEED", "1").strip().lower()
    if v in ("0", "false", "no"):
        return
    from sqlalchemy.orm import Session

    from app.db.session import engine
    from app.models.tables import Scenario
    from app.seed.seed_db import run_seed

    if engine is None:
        return
    session = Session(bind=engine)
    try:
        if session.query(Scenario).count() > 0:
            return
        run_seed(session)
        logger.info("AUTO_SEED: демо-данные загружены (сценарии и доски планирования).")
    except Exception:
        logger.exception("AUTO_SEED: не удалось выполнить сид; проверьте DATABASE_URL и миграции.")
    finally:
        session.close()
