from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.tables import AppUser, OrgUnit
from app.schemas.user import UserPublic

router = APIRouter()


@router.get("", response_model=list[UserPublic])
def list_users(
    db: Session = Depends(get_db),
    q: str | None = Query(None, description="Поиск по display_name"),
    limit: int = Query(50, ge=1, le=200),
):
    query = db.query(AppUser).filter(AppUser.is_active.is_(True))
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(AppUser.display_name.ilike(term))
    rows = query.order_by(AppUser.display_name).limit(limit).all()
    org_cache: dict = {}
    out = []
    for u in rows:
        org_name = None
        if u.org_unit_id:
            if u.org_unit_id not in org_cache:
                org_cache[u.org_unit_id] = db.get(OrgUnit, u.org_unit_id)
            ou = org_cache.get(u.org_unit_id)
            org_name = ou.name if ou else None
        out.append(
            UserPublic(
                id=u.id,
                display_name=u.display_name,
                job_title=u.job_title,
                email=u.email,
                org_unit_name=org_name,
            )
        )
    return out
