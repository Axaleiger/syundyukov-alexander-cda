from fastapi import APIRouter

from app.api.routes import assets, me, planning, scenarios, taxonomy, users

api_router = APIRouter()
api_router.include_router(me.router, prefix="/me", tags=["identity"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(taxonomy.router, prefix="/taxonomy", tags=["taxonomy"])
api_router.include_router(assets.router, prefix="/assets", tags=["assets"])
api_router.include_router(scenarios.router, prefix="/scenarios", tags=["scenarios"])
api_router.include_router(planning.router, prefix="/planning", tags=["planning"])
