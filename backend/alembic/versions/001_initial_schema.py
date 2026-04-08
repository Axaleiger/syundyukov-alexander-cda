"""initial_schema

Revision ID: 001_initial
Revises:
Create Date: 2026-04-06

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "org_unit",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["parent_id"], ["org_unit.id"], name=op.f("org_unit_parent_id_fkey")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "app_user",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_subject", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("job_title", sa.Text(), nullable=True),
        sa.Column("photo_url", sa.Text(), nullable=True),
        sa.Column("org_unit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_unit_id"], ["org_unit.id"], name=op.f("app_user_org_unit_id_fkey")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_subject"),
    )
    op.create_index(op.f("ix_app_user_org_unit_id"), "app_user", ["org_unit_id"], unique=False)
    op.create_index(op.f("ix_app_user_display_name"), "app_user", ["display_name"], unique=False)

    op.create_table(
        "production_stage",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("canonical_key", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("canonical_key"),
    )
    op.create_table(
        "production_stage_label",
        sa.Column("production_stage_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("locale", sa.Text(), server_default=sa.text("'ru'"), nullable=False),
        sa.Column("label_short", sa.Text(), nullable=True),
        sa.Column("label_full", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["production_stage_id"],
            ["production_stage.id"],
            name=op.f("production_stage_label_production_stage_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("production_stage_id", "locale"),
    )
    op.create_table(
        "business_direction",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["parent_id"], ["business_direction.id"], name=op.f("business_direction_parent_id_fkey")
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "asset",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("display_name", sa.Text(), nullable=False),
        sa.Column("asset_type", sa.Text(), nullable=True),
        sa.Column("org_unit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("geo_lat", sa.Float(), nullable=True),
        sa.Column("geo_lon", sa.Float(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["org_unit_id"], ["org_unit.id"], name=op.f("asset_org_unit_id_fkey")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "region",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("code", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "asset_region",
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("region_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["asset.id"], name=op.f("asset_region_asset_id_fkey")),
        sa.ForeignKeyConstraint(["region_id"], ["region.id"], name=op.f("asset_region_region_id_fkey")),
        sa.PrimaryKeyConstraint("asset_id", "region_id"),
    )
    op.create_table(
        "it_system",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("canonical_name", sa.Text(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("canonical_name"),
    )
    op.create_table(
        "system_alias",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("it_system_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("alias", sa.Text(), nullable=False),
        sa.Column("source", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["it_system_id"], ["it_system.id"], name=op.f("system_alias_it_system_id_fkey")
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("it_system_id", "alias", name="uq_system_alias_system_alias"),
    )
    op.create_table(
        "metric_definition",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("key", sa.Text(), nullable=False),
        sa.Column("unit", sa.Text(), nullable=True),
        sa.Column("aggregation", sa.Text(), nullable=True),
        sa.Column("ui_widget_config", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )

    op.create_table(
        "scenario",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_code", sa.Text(), nullable=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("production_stage_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("business_direction_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("author_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_approved", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("approved_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("calculation_duration_text", sa.Text(), nullable=True),
        sa.Column("last_calc_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("data_source", sa.Text(), server_default=sa.text("'api'"), nullable=False),
        sa.ForeignKeyConstraint(
            ["approved_by_user_id"], ["app_user.id"], name=op.f("scenario_approved_by_user_id_fkey")
        ),
        sa.ForeignKeyConstraint(
            ["asset_id"], ["asset.id"], name=op.f("scenario_asset_id_fkey")
        ),
        sa.ForeignKeyConstraint(
            ["author_user_id"], ["app_user.id"], name=op.f("scenario_author_user_id_fkey")
        ),
        sa.ForeignKeyConstraint(
            ["business_direction_id"],
            ["business_direction.id"],
            name=op.f("scenario_business_direction_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["production_stage_id"],
            ["production_stage.id"],
            name=op.f("scenario_production_stage_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scenario_production_stage_id"), "scenario", ["production_stage_id"], unique=False)
    op.create_index(op.f("ix_scenario_asset_id"), "scenario", ["asset_id"], unique=False)
    op.create_index(op.f("ix_scenario_data_source"), "scenario", ["data_source"], unique=False)
    op.create_index(op.f("ix_scenario_author_user_id"), "scenario", ["author_user_id"], unique=False)

    op.create_table(
        "planning_case",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scenario_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("board_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("assumptions_ref", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("data_source", sa.Text(), server_default=sa.text("'api'"), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["asset.id"], name=op.f("planning_case_asset_id_fkey")),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"], ["app_user.id"], name=op.f("planning_case_created_by_user_id_fkey")
        ),
        sa.ForeignKeyConstraint(
            ["scenario_id"], ["scenario.id"], name=op.f("planning_case_scenario_id_fkey")
        ),
        sa.ForeignKeyConstraint(
            ["updated_by_user_id"], ["app_user.id"], name=op.f("planning_case_updated_by_user_id_fkey")
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_planning_case_asset_id"), "planning_case", ["asset_id"], unique=False)
    op.create_index(op.f("ix_planning_case_scenario_id"), "planning_case", ["scenario_id"], unique=False)
    op.create_index(
        op.f("ix_planning_case_created_by_user_id"), "planning_case", ["created_by_user_id"], unique=False
    )

    op.create_table(
        "planning_board_stage",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("planning_case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sort_index", sa.Integer(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(
            ["planning_case_id"],
            ["planning_case.id"],
            ondelete="CASCADE",
            name=op.f("planning_board_stage_planning_case_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("planning_case_id", "sort_index", name="uq_planning_board_stage_case_order"),
    )
    op.create_table(
        "planning_board_card",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("planning_case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("stage_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("card_key", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("executor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approver_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("status", sa.Text(), server_default=sa.text("'в работе'"), nullable=False),
        sa.Column("date_created_text", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["approver_user_id"], ["app_user.id"], name=op.f("planning_board_card_approver_user_id_fkey")
        ),
        sa.ForeignKeyConstraint(
            ["executor_user_id"], ["app_user.id"], name=op.f("planning_board_card_executor_user_id_fkey")
        ),
        sa.ForeignKeyConstraint(
            ["planning_case_id"],
            ["planning_case.id"],
            ondelete="CASCADE",
            name=op.f("planning_board_card_planning_case_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["stage_id"],
            ["planning_board_stage.id"],
            ondelete="CASCADE",
            name=op.f("planning_board_card_stage_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "planning_case_id",
            "stage_id",
            "card_key",
            name="uq_planning_board_card_case_stage_key",
        ),
    )
    op.create_index(
        op.f("ix_planning_board_card_planning_case_id"), "planning_board_card", ["planning_case_id"], unique=False
    )
    op.create_index(op.f("ix_planning_board_card_stage_id"), "planning_board_card", ["stage_id"], unique=False)
    op.create_index(
        op.f("ix_planning_board_card_executor_user_id"), "planning_board_card", ["executor_user_id"], unique=False
    )
    op.create_index(
        op.f("ix_planning_board_card_approver_user_id"), "planning_board_card", ["approver_user_id"], unique=False
    )

    op.create_table(
        "planning_board_card_entry",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("card_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("line_index", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("system_name", sa.Text(), nullable=True),
        sa.Column("input_data", sa.Text(), nullable=True),
        sa.Column("output_data", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["card_id"],
            ["planning_board_card.id"],
            ondelete="CASCADE",
            name=op.f("planning_board_card_entry_card_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_planning_board_card_entry_card_id"), "planning_board_card_entry", ["card_id"], unique=False
    )

    op.create_table(
        "planning_board_connection",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("planning_case_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_card_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("to_card_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["from_card_id"],
            ["planning_board_card.id"],
            ondelete="CASCADE",
            name=op.f("planning_board_connection_from_card_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["planning_case_id"],
            ["planning_case.id"],
            ondelete="CASCADE",
            name=op.f("planning_board_connection_planning_case_id_fkey"),
        ),
        sa.ForeignKeyConstraint(
            ["to_card_id"],
            ["planning_board_card.id"],
            ondelete="CASCADE",
            name=op.f("planning_board_connection_to_card_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_planning_board_connection_planning_case_id"),
        "planning_board_connection",
        ["planning_case_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_planning_board_connection_from_card_id"),
        "planning_board_connection",
        ["from_card_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_planning_board_connection_to_card_id"),
        "planning_board_connection",
        ["to_card_id"],
        unique=False,
    )

    op.create_table(
        "board_template",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("asset_type", sa.Text(), nullable=True),
        sa.Column("template", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "ontology_graph",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
        sa.Column("nodes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("edges", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("mermaid_hash", sa.Text(), nullable=True),
        sa.Column("derived_from_planning_case_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["derived_from_planning_case_id"],
            ["planning_case.id"],
            name=op.f("ontology_graph_derived_from_planning_case_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_ontology_graph_derived_from_planning_case_id"),
        "ontology_graph",
        ["derived_from_planning_case_id"],
        unique=False,
    )

    op.create_table(
        "metric_slice",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("portfolio_key", sa.Text(), nullable=True),
        sa.Column("period", sa.Text(), nullable=True),
        sa.Column("metric_definition_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("value_numeric", sa.Numeric(), nullable=True),
        sa.Column("value_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("provenance", sa.Text(), nullable=True),
        sa.Column("calculation_run_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("data_source", sa.Text(), server_default=sa.text("'api'"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["asset_id"], ["asset.id"], name=op.f("metric_slice_asset_id_fkey")),
        sa.ForeignKeyConstraint(
            ["metric_definition_id"],
            ["metric_definition.id"],
            name=op.f("metric_slice_metric_definition_id_fkey"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_metric_slice_metric_definition_id"), "metric_slice", ["metric_definition_id"], unique=False)
    op.create_index(op.f("ix_metric_slice_asset_id"), "metric_slice", ["asset_id"], unique=False)

    op.create_table(
        "scenario_comparison_run",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("asset_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assumptions_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "refreshed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("data_source", sa.Text(), server_default=sa.text("'api'"), nullable=False),
        sa.ForeignKeyConstraint(
            ["asset_id"], ["asset.id"], name=op.f("scenario_comparison_run_asset_id_fkey")
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_scenario_comparison_run_asset_id"), "scenario_comparison_run", ["asset_id"], unique=False
    )
    op.create_index(
        op.f("ix_scenario_comparison_run_assumptions_id"),
        "scenario_comparison_run",
        ["assumptions_id"],
        unique=False,
    )

    op.create_table(
        "audit_event",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("operation", sa.Text(), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["app_user.id"], name=op.f("audit_event_user_id_fkey")),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("audit_event")
    op.drop_table("scenario_comparison_run")
    op.drop_table("metric_slice")
    op.drop_table("ontology_graph")
    op.drop_table("board_template")
    op.drop_table("planning_board_connection")
    op.drop_table("planning_board_card_entry")
    op.drop_table("planning_board_card")
    op.drop_table("planning_board_stage")
    op.drop_table("planning_case")
    op.drop_table("scenario")
    op.drop_table("metric_definition")
    op.drop_table("system_alias")
    op.drop_table("it_system")
    op.drop_table("asset_region")
    op.drop_table("region")
    op.drop_table("asset")
    op.drop_table("business_direction")
    op.drop_table("production_stage_label")
    op.drop_table("production_stage")
    op.drop_table("app_user")
    op.drop_table("org_unit")
