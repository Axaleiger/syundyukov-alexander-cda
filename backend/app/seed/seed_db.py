"""
Загрузка справочников, сценариев (как во фронте) и досок из Excel.
"""

from __future__ import annotations

import json
import os
from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.tables import (
    AppUser,
    Asset,
    BoardTemplate,
    BusinessDirection,
    ItSystem,
    MetricDefinition,
    OrgUnit,
    PlanningBoardCard,
    PlanningBoardCardEntry,
    PlanningBoardConnection,
    PlanningBoardStage,
    PlanningCase,
    ProductionStage,
    ProductionStageLabel,
    Region,
    Scenario,
    SystemAlias,
)
from app.seed.board_demo_snapshots import board_fallback_do_burenie, board_fallback_hantos
from app.seed.excel_board import BoardParseResult, parse_board_from_excel
from app.seed.ids import seed_uuid
from app.seed.scenarios_gen import SCENARIO_DIRECTIONS, generate_scenarios
from app.seed.static_lists import FIELD_ASSETS, PERSONNEL, PRODUCTION_STAGES, SYSTEMS_LIST

STAGE_NAME_TO_KEY = {label: key for key, label, _ in PRODUCTION_STAGES}


def _default_exports_dir() -> Path:
    """Порядок: SCENARIO_EXPORTS_DIR; seed_data в backend; Sin/docs/scenario_exports."""
    here = Path(__file__).resolve()
    backend = here.parents[2]
    bundled = backend / "seed_data" / "scenario_exports"
    if bundled.is_dir():
        return bundled
    for depth in (4, 3):
        if len(here.parents) > depth:
            sin_docs = here.parents[depth] / "docs" / "scenario_exports"
            if sin_docs.is_dir():
                return sin_docs
    return bundled


def truncate_all(session: Session) -> None:
    session.execute(
        text(
            """
            TRUNCATE TABLE
                audit_event,
                scenario_comparison_run,
                metric_slice,
                ontology_graph,
                board_template,
                planning_board_connection,
                planning_board_card_entry,
                planning_board_card,
                planning_board_stage,
                planning_case,
                scenario,
                system_alias,
                it_system,
                asset_region,
                asset,
                region,
                metric_definition,
                production_stage_label,
                production_stage,
                business_direction,
                app_user,
                org_unit
            RESTART IDENTITY CASCADE;
            """
        )
    )
    session.commit()


def _upsert_org_units(session: Session) -> dict[str, Any]:
    orgs = {}
    for label, key in [
        ("ООО «Газпромнефть-Хантос»", "org_hantos"),
        ("ООО «Газпромнефть-ННГ»", "org_nng"),
        ("ООО «Газпромнефть-Мегион»", "org_megion"),
    ]:
        oid = seed_uuid("org_unit", key)
        session.merge(
            OrgUnit(
                id=oid,
                parent_id=None,
                name=label,
            )
        )
        orgs[key] = oid
    return orgs


def _map_face_points_path() -> Path:
    here = Path(__file__).resolve()
    backend = here.parents[2]
    return backend / "seed_data" / "map_face_points.json"


def _upsert_map_face_assets(session: Session) -> None:
    """Точки карты главной: slug + geo; не пересекаются с месторождениями сценариев."""
    path = _map_face_points_path()
    if not path.is_file():
        return
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        return
    for sort_i, row in enumerate(raw):
        slug = row.get("id")
        if not slug:
            continue
        name = row.get("name") or slug
        lon = row.get("lon")
        lat = row.get("lat")
        if lon is None or lat is None:
            continue
        city = row.get("city")
        aid = seed_uuid("asset", f"map:{slug}")
        session.merge(
            Asset(
                id=aid,
                display_name=name,
                asset_type="map_point",
                slug=slug,
                city=city,
                map_sort_order=sort_i,
                org_unit_id=None,
                geo_lat=float(lat),
                geo_lon=float(lon),
                metadata_={"source": "map_face_points.json"},
            )
        )


