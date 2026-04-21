# Карта логики в `prompt-builder.html`

Номера строк — ориентир по состоянию репозитория; при правках файла сдвинутся. **Не переносить**: блоки HTML/CSS вкладки «ИИ-помощник» (разметка, классы `_panel_*`, стили `.ai-*` в `<style>`) — только перечисленные функции и константы.

## Глобальные данные и загрузка

| Символ / место | Строка (≈) | Назначение |
|----------------|------------|------------|
| `K`, `T`, `A`, `LEX`, `PRE`, `SRULES`, `SREG` | 419 | Знания, теги, активы, лексикон, пресеты, семантические правила, регрессия. |
| `btnFetchAll` / `Promise.all` | 1301–1329 | Загрузка JSON с сервера, в т.ч. `semantic_rules.json`, `semantic_regression_cases.json`, `lexicon.json`, `actives_tree.json`, `scenario_presets.json`. |
| `promptConfirmed` | 420, 1189+, 1371, 2804 | Граф и анализ после подтверждения конструктора. |

## Склейка человекочитаемого промпта (общие кирпичики)

Используются и конструктором, и ИИ-веткой.

| Функция | Строка (≈) |
|---------|------------|
| `escapeHtml` | 435 |
| `skel`, `item` | 443, 447 |
| `appendFinalPeriodIfNeeded` | 458 |
| `formatHorizonPlanningPhrase` | 573 |
| `formatHorizonPlanningPhraseFromState` | 559 |
| `openingEntityHtml` | 579 |
| `normalizeClauseText` | 587 |
| `appendBulletBlock` | 598 |
| `aiEnsureObjectiveTarget` | 654 |
| `formatGoalClauseAi` | 665 |
| `formatConstraintLineForPromptAi` | 682 |
| `buildGoalsConsLeversHtmlAi` | 703 |
| `buildHumanPromptHtmlAi` | 731 |
| `formatGoalClause` (конструктор) | 1039 |
| `unitStepForSemantics` | 1016 |
| `fillBaseSelectOptions` | 1153 |

## Мастер ИИ: модель состояния (логика без внешнего вида)

| Символ / функция | Строка (≈) | Назначение |
|------------------|------------|------------|
| `aiWizard` | 3074–3085 | Шаги, `done`, `state` (base, horizon, goals, constraints, levers, objectiveTargets, constraintParams). |
| `AI_PROMPT_INPUT_DEBOUNCE_MS` | 3088 | Пауза после ввода перед `aiStartPromptTransform`. |
| Переменные debounce / speech / seq | 3086–3101 | Управление асинхронностью. |
| `aiCheckedValues`, `aiConfirmedStepCount` | 3103–3114 | Снятие значений с полей шагов мастера. |
| `aiSyncDefaultsAndRefresh` | 3116 | Подстановка дефолтных base/horizon из `K`. |
| `aiRenderStepChips`, `aiGotoStep`, `aiMarkStepDone` | 3369–3414 | Навигация по шагам (в новом UI — своя навигация, тот же state). |
| `aiRefreshProgressivePrompt` | 3416 | Перезапись `#aiPromptOut` через `buildHumanPromptHtmlAi`. |
| `aiFindClosestPresetByText` | 3429 | Эвристика по `PRE.presets`. |

### Генерация DOM шагов мастера (заменить в целевом проекте)

`aiBuildStepBase`, `aiBuildStepHorizon`, `aiBuildStepGoals`, `aiBuildStepConstraints`, `aiBuildStepLevers` — **3130–3367**: создают `fieldset`/`label`/`input` под текущий дизайн. Переносить **не как вёрстку**, а как спецификацию полей, которые должны менять `aiWizard.state`.

## Нормализация и разбиение текста запроса

| Функция | Строка (≈) |
|---------|------------|
| `aiSentenceCase` | 3444 |
| `aiNormalizeCapexOpexFromSpeech` | 3454 |
| `aiPrettifyCommasInRequest` | 3471 |
| `aiNormalizeTextRu` | 3482 |
| `aiExtractIntents` | 3505 |
| `aiScoreCandidates` | 3516 |
| `aiApplyPolicies` | 3573 |
| `aiPolicyFilterState` | 3650 |
| `aiMaybeGroqFallback` | 3681 |
| `aiBuildSemanticStateFromText` | 3720 |
| `aiDetectDoFromText` | 3728 |
| `aiApplyDoSelectionFromText` | 3755 |
| `aiRenderSemanticExplain` | 3770 | Заглушка (можно расширять). |
| `aiRunSemanticRegression` | 3772 |
| `aiIsDomainRelevant` | 3807 |
| `aiClauseDomainCorpus` | 3818 |
| `aiSplitPromptPrimary` | 3839 |
| `aiSplitByConjunctionI` | 3866 |
| `aiFragmentKeepable` | 3870 |
| `aiFilterPromptClauses` | 3896 |
| `aiApplyPresetState` | 3927 |
| `aiApplySemanticState` | 3942 |
| `aiStartPromptTransform` | 3956 |
| `initAiAssistant` | 4025 | Привязка событий: микрофон, `input` на `#aiPromptOut`, reset, random. |
| `getPickerStatePerDo`, `buildEntityOpeningSentence` | 4170+ | Текст про выбранные ДО/месторождения для начала промпта. |

## Событие ввода в окне запроса (поведение)

Внутри `initAiAssistant` (≈ **4126–4132**): на элементе `#aiPromptOut` слушатель `input` — если не `aiSuppressPromptInput`, берётся первая строка `innerText`, ставится `setTimeout(..., AI_PROMPT_INPUT_DEBOUNCE_MS)` → `aiStartPromptTransform(txt)`.

## Сущности и промпт конструктора (связь с графом)

| Функция | Строка (≈) |
|---------|------------|
| `getPickerStatePerDo` | 4170 |
| `buildEntityOpeningSentence` | 4202 |
| `buildHumanPrompt` / `buildHumanPromptHtml` | 4246+ |

Граф (`buildMermaidFromPanel`) читает **галочки конструктора** (`getChecked("objectives")` и т.д.), а не `aiWizard`, пока вы сами не синхронизируете два UI.

## Зависимости при переносе

- Минимум для скоринга целей: `K` из `asset_modeling_knowledge.json`, `SRULES`, опционально `LEX`.
- Для регрессии в консоли: `SREG` + вызов `aiRunSemanticRegression` (экспорт в `window` на строке **4257**).
- Для графа: см. `GRAPH_LOGIC.md` + мердж `prompt_deep_causes` в `K`, Mermaid в рантайме.
