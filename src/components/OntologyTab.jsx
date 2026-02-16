import React from 'react'
import './OntologyTab.css'

function OntologyTab() {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') + '/'
  return (
    <div className="ontology-tab ontology-tab-config">
      <h2 className="ontology-title">Конфигуратор систем</h2>
      <div className="ontology-config-wrap">
        <img
          src={`${base}n8n-mvp.png`}
          alt="Конфигуратор систем (n8n MVP)"
          className="ontology-config-img"
        />
      </div>
    </div>
  )
}

export default OntologyTab