def _upsert_regions_and_assets(session: Session, orgs: dict[str, Any]) -> dict[str, Any]:
    region_map = {}
    asset_map = {}
    org_by_field = {
        "Зимнее": orgs["org_hantos"],
        "Новогоднее": orgs["org_nng"],
        "Аганское": orgs["org_megion"],
    }
    for field_name, _do_label, akey in FIELD_ASSETS:
        rid = seed_uuid("region", akey)
        session.merge(Region(id=rid, name=field_name, code=akey))
        region_map[field_name] = rid
        aid = seed_uuid("asset", akey)
        session.merge(
            Asset(
                id=aid,
                display_name=field_name,
                asset_type="месторождение",
                org_unit_id=org_by_field.get(field_name),
                metadata_={"demoField": True},
            )
        )
        asset_map[field_name] = aid
    return {"regions": region_map, "assets": asset_map}


def _upsert_production_stages(session: Session) -> dict[str, Any]:
    by_key: dict[str, Any] = {}
    for key, label_full, sort_order in PRODUCTION_STAGES:
        sid = seed_uuid("production_stage", key)
        session.merge(
            ProductionStage(
                id=sid,
                canonical_key=key,
                sort_order=sort_order,
            )
        )
        session.merge(
            ProductionStageLabel(
                production_stage_id=sid,
                locale="ru",
                label_short=None,
                label_full=label_full,
            )
        )
        by_key[key] = sid
    return by_key


def _upsert_business_directions(session: Session) -> None:
    for i, name in enumerate(SCENARIO_DIRECTIONS):
        session.merge(
            BusinessDirection(
                id=seed_uuid("business_direction", str(i)),
                parent_id=None,
                name=name,
                sort_order=i,
            )
        )


def _upsert_users(session: Session, orgs: dict[str, Any]) -> dict[str, Any]:
    by_name: dict[str, Any] = {}
    org_default = orgs["org_hantos"]
    for name in PERSONNEL:
        uid = seed_uuid("app_user", name)
        job = "Ведущий эксперт" if "Сюндюков" in name else None
        session.merge(
            AppUser(
                id=uid,
                external_subject=f"demo:{name}",
                email=None,
                display_name=name,
                job_title=job,
                photo_url=None,
                org_unit_id=org_default,
                is_active=True,
            )
        )
        by_name[name] = uid
    return by_name


def _upsert_it_systems(session: Session) -> None:
    for s in SYSTEMS_LIST:
        iid = seed_uuid("it_system", s)
        session.merge(ItSystem(id=iid, canonical_name=s, description=None))
        session.merge(
            SystemAlias(
                id=seed_uuid("system_alias", s),
                it_system_id=iid,
                alias=s,
                source="bpm",
            )
        )


def _upsert_metrics(session: Session) -> None:
    for key, unit in [("npv", "млн руб"), ("payback", "лет"), ("irr", "%")]:
        session.merge(
            MetricDefinition(
                id=seed_uuid("metric_definition", key),
                key=key,
                unit=unit,
                aggregation="last",
                ui_widget_config=None,
            )
        )


def _upsert_scenarios(
    session: Session,
    stage_by_key: dict[str, Any],
    users_by_name: dict[str, Any],
    assets: dict[str, Any],
) -> None:
    rows = generate_scenarios()
    for row in rows:
        st_name = row["stageType"]
        key = STAGE_NAME_TO_KEY.get(st_name)
        if not key:
            continue
        ps_id = stage_by_key[key]
        asset_field = row["field"]
        asset_id = assets.get(asset_field)
        author_id = users_by_name.get(row["author"])
        try:
            di = SCENARIO_DIRECTIONS.index(row["direction"])
        except ValueError:
            di = 0
        direction_id = seed_uuid("business_direction", str(di))
        scid = seed_uuid("scenario", row["id"])
        session.merge(
            Scenario(
                id=scid,
                external_code=row["id"],
                name=row["name"],
                production_stage_id=ps_id,
                business_direction_id=direction_id,
                asset_id=asset_id,
                status=row["status"],
                author_user_id=author_id,
                is_approved=bool(row.get("approved")),
                approved_at=datetime.now() if row.get("approved") else None,
                approved_by_user_id=author_id if row.get("approved") else None,
                calculation_duration_text=row.get("timeCalc"),
                last_calc_at=None,
                valid_from=None,
                valid_to=None,
                version=1,
                data_source="demo",
            )
        )


