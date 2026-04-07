from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.tables import AppUser, OrgUnit
from app.schemas.me import MeResponse
from app.seed.ids import seed_uuid

router = APIRouter()


@router.get("", response_model=MeResponse)
def get_me(db: Session = Depends(get_db)):
    uid = seed_uuid("app_user", "Сюндюков А.В.")
    user = db.get(AppUser, uid)
    if not user:
        raise HTTPException(404, "User not found — run scripts/reset_and_seed.py")
    org_name = None
    if user.org_unit_id:
        ou = db.get(OrgUnit, user.org_unit_id)
        org_name = ou.name if ou else None
    return MeResponse(
        user_id=user.id,
        display_name=user.display_name,
        job_title=user.job_title,
        email=user.email,
        org_unit_name=org_name,
    )
