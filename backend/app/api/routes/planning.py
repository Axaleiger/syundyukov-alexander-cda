import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.tables import PlanningCase
from app.schemas.planning import PlanningBoardUpdateBody, PlanningCaseOut, PlanningCaseSummary
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
