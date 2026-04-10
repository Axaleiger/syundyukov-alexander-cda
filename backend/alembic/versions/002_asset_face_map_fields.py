"""asset slug city map_sort_order for face map

Revision ID: 002_face_map
Revises: 001_initial
Create Date: 2026-04-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002_face_map"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("asset", sa.Column("slug", sa.Text(), nullable=True))
    op.add_column("asset", sa.Column("city", sa.Text(), nullable=True))
    op.add_column(
        "asset",
        sa.Column("map_sort_order", sa.Integer(), server_default=sa.text("0"), nullable=False),
    )
    op.create_unique_constraint(op.f("uq_asset_slug"), "asset", ["slug"])
    op.create_index(op.f("ix_asset_map_sort_order"), "asset", ["map_sort_order"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_asset_map_sort_order"), table_name="asset")
    op.drop_constraint(op.f("uq_asset_slug"), "asset", type_="unique")
    op.drop_column("asset", "map_sort_order")
    op.drop_column("asset", "city")
    op.drop_column("asset", "slug")
