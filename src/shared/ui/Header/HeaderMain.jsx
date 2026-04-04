import { useAppStore } from '../../../core/store/appStore';
import styles from './HeaderMain.module.css';

export const HeaderMain = () => {
  const aiMode = useAppStore((s) => s.aiMode)
  const setAiMode = useAppStore((s) => s.setAiMode)

  return <header className={styles[ 'app-header' ]}>
    <img src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/,'')}/emblem.png`} alt="Оркестратор актива" className={styles[ 'app-header-emblem' ]} />
    <div className={styles[ 'app-header-text' ]}>
      <h1>Оркестратор актива</h1>
    </div>
    <div className={styles[ 'app-header-actions' ]}>
      <button
        type="button"
        className={`${styles[ 'app-header-ai-toggle' ]} ${aiMode ? styles[ 'app-header-ai-toggle-on' ] : ''}`}
        onClick={() => setAiMode(!aiMode)}
        title={aiMode ? 'Выключить ИИ-режим' : 'Включить ИИ-режим'}
      >
        {aiMode && <span className={styles[ 'app-header-ai-spinner' ]} aria-hidden />}
        <span className={styles[ 'app-header-ai-toggle-text' ]}>ИИ-режим</span>
      </button>
      <div className={styles[ 'app-header-user' ]}>
        <span className={styles[ 'app-header-user-name' ]}>Сюндюков А.В. · Ведущий эксперт</span>
        <img src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/,'')}/sanya-bodibilder.png`} alt="" className={styles[ 'app-header-user-avatar' ]} />
      </div>
    </div>
  </header>
}
