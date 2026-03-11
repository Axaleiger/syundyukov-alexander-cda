/**
 * Обёртка над Web Speech API для голосового ввода (ru-RU).
 * startListening / stopListening, onResult / onError, getTranscript.
 * Обработка aborted, no-speech, audio-capture, network; interimResults; автоперезапуск при временных сбоях.
 */

const SpeechRecognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition)

export const isSupported = !!SpeechRecognition

let recognition = null
let transcriptBuffer = ''
let restartTimeout = null
let isListening = false
let currentOnResult = null
let currentOnError = null

function getRecognition() {
  if (!SpeechRecognition) return null
  if (recognition) return recognition
  recognition = new SpeechRecognition()
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = 'ru-RU'
  return recognition
}

function clearRestartTimeout() {
  if (restartTimeout) {
    clearTimeout(restartTimeout)
    restartTimeout = null
  }
}

function toRussianMessage(errorCode) {
  switch (errorCode) {
    case 'aborted':
      return 'Запись остановлена.'
    case 'no-speech':
      return 'Речь не обнаружена. Попробуйте говорить чётче или ближе к микрофону.'
    case 'audio-capture':
      return 'Не удалось получить доступ к микрофону. Проверьте настройки браузера.'
    case 'network':
      return 'Ошибка сети. Проверьте подключение к интернету.'
    case 'not-allowed':
      return 'Доступ к микрофону запрещён. Разрешите использование микрофона в настройках сайта.'
    case 'service-not-allowed':
      return 'Сервис распознавания речи недоступен.'
    default:
      return errorCode ? `Ошибка распознавания: ${errorCode}` : 'Не удалось распознать речь.'
  }
}

/**
 * Начать распознавание. onResult(transcript) — финальный текст; onError(message) — сообщение на русском.
 * При aborted / no-speech не вызываем onError с пугающим текстом; при network пробуем перезапуск один раз.
 */
export function startListening(onResult, onError) {
  transcriptBuffer = ''
  clearRestartTimeout()
  const rec = getRecognition()
  if (!rec) {
    onError?.('Голос не поддерживается в этом браузере')
    return
  }

  currentOnResult = onResult
  currentOnError = onError
  isListening = true

  rec.onresult = (event) => {
    let interim = ''
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i]
      const text = result[0]?.transcript ?? ''
      if (result.isFinal) {
        transcriptBuffer += (transcriptBuffer ? ' ' : '') + text
      } else {
        interim += text
      }
    }
    if (interim) {
      const full = transcriptBuffer + (transcriptBuffer && interim ? ' ' : '') + interim
      if (currentOnResult) currentOnResult(full)
    }
  }

  rec.onend = () => {
    if (!isListening) return
    if (transcriptBuffer && currentOnResult) currentOnResult(transcriptBuffer)
  }

  rec.onerror = (event) => {
    const code = event.error || ''
    const msg = toRussianMessage(code)
    if (code === 'aborted') {
      return
    }
    if (code === 'no-speech' || code === 'audio-capture') {
      currentOnError?.(msg)
      return
    }
    if (code === 'network' && !restartTimeout) {
      restartTimeout = setTimeout(() => {
        restartTimeout = null
        try {
          rec.start()
        } catch (_) {
          currentOnError?.(msg)
        }
      }, 800)
      return
    }
    currentOnError?.(msg)
  }

  try {
    rec.start()
  } catch (e) {
    isListening = false
    currentOnError?.(e?.message || 'Не удалось запустить распознавание')
  }
}

/**
 * Остановить распознавание.
 */
export function stopListening() {
  isListening = false
  clearRestartTimeout()
  if (recognition) {
    try {
      recognition.abort()
    } catch (_) {}
  }
}

/**
 * Текущий накопленный транскрипт.
 */
export function getTranscript() {
  return transcriptBuffer
}
