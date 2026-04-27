import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.tables import AppUser, BusinessDirection, Scenario
from app.schemas.scenario import (
    ScenarioCreate,
    ScenarioListItem,
    ScenarioOut,
    ScenarioUpdate,
)

router = APIRouter()


def _to_list_item(
    s: Scenario,
    author_name: Optional[str],
    business_direction_name: Optional[str],
) -> ScenarioListItem:
    return ScenarioListItem(
        id=s.id,
        external_code=s.external_code,
        name=s.name,
        status=s.status,
        production_stage_id=s.production_stage_id,
        asset_id=s.asset_id,
        author_user_id=s.author_user_id,
        author_display_name=author_name,
        is_approved=s.is_approved,
        calculation_duration_text=s.calculation_duration_text,
        created_at=s.created_at,
        updated_at=s.updated_at,
        data_source=s.data_source,
        business_direction_id=s.business_direction_id,
        business_direction_name=business_direction_name,
    )


def _scenario_to_out(s: Scenario, db: Session) -> ScenarioOut:
    author_name = None
    if s.author_user_id:
        u = db.get(AppUser, s.author_user_id)
        author_name = u.display_name if u else None
    bd_name = None
    if s.business_direction_id:
        bd = db.get(BusinessDirection, s.business_direction_id)
        bd_name = bd.name if bd else None
    base = _to_list_item(s, author_name, bd_name)
    return ScenarioOut(
        **base.model_dump(),
        approved_at=s.approved_at,
    )


@router.get("", response_model=list[ScenarioListItem])
def list_scenarios(
    db: Session = Depends(get_db),
    production_stage_id: Optional[uuid.UUID] = Query(None, alias="productionStageId"),
    asset_id: Optional[uuid.UUID] = Query(None, alias="assetId"),
):
    q = db.query(Scenario)
    if production_stage_id:
        q = q.filter(Scenario.production_stage_id == production_stage_id)
    if asset_id:
        q = q.filter(Scenario.asset_id == asset_id)
    rows = q.order_by(Scenario.created_at.desc()).all()
    author_ids = {s.author_user_id for s in rows if s.author_user_id}
    authors = {}
    if author_ids:
        for u in db.query(AppUser).filter(AppUser.id.in_(author_ids)):
            authors[u.id] = u.display_name
    bd_ids = {s.business_direction_id for s in rows if s.business_direction_id}
    bd_names: dict = {}
    if bd_ids:
        for bd in db.query(BusinessDirection).filter(BusinessDirection.id.in_(bd_ids)):
            bd_names[bd.id] = bd.name
    return [
        _to_list_item(s, authors.get(s.author_user_id), bd_names.get(s.business_direction_id))
        for s in rows
    ]


@router.get("/{scenario_id}", response_model=ScenarioOut)
def get_scenario(scenario_id: uuid.UUID, db: Session = Depends(get_db)):
    s = db.get(Scenario, scenario_id)
    if not s:
        raise HTTPException(404, "scenario not found")
    return _scenario_to_out(s, db)


@router.post("", response_model=ScenarioOut)
def create_scenario(body: ScenarioCreate, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    s = Scenario(
        id=uuid.uuid4(),
        external_code=body.external_code,
        name=body.name.strip(),
        status=body.status.strip() if body.status else "в работе",
        production_stage_id=body.production_stage_id,
        business_direction_id=body.business_direction_id,
        asset_id=body.asset_id,
        author_user_id=body.author_user_id,
        is_approved=bool(body.is_approved),
        calculation_duration_text=body.calculation_duration_text,
        created_at=now,
        updated_at=now,
        data_source="api",
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _scenario_to_out(s, db)


@router.patch("/{scenario_id}", response_model=ScenarioOut)
def patch_scenario(
    scenario_id: uuid.UUID,
    body: ScenarioUpdate,
    db: Session = Depends(get_db),
):
    s = db.get(Scenario, scenario_id)
    if not s:
        raise HTTPException(404, "scenario not found")
    data = body.model_dump(exclude_unset=True)
    if not data:
        return _scenario_to_out(s, db)
    for k, v in data.items():
        setattr(s, k, v)
    s.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(s)
    return _scenario_to_out(s, db)
