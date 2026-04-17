# Перенос вкладки «n8n» (Mermaid-граф причин и гипотез)

Эта папка — самодостаточный набор **данных** и **описания логики**, чтобы воспроизвести наполнение графа в другом проекте (например, в другом репозитории Cursor).

## Важно

Для сборки приложения (Vite) используются **канонические копии** JSON в `frontend/src/modules/thinking/data/formalizator/`; файлы в `docs/formalizator/` остаются самодостаточным описанием и исходником для переноса.

Вкладка **не** использует экспорт workflow n8n. Это **встроенный Mermaid** (`flowchart LR`), который собирается в браузере из отмеченных в конструкторе целей / ограничений / рычагов и из библиотек JSON.

## Содержимое папки

| Файл / каталог | Назначение |
|----------------|------------|
| `data/asset_modeling_knowledge.json` | База `K`: `dimensions`, `dimension_help`, тексты целей/ограничений/рычагов для подписей узлов и fallback-текстов причин. |
| `data/prompt_deep_causes.json` | Ключ = id цели (G…), ограничения (C…) или рычага (L…): `situation`, `introduction`, `causes[]`, `influences[]` (или legacy `hypothesis_proposals`), `hypothesis_introduction`. |
| `data/influence_tags.json` | В текущем приложении подгружается как `T` и требуется для общей готовности интерфейса (`mergeReady`); для **чистой** логики `buildMermaidFromPanel` достаточно `K` с вмерженным `prompt_deep_causes`. |
| `hypothesis_exact_phrase.json` | Словарь «формулировка влияния → «что сделать?»»; в исходнике это `HYPOTHESIS_EXACT_PHRASE` в `prompt-builder.html`. Генератор: `python scripts/_gen_hypothesis_exact_phrase.py`. |

## Поток данных (кратко)

1. Пользователь отмечает чекбоксы целей, ограничений, рычагов в конструкторе промпта.
2. `collectPromptElementsForCausesPanel()` собирает список элементов `{ key, kind, labelExact }`.
3. Для каждой **цели** (`kind === "objective"`): `resolveDeepCauseBundle` читает причины из `K.prompt_deep_causes[el.key]` или `genericFallbackDeepCauses` (подсказки из `K.dimension_help`).
4. `resolveHypothesisBundle` формирует список гипотез/влияний из `row.influences` или fallback из текстов причин.
5. Подписи узлов гипотез проходят через `formatHypothesisAsWhatToDo` (словарь из `hypothesis_exact_phrase.json` / `HYPOTHESIS_EXACT_PHRASE`).
6. `buildMermaidFromPanel()` строит строки Mermaid (узлы `N0`, `N1`, цели `G*`, причины `C*_*`, промежуточные `HF*_*`, общие узлы влияний `I*`), рёбра и подсветку «лучшего» пути по длине текста (`pickBestInfluenceIndex`, `pickHeavyTextIndices`).
7. `renderMermaidIntoHost` вызывает `mermaid.run`; `initN8nZoom` — масштаб колесом с Ctrl и кнопками.

Подробные якоря по функциям и строкам — в `GRAPH_SOURCES.md`.

## Зависимости в целевом проекте

- Подключённый **Mermaid** (как в исходном `prompt-builder.html`: `mermaid.initialize`, `mermaid.run`).
- Глобальное состояние аналога `K` с полями `dimensions`, `dimension_help`, `prompt_deep_causes` (после merge из `prompt_deep_causes.json`).
- Флаг готовности промпта (`promptConfirmed` в оригинале): граф пересчитывается только после подтверждения конструктора.

## Архив

Готовый однофайловый перенос: **`export/n8n-graph-handoff.zip`** в корне репозитория (внутри — та же структура: `data/`, `README.md`, `GRAPH_SOURCES.md`, `hypothesis_exact_phrase.json`).

Пересобрать в PowerShell из корня репозитория:

`Compress-Archive -Path export\n8n-graph-handoff\* -DestinationPath export\n8n-graph-handoff.zip -Force`
