/**
 * Уровень «Функции» воронки: по 6 инженерных операций на каждый микросервис.
 * Формулировки задаются в microserviceEngineeringSteps.js; итоговая длина = MICROSERVICES.length × 6.
 */

import { MICROSERVICES } from './microservicesFunnel.js'
import { getEngineeringStepsForMicroservice } from './microserviceEngineeringSteps.js'

function sixFunctionsForMicroservice(ms) {
  const steps = getEngineeringStepsForMicroservice(ms)
  return steps.map((step) => `${ms} · ${step}`)
}

export const FUNCTIONS = MICROSERVICES.flatMap((ms) => sixFunctionsForMicroservice(ms))

const expectedFn = MICROSERVICES.length * 6
if (FUNCTIONS.length !== expectedFn) {
  throw new Error(`functionsFunnel: ожидалось ${expectedFn} функций, получилось ${FUNCTIONS.length}`)
}