def _persist_planning_board(
    session: Session,
    *,
    case_key: str,
    scenario_external_code: str | None,
    asset_field: str,
    parsed: BoardParseResult,
    users_by_name: dict[str, Any],
    assets: dict[str, Any],
) -> None:
    if not parsed.stages:
        return
    asset_id = assets.get(asset_field) or assets.get("Зимнее")
    if not asset_id:
        return
    scenario_id = (
        seed_uuid("scenario", scenario_external_code) if scenario_external_code else None
    )
    creator = users_by_name.get("Сюндюков А.В.")
    case_id = seed_uuid("planning_case", case_key)
    session.merge(
        PlanningCase(
            id=case_id,
            scenario_id=scenario_id,
            asset_id=asset_id,
            created_by_user_id=creator,
            updated_by_user_id=creator,
            board_snapshot=None,
            assumptions_ref=None,
            data_source="demo",
        )
    )

    stage_ids: dict[str, Any] = {}
    card_ids: dict[tuple[str, str], Any] = {}

    for si, stage_name in enumerate(parsed.stages):
        st_id = seed_uuid("planning_board_stage", f"{case_key}:{stage_name}:{si}")
        session.merge(
            PlanningBoardStage(
                id=st_id,
                planning_case_id=case_id,
                sort_index=si,
                name=stage_name,
            )
        )
        stage_ids[stage_name] = st_id

    for stage_name, task_list in parsed.tasks.items():
        st_id = stage_ids.get(stage_name)
        if not st_id:
            continue
        for task in task_list:
            ck = task["id"]
            cid = seed_uuid("planning_board_card", f"{case_key}:{stage_name}:{ck}")
            card_ids[(stage_name, ck)] = cid
            ex = users_by_name.get(task.get("executor") or "")
            ap = users_by_name.get(task.get("approver") or "")
            dl = task.get("deadline")
            if isinstance(dl, datetime):
                dl = dl.date()
            session.merge(
                PlanningBoardCard(
                    id=cid,
                    planning_case_id=case_id,
                    stage_id=st_id,
                    card_key=ck,
                    name=task.get("name") or ck,
                    executor_user_id=ex,
                    approver_user_id=ap,
                    deadline=dl if isinstance(dl, date) else None,
                    status=task.get("status") or "в работе",
                    date_created_text=task.get("date"),
                )
            )
            for li, ent in enumerate(task.get("entries") or []):
                session.merge(
                    PlanningBoardCardEntry(
                        id=seed_uuid("planning_board_card_entry", f"{case_key}:{cid}:{li}"),
                        card_id=cid,
                        line_index=li,
                        system_name=ent.get("system"),
                        input_data=ent.get("input"),
                        output_data=ent.get("output"),
                    )
                )

    for c in parsed.connections:
        fs, fid, ts, tid = c["fromStage"], c["fromId"], c["toStage"], c["toId"]
        fcid = card_ids.get((fs, fid))
        tcid = card_ids.get((ts, tid))
        if not fcid or not tcid:
            continue
        session.merge(
            PlanningBoardConnection(
                id=seed_uuid("planning_board_connection", f"{case_key}:{fs}:{fid}:{ts}:{tid}"),
                planning_case_id=case_id,
                from_card_id=fcid,
                to_card_id=tcid,
            )
        )


