import React, { useState } from 'react'
import { getCdPageInfo } from '../data/cdEmblems'
import './CDPage.css'

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
const DEFAULT_EMBLEM = BASE + '/emblem.png'
const isCdPlasta = (name) => /пласта|Пласта|^Пласт$/i.test(name || '')

function CDPage({ nodeName, onBack }) {
  const info = getCdPageInfo(nodeName)
  const [emblemSrc, setEmblemSrc] = useState(info.emblemUrl)
  const showPlastaImages = isCdPlasta(nodeName)

  const handleEmblemError = () => setEmblemSrc(DEFAULT_EMBLEM)

  if (showPlastaImages) {
    const plastaImages = ['ЦД Пласта 1.png', 'ЦД Пласта 2.png', 'ЦД Пласта 3.png']
    return (
      <div className="cd-page cd-page-plasta">
        <button type="button" className="cd-page-back" onClick={onBack}>
          ← Закрыть
        </button>
        <div className="cd-page-plasta-images">
          {plastaImages.map((name, i) => (
            <img key={i} src={`${BASE}/${name}`} alt={name.replace('.png', '')} className="cd-page-plasta-img" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="cd-page">
      <button type="button" className="cd-page-back" onClick={onBack}>
        ← Закрыть
      </button>
      <div className="cd-page-header">
        <img
          src={emblemSrc}
          alt=""
          className="cd-page-emblem"
          onError={handleEmblemError}
        />
        <div className="cd-page-text">
          <h1 className="cd-page-title">{info.title}</h1>
          <p className="cd-page-subtitle">{info.subtitle}</p>
        </div>
      </div>
      <div className="cd-page-content">
        <p className="cd-page-description">
          Страница цифрового двойника «{info.subtitle}». Здесь могут отображаться детальные данные и сценарии по выбранному ЦД.
        </p>
      </div>
    </div>
  )
}

export default CDPage
