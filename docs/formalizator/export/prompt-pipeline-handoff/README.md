# Перенос логики окна запроса, разбиения на цели и графа (без дизайна)

Пакет для переноса в другой проект **поведения и данных**, без копирования вёрстки/CSS вкладки «ИИ-помощник» и без визуальных паттернов — в целевом приложении UI уже свой.

Исходный монолит: **`prompt-builder.html`** в корне репозитория formalizator. Точная карта функций и строк — в **`PIPELINE_SOURCES.md`**. Логика графа Mermaid — в **`GRAPH_LOGIC.md`** (дублирует якоря из `export/n8n-graph-handoff` для одного zip).

## Что считается «логикой окна запроса»

- **Ввод**: `contenteditable` с `id="aiPromptOut"`; при `input` берётся **первая строка** текста, после паузы вызывается пайплайн (debounce `AI_PROMPT_INPUT_DEBOUNCE_MS`, сейчас 5000 мс).
- **Подавление рекурсии**: флаг `aiSuppressPromptInput` при программной подстановке HTML в то же поле.
- **Голос**: Web Speech API (`SpeechRecognition`), накопление транскрипта, по `onend` — тот же вход в пайплайн, что и с клавиатуры.
- **Прогресс «преобразования»**: таймеры `aiTransformProgressTimer` / `aiTransformFinishTimer`, счётчик `aiTransformSeq` для отмены устаревших тиков — при переносе можно заменить на свой индикатор без смены семантики.

## Цепочка «запрос → цели/ограничения/рычаги»

1. Нормализация строки: `aiSentenceCase` → `aiNormalizeCapexOpexFromSpeech` → `aiPrettifyCommasInRequest`.
2. Фильтрация шумовых фрагментов: `aiFilterPromptClauses` (опирается на `aiSplitPromptPrimary`, `aiSplitByConjunctionI`, `aiFragmentKeepable`, `aiIsDomainRelevant`, `aiClauseDomainCorpus`).
3. Проверка домена: `aiIsDomainRelevant`; иначе — ветка «вне области» без скоринга.
4. Семантика: `aiBuildSemanticStateFromText` = `aiNormalizeTextRu` + `aiExtractIntents` (из **`data/semantic_rules.json`**) + `aiScoreCandidates` (имена/справки из `K`, ключевые слова рычагов из **`data/lexicon.json`**) + `aiApplyPolicies`.
5. Опционально: `aiMaybeGroqFallback` (если в `semantic_rules.json` включён флаг и задан `window.__GROQ_API_KEY`) + `aiPolicyFilterState`.
6. Состояние мастера: `aiApplySemanticState` пишет в объект **`aiWizard.state`** (`base`, `horizon`, `goals`, `constraints`, `levers`, …).
7. Выбор ДО по тексту: `aiDetectDoFromText` / `aiApplyDoSelectionFromText` (нужен **`data/actives_tree.json`**).
8. Текст промпта для отображения: `buildHumanPromptHtmlAi` и вспомогательные функции (склейка фраз, цели с порогами — см. карту в `PIPELINE_SOURCES.md`).

Функции `aiBuildStepBase` / `Horizon` / `Goals` / … — это **генерация DOM** шагов мастера в текущем проекте; при переносе их не копируют, а подключают своё UI к тому же `aiWizard.state` и тем же обработчикам смысла (`aiApplySemanticState`, ручное редактирование шагов).

## Логика графа (вкладка n8n)

Строится не из n8n-экспорта, а из **отмеченных в конструкторе** целей/ограничений/рычагов и `K.prompt_deep_causes` + словаря гипотез. Подробно — **`GRAPH_LOGIC.md`** и файл **`hypothesis_exact_phrase.json`**.

## Файлы в `data/`

| Файл | Зачем |
|------|--------|
| `semantic_rules.json` | Интенты, триггеры, веса целей по интентам, политика отбора (пороги, лимиты, gates). |
| `semantic_regression_cases.json` | Регрессионные примеры для `aiRunSemanticRegression` (в консоли). |
| `lexicon.json` | `lever_keywords` для усиления скоринга рычагов. |
| `actives_tree.json` | Сопоставление текста с ДО для `aiDetectDoFromText`. |
| `scenario_presets.json` | Пресеты; используется `aiFindClosestPresetByText` при необходимости. |
| `asset_modeling_knowledge.json` | `dimensions`, `dimension_help` — подписи и скоринг по именам/справкам. |
| `prompt_deep_causes.json` | Причины и влияния для графа и панелей анализа. |
| `influence_tags.json` | В оригинале нужен для общей готовности загрузки (`mergeReady`); для чистого скоринга целей не обязателен. |

## Архив

Готовый файл переноса: **`export/prompt-pipeline-handoff.zip`** в корне репозитория formalizator.

Пересобрать в PowerShell:

`Compress-Archive -Path d:\formalizator\export\prompt-pipeline-handoff\* -DestinationPath d:\formalizator\export\prompt-pipeline-handoff.zip -Force`
