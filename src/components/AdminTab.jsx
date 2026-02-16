import React, { useState } from 'react'
import './AdminTab.css'

function AdminTab({ activeSub = 'roles' }) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'
  const [roleFilter, setRoleFilter] = useState('')
  const [apiKeyName, setApiKeyName] = useState('')
  const [certName, setCertName] = useState('')

  return (
    <div className="admin-tab">
      <div className="admin-sub-content">
        {activeSub === 'roles' && (
          <div className="admin-panel admin-panel-roles">
            <h3>Ролевая модель (СУИД)</h3>
            <p className="admin-panel-hint">Подключение пользователей и назначение ролей. Доступ запрашивается через СУИД.</p>
            <div className="admin-cards">
              <div className="admin-card">
                <div className="admin-card-icon">👤</div>
                <h4>Эксперт</h4>
                <p>Просмотр и экспертиза данных</p>
                <button type="button" className="admin-btn">Назначить</button>
              </div>
              <div className="admin-card">
                <div className="admin-card-icon">🔧</div>
                <h4>Технический специалист</h4>
                <p>Настройка и поддержка систем</p>
                <button type="button" className="admin-btn">Назначить</button>
              </div>
              <div className="admin-card">
                <div className="admin-card-icon">📐</div>
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
            <hr className="admin-hr" />
            <h4>Карточка: ключи, сертификаты, пароли</h4>
            <div className="admin-cards admin-cards-compact">
              <div className="admin-card admin-card-icon-only">
                <div className="admin-card-icon">🔑</div>
                <h5>Ключи API</h5>
                <input type="text" placeholder="Имя ключа" value={apiKeyName} onChange={(e) => setApiKeyName(e.target.value)} className="admin-input" />
                <button type="button" className="admin-btn">Сгенерировать</button>
              </div>
              <div className="admin-card admin-card-icon-only">
                <div className="admin-card-icon">📜</div>
                <h5>Сертификаты</h5>
                <input type="text" placeholder="Имя сертификата" value={certName} onChange={(e) => setCertName(e.target.value)} className="admin-input" />
                <button type="button" className="admin-btn">Загрузить</button>
              </div>
              <div className="admin-card admin-card-icon-only">
                <div className="admin-card-icon">🔐</div>
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
          <div className="admin-panel">
            <h3>Заявки на интеграцию</h3>
            <p className="admin-panel-hint">Создание и согласование заявок на подключение систем.</p>
            <div className="admin-form-group">
              <label>Система-источник</label>
              <input type="text" placeholder="Наименование системы" className="admin-input" />
            </div>
            <div className="admin-form-group">
              <label>Система-приёмник</label>
              <input type="text" placeholder="Наименование системы" className="admin-input" />
            </div>
            <div className="admin-form-group">
              <label>Описание интеграции</label>
              <textarea placeholder="Описание и обоснование" className="admin-input admin-textarea" rows={3} />
            </div>
            <button type="button" className="admin-btn admin-btn-primary">Создать заявку</button>
            <div className="admin-list-caption">Активные заявки</div>
            <div className="admin-placeholder admin-placeholder-sm">Список заявок на интеграцию</div>
          </div>
        )}
        {activeSub === 'changes' && (
          <div className="admin-panel">
            <h3>Заявки на доработку сервисов</h3>
            <p className="admin-panel-hint">Заявки на доработку и развитие сервисов.</p>
            <div className="admin-form-group">
              <label>Сервис</label>
              <input type="text" placeholder="Выберите сервис" className="admin-input" />
            </div>
            <div className="admin-form-group">
              <label>Описание доработки</label>
              <textarea placeholder="Требования и описание" className="admin-input admin-textarea" rows={3} />
            </div>
            <button type="button" className="admin-btn admin-btn-primary">Создать заявку</button>
            <div className="admin-list-caption">Мои заявки</div>
            <div className="admin-placeholder admin-placeholder-sm">Список заявок на доработку</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminTab
