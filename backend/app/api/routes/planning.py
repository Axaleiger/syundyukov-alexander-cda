import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.tables import Asset, PlanningCase, Scenario
from app.schemas.planning import (
    PlanningBoardUpdateBody,
    PlanningCaseCreateBody,
    PlanningCaseOut,
    PlanningCaseSummary,
)
from app.seed.board_demo_snapshots import board_fallback_do_burenie, board_fallback_hantos
from app.services.planning_assembly import build_board_payload
from app.services.planning_persist import replace_board_from_payload

router = APIRouter()


@router.get("/cases", response_model=list[PlanningCaseSummary])
def list_cases(
    db: Session = Depends(get_db),
    asset_id: Optional[uuid.UUID] = Query(None, alias="assetId"),
):
    q = db.query(PlanningCase)
    if asset_id:
        q = q.filter(PlanningCase.asset_id == asset_id)
    rows = q.order_by(PlanningCase.updated_at.desc()).all()
    return [
        PlanningCaseSummary(
            id=c.id,
            scenario_id=c.scenario_id,
            asset_id=c.asset_id,
            created_at=c.created_at,
            updated_at=c.updated_at,
            data_source=c.data_source,
        )
        for c in rows
    ]


@router.post("/cases", response_model=PlanningCaseOut)
def create_case(body: PlanningCaseCreateBody, db: Session = Depends(get_db)):
    asset_id = body.asset_id
    if not asset_id and body.scenario_id:
        scenario = db.get(Scenario, body.scenario_id)
        if scenario and scenario.asset_id:
            asset_id = scenario.asset_id
    if not asset_id:
        first_asset = db.query(Asset).order_by(Asset.display_name).first()
        if not first_asset:
            raise HTTPException(400, "asset list is empty")
        asset_id = first_asset.id
    now = datetime.now(timezone.utc)
    c = PlanningCase(
        id=uuid.uuid4(),
        scenario_id=body.scenario_id,
        asset_id=asset_id,
        created_by_user_id=body.created_by_user_id,
        updated_by_user_id=body.updated_by_user_id or body.created_by_user_id,
        data_source="api",
        created_at=now,
        updated_at=now,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return PlanningCaseOut(
        id=c.id,
        scenario_id=c.scenario_id,
        asset_id=c.asset_id,
        created_at=c.created_at,
        updated_at=c.updated_at,
        data_source=c.data_source,
        board={"stages": [], "tasks": {}, "connections": []},
    )


# Маршруты с суффиксом /board объявляем до /cases/{case_id}, чтобы матчинг пути был однозначен.
@router.get("/cases/{case_id}/board")
def get_case_board(case_id: uuid.UUID, db: Session = Depends(get_db)):
    """Только доска (тот же payload, что поле board в GET /cases/{id})."""
    c = db.get(PlanningCase, case_id)
    if not c:
        raise HTTPException(404, "planning case not found")
    return {"board": build_board_payload(db, case_id)}


@router.put("/cases/{case_id}/board", response_model=PlanningCaseOut)
def put_case_board(
    case_id: uuid.UUID,
    body: PlanningBoardUpdateBody,
    db: Session = Depends(get_db),
):
    c = db.get(PlanningCase, case_id)
    if not c:
        raise HTTPException(404, "planning case not found")
    replace_board_from_payload(db, case_id, body.board)
    db.commit()
    db.refresh(c)
    board = build_board_payload(db, case_id)
    return PlanningCaseOut(
        id=c.id,
        scenario_id=c.scenario_id,
        asset_id=c.asset_id,
        created_at=c.created_at,
        updated_at=c.updated_at,
        data_source=c.data_source,
        board=board,
    )


@router.get("/cases/{case_id}", response_model=PlanningCaseOut)
def get_case(case_id: uuid.UUID, db: Session = Depends(get_db)):
    c = db.get(PlanningCase, case_id)
    if not c:
        raise HTTPException(404, "planning case not found")
    board = build_board_payload(db, case_id)
    return PlanningCaseOut(
        id=c.id,
        scenario_id=c.scenario_id,
        asset_id=c.asset_id,
        created_at=c.created_at,
        updated_at=c.updated_at,
        data_source=c.data_source,
        board=board,
    )


@router.post("/cases/{case_id}/reset-demo", response_model=PlanningCaseOut)
def reset_case_to_demo(case_id: uuid.UUID, db: Session = Depends(get_db)):
    """
    Возвращает доску planning_case к дефолтному демо-шаблону по сценарию.
    Используется expo-режимом "Начать с начала".
    """
    c = db.get(PlanningCase, case_id)
    if not c:
        raise HTTPException(404, "planning case not found")

    scenario = db.get(Scenario, c.scenario_id) if c.scenario_id else None
    ext = (scenario.external_code or "") if scenario else ""
    name = (scenario.name or "") if scenario else ""

    is_do_burenie = (
        ext == "SC-17081"
        or ("Управление добычей" in name and "бурения" in name)
    )
    parsed = board_fallback_do_burenie() if is_do_burenie else board_fallback_hantos()

    board = {
        "stages": parsed.stages,
        "tasks": parsed.tasks,
        "connections": parsed.connections,
    }
    replace_board_from_payload(db, case_id, board)
    db.commit()
    db.refresh(c)
    out_board = build_board_payload(db, case_id)
    return PlanningCaseOut(
        id=c.id,
        scenario_id=c.scenario_id,
        asset_id=c.asset_id,
        created_at=c.created_at,
        updated_at=c.updated_at,
        data_source=c.data_source,
        board=out_board,
    )
