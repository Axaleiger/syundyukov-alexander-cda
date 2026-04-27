import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.schemas.common import DataSourceMixin


class PlanningBoardUpdateBody(BaseModel):
    board: dict[str, Any] = Field(
        ...,
        description="Снимок доски: stages, tasks по этапам, connections",
    )

    model_config = {"populate_by_name": True}


class PlanningCaseCreateBody(BaseModel):
    scenario_id: Optional[uuid.UUID] = Field(None, validation_alias="scenarioId")
    asset_id: Optional[uuid.UUID] = Field(None, validation_alias="assetId")
    created_by_user_id: Optional[uuid.UUID] = Field(
        None, validation_alias="createdByUserId"
    )
    updated_by_user_id: Optional[uuid.UUID] = Field(
        None, validation_alias="updatedByUserId"
    )

    model_config = {"populate_by_name": True}


class PlanningCaseSummary(DataSourceMixin):
    id: uuid.UUID
    scenario_id: Optional[uuid.UUID] = Field(None, serialization_alias="scenarioId")
    asset_id: uuid.UUID = Field(..., serialization_alias="assetId")
    created_at: datetime = Field(..., serialization_alias="createdAt")
    updated_at: datetime = Field(..., serialization_alias="updatedAt")

    model_config = {"populate_by_name": True}


class PlanningCaseOut(PlanningCaseSummary):
    board: dict[str, Any] = Field(
        ...,
        description="Снимок доски: stages, tasks по этапам, connections",
    )

    model_config = {"populate_by_name": True}
