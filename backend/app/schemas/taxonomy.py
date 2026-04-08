import uuid
from typing import Optional

from pydantic import BaseModel, Field


class BusinessDirectionOut(BaseModel):
    id: uuid.UUID
    name: str
    sort_order: Optional[int] = Field(None, serialization_alias="sortOrder")

    model_config = {"populate_by_name": True, "from_attributes": True}


class ProductionStageOut(BaseModel):
    id: uuid.UUID
    canonical_key: str = Field(..., serialization_alias="canonicalKey")
    sort_order: int = Field(..., serialization_alias="sortOrder")
    label_full: str = Field(..., serialization_alias="labelFull")
    label_short: Optional[str] = Field(None, serialization_alias="labelShort")

    model_config = {"populate_by_name": True, "from_attributes": True}
