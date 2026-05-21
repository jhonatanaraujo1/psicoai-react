import { useState, useEffect } from 'react'
import { api } from '../services'

const statusConfig = {
  red:    { bg: 'var(--danger-l)', color: 'var(--danger)', label: 'Alerta IA' },
  yellow: { bg: 'var(--warn-l)',   color: 'var(--warn)',   label: 'Monitorar' },
  green:  { bg: 'var(--g50)',      color: 'var(--g600)',   label: 'Evolução' },
  gray:   { bg: 'var(--gr1)',      color: 'var(--gr5)',    label: 'Início' },
}

export default function PatientPicker({ isOpen, onSelect, onCancel }) {
  const [search, setSearch] = useState('')
  const [allPatients, setAllPatients] = useState([])

  useEffect(() => {
    if (isOpen) {
      api.getPatients({ size: 100 }).then(res => setAllPatients(res.content || []))
    }
  }, [isOpen])

  if (!isOpen) return null

  const filtered = allPatients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.cid && p.cid.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 240,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--w)', borderRadius: 'var(--r3)',
        width: '100%', maxWidth: '520px', maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'var(--g700)', padding: '20px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', color: '#fff', fontWeight: 400 }}>
              Nova Sessão
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>
              Selecione o paciente para iniciar
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none',
              color: 'rgba(255,255,255,0.7)', width: '32px', height: '32px',
              borderRadius: '8px', cursor: 'pointer', fontSize: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* Search */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--gr2)', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nome ou CID..."
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1px solid var(--gr2)', borderRadius: 'var(--r)',
                padding: '9px 12px 9px 36px', fontSize: '13px',
                color: 'var(--d)', fontFamily: "'DM Sans', sans-serif",
                outline: 'none', background: 'var(--ow)',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--g300)'}
              onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
            />
          </div>
        </div>

        {/* Patient list */}
        <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'var(--gr2) transparent' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--gr4)', fontSize: '13px' }}>
              Nenhum paciente encontrado
            </div>
          ) : (
            filtered.map((p) => {
              const sc = statusConfig[p.status] || statusConfig.gray
              return (
                <div
                  key={p.id}
                  onClick={() => onSelect(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '14px 20px', cursor: 'pointer',
                    borderBottom: '1px solid var(--gr1)',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ow)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  {/* Avatar */}
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                    background: p.avatarBg, color: p.avatarColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Fraunces', serif", fontSize: '14px', fontWeight: 500,
                  }}>
                    {p.initials}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--d)' }}>{p.name}</span>
                      {p.cid && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, padding: '2px 7px',
                          borderRadius: '20px', background: 'var(--g50)', color: 'var(--g600)',
                          border: '1px solid var(--g100)',
                        }}>{p.cid}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--gr5)', marginTop: '2px' }}>
                      {p.age} anos · {p.gender} · {p.sessions} sessões · {p.months} meses
                    </div>
                  </div>

                  {/* Status badge + chevron */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600, padding: '3px 9px',
                      borderRadius: '20px', background: sc.bg, color: sc.color,
                      whiteSpace: 'nowrap',
                    }}>{p.statusLabel}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr3)" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
