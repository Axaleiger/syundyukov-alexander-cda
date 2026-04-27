import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import DataSourceMixin


class ScenarioCreate(BaseModel):
    """Создание сценария (тело POST). Поля camelCase как в JSON API."""

    name: str
    external_code: Optional[str] = Field(None, validation_alias="externalCode")
    status: str = "в работе"
    production_stage_id: uuid.UUID = Field(..., validation_alias="productionStageId")
    business_direction_id: Optional[uuid.UUID] = Field(
        None, validation_alias="businessDirectionId"
    )
    asset_id: Optional[uuid.UUID] = Field(None, validation_alias="assetId")
    author_user_id: Optional[uuid.UUID] = Field(None, validation_alias="authorUserId")
    is_approved: bool = Field(False, validation_alias="isApproved")
    calculation_duration_text: Optional[str] = Field(
        None, validation_alias="calculationDurationText"
    )

    model_config = {"populate_by_name": True}


class ScenarioUpdate(BaseModel):
    """Частичное обновление сценария (тело PATCH). Поля camelCase как в JSON API."""

    name: Optional[str] = None
    external_code: Optional[str] = Field(None, validation_alias="externalCode")
    status: Optional[str] = None
    production_stage_id: Optional[uuid.UUID] = Field(
        None, validation_alias="productionStageId"
    )
    business_direction_id: Optional[uuid.UUID] = Field(
        None, validation_alias="businessDirectionId"
    )
    asset_id: Optional[uuid.UUID] = Field(None, validation_alias="assetId")
    is_approved: Optional[bool] = Field(None, validation_alias="isApproved")
    calculation_duration_text: Optional[str] = Field(
        None, validation_alias="calculationDurationText"
    )

    model_config = {"populate_by_name": True}


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
    business_direction_id: Optional[uuid.UUID] = Field(None, serialization_alias="businessDirectionId")
    business_direction_name: Optional[str] = Field(None, serialization_alias="businessDirectionName")

    model_config = {"populate_by_name": True}


class ScenarioOut(ScenarioListItem):
    approved_at: Optional[datetime] = Field(None, serialization_alias="approvedAt")

    model_config = {"populate_by_name": True}
