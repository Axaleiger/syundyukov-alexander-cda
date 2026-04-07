"""Сборка JSON доски из нормализованных таблиц (как ожидает будущий фронт)."""

from __future__ import annotations

import uuid
from collections import defaultdict
from typing import Any

from sqlalchemy.orm import Session

from app.models.tables import (
    AppUser,
    PlanningBoardCard,
    PlanningBoardCardEntry,
    PlanningBoardConnection,
    PlanningBoardStage,
    PlanningCase,
)


def build_board_payload(session: Session, case_id: uuid.UUID) -> dict[str, Any]:
    case = session.get(PlanningCase, case_id)
    if not case:
        return {}

    stages = (
        session.query(PlanningBoardStage)
        .filter(PlanningBoardStage.planning_case_id == case_id)
        .order_by(PlanningBoardStage.sort_index)
        .all()
    )

    cards = (
        session.query(PlanningBoardCard)
        .filter(PlanningBoardCard.planning_case_id == case_id)
        .order_by(PlanningBoardCard.card_key)
        .all()
    )
    card_ids = [c.id for c in cards]
    entries_by_card: dict[uuid.UUID, list[PlanningBoardCardEntry]] = defaultdict(list)
    if card_ids:
        q = session.query(PlanningBoardCardEntry).filter(PlanningBoardCardEntry.card_id.in_(card_ids))
        for e in q:
            entries_by_card[e.card_id].append(e)
        for lst in entries_by_card.values():
            lst.sort(key=lambda x: x.line_index)

    user_ids = set()
    for c in cards:
        if c.executor_user_id:
            user_ids.add(c.executor_user_id)
        if c.approver_user_id:
            user_ids.add(c.approver_user_id)
    users: dict[uuid.UUID, str] = {}
    if user_ids:
        for u in session.query(AppUser).filter(AppUser.id.in_(user_ids)):
            users[u.id] = u.display_name

    stage_order = [s.name for s in stages]
    stage_id_to_name = {s.id: s.name for s in stages}

    tasks: dict[str, list[dict[str, Any]]] = {n: [] for n in stage_order}
    for s in stages:
        tasks.setdefault(s.name, [])

    for c in cards:
        sname = stage_id_to_name.get(c.stage_id)
        if not sname:
            continue
        entries = []
        for e in entries_by_card.get(c.id, []):
            entries.append(
                {
                    "system": e.system_name or "",
                    "input": e.input_data or "",
                    "output": e.output_data or "",
                }
            )
        tasks[sname].append(
            {
                "id": c.card_key,
                "name": c.name,
                "executor": users.get(c.executor_user_id, "") if c.executor_user_id else "",
                "approver": users.get(c.approver_user_id, "") if c.approver_user_id else "",
                "deadline": c.deadline.isoformat() if c.deadline else None,
                "status": c.status,
                "date": c.date_created_text or "",
                "entries": entries,
            }
        )

    conns = (
        session.query(PlanningBoardConnection)
        .filter(PlanningBoardConnection.planning_case_id == case_id)
        .all()
    )
    card_by_id = {c.id: c for c in cards}
    connections_out = []
    for cn in conns:
        fc = card_by_id.get(cn.from_card_id)
        tc = card_by_id.get(cn.to_card_id)
        if not fc or not tc:
            continue
        connections_out.append(
            {
                "fromStage": stage_id_to_name.get(fc.stage_id, ""),
                "fromId": fc.card_key,
                "toStage": stage_id_to_name.get(tc.stage_id, ""),
                "toId": tc.card_key,
            }
        )

    return {
        "stages": stage_order,
        "tasks": tasks,
        "connections": connections_out,
    }
