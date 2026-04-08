"""Детерминированные UUID для воспроизводимого сида."""

from __future__ import annotations

import uuid

_NS = uuid.uuid5(uuid.NAMESPACE_DNS, "cda.orchestrator.seed")


def seed_uuid(kind: str, key: str) -> uuid.UUID:
    return uuid.uuid5(_NS, f"{kind}:{key}")
