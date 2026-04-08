"""
Встроенные снимки досок, если рядом нет Excel (копии из frontend BOARD_PRESETS / bpmData).
При наличии файлов в SCENARIO_EXPORTS_DIR сид берёт данные только из Excel.
"""

from __future__ import annotations

from datetime import date

from app.seed.excel_board import BoardParseResult

_TODAY = date.today()

# Совпадает с BOARD_PRESETS.hantos + buildPresetTasks во frontend/src/modules/planning/data/bpmData.js
_HANTOS_STAGES = [
    "Геологоразведка и работа с РБ",
    "Разработка",
    "Планирование и обустройство",
    "Бурение и ВСР",
    "Добыча",
]


def _card(
    cid: str,
    name: str,
    *,
    executor: str = "Сюндюков А.В.",
    approver: str = "Иванова Е.П.",
) -> dict:
    return {
        "id": cid,
        "name": name,
        "executor": executor,
        "approver": approver,
        "deadline": _TODAY,
        "status": "в работе",
        "date": _TODAY.strftime("%d.%m.%Y"),
        "entries": [{"system": "Б6К", "input": "—", "output": "—"}],
    }


def board_fallback_hantos() -> BoardParseResult:
    """Доска для кейса «Хантос» (hantos.xlsx) — сценарий «Проактивное управление ремонтами…»."""
    tasks = {
        "Геологоразведка и работа с РБ": [
            _card("G1", "Оценка запасов"),
            _card("G2", "Подсчёт КИН"),
            _card("G3", "Подготовка РБ"),
            _card("G4", "Сейсмика и интерпретация"),
        ],
        "Разработка": [
            _card("R1", "Проект разработки"),
            _card("R2", "Схема обустройства"),
            _card("R3", "ТЭО"),
            _card("R4", "Проектная документация"),
        ],
        "Планирование и обустройство": [
            _card("P1", "Строительство объектов"),
            _card("P2", "Пусконаладка"),
            _card("P3", "Подготовка кустов"),
            _card("P4", "Инфраструктура"),
        ],
        "Бурение и ВСР": [
            _card("B1", "Бурение скважин"),
            _card("B2", "ГРП"),
            _card("B3", "КРС"),
            _card("B4", "ВСР и ремонты"),
        ],
        "Добыча": [
            _card("D1", "Эксплуатация"),
            _card("D2", "Мониторинг"),
            _card("D3", "Оптимизация режимов"),
            _card("D4", "Учёт добычи"),
        ],
    }
    return BoardParseResult(stages=list(_HANTOS_STAGES), tasks=tasks, connections=[])


def board_fallback_do_burenie() -> BoardParseResult:
    """Доска для «Управление добычей…» — чуть иначе названия карточек в добыче, чтобы отличать от hantos."""
    base = board_fallback_hantos()
    t = {k: [dict(x) for x in v] for k, v in base.tasks.items()}
    t["Добыча"] = [
        _card("D1", "Баланс жидкости"),
        _card("D2", "Мониторинг добычи"),
        _card("D3", "Оптимизация режимов"),
        _card("D4", "Учёт добычи"),
    ]
    return BoardParseResult(stages=list(base.stages), tasks=t, connections=[])
