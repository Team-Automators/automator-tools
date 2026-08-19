import { useNavigate } from 'react-router-dom'
import { TYPES } from '../lib/types.js'
import { getLocationId } from '../lib/api.js'

export default function CopywritersList() {
  const navigate = useNavigate()
  const locationId = getLocationId()

  function goTo(type) {
    const u = new URL(`/copywriters/${type}`, window.location.origin)
    if (locationId) u.searchParams.set('locationId', locationId)
    navigate(u.pathname + u.search)
  }

  return (
    <>
      <div className="topnav">
        <div className="topnav-left">
          <span className="breadcrumb">Dashboard</span>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Copywriters</span>
        </div>
      </div>

      <div className="content">
        <div className="page-header">
          <div>
            <div className="page-title">Copywriters</div>
            <div className="page-sub">Select a specialist to start generating copy</div>
          </div>
        </div>

        <div className="card-grid">
          {Object.entries(TYPES).map(([key, type]) => (
            <div
              key={key}
              className="type-card"
              onClick={() => goTo(key)}
              role="button"
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && goTo(key)}
            >
              <div className="type-card-icon" style={{ background: type.colorBg }}>
                <span
                  style={{ color: type.color, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  dangerouslySetInnerHTML={{ __html: type.icon }}
                />
              </div>
              <div>
                <h3>{type.title}</h3>
                <p style={{ color: 'var(--sub)', fontSize: '.8125rem', lineHeight: 1.5, marginTop: 4 }}>
                  {type.description}
                </p>
              </div>
              <div className="type-card-arrow">
                Start session
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
