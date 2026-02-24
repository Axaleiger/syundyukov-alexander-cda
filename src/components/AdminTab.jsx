import React, { useState, useCallback } from 'react'
import './AdminTab.css'

const IconUser = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="admin-svg-icon">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)
const IconWrench = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="admin-svg-icon">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
)
const IconLayers = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="admin-svg-icon">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
  </svg>
)
const IconKey = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="admin-svg-icon">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
)
const IconCert = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="admin-svg-icon">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="15" y2="15" />
  </svg>
)
const IconLock = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="admin-svg-icon">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

function generateApiKey() {
  const bytes = new Uint8Array(48)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function AdminTab({ activeSub = 'roles' }) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'
  const [roleFilter, setRoleFilter] = useState('')
  const [apiKeyName, setApiKeyName] = useState('')
  const [generatedKey, setGeneratedKey] = useState('')
  const [certName, setCertName] = useState('')

  const handleGenerateKey = useCallback(() => {
    setGeneratedKey(generateApiKey())
  }, [])

  return (
    <div className="admin-tab">
      <div className="admin-sub-content">
        {activeSub === 'roles' && (
          <div className="admin-panel admin-panel-roles">
            <h3>Ролевая модель (СУИД)</h3>
            <p className="admin-panel-hint">Подключение пользователей и назначение ролей. Доступ запрашивается через СУИД.</p>
            <div className="admin-cards">
              <div className="admin-card">
                <div className="admin-card-icon admin-card-icon-svg"><IconUser /></div>
                <h4>Эксперт</h4>
                <p>Просмотр и экспертиза данных</p>
                <button type="button" className="admin-btn">Назначить</button>
              </div>
              <div className="admin-card">
                <div className="admin-card-icon admin-card-icon-svg"><IconWrench /></div>
                <h4>Технический специалист</h4>
                <p>Настройка и поддержка систем</p>
                <button type="button" className="admin-btn">Назначить</button>
              </div>
              <div className="admin-card">
                <div className="admin-card-icon admin-card-icon-svg"><IconLayers /></div>
                <h4>Архитектор</h4>
                <p>Управление архитектурой и интеграциями</p>
                <button type="button" className="admin-btn">Назначить</button>
              </div>
            </div>
            <div className="admin-form-group">
              <label>Поиск по роли</label>
              <input type="text" placeholder="Введите имя или роль..." value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="admin-input" />
            </div>
            <button type="button" className="admin-btn admin-btn-primary">Запросить роль через СУИД</button>
          </div>
        )}
        {activeSub === 'catalog' && (
          <div className="admin-panel admin-panel-catalog">
            <img
              src={`${base}Каталог сервисов.png`}
              alt="Каталог сервисов"
              className="admin-catalog-img"
            />
          </div>
        )}
        {activeSub === 'integration' && (
          <div className="admin-panel admin-panel-requests">
            <h3>Заявки на интеграцию</h3>
            <p className="admin-panel-hint">Создание и согласование заявок на подключение систем. Укажите источник, приёмник и обоснование.</p>
            <hr className="admin-hr" />
            <h4>Учётные данные и доступ</h4>
            <p className="admin-panel-hint">API-ключи, сертификаты и пароли для доступа к системам. Хранятся в защищённом хранилище.</p>
            <div className="admin-cards admin-cards-compact">
              <div className="admin-card admin-card-icon-only">
                <div className="admin-card-icon admin-card-icon-svg"><IconKey /></div>
                <h5>Ключи API</h5>
                <input type="text" placeholder="Имя ключа" value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} className="admin-input" />
                <button type="button" className="admin-btn admin-btn-primary" onClick={handleGenerateKey}>Сгенерировать</button>
                {generatedKey && (
                  <div className="admin-generated-key-wrap">
                    <label className="admin-generated-key-label">Сгенерированный ключ (скопируйте и сохраните):</label>
                    <div className="admin-generated-key-value" title={generatedKey}>{generatedKey}</div>
                    <button type="button" className="admin-btn admin-btn-copy" onClick={() => { try { navigator.clipboard.writeText(generatedKey) } catch (_) {} }}>Копировать</button>
                  </div>
                )}
              </div>
              <div className="admin-card admin-card-icon-only">
                <div className="admin-card-icon admin-card-icon-svg"><IconCert /></div>
                <h5>Сертификаты</h5>
                <input type="text" placeholder="Имя сертификата" value={certName} onChange={(e) => setCertName(e.target.value)} className="admin-input" />
                <button type="button" className="admin-btn">Загрузить</button>
              </div>
              <div className="admin-card admin-card-icon-only">
                <div className="admin-card-icon admin-card-icon-svg"><IconLock /></div>
                <h5>Пароли</h5>
                <button type="button" className="admin-btn">Управление</button>
              </div>
            </div>
            <hr className="admin-hr" />
            <h4>Подключение по API</h4>
            <div className="admin-api-block">
              <div className="admin-form-group">
                <label>Base URL</label>
                <input type="url" placeholder="https://api.example.com" className="admin-input" />
              </div>
              <div className="admin-form-group">
                <label>Метод аутентификации</label>
                <select className="admin-input">
                  <option>API Key (Header)</option>
                  <option>OAuth 2.0</option>
                  <option>Сертификат</option>
                </select>
              </div>
              <div className="admin-form-group">
                <label>Роль для доступа</label>
                <select className="admin-input">
                  <option>Эксперт</option>
                  <option>Технический специалист</option>
                  <option>Архитектор</option>
                </select>
              </div>
            </div>
            <button type="button" className="admin-btn admin-btn-primary">Сохранить подключение</button>
            <hr className="admin-hr" />
            <div className="admin-request-form-card">
              <div className="admin-form-row">
                <div className="admin-form-group admin-form-half">
                  <label>Система-источник</label>
                  <input type="text" placeholder="Наименование системы" className="admin-input" />
                </div>
                <div className="admin-form-group admin-form-half">
                  <label>Система-приёмник</label>
                  <input type="text" placeholder="Наименование системы" className="admin-input" />
                </div>
              </div>
              <div className="admin-form-group">
                <label>Описание интеграции</label>
                <textarea placeholder="Описание и обоснование" className="admin-input admin-textarea" rows={3} />
              </div>
              <button type="button" className="admin-btn admin-btn-primary">Создать заявку</button>
            </div>
            <div className="admin-list-caption">Активные заявки</div>
            <div className="admin-request-list">
              <div className="admin-request-item">
                <div className="admin-request-item-main">
                  <span className="admin-request-title">ГИС → ЦДА</span>
                  <span className="admin-request-meta">№ INT-2024-089</span>
                </div>
                <span className="admin-request-status admin-request-status-review">На согласовании</span>
              </div>
              <div className="admin-request-item">
                <div className="admin-request-item-main">
                  <span className="admin-request-title">СПекТР → Б6К</span>
                  <span className="admin-request-meta">№ INT-2024-088</span>
                </div>
                <span className="admin-request-status admin-request-status-draft">Черновик</span>
              </div>
              <div className="admin-request-item">
                <div className="admin-request-item-main">
                  <span className="admin-request-title">КФА → eXoil</span>
                  <span className="admin-request-meta">№ INT-2024-087</span>
                </div>
                <span className="admin-request-status admin-request-status-done">Выполнена</span>
              </div>
            </div>
          </div>
        )}
        {activeSub === 'changes' && (
          <div className="admin-panel admin-panel-requests">
            <h3>Заявки на доработку сервисов</h3>
            <p className="admin-panel-hint">Заявки на доработку и развитие сервисов. Опишите требования и ожидаемый результат.</p>
            <div className="admin-request-form-card">
              <div className="admin-form-group">
                <label>Сервис</label>
                <input type="text" placeholder="Выберите сервис" className="admin-input" />
              </div>
              <div className="admin-form-group">
                <label>Описание доработки</label>
                <textarea placeholder="Требования и описание" className="admin-input admin-textarea" rows={3} />
              </div>
              <button type="button" className="admin-btn admin-btn-primary">Создать заявку</button>
            </div>
            <div className="admin-list-caption">Мои заявки</div>
            <div className="admin-request-list">
              <div className="admin-request-item">
                <div className="admin-request-item-main">
                  <span className="admin-request-title">Расширение API Б6К</span>
                  <span className="admin-request-meta">Сервис Б6К · № CHG-2024-012</span>
                </div>
                <span className="admin-request-status admin-request-status-review">В работе</span>
              </div>
              <div className="admin-request-item">
                <div className="admin-request-item-main">
                  <span className="admin-request-title">Доработка отчёта КФА</span>
                  <span className="admin-request-meta">Сервис КФА · № CHG-2024-011</span>
                </div>
                <span className="admin-request-status admin-request-status-done">Выполнена</span>
              </div>
            </div>
          </div>
        )}
        {activeSub === 'add-service' && (
          <div className="admin-panel admin-panel-add-service">
            <h3>Заявки на добавление своего сервиса</h3>
            <p className="admin-panel-hint">Предложите новый сервис или модуль для включения в ЦДА. Загрузите код, укажите ссылку на репозиторий или приложите Excel-файл с описанием логики.</p>
            <div className="admin-request-form-card">
              <div className="admin-form-group">
                <label>Название сервиса / модуля</label>
                <input type="text" placeholder="Краткое наименование" className="admin-input" />
              </div>
              <div className="admin-form-group">
                <label>Описание</label>
                <textarea placeholder="Назначение, входы/выходы, с какой системой планируется интеграция" className="admin-input admin-textarea" rows={3} />
              </div>
              <hr className="admin-hr" />
              <h4>Загрузка кода</h4>
              <p className="admin-panel-hint">Загрузите код на языках: Python, C#, Java, JavaScript/TypeScript, Go, R или архив с исходниками. Либо укажите ссылку на репозиторий (Git).</p>
              <div className="admin-dropzone" onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('admin-dropzone-over') }} onDragLeave={(e) => { e.currentTarget.classList.remove('admin-dropzone-over') }} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('admin-dropzone-over') }}>
                <span className="admin-dropzone-text">Перетащите файлы сюда или выберите файл</span>
                <span className="admin-dropzone-sublabel">.py, .cs, .java, .js, .ts, .go, .r, .zip</span>
                <input type="file" className="admin-dropzone-input" accept=".py,.cs,.java,.js,.ts,.go,.r,.zip,application/zip" multiple />
              </div>
              <div className="admin-form-group">
                <label>Ссылка на репозиторий (Git)</label>
                <input type="url" placeholder="https://github.com/org/repo" className="admin-input" />
              </div>
              <hr className="admin-hr" />
              <h4>Загрузка Excel</h4>
              <p className="admin-panel-hint">Работа через Excel популярна в ДО. Загрузите файл и опишите, как с ним работает логика, чтобы ЦДА мог интегрировать и настроить связи.</p>
              <div className="admin-dropzone admin-dropzone-excel" onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('admin-dropzone-over') }} onDragLeave={(e) => { e.currentTarget.classList.remove('admin-dropzone-over') }} onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('admin-dropzone-over') }}>
                <span className="admin-dropzone-excel-icon">📊</span>
                <span className="admin-dropzone-text">Перетащите Excel-файл сюда или выберите .xlsx / .xls</span>
                <input type="file" className="admin-dropzone-input" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" />
              </div>
              <div className="admin-form-group">
                <label>Описание работы Excel</label>
                <textarea placeholder="Как устроена книга, какие листы, формулы, связи с другими системами" className="admin-input admin-textarea" rows={2} />
              </div>
              <button type="button" className="admin-btn admin-btn-primary">Отправить заявку</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminTab
