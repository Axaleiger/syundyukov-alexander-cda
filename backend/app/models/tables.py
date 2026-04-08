"""SQLAlchemy-модели по docs/cda_physical_model.dbml (PostgreSQL)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    Numeric,
    PrimaryKeyConstraint,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class OrgUnit(Base):
    __tablename__ = "org_unit"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_unit.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class AppUser(Base):
    __tablename__ = "app_user"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    external_subject: Mapped[Optional[str]] = mapped_column(Text, unique=True, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    job_title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    org_unit_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_unit.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class ProductionStage(Base):
    __tablename__ = "production_stage"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    canonical_key: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class ProductionStageLabel(Base):
    __tablename__ = "production_stage_label"
    __table_args__ = (
        PrimaryKeyConstraint("production_stage_id", "locale"),
    )

    production_stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_stage.id"), nullable=False
    )
    locale: Mapped[str] = mapped_column(Text, server_default=text("'ru'"), nullable=False)
    label_short: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    label_full: Mapped[str] = mapped_column(Text, nullable=False)


class BusinessDirection(Base):
    __tablename__ = "business_direction"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_direction.id"), nullable=True
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


class Asset(Base):
    __tablename__ = "asset"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    display_name: Mapped[str] = mapped_column(Text, nullable=False)
    asset_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    org_unit_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("org_unit.id"), nullable=True
    )
    geo_lat: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    geo_lon: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    metadata_: Mapped[Optional[dict[str, Any]]] = mapped_column("metadata", JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class Region(Base):
    __tablename__ = "region"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class AssetRegion(Base):
    __tablename__ = "asset_region"
    __table_args__ = (PrimaryKeyConstraint("asset_id", "region_id"),)

    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.id"), nullable=False
    )
    region_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("region.id"), nullable=False
    )


class ItSystem(Base):
    __tablename__ = "it_system"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    canonical_name: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class SystemAlias(Base):
    __tablename__ = "system_alias"
    __table_args__ = (UniqueConstraint("it_system_id", "alias", name="uq_system_alias_system_alias"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    it_system_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("it_system.id"), nullable=False
    )
    alias: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class MetricDefinition(Base):
    __tablename__ = "metric_definition"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    key: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    unit: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    aggregation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ui_widget_config: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class Scenario(Base):
    __tablename__ = "scenario"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    external_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    production_stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("production_stage.id"), nullable=False
    )
    business_direction_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("business_direction.id"), nullable=True
    )
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.id"), nullable=True
    )
    status: Mapped[str] = mapped_column(Text, nullable=False)
    author_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id"), nullable=True
    )
    is_approved: Mapped[bool] = mapped_column(Boolean, server_default=text("false"), nullable=False)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id"), nullable=True
    )
    calculation_duration_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_calc_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    valid_from: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    valid_to: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    data_source: Mapped[str] = mapped_column(Text, server_default=text("'api'"), nullable=False)


class PlanningCase(Base):
    __tablename__ = "planning_case"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    scenario_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("scenario.id"), nullable=True
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.id"), nullable=False
    )
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id"), nullable=True
    )
    updated_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id"), nullable=True
    )
    board_snapshot: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    assumptions_ref: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    data_source: Mapped[str] = mapped_column(Text, server_default=text("'api'"), nullable=False)


class PlanningBoardStage(Base):
    __tablename__ = "planning_board_stage"
    __table_args__ = (
        UniqueConstraint("planning_case_id", "sort_index", name="uq_planning_board_stage_case_order"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    planning_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("planning_case.id", ondelete="CASCADE"), nullable=False
    )
    sort_index: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)


class PlanningBoardCard(Base):
    __tablename__ = "planning_board_card"
    __table_args__ = (
        UniqueConstraint(
            "planning_case_id", "stage_id", "card_key", name="uq_planning_board_card_case_stage_key"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    planning_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("planning_case.id", ondelete="CASCADE"), nullable=False
    )
    stage_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("planning_board_stage.id", ondelete="CASCADE"), nullable=False
    )
    card_key: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    executor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id"), nullable=True
    )
    approver_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id"), nullable=True
    )
    deadline: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(Text, server_default=text("'в работе'"), nullable=False)
    date_created_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class PlanningBoardCardEntry(Base):
    __tablename__ = "planning_board_card_entry"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("planning_board_card.id", ondelete="CASCADE"), nullable=False
    )
    line_index: Mapped[int] = mapped_column(Integer, server_default=text("0"), nullable=False)
    system_name: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    input_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    output_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class PlanningBoardConnection(Base):
    __tablename__ = "planning_board_connection"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    planning_case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("planning_case.id", ondelete="CASCADE"), nullable=False
    )
    from_card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("planning_board_card.id", ondelete="CASCADE"), nullable=False
    )
    to_card_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("planning_board_card.id", ondelete="CASCADE"), nullable=False
    )


class BoardTemplate(Base):
    __tablename__ = "board_template"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    asset_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    template: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class OntologyGraph(Base):
    __tablename__ = "ontology_graph"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    version: Mapped[int] = mapped_column(Integer, server_default=text("1"), nullable=False)
    nodes: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    edges: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    mermaid_hash: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    derived_from_planning_case_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("planning_case.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class MetricSlice(Base):
    __tablename__ = "metric_slice"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    asset_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.id"), nullable=True
    )
    portfolio_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    period: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metric_definition_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("metric_definition.id"), nullable=False
    )
    value_numeric: Mapped[Optional[Decimal]] = mapped_column(Numeric, nullable=True)
    value_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    provenance: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    calculation_run_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    data_source: Mapped[str] = mapped_column(Text, server_default=text("'api'"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class ScenarioComparisonRun(Base):
    __tablename__ = "scenario_comparison_run"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    asset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("asset.id"), nullable=False
    )
    assumptions_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    refreshed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
    data_source: Mapped[str] = mapped_column(Text, server_default=text("'api'"), nullable=False)


class AuditEvent(Base):
    __tablename__ = "audit_event"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.id"), nullable=True
    )
    operation: Mapped[str] = mapped_column(Text, nullable=False)
    payload: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
