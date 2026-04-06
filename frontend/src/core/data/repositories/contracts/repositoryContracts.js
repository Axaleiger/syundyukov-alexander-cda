/**
 * Контракты репозиториев (порты). Реализации подменяются в registry / composition root.
 * Проект на JS — проверка на этапе сборки через JSDoc; сами объекты создаются фабриками в static/.
 */

/**
 * @typedef {Object} ScenarioRow
 * @property {string} id
 * @property {string} name
 * @property {string} stageType
 * @property {string} [direction]
 * @property {string} [dateCreated]
 * — остальные поля как у текущей генерации сценариев.
 */

/**
 * @typedef {Object} ScenariosRepository
 * @property {() => string[]} getScenarioStageFilters
 * @property {() => { value: string, label: string }[]} getPeriodOptions
 * @property {() => string[]} getScenarioDirections
 * @property {() => ScenarioRow[]} getScenarios
 * @property {(scenarios: ScenarioRow[], periodValue: string) => ScenarioRow[]} filterScenariosByPeriod
 */

/**
 * @typedef {Object} MapGlobeRepository
 * @property {() => unknown[]} getMapPoints
 * @property {() => unknown[]} getChains
 * @property {() => { from: string, to: string, cf: number }[]} getCfArrows
 * @property {(assetId: string) => number | null} getBudgetForAssetId
 * @property {() => Record<string, number>} getBudgetByAsset
 * @property {(t: number) => string} budgetToColor
 * @property {(regionName: string) => string | null} getAssetRegionKey
 * @property {() => string[]} getAssetRegionNames
 */

/**
 * @typedef {Object} RosesRepository
 * @property {() => { name: string, value: number, coverage?: number }[]} getProductionStages
 * @property {() => Record<string, { name: string, value: number, coverage?: number }[]>} getObjectsByStage
 * @property {() => { name: string, value: number, coverage?: number }[]} getDefaultObjects
 * @property {(coverage: number) => string} petalColorFromCoverage
 */

/**
 * @typedef {Object} AssetStatusRepository
 * @property {(assetId: string) => string} getAssetStatus
 * @property {(status: string) => string} getAssetStatusLabel
 * @property {(status: string) => { type: string, color: string }} getAssetStatusIcon
 */

/**
 * @typedef {Object} LifecycleRepository
 * @property {(baseUrl?: string) => Promise<unknown>} loadLifecycleFromExcel
 * @property {() => unknown} getLifecycleStreamData
 */

/**
 * @typedef {Object} FunnelRepository
 * @property {() => number[]} getPointsPerLevel
 * @property {(levelIndex: number, pointIndex: number) => string} getEntityLabel
 * @property {() => Record<string, string[]>} getFunnelEntityLabels
 * @property {() => Promise<unknown>} loadFunnelFromExcel
 * @property {(entities: unknown) => unknown} buildFunnelFromEntities
 */

/**
 * Демо-данные панели «Сравнение сценариев развития актива» (RightPanel).
 * @typedef {Object} AssetScenarioComparisonRepository
 * @property {(assetId: string | null | undefined) => unknown} getComparison
 * @property {() => Array<{ key: string, label: string, unit: string, decimals: number }>} getMetricDefs
 */

/**
 * @typedef {Object} AppRepositories
 * @property {ScenariosRepository} scenarios
 * @property {MapGlobeRepository} mapGlobe
 * @property {RosesRepository} roses
 * @property {AssetStatusRepository} assetStatus
 * @property {LifecycleRepository} lifecycle
 * @property {FunnelRepository} funnel
 * @property {AssetScenarioComparisonRepository} assetScenarioComparison
 */

export {}
