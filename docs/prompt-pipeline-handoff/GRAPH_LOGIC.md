# Логика построения Mermaid-графа (вкладка «n8n»)

Код в **`prompt-builder.html`**. Данные: `data/prompt_deep_causes.json`, `data/asset_modeling_knowledge.json`, словарь **`hypothesis_exact_phrase.json`** (в корне этого handoff; в исходнике — `HYPOTHESIS_EXACT_PHRASE`).

## Ключевые функции (строки ≈)

| Функция | Строка |
|---------|--------|
| `collectPromptElementsForCausesPanel` | 2179 |
| `genericFallbackDeepCauses` | 2200 |
| `resolveDeepCauseBundle` | 2223 |
| `resolveInfluenceList` | 2257 |
| `resolveHypothesisBundle` | 2273 |
| `normalizeInfluenceKey` | 2285 |
| `HYPOTHESIS_EXACT_PHRASE` | 2293–2484 |
| `hypothesisToActionPhrase` / `formatHypothesisAsWhatToDo` | 2489, 2512 |
| `sanitizeMermaidLabel` | 2659 |
| `pickBestInfluenceIndex` | 2673 |
| `pickHeavyTextIndices` | 2690 |
| `n8nScenarioTotalAndRank` | 2702 |
| `renderMermaidIntoHost` | 2735 |
| `initN8nZoom` | 2771 |
| `buildMermaidFromPanel` | 2803–3018 |

Условие запуска: `promptConfirmed && K` (начало `buildMermaidFromPanel`).

## Скрипт синхронизации словаря гипотез

`scripts/_gen_hypothesis_exact_phrase.py` — поддержание `HYPOTHESIS_EXACT_PHRASE` в согласованности с данными.
