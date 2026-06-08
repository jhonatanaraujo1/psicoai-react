import { useState, useEffect } from 'react'
import { api } from '../services'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function fmtDuration(secs) {
  if (!secs) return null
  const m = Math.round(secs / 60)
  return `${m} min`
}

// ── Precificação dinâmica por volume ─────────────────────────────────────────
const CHARS_PER_PAGE = 1500  // ~250 palavras de texto clínico em PT-BR
const CANVAS_DEFAULT_PAGES = 3  // canvas sem texto estimado em 3 páginas

function estimatePages(session) {
  const text = session?.textContent || session?.htmlContent || ''
  if (!text && session?.imageBase64) return CANVAS_DEFAULT_PAGES
  if (!text) return 1
  return Math.max(1, Math.ceil(text.replace(/<[^>]+>/g, '').length / CHARS_PER_PAGE))
}

function estimatePagesFromPending(pending) {
  const text = pending?.textContent || ''
  if (!text && pending?.imageBase64) return CANVAS_DEFAULT_PAGES
  if (!text) return 1
  return Math.max(1, Math.ceil(text.length / CHARS_PER_PAGE))
}

function calcPrice(_totalPages) {
  // Preço fixo por análise — simples e previsível
  return { price: 4.90, tier: 'base', color: 'var(--g600)', label: null }
}

function pageBarColor(totalPages) {
  if (totalPages <= 30)  return 'var(--g500)'
  if (totalPages <= 60)  return 'var(--warn)'
  if (totalPages <= 100) return '#E67E22'
  return 'var(--danger)'
}

const TEMPLATES = [
  {
    id: 'reflexao_clinica',
    icon: '✦',
    label: 'Reflexão clínica',
    desc: 'Hipóteses DSM-5/CID-11, padrões e sugestões para próxima sessão',
    color: 'var(--g500)',
    bg: 'var(--g50)',
    border: 'var(--g300)',
  },
  {
    id: 'foco_risco',
    icon: '⚠',
    label: 'Foco em risco',
    desc: 'Prioriza sinais de risco e segurança do paciente',
    color: 'var(--danger)',
    bg: 'var(--danger-l)',
    border: '#F4C5C5',
  },
  {
    id: 'evolucao_longitudinal',
    icon: '↑',
    label: 'Evolução',
    desc: 'O que mudou entre as anotações — requer múltiplas anotações',
    color: 'var(--g600)',
    bg: 'var(--g50)',
    border: 'var(--g300)',
  },
  {
    id: 'supervisao_clinica',
    icon: '◉',
    label: 'Supervisão',
    desc: 'Perspectiva de supervisor — pontos cegos e perguntas não feitas',
    color: '#7B5EA7',
    bg: '#F5F0FF',
    border: '#D9C9F0',
  },
  {
    id: 'psicodinamica',
    icon: 'Ψ',
    label: 'Psicodinâmica',
    desc: 'Defesas, transferência, repetições e conflitos internos',
    color: '#4A7C9E',
    bg: '#EEF5FA',
    border: '#C2DAEA',
  },
]

/**
 * Exibido logo após o usuário clicar "Gerar reflexão clínica" no encerramento da sessão.
 * Permite ao psicólogo incluir sessões anteriores e escolher o template de análise.
 *
 * Props:
 *   pendingData         – { textContent, htmlContent, imageBase64, duration } da sessão atual
 *   patient             – objeto paciente { id, name, sessions }
 *   currentSessionId    – ID da sessão atual já criada no backend (pode ser null em mock)
 *   onConfirm           – ({ textContent, htmlContent, imageBase64, duration, additionalSessionIds, template }) => void
 *   onCancel            – () => void
 */
