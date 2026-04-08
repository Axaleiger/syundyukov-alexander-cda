import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.tables import Asset

router = APIRouter()


@router.get("")
def list_assets(db: Session = Depends(get_db)):
    rows = db.query(Asset).order_by(Asset.display_name).all()
    return [
        {
            "id": str(a.id),
            "displayName": a.display_name,
            "assetType": a.asset_type,
            "orgUnitId": str(a.org_unit_id) if a.org_unit_id else None,
            "dataSource": "demo",
        }
        for a in rows
    ]


@router.get("/{asset_id}")
def get_asset(asset_id: uuid.UUID, db: Session = Depends(get_db)):
    a = db.get(Asset, asset_id)
    if not a:
        from fastapi import HTTPException

        raise HTTPException(404, "asset not found")
    return {
        "id": str(a.id),
        "displayName": a.display_name,
        "assetType": a.asset_type,
        "orgUnitId": str(a.org_unit_id) if a.org_unit_id else None,
        "metadata": a.metadata_,
        "dataSource": "demo",
    }