def _load_board_case(
    session: Session,
    *,
    case_key: str,
    scenario_external_code: str | None,
    asset_field: str,
    excel_path: Path,
    users_by_name: dict[str, Any],
    assets: dict[str, Any],
) -> None:
    if excel_path.is_file():
        parsed = parse_board_from_excel(str(excel_path))
    else:
        parsed = (
            board_fallback_do_burenie()
            if case_key == "case_do_burenie"
            else board_fallback_hantos()
        )
    _persist_planning_board(
        session,
        case_key=case_key,
        scenario_external_code=scenario_external_code,
        asset_field=asset_field,
        parsed=parsed,
        users_by_name=users_by_name,
        assets=assets,
    )


def _board_templates(session: Session) -> None:
    presets = {
        "hantos": "ООО \"Газпромнефть-Хантос\" / Зимнее",
        "nng": "ООО \"Газпромнефть-ННГ\" / Новогоднее",
        "mgn": "ООО \"Газпромнефть-Мегион\" / Аганское",
    }
    for key, label in presets.items():
        session.merge(
            BoardTemplate(
                id=seed_uuid("board_template", key),
                name=label,
                asset_type=key,
                template={"presetKey": key, "stages": []},
            )
        )


def run_seed(session: Session, exports_dir: Path | None = None) -> None:
    env_dir = (os.getenv("SCENARIO_EXPORTS_DIR") or "").strip()
    if exports_dir is None:
        exports_dir = Path(env_dir) if env_dir else _default_exports_dir()
    if not exports_dir.is_dir():
        raise FileNotFoundError(
            f"Нет каталога с Excel: {exports_dir}. Задайте SCENARIO_EXPORTS_DIR или положите файлы в Sin/docs/scenario_exports."
        )

    truncate_all(session)

    orgs = _upsert_org_units(session)
    ra = _upsert_regions_and_assets(session, orgs)
    _upsert_map_face_assets(session)
    assets_map = ra["assets"]
    stage_by_key = _upsert_production_stages(session)
    _upsert_business_directions(session)
    users_by_name = _upsert_users(session, orgs)
    _upsert_it_systems(session)
    _upsert_metrics(session)
    _upsert_scenarios(session, stage_by_key, users_by_name, assets_map)
    _board_templates(session)

    hantos_x = exports_dir / "hantos.xlsx"
    dobur_x = exports_dir / "Управление добычей с учетом ближайшего бурения.xlsx"

    # hantos: «Проактивное управление ремонтами…» — SC-17271 (детерминированный id из scenarios_gen)
    _load_board_case(
        session,
        case_key="case_hantos",
        scenario_external_code="SC-17271",
        asset_field="Зимнее",
        excel_path=hantos_x,
        users_by_name=users_by_name,
        assets=assets_map,
    )
    # «Управление добычей с учётом ближайшего бурения» — первый именованный сценарий, SC-17081
    sc_do = None
    for row in generate_scenarios():
        if "Управление добычей" in row["name"] and "бурения" in row["name"]:
            sc_do = row["id"]
            break
    _load_board_case(
        session,
        case_key="case_do_burenie",
        scenario_external_code=sc_do,
        asset_field="Зимнее",
        excel_path=dobur_x,
        users_by_name=users_by_name,
        assets=assets_map,
    )

    # Остальные сценарии из списка — по одному кейсу планирования с демо-доской (как hantos-пресет).
    scenarios_with_excel_board = {"SC-17271", sc_do} if sc_do else {"SC-17271"}
    template_board = board_fallback_hantos()
    for row in generate_scenarios():
        ext = row["id"]
        if ext in scenarios_with_excel_board:
            continue
        field = row.get("field") or "Зимнее"
        _persist_planning_board(
            session,
            case_key=f"pc:{ext}",
            scenario_external_code=ext,
            asset_field=field,
            parsed=template_board,
            users_by_name=users_by_name,
            assets=assets_map,
        )

    session.commit()
