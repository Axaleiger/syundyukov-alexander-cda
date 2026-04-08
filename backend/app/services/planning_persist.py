"""Сохранение доски планирования в нормализованные таблицы."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tables import (
    AppUser,
    PlanningBoardCard,
    PlanningBoardCardEntry,
    PlanningBoardConnection,
    PlanningBoardStage,
    PlanningCase,
)


def _user_id_by_display_name(session: Session, name: Optional[str]) -> Optional[uuid.UUID]:
    if not name or not str(name).strip():
        return None
    u = session.query(AppUser).filter(AppUser.display_name == str(name).strip()).one_or_none()
    return u.id if u else None


def _parse_deadline(v: Any) -> Optional[date]:
    if v is None:
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(s)
            return dt.date()
        except ValueError:
            return None
    return None


def replace_board_from_payload(session: Session, case_id: uuid.UUID, board: dict[str, Any]) -> None:
    """Полностью заменяет доску кейса по JSON (stages, tasks, connections)."""
    stages = board.get("stages") or []
    tasks = board.get("tasks") or {}
    connections = board.get("connections") or []

    card_id_rows = session.execute(
        select(PlanningBoardCard.id).where(PlanningBoardCard.planning_case_id == case_id)
    ).all()
    card_ids = [r[0] for r in card_id_rows]
    if card_ids:
        session.query(PlanningBoardCardEntry).filter(PlanningBoardCardEntry.card_id.in_(card_ids)).delete(
            synchronize_session=False
        )
    session.query(PlanningBoardConnection).filter(PlanningBoardConnection.planning_case_id == case_id).delete(
        synchronize_session=False
    )
    session.query(PlanningBoardCard).filter(PlanningBoardCard.planning_case_id == case_id).delete(
        synchronize_session=False
    )
    session.query(PlanningBoardStage).filter(PlanningBoardStage.planning_case_id == case_id).delete(
        synchronize_session=False
    )
    session.flush()

    stage_ids: dict[str, uuid.UUID] = {}
    card_ids_map: dict[tuple[str, str], uuid.UUID] = {}

    for si, stage_name in enumerate(stages):
        if not stage_name:
            continue
        sid = uuid.uuid4()
        session.add(
            PlanningBoardStage(
                id=sid,
                planning_case_id=case_id,
                sort_index=si,
                name=str(stage_name),
            )
        )
        stage_ids[str(stage_name)] = sid

    # Иначе при bulk INSERT карточек PostgreSQL ещё не видит строки planning_board_stage → FK violation.
    session.flush()

    for stage_name, task_list in tasks.items():
        st_id = stage_ids.get(str(stage_name))
        if not st_id:
            continue
        for task in task_list or []:
            if not isinstance(task, dict):
                continue
            ck = str(task.get("id") or "").strip()
            if not ck:
                continue
            cid = uuid.uuid4()
            card_ids_map[(str(stage_name), ck)] = cid
            ex = _user_id_by_display_name(session, task.get("executor"))
            ap = _user_id_by_display_name(session, task.get("approver"))
            dl = _parse_deadline(task.get("deadline"))
            session.add(
                PlanningBoardCard(
                    id=cid,
                    planning_case_id=case_id,
                    stage_id=st_id,
                    card_key=ck,
                    name=str(task.get("name") or ck),
                    executor_user_id=ex,
                    approver_user_id=ap,
                    deadline=dl,
                    status=str(task.get("status") or "в работе"),
                    date_created_text=task.get("date") if task.get("date") is not None else None,
                )
            )
            for li, ent in enumerate(task.get("entries") or []):
                if not isinstance(ent, dict):
                    continue
                session.add(
                    PlanningBoardCardEntry(
                        id=uuid.uuid4(),
                        card_id=cid,
                        line_index=li,
                        system_name=ent.get("system"),
                        input_data=ent.get("input"),
                        output_data=ent.get("output"),
                    )
                )

    session.flush()

    for c in connections:
        if not isinstance(c, dict):
            continue
        fs, fid, ts, tid = c.get("fromStage"), c.get("fromId"), c.get("toStage"), c.get("toId")
        if fs is None or fid is None or ts is None or tid is None:
            continue
        fcid = card_ids_map.get((str(fs), str(fid)))
        tcid = card_ids_map.get((str(ts), str(tid)))
        if not fcid or not tcid:
            continue
        session.add(
            PlanningBoardConnection(
                id=uuid.uuid4(),
                planning_case_id=case_id,
                from_card_id=fcid,
                to_card_id=tcid,
            )
        )

    case = session.get(PlanningCase, case_id)
    if case:
        case.updated_at = datetime.now(timezone.utc)

    session.flush()
