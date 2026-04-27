import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.tables import (
    AppUser,
    Asset,
    BusinessDirection,
    PlanningCase,
    ProductionStage,
    Scenario,
)
from app.schemas.scenario import (
    ScenarioCreate,
    ScenarioListItem,
    ScenarioOut,
    ScenarioUpdate,
)

router = APIRouter()


def _resolve_author_user_id(
    db: Session, author_user_id: Optional[uuid.UUID], author_name: Optional[str]
) -> Optional[uuid.UUID]:
    if author_user_id:
        return author_user_id
    author_name = (author_name or "").strip()
    if not author_name:
        return None
    existing = (
        db.query(AppUser)
        .filter(AppUser.display_name == author_name, AppUser.is_active.is_(True))
        .first()
    )
    if existing:
        return existing.id
    user = AppUser(
        id=uuid.uuid4(),
        display_name=author_name,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user.id


def _upsert_asset_for_scenario(
    db: Session,
    *,
    asset_id: Optional[uuid.UUID],
    field_name: Optional[str],
    do_label: Optional[str],
) -> Optional[uuid.UUID]:
    """Подбирает/создаёт asset по полю fieldName и сохраняет doLabel в metadata."""
    resolved_asset_id = asset_id
    field_name = (field_name or "").strip()
    do_label = (do_label or "").strip()

    asset = db.get(Asset, resolved_asset_id) if resolved_asset_id else None
    if not asset and field_name:
        asset = db.query(Asset).filter(Asset.display_name == field_name).first()
    if not asset and field_name:
        max_sort = db.query(func.max(Asset.map_sort_order)).scalar() or 0
        asset = Asset(
            id=uuid.uuid4(),
            display_name=field_name,
            map_sort_order=int(max_sort) + 1,
            metadata_={},
        )
        db.add(asset)
        db.flush()
    if asset:
        meta = dict(asset.metadata_ or {})
        if do_label:
            meta["doLabel"] = do_label
        asset.metadata_ = meta
        return asset.id
    return resolved_asset_id


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
    rows = q.order_by(Scenario.updated_at.desc(), Scenario.created_at.desc()).all()
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
    stage_id = body.production_stage_id
    if not stage_id:
        first_stage = db.query(ProductionStage).order_by(ProductionStage.sort_order).first()
        if not first_stage:
            raise HTTPException(400, "production stage list is empty")
        stage_id = first_stage.id
    asset_id = body.asset_id
    if not asset_id and not (body.field_name or "").strip():
        first_asset = db.query(Asset).order_by(Asset.display_name).first()
        if not first_asset:
            raise HTTPException(400, "asset list is empty")
        asset_id = first_asset.id
    asset_id = _upsert_asset_for_scenario(
        db,
        asset_id=asset_id,
        field_name=body.field_name,
        do_label=body.do_label,
    )
    author_user_id = _resolve_author_user_id(db, body.author_user_id, body.author_name)
    s = Scenario(
        id=uuid.uuid4(),
        external_code=body.external_code,
        name=body.name.strip(),
        status=body.status.strip() if body.status else "в работе",
        production_stage_id=stage_id,
        business_direction_id=body.business_direction_id,
        asset_id=asset_id,
        author_user_id=author_user_id,
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
    if "author_name" in data:
        s.author_user_id = _resolve_author_user_id(
            db, data.get("author_user_id"), data.get("author_name")
        )
        data.pop("author_name", None)
        data.pop("author_user_id", None)
    if "field_name" in data or "do_label" in data or "asset_id" in data:
        s.asset_id = _upsert_asset_for_scenario(
            db,
            asset_id=data.get("asset_id", s.asset_id),
            field_name=data.get("field_name"),
            do_label=data.get("do_label"),
        )
        data.pop("field_name", None)
        data.pop("do_label", None)
        data.pop("asset_id", None)
    for k, v in data.items():
        setattr(s, k, v)
    s.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(s)
    return _scenario_to_out(s, db)


@router.delete("/{scenario_id}")
def delete_scenario(scenario_id: uuid.UUID, db: Session = Depends(get_db)):
    s = db.get(Scenario, scenario_id)
    if not s:
        raise HTTPException(404, "scenario not found")
    linked_cases = db.query(PlanningCase).filter(PlanningCase.scenario_id == scenario_id).all()
    for c in linked_cases:
        db.delete(c)
    db.delete(s)
    db.commit()
    return {"ok": True, "deletedScenarioId": str(scenario_id), "deletedCases": len(linked_cases)}
