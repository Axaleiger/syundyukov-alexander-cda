import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import DataSourceMixin


class ScenarioListItem(DataSourceMixin):
    id: uuid.UUID
    external_code: Optional[str] = Field(None, serialization_alias="externalCode")
    name: str
    status: str
    production_stage_id: uuid.UUID = Field(..., serialization_alias="productionStageId")
    asset_id: Optional[uuid.UUID] = Field(None, serialization_alias="assetId")
    author_user_id: Optional[uuid.UUID] = Field(None, serialization_alias="authorUserId")
    author_display_name: Optional[str] = Field(None, serialization_alias="authorDisplayName")
    is_approved: bool = Field(..., serialization_alias="isApproved")
    calculation_duration_text: Optional[str] = Field(None, serialization_alias="calculationDurationText")
    created_at: datetime = Field(..., serialization_alias="createdAt")
    updated_at: datetime = Field(..., serialization_alias="updatedAt")

    model_config = {"populate_by_name": True}


class ScenarioOut(ScenarioListItem):
    business_direction_id: Optional[uuid.UUID] = Field(None, serialization_alias="businessDirectionId")
    approved_at: Optional[datetime] = Field(None, serialization_alias="approvedAt")

    model_config = {"populate_by_name": True}
