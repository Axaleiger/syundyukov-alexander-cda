#!/usr/bin/env python3
"""
Смоук-тесты всех публичных HTTP-эндпоинтов API.
Запуск: BASE_URL=http://localhost:8000 python scripts/test_api_smoke.py

Требуется запущенный API и заполненная БД (reset_and_seed).
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


def _get(url: str) -> tuple[int, Any]:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode()
            code = resp.getcode()
    except urllib.error.HTTPError as e:
        code = e.code
        body = e.read().decode() if e.fp else ""
    try:
        data = json.loads(body) if body else None
    except json.JSONDecodeError:
        data = body
    return code, data


def _fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        _fail(msg)


def main() -> None:
    base = os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")

    # --- /health ---
    code, data = _get(f"{base}/health")
    _assert(code == 200, f"/health expected 200, got {code}")
    _assert(isinstance(data, dict) and data.get("status") == "ok", f"/health body: {data}")

    # --- /health/db ---
    code, data = _get(f"{base}/health/db")
    _assert(code == 200, f"/health/db expected 200, got {code}")
    _assert(isinstance(data, dict), f"/health/db not json: {data}")
    _assert(data.get("status") in ("ok", "skipped", "error"), f"/health/db bad status: {data}")

    # --- /api/v1/me ---
    code, data = _get(f"{base}/api/v1/me")
    _assert(code == 200, f"/api/v1/me expected 200, got {code}: {data}")
    _assert(isinstance(data, dict), "/api/v1/me not object")
    _assert("userId" in data and data.get("displayName"), "/api/v1/me missing userId/displayName")

    # --- /api/v1/users ---
    code, data = _get(f"{base}/api/v1/users?limit=5")
    _assert(code == 200, f"/api/v1/users expected 200, got {code}")
    _assert(isinstance(data, list) and len(data) >= 1, "/api/v1/users should be non-empty list")
    u0 = data[0]
    _assert("id" in u0 and "displayName" in u0, "/api/v1/users item shape")

    q = urllib.parse.quote("Сюндюков")
    code, qdata = _get(f"{base}/api/v1/users?q={q}&limit=3")
    _assert(code == 200, "/api/v1/users?q=...")
    _assert(isinstance(qdata, list), "/api/v1/users search list")

    # --- /api/v1/taxonomy/production-stages ---
    code, data = _get(f"{base}/api/v1/taxonomy/production-stages")
    _assert(code == 200, f"/taxonomy/production-stages {code}")
    _assert(isinstance(data, list) and len(data) == 5, f"expected 5 stages, got {len(data) if isinstance(data, list) else data}")
    s0 = data[0]
    for k in ("id", "canonicalKey", "sortOrder", "labelFull"):
        _assert(k in s0, f"stage missing {k}: {s0}")

    # --- /api/v1/assets ---
    code, data = _get(f"{base}/api/v1/assets")
    _assert(code == 200, "/api/v1/assets")
    _assert(isinstance(data, list) and len(data) == 3, f"expected 3 assets, got {data}")
    asset_id = data[0]["id"]

    code, one = _get(f"{base}/api/v1/assets/{asset_id}")
    _assert(code == 200, f"/api/v1/assets/{{id}} {code}")
    _assert(one.get("id") == asset_id and one.get("displayName"), "asset detail")

    code, missing = _get(f"{base}/api/v1/assets/00000000-0000-0000-0000-000000000001")
    _assert(code == 404, f"asset 404 expected, got {code}")

    # --- /api/v1/scenarios ---
    code, scenarios = _get(f"{base}/api/v1/scenarios")
    _assert(code == 200, "/api/v1/scenarios")
    _assert(
        isinstance(scenarios, list) and len(scenarios) >= 20,
        f"scenarios list too short: {len(scenarios) if isinstance(scenarios, list) else 0}",
    )
    sc = scenarios[0]
    for k in ("id", "name", "status", "productionStageId", "dataSource"):
        _assert(k in sc, f"scenario item missing {k}")

    scenario_id = sc["id"]
    code, detail = _get(f"{base}/api/v1/scenarios/{scenario_id}")
    _assert(code == 200, "/api/v1/scenarios/{id}")
    _assert(detail.get("id") == scenario_id and "businessDirectionId" in detail, "scenario detail")

    # --- /api/v1/planning/cases ---
    code, data = _get(f"{base}/api/v1/planning/cases")
    _assert(code == 200, "/api/v1/planning/cases")
    _assert(isinstance(data, list) and len(data) >= 2, "at least 2 planning cases")
    case = data[0]
    for k in ("id", "assetId", "dataSource", "createdAt"):
        _assert(k in case, f"case summary missing {k}")

    case_id = case["id"]
    code, cased = _get(f"{base}/api/v1/planning/cases/{case_id}")
    _assert(code == 200, "/api/v1/planning/cases/{id}")
    _assert("board" in cased, "case detail missing board")
    board = cased["board"]
    _assert(isinstance(board, dict), "board not object")
    _assert("stages" in board and "tasks" in board, "board.stages / board.tasks")
    _assert(isinstance(board["stages"], list), "board.stages list")
    _assert(isinstance(board["tasks"], dict), "board.tasks object")
    # хотя бы одна задача с entries-подобной структурой если есть этапы
    if board["stages"]:
        st = board["stages"][0]
        tasks_for = board["tasks"].get(st, [])
        if tasks_for:
            t0 = tasks_for[0]
            for k in ("id", "name", "executor", "approver", "entries"):
                _assert(k in t0, f"task missing {k}")

    print("OK: все смоук-тесты пройдены.")
    print(f"    base URL: {base}")
    print(f"    сценариев в выборке: {len(scenarios)}")


if __name__ == "__main__":
    main()
