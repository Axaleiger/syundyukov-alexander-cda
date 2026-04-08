from pydantic import BaseModel, Field


class DataSourceMixin(BaseModel):
    data_source: str = Field(..., serialization_alias="dataSource")

    model_config = {"populate_by_name": True}
