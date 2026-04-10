"""Главная страница (face): точки карты из БД."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.tables import Asset
from app.schemas.face import MapPointOut

router = APIRouter()


@router.get("/map-points", response_model=list[MapPointOut])
def list_face_map_points(db: Session = Depends(get_db)):
    """
    Объекты с заполненным slug и координатами — маркеры карты на /face и /new-demo/face.
    """
    rows = (
        db.query(Asset)
        .filter(Asset.slug.isnot(None))
        .filter(Asset.geo_lat.isnot(None))
        .filter(Asset.geo_lon.isnot(None))
        .order_by(Asset.map_sort_order, Asset.slug)
        .all()
    )
    return [
        MapPointOut(
            id=a.slug or "",
            asset_id=str(a.id),
            name=a.display_name,
            lon=float(a.geo_lon),
            lat=float(a.geo_lat),
            city=a.city,
            sort_order=a.map_sort_order,
        )
        for a in rows
        if a.slug
    ]
