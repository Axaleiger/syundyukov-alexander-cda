# Источники логики графа: `prompt-builder.html`

Все перечисленные функции находятся в одном файле: **`prompt-builder.html`** (корень репозитория formalizator). Номера строк ориентировочные; при правках файла сместятся.

## Сбор элементов и разрешение текстов

| Функция | Строка (≈) | Роль |
|---------|------------|------|
| `collectPromptElementsForCausesPanel` | 2179 | Чекбоксы objectives / constraints / levers → массив `{ key, kind, labelExact }`. |
| `genericFallbackDeepCauses` | 2200 | Fallback причин и вступления из `K.dimension_help`. |
| `resolveDeepCauseBundle` | 2223 | Чтение `K.prompt_deep_causes[el.key]` → `{ situation, introduction, causes }`. |
| `clipInfluence` | 2241 | Обрезка строки влияния. |
| `influenceFallbackFromCauses` | 2248 | До двух влияний из текстов причин, иначе запасная фраза. |
| `resolveInfluenceList` | 2257 | `row.influences` / legacy `hypothesis_proposals` / fallback. |
| `resolveHypothesisBundle` | 2273 | Сводка для графа: `hypothesis_introduction` + `proposals`. |

## Словарь «что сделать?» по формулировке влияния

| Символ / функция | Строка (≈) | Роль |
|------------------|------------|------|
| `normalizeInfluenceKey` | 2285 | Нормализация ключа для дедупликации узлов `I*`. |
| `HYPOTHESIS_EXACT_PHRASE` | 2293–2484 | Объект ключ → фраза действия (дубликат в `hypothesis_exact_phrase.json` в этой папке). |
| `HYPOTHESIS_PREFIX_RULES` | 2487 | Пустой массив; расширяемые правила префиксов. |
| `hypothesisToActionPhrase` | 2489 | Обёртка над словарём и правилами. |
| `formatHypothesisAsWhatToDo` | 2512 | Итоговая подпись узла гипотезы для Mermaid. |

## Подсветка «лучшего» сценария и рендер

| Функция | Строка (≈) | Роль |
|---------|------------|------|
| `sanitizeMermaidLabel` | 2659 | Экранирование/укорочение подписи узла. |
| `pickBestInfluenceIndex` | 2673 | Индекс «лучшей» строки по длине (и при равенстве — больший индекс). |
| `pickHeavyTextIndices` | 2690 | До двух самых длинных текстов для цепочки подсветки. |
| `n8nScenarioTotalAndRank` | 2702 | Число комбинаций и номер выбранной «лучшей» комбинации. |
| `escapeHtmlLite` | 2728 | HTML в блоке текстового резюме под графом. |
| `renderMermaidIntoHost` | 2735 | Вставка и `mermaid.run`. |
| `applyN8nZoom` / `initN8nZoom` | 2760–2801 | Масштаб области графа. |
| `buildMermaidFromPanel` | 2803–3018 | Полная сборка `flowchart LR`, статистика, HTML-резюме. |

## Загрузка JSON в рантайме (оригинал)

Кнопка «Загрузить всё»: `btnFetchAll` — массив URL, в т.ч. `data/prompt_deep_causes.json` и `data/asset_modeling_knowledge.json`, результат в `K` с присвоением `K.prompt_deep_causes` (около строк 1301–1325).

## Связанный скрипт генерации словаря

`scripts/_gen_hypothesis_exact_phrase.py` — синхронизация `HYPOTHESIS_EXACT_PHRASE` с данными `prompt_deep_causes` / `influence_tags`.