export default function AnalyzeSessionsModal({ pendingData, patient, currentSessionId, onConfirm, onCancel }) {
  const [pastSessions, setPastSessions] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('reflexao_clinica')

  const patientName = patient?.name || '—'

  useEffect(() => {
    if (!patient?.id) { setLoading(false); return }
    api.getPatientSessions(patient.id, { page: 0, size: 20 }).then(res => {
      const finished = (res.content || []).filter(s =>
        s.status === 'finished' && s.id !== currentSessionId
      )
      setPastSessions(finished)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [patient?.id, currentSessionId])

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const totalSelected = 1 + selected.size
  const wordCount = pendingData?.textContent
    ? pendingData.textContent.trim().split(/\s+/).filter(Boolean).length
    : null
  const currentPreview = pendingData?.textContent?.slice(0, 100) || null

  // ── Cálculo de volume e preço ────────────────────────────────────────────
  const currentPages = estimatePagesFromPending(pendingData)
  const selectedPages = pastSessions
    .filter(s => selected.has(s.id))
    .reduce((sum, s) => sum + estimatePages(s), 0)
  const totalPages = currentPages + selectedPages
  const pricing = calcPrice(totalPages)
  const barPct = Math.min(100, (totalPages / 120) * 100)

  const handleConfirm = () => {
    onConfirm({
      ...pendingData,
      additionalSessionIds: [...selected],
      template: selectedTemplate,
      estimatedPages: totalPages,
      analysisPrice: pricing.price,
    })
  }

  const currentTpl = TEMPLATES.find(t => t.id === selectedTemplate) || TEMPLATES[0]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
      touchAction: 'none',
      overscrollBehavior: 'none',
    }}>
      <div style={{
        background: 'var(--w)', borderRadius: '16px',
        width: '100%', maxWidth: '500px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
        overflow: 'hidden', maxHeight: 'min(92dvh, 92svh, 92vh)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{ background: 'var(--g700)', padding: '20px 24px', flexShrink: 0 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', color: '#fff', fontWeight: 400, marginBottom: '3px' }}>
            Análise clínica com IA
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
            {patientName} · Escolha o foco da análise e as anotações a incluir
          </div>
        </div>

        {/* Body scrollável */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ── Template selector ─────────────────────────────────────────── */}
          <div style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '8px' }}>
              Foco da análise
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {TEMPLATES.map(tpl => {
                const isActive = selectedTemplate === tpl.id
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplate(tpl.id)}
                    style={{
                      width: '100%', border: `1.5px solid ${isActive ? tpl.border : 'var(--gr2)'}`,
                      borderRadius: 'var(--r)', padding: '10px 12px',
                      background: isActive ? tpl.bg : 'var(--w)',
                      cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                      display: 'flex', alignItems: 'center', gap: '10px',
                      textAlign: 'left', transition: 'all 0.12s',
                    }}
                  >
                    {/* Radio indicator */}
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${isActive ? tpl.color : 'var(--gr2)'}`,
                      background: isActive ? tpl.color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.12s',
                    }}>
                      {isActive && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
                    </div>

                    {/* Icon + Labels */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <span style={{ fontSize: '12px', color: isActive ? tpl.color : 'var(--gr4)', fontWeight: 700 }}>{tpl.icon}</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: isActive ? 'var(--d)' : 'var(--gr5)' }}>{tpl.label}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.4 }}>{tpl.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Sessão atual — sempre incluída ───────────────────────────── */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '8px' }}>
              Anotação atual — sempre incluída
            </div>
            <div style={{
              border: '2px solid var(--g400)', borderRadius: 'var(--r2)',
              padding: '12px 14px', background: 'var(--g50)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: currentPreview ? '6px' : 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'var(--g500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--g700)' }}>
                    {pendingData?.imageBase64 && !pendingData?.textContent ? 'Canvas de hoje' : 'Notas de hoje'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  {fmtDuration(pendingData?.duration) && (
                    <span style={{ fontSize: '10px', color: 'var(--g600)', background: 'var(--g100)', padding: '2px 8px', borderRadius: '20px', fontWeight: 500 }}>
                      {fmtDuration(pendingData?.duration)}
                    </span>
                  )}
                  {wordCount > 0 && (
                    <span style={{ fontSize: '10px', color: 'var(--g600)', background: 'var(--g100)', padding: '2px 8px', borderRadius: '20px', fontWeight: 500 }}>
                      {wordCount} palavras
                    </span>
                  )}
                </div>
              </div>
              {currentPreview && (
                <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.5, fontStyle: 'italic', paddingLeft: '26px' }}>
                  "{currentPreview}{pendingData.textContent.length > 100 ? '…' : ''}"
                </div>
              )}
              {!currentPreview && pendingData?.imageBase64 && (
                <div style={{ fontSize: '11px', color: 'var(--gr5)', paddingLeft: '26px' }}>
                  Canvas com anotações manuscritas
                </div>
              )}
              {!currentPreview && !pendingData?.imageBase64 && (
                <div style={{ fontSize: '11px', color: 'var(--warn)', paddingLeft: '26px' }}>
                  Anotação vazia — feche e registre as notas antes de analisar para obter um resultado mais preciso
                </div>
              )}
            </div>
          </div>

          {/* ── Sessões anteriores ───────────────────────────────────────── */}
          {!loading && pastSessions.length > 0 && (
            <div>
              <button
                onClick={() => setExpanded(e => !e)}
                style={{
                  width: '100%', background: 'none', border: '1px solid var(--gr2)',
                  borderRadius: 'var(--r)', padding: '10px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  marginBottom: expanded ? '10px' : 0,
                  transition: 'all 0.15s',
                }}
                onMouseOver={e => e.currentTarget.style.background = 'var(--ow)'}
                onMouseOut={e => e.currentTarget.style.background = 'none'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)' }}>
                    Adicionar anotações anteriores
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--g600)', background: 'var(--g50)', padding: '1px 7px', borderRadius: '20px', fontWeight: 600 }}>
                    opcional · revela padrões ao longo do tempo
                  </span>
                </div>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"
                  style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {expanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pastSessions.slice(0, 10).map(s => {
                    const isSelected = selected.has(s.id)
                    return (
                      <button
                        key={s.id}
                        onClick={() => toggle(s.id)}
                        style={{
                          width: '100%', border: `1.5px solid ${isSelected ? 'var(--g400)' : 'var(--gr2)'}`,
                          borderRadius: 'var(--r)', padding: '10px 12px',
                          background: isSelected ? 'var(--g50)' : 'var(--w)',
                          cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                          display: 'flex', alignItems: 'center', gap: '10px',
                          textAlign: 'left', transition: 'all 0.12s',
                        }}
                      >
                        {/* checkbox */}
                        <div style={{
                          width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                          border: `2px solid ${isSelected ? 'var(--g500)' : 'var(--gr2)'}`,
                          background: isSelected ? 'var(--g500)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.12s',
                        }}>
                          {isSelected && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)' }}>
                              {fmtDate(s.finishedAt || s.createdAt)}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--gr5)', background: 'var(--gr1)', padding: '1px 6px', borderRadius: '20px' }}>
                              {s.type === 'canvas' ? 'Canvas' : 'Texto'}
                            </span>
                            {fmtDuration(s.durationSeconds) && (
                              <span style={{ fontSize: '10px', color: 'var(--gr5)' }}>
                                {fmtDuration(s.durationSeconds)}
                              </span>
                            )}
                            <span style={{ fontSize: '10px', color: isSelected ? 'var(--g600)' : 'var(--gr4)', background: isSelected ? 'var(--g100)' : 'transparent', padding: '1px 5px', borderRadius: '10px', fontWeight: isSelected ? 600 : 400 }}>
                              ~{estimatePages(s)} pág
                            </span>
                            {s.hasAnalysis && (
                              <span style={{ fontSize: '10px', color: 'var(--g600)', background: 'var(--g50)', padding: '1px 6px', borderRadius: '20px', fontWeight: 600 }}>
                                ✓ analisada
                              </span>
                            )}
                          </div>
                          {s.notePreview && (
                            <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.notePreview}
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}

                  {pastSessions.length > 10 && (
                    <div style={{ fontSize: '11px', color: 'var(--gr4)', textAlign: 'center', padding: '4px' }}>
                      + {pastSessions.length - 10} anotações mais antigas não exibidas
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!loading && pastSessions.length === 0 && (
            <div style={{ fontSize: '12px', color: 'var(--gr5)', textAlign: 'center', padding: '8px', background: 'var(--ow)', borderRadius: 'var(--r)' }}>
              Nenhuma anotação anterior registrada para este paciente
            </div>
          )}

          {loading && (
            <div style={{ fontSize: '12px', color: 'var(--gr4)', padding: '8px', textAlign: 'center' }}>
              Carregando histórico de anotações…
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gr1)', background: 'var(--w)', flexShrink: 0 }}>

          {/* Volume meter */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gr4)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                  Volume de conteúdo
                </span>
                <span style={{ fontSize: '11px', color: pageBarColor(totalPages), fontWeight: 600 }}>
                  ~{totalPages} {totalPages === 1 ? 'página' : 'páginas'}
                </span>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--gr4)' }}>
                {totalPages <= 30 ? 'volume padrão' : totalPages <= 60 ? 'volume médio' : totalPages <= 100 ? 'volume alto' : 'volume extenso'}
              </span>
            </div>

            {/* Barra de volume */}
            <div style={{ height: '4px', background: 'var(--gr1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '2px',
                width: `${barPct}%`,
                background: pageBarColor(totalPages),
                transition: 'width 0.3s, background 0.3s',
              }} />
            </div>

            {/* Régua de tiers */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
              <span style={{ fontSize: '9px', color: 'var(--gr3)' }}>1</span>
              <span style={{ fontSize: '9px', color: totalPages > 30 ? 'var(--warn)' : 'var(--gr3)' }}>30 pág</span>
              <span style={{ fontSize: '9px', color: totalPages > 60 ? '#E67E22' : 'var(--gr3)' }}>60 pág</span>
              <span style={{ fontSize: '9px', color: totalPages > 100 ? 'var(--danger)' : 'var(--gr3)' }}>100+ pág</span>
            </div>

            {/* Alerta de volume alto → direciona para upgrade */}
            {pricing.tier !== 'base' && (
              <div style={{
                marginTop: '6px', fontSize: '11px', color: pricing.color,
                background: pricing.tier === 'muito-alto' ? 'var(--danger-l)' : pricing.tier === 'alto' ? '#FEF0E7' : 'var(--warn-l)',
                border: `1px solid ${pricing.tier === 'muito-alto' ? '#F4C5C5' : pricing.tier === 'alto' ? '#FAD7A0' : '#F0D08A'}`,
                borderRadius: '6px', padding: '8px 12px', lineHeight: 1.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap',
              }}>
                <span>
                  {pricing.tier === 'muito-alto'
                    ? '⚠ Volume muito extenso — considere selecionar menos anotações ou fazer upgrade'
                    : pricing.tier === 'alto'
                    ? '⚠ Volume alto — pacotes de análise disponíveis nos planos'
                    : '↑ Volume médio — analise com mais anotações em planos superiores'}
                </span>
                <a href="#planos" onClick={e => { e.preventDefault(); window.open('/#precos', '_blank') }}
                  style={{ fontSize: '11px', fontWeight: 700, color: pricing.color, textDecoration: 'none', whiteSpace: 'nowrap', borderBottom: `1px solid ${pricing.color}` }}>
                  Ver planos →
                </a>
              </div>
            )}

            {/* Hint longitudinal */}
            {selected.size > 0 && !pricing.label && (
              <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--g700)', background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: '6px', padding: '6px 10px', lineHeight: 1.4 }}>
                ✦ Análise longitudinal: padrões <strong>entre {totalSelected} anotações</strong> detectados
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={onCancel}
              style={{ padding: '11px 20px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: 'var(--gr5)', flexShrink: 0 }}
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              style={{
                flex: 1, padding: '11px', border: 'none', borderRadius: 'var(--r)',
                background: pricing.tier === 'muito-alto' ? 'var(--danger)' : currentTpl.color === 'var(--danger)' ? 'var(--danger)' : 'var(--g500)',
                color: '#fff',
                fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'opacity 0.15s',
              }}
              onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
              onMouseOut={e => e.currentTarget.style.opacity = '1'}
            >
              <span style={{ fontSize: '13px' }}>{currentTpl.icon}</span>
              Gerar análise: {currentTpl.label} · {totalSelected} {totalSelected === 1 ? 'anotação' : 'anotações'}
            </button>
          </div>

          <div style={{ marginTop: '8px', fontSize: '10px', color: 'var(--gr4)', textAlign: 'center', lineHeight: 1.4 }}>
            Análise incluída no plano · volumes acima de 30 páginas podem gerar custo adicional
          </div>
        </div>
      </div>
    </div>
  )
}
