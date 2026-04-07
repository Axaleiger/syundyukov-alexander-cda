import uuid
from typing import Optional

from pydantic import BaseModel, Field


class UserPublic(BaseModel):
    id: uuid.UUID
    display_name: str = Field(..., serialization_alias="displayName")
    job_title: Optional[str] = Field(None, serialization_alias="jobTitle")
    email: Optional[str] = None
    org_unit_name: Optional[str] = Field(None, serialization_alias="orgUnitName")

    model_config = {"populate_by_name": True, "from_attributes": True}
