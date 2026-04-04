import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import styles from './AppLayout.module.css';


const ADMIN_SUB_TABS = [
  { id: 'roles', label: 'Ролевая модель' },
  { id: 'catalog', label: 'Каталог сервисов' },
  { id: 'integration', label: 'Заявки на интеграцию' },
  { id: 'changes', label: 'Заявки на доработку сервисов' },
  { id: 'add-service', label: 'Заявки на добавление своего сервиса' },
]

const TABS = [
  { id: 'face', label: 'Главная страница' },
  { id: 'scenarios', label: 'Список сценариев' },
  { id: 'planning', label: 'Планирование' },
  { id: 'ontology', label: 'Конфигуратор систем' },
  { id: 'results', label: 'Результаты' },
  { id: 'admin', label: 'Администрирование', separatorBefore: true },
]

function parseTabFromHash() {
  const hash = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#/, '') || 'face'
  const serviceMatch = hash.match(/^\/?service\/(.+)$/)
  if (serviceMatch) return { tab: 'planning', adminSub: 'roles', servicePageName: decodeURIComponent(serviceMatch[1]) }
  if (hash.startsWith('admin-')) {
    const sub = hash.slice(6)
    const valid = ADMIN_SUB_TABS.some((t) => t.id === sub)
    return { tab: 'admin', adminSub: valid ? sub : 'roles', servicePageName: null }
  }
  const valid = TABS.some((t) => t.id === hash)
  return { tab: valid ? hash : 'face', adminSub: 'roles', servicePageName: null }
}


export const AppLayout = () => {
     const [activeTab, setActiveTab] = useState(() => {
        if (typeof window === 'undefined') return 'face'
        return parseTabFromHash().tab
      })
    const [aiMode, setAiMode] = useState(false)
    
    return <div className={`${styles.app} ${styles['app-with-sidebar']}`}>
        <header className={styles['app-header']}>
        <img src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/emblem.png`} alt="Оркестратор актива" className={styles['app-header-emblem']} />
        <div className={styles['app-header-text']}>
          <h1>Оркестратор актива</h1>
        </div>
        <div className={styles['app-header-actions']}>
          <button
            type="button"
            className={`${styles['app-header-ai-toggle']} ${aiMode ? styles['app-header-ai-toggle-on'] : ''}`}
            onClick={() => setAiMode(!aiMode)}
            title={aiMode ? 'Выключить ИИ-режим' : 'Включить ИИ-режим'}
          >
            {aiMode && <span className={styles['app-header-ai-spinner']} aria-hidden />}
            <span className={styles['app-header-ai-toggle-text']}>ИИ-режим</span>
          </button>
          <div className={styles['app-header-user']}>
            <span className={styles['app-header-user-name']}>Сюндюков А.В. · Ведущий эксперт</span>
            <img src={`${(import.meta.env.BASE_URL || '/').replace(/\/$/, '')}/sanya-bodibilder.png`} alt="" className={styles['app-header-user-avatar']} />
          </div>
        </div>
      </header>

        <div className={styles['app-body']}>
            <nav className={styles['app-sidebar']}>
                      {TABS.map((t) => (
                        <React.Fragment key={t.id}>
                          {t.separatorBefore && <hr className={styles['app-sidebar-divider']} />}
                          <button
                            type="button"
                            className={`${styles['app-sidebar-tab']} ${activeTab === t.id ? 'app-sidebar-tab-active' : ''}`}
                            onClick={() => setActiveTab(t.id)}
                          >
                            {t.label}
                          </button>
                        </React.Fragment>
                      ))}
                    </nav>
                     <main className={styles['app-main']}>
                        <Outlet />
                    </main>
        </div>
    </div>
}