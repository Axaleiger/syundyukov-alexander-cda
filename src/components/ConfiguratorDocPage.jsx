import React from 'react'
import './ConfiguratorDocPage.css'

function ConfiguratorDocPage({ onClose }) {
  return (
    <div className="configurator-doc-page">
      <header className="configurator-doc-header">
        <h1 className="configurator-doc-title">Синтаксис блок-схем — краткий справочник</h1>
        <button type="button" className="configurator-doc-close" onClick={onClose}>
          Закрыть
        </button>
      </header>
      <div className="configurator-doc-content">
        <section>
          <h2>Направление графика</h2>
          <p>В начале кода укажите направление:</p>
          <ul>
            <li><code>flowchart TD</code> или <code>TB</code> — сверху вниз</li>
            <li><code>flowchart LR</code> — слева направо</li>
            <li><code>flowchart RL</code> — справа налево</li>
            <li><code>flowchart BT</code> — снизу вверх</li>
          </ul>
        </section>

        <section>
          <h2>Формы узлов</h2>
          <p>Узел задаётся идентификатором и опционально текстом в кавычках. Форма задаётся скобками:</p>
          <table className="configurator-doc-table">
            <thead>
              <tr><th>Форма</th><th>Синтаксис</th></tr>
            </thead>
            <tbody>
              <tr><td>Прямоугольник</td><td><code>A</code> или <code>A[Текст]</code></td></tr>
              <tr><td>Скруглённый</td><td><code>A(Текст)</code></td></tr>
              <tr><td>Стадион</td><td><code>A([Текст])</code></td></tr>
              <tr><td>Подпрограмма</td><td><code>A[[Текст]]</code></td></tr>
              <tr><td>Цилиндр (БД)</td><td><code>A[(Текст)]</code></td></tr>
              <tr><td>Круг</td><td><code>A((Текст))</code></td></tr>
              <tr><td>Ромб (решение)</td><td><code>{'A{Текст}'}</code></td></tr>
              <tr><td>Шестиугольник</td><td><code>{'A{{Текст}}'}</code></td></tr>
              <tr><td>Параллелограмм</td><td><code>A[/Текст/]</code> или <code>A[\Текст\]</code></td></tr>
            </tbody>
          </table>
        </section>

        <section>
          <h2>Связи между узлами</h2>
          <p>Узлы соединяются цепочкой из дефисов или знаков равенства, стрелка — символ <code>&gt;</code>:</p>
          <ul>
            <li><code>A --&gt; B</code> — стрелка от A к B</li>
            <li><code>A --- B</code> — линия без стрелки</li>
            <li><code>A -- текст --&gt; B</code> или <code>A --&gt;|текст| B</code> — подпись на связи</li>
            <li><code>A -.-> B</code> — пунктирная стрелка</li>
            <li><code>A ===&gt; B</code> — толстая стрелка</li>
          </ul>
          <p>Можно объединять в одну строку: <code>A --&gt; B --&gt; C</code>.</p>
        </section>

        <section>
          <h2>Подграфы</h2>
          <p>Группу узлов можно объединить в блок:</p>
          <pre className="configurator-doc-pre">{`subgraph Заголовок
  A --> B
  B --> C
end`}</pre>
        </section>

        <section>
          <h2>Комментарии</h2>
          <p>Строка, начинающаяся с <code>%%</code>, игнорируется (комментарий).</p>
        </section>

        <section>
          <h2>Пример</h2>
          <pre className="configurator-doc-pre">{`flowchart LR
  A[Старт] --> B{Условие?}
  B -->|Да| C[Действие 1]
  B -->|Нет| D[Действие 2]
  C --> E((Конец))
  D --> E`}</pre>
        </section>
      </div>
    </div>
  )
}

export default ConfiguratorDocPage
