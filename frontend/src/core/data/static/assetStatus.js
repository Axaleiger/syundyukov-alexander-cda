/**
 * Статусы активов для шапки "Состояние актива".
 * Устойчиво = green check, Под управленческим риском = orange ? or red !
 * ННГ — красный восклицательный знак.
 */

const ASSET_STATUS = {
  'do-orenburg': 'stable',
  'do-yamal': 'risk_orange',
  'do-zapolyarye': 'stable',
  'do-messoyakha': 'risk_orange',
  'do-meretoyakha': 'stable',
  'do-noyabrsk': 'risk_red',
  'do-megion': 'stable',
  'do-tomsk': 'risk_orange',
  'prirazlomnoe': 'stable',
  'do-vostok': 'stable',
  'do-hantos': 'stable',
  'do-salym': 'risk_orange',
  'spb': 'stable',
  'moscow': 'risk_orange',
}

export function getAssetStatus(assetId) {
  return ASSET_STATUS[assetId] || 'stable'
}

export function getAssetStatusLabel(status) {
  if (status === 'stable') return 'Устойчивое развитие'
  if (status === 'risk_red') return 'Критическое состояние'
  return 'Требует внимания'
}

export function getAssetStatusIcon(status) {
  if (status === 'stable') return { type: 'check', color: 'green' }
  if (status === 'risk_red') return { type: 'exclamation', color: 'red' }
  return { type: 'question', color: 'orange' }
}
