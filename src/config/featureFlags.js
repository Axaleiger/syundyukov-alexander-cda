/**
 * Флаги функций приложения.
 * Голосовой ввод и авто-выполнение сценариев ИИ-помощника.
 * По умолчанию включено; выключение только через localStorage 'aiVoiceEnabled' === 'false'.
 */

const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('aiVoiceEnabled') : null

/** Включены ли голосовой ввод и авто-выполнение. По умолчанию true; false только если в localStorage сохранено 'false'. */
export const AI_VOICE_AND_EXECUTION_ENABLED = stored !== 'false'
