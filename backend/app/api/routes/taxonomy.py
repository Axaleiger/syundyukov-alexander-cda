from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.tables import BusinessDirection, ProductionStage, ProductionStageLabel
from app.schemas.taxonomy import BusinessDirectionOut, ProductionStageOut

router = APIRouter()


@router.get("/business-directions", response_model=list[BusinessDirectionOut])
def business_directions(db: Session = Depends(get_db)):
    rows = db.query(BusinessDirection).order_by(BusinessDirection.sort_order).all()
    return [
        BusinessDirectionOut(
            id=r.id,
            name=r.name,
            sort_order=r.sort_order,
        )
        for r in rows
    ]


@router.get("/production-stages", response_model=list[ProductionStageOut])
def production_stages(db: Session = Depends(get_db)):
    stages = db.query(ProductionStage).order_by(ProductionStage.sort_order).all()
    out = []
    for s in stages:
        lab = (
            db.query(ProductionStageLabel)
            .filter(
                ProductionStageLabel.production_stage_id == s.id,
                ProductionStageLabel.locale == "ru",
            )
            .one_or_none()
        )
        if not lab:
            continue
        out.append(
            ProductionStageOut(
                id=s.id,
                canonical_key=s.canonical_key,
                sort_order=s.sort_order,
                label_full=lab.label_full,
                label_short=lab.label_short,
            )
        )
    return out
