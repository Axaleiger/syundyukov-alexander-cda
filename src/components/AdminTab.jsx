import React from 'react'
import './AdminTab.css'

function AdminTab({ activeSub = 'roles' }) {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'

  return (
    <div className="admin-tab">
      <h2 className="admin-tab-title">Администрирование</h2>
      <p className="admin-tab-desc">
        Подключение пользователей, роли (эксперт, технический специалист, архитектор), карточки ключей, сертификаты, пароли, формирование подключения по API.
      </p>

      <div className="admin-sub-content">
        {activeSub === 'roles' && (
          <div className="admin-panel">
            <h3>Ролевая модель</h3>
            <p>Настройка ролей: эксперт, технический специалист, архитектор. Запрос и выдача доступов внутри системы.</p>
            <div className="admin-placeholder">Раздел в разработке</div>
          </div>
        )}
        {activeSub === 'catalog' && (
          <div className="admin-panel admin-panel-catalog">
            <h3>Каталог сервисов</h3>
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
            <p>Создание и согласование заявок на интеграцию систем.</p>
            <div className="admin-placeholder">Раздел в разработке</div>
          </div>
        )}
        {activeSub === 'changes' && (
          <div className="admin-panel">
            <h3>Заявки на доработку сервисов</h3>
            <p>Создание и согласование заявок на доработку сервисов.</p>
            <div className="admin-placeholder">Раздел в разработке</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminTab
