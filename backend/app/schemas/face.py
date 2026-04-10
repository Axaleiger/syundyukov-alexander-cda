"""Ответы API главной (face): точки карты."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class MapPointOut(BaseModel):
    """Точка на карте главной: id — прежний slug из mapPoints.json."""

    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(description="Стабильный ключ UI (slug)")
    asset_id: str = Field(serialization_alias="assetId", description="UUID актива в БД")
    name: str
    lon: float
    lat: float
    city: str | None = None
    sort_order: int = Field(0, serialization_alias="sortOrder")
