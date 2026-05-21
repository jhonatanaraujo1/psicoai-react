import { useState, useEffect } from 'react'

const STEP_LABELS = [
  'Lendo anotações da sessão…',
  'Cruzando com histórico do paciente…',
  'Mapeando padrões emocionais…',
  'Gerando hipóteses diagnósticas…',
]

const SEVERITY_STYLES = {
  high:     { bg: 'var(--danger-l)', border: 'var(--danger)', color: 'var(--danger)', label: 'Alto' },
  critical: { bg: 'var(--danger-l)', border: 'var(--danger)', color: 'var(--danger)', label: 'Crítico' },
  medium:   { bg: 'var(--warn-l)',   border: 'var(--warn)',   color: 'var(--warn)',   label: 'Médio' },
  low:      { bg: 'var(--g50)',      border: 'var(--g300)',   color: 'var(--g600)',   label: 'Baixo' },
}

const PATTERN_LABELS = {
  avoidance:       'Evitação comportamental',
  rumination:      'Ruminação cognitiva',
  hypervigilance:  'Hipervigilância',
  catastrophizing: 'Catastrofização',
  dissociation:    'Dissociação',
  isolation:       'Isolamento social',
}

function parseJson(raw, fallback = []) {
  if (!raw) return fallback
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return fallback }
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function LoadingState() {
  const [step, setStep] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setStep(s => (s + 1) % STEP_LABELS.length), 1400)
    return () => clearInterval(interval)
  }, [])
  return (
    <div className="ai-loading-wrap">
      <div className="ai-spinner" />
      <div className="ai-loading-text">Claude está analisando a sessão…</div>
      <div className="ai-loading-steps">
        {STEP_LABELS.map((s, i) => (
          <div key={i} className="ai-step" style={{ opacity: i <= step ? 1 : 0.35, transition: 'opacity 0.4s' }}>
            <span className="ai-step-dot" style={{ background: i < step ? 'var(--g500)' : i === step ? 'var(--g300)' : 'var(--gr2)', transition: 'background 0.4s' }} />
            {s}
          </div>
        ))}
      </div>
      <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--gr4)', textAlign: 'center', lineHeight: 1.6 }}>
        Processando com Claude claude-3-5-sonnet<br/>
        <span style={{ color: 'var(--g500)', fontWeight: 600 }}>Tempo médio: ~30 segundos</span>
      </div>
    </div>
  )
}

export default function AiDrawer({ isOpen, onClose, onSave, patient, result, loading }) {
  const patientName = patient?.name || 'Paciente'
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })

  // Parse JSON strings from analysis (backend stores as TEXT)
  const hypotheses = parseJson(result?.hypotheses)
  const patterns   = parseJson(result?.patterns)
  const riskAlerts = parseJson(result?.riskAlerts)
  const suggestions = parseJson(result?.nextSessionSuggestions)

  const hasHighRisk = riskAlerts.some(r => ['high', 'critical'].includes(r.level))

  return (
    <>
      <div className={`ai-overlay${isOpen ? ' open' : ''}`} onClick={onClose} />
      <div className={`ai-drawer${isOpen ? ' open' : ''}`}>
        {/* Header */}
        <div className="ai-drawer-header">
          <div>
            <div className="ai-drawer-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              Análise da IA
            </div>
            <div className="ai-drawer-sub">{patientName} · {today}</div>
          </div>
          <button className="ai-close" onClick={onClose}>✕</button>
        </div>

        <div className="ai-drawer-body">

          {/* LOADING */}
          {loading && <LoadingState />}

          {/* ERRO */}
          {!loading && result?.error && (
            <div style={{ padding: '32px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠️</div>
              <div style={{ fontSize: '14px', color: 'var(--danger)', fontWeight: 600, marginBottom: '8px' }}>Falha na análise</div>
              <div style={{ fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.5 }}>{result.error}</div>
              <button onClick={onClose} style={{ marginTop: '20px', padding: '9px 22px', background: 'var(--g500)', color: '#fff', border: 'none', borderRadius: 'var(--r)', cursor: 'pointer', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                Fechar
              </button>
            </div>
          )}

          {/* RESULTADO */}
          {!loading && result && !result.error && (
            <div>
              {/* Aviso ético */}
              <div style={{ background: 'var(--warn-l)', border: '1px solid #F0D08A', borderRadius: 'var(--r)', padding: '10px 12px', marginBottom: '14px', fontSize: '11px', color: 'var(--warn)', lineHeight: 1.5 }}>
                ⚠ Análise de suporte clínico gerada por IA. O diagnóstico é responsabilidade exclusiva do psicólogo.
              </div>

              {/* Meta */}
              {result.createdAt && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  {[
                    result.evolution === 'positive' ? ['Evolução', '↑', 'var(--g600)', 'var(--g50)']
                      : result.evolution === 'negative' ? ['Regressão', '↓', 'var(--danger)', 'var(--danger-l)']
                      : ['Neutro', '→', 'var(--warn)', 'var(--warn-l)'],
                    result.usedIncluded ? ['Incluído no plano', '✓', 'var(--g600)', 'var(--g50)'] : [`R$ ${result.cost?.toFixed(2)}`, '✦', 'var(--gr5)', 'var(--gr1)'],
                    [`${(result.inputTokens || 0) + (result.outputTokens || 0)} tokens`, '◈', 'var(--gr5)', 'var(--gr1)'],
                  ].map(([label, icon, c, bg], idx) => (
                    <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: bg, color: c }}>
                      <span>{icon}</span>{label}
                    </div>
                  ))}
                </div>
              )}

              {/* Resumo da sessão */}
              {result.summary && (
                <div className="ai-section">
                  <div className="ai-sec-header">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Resumo da Sessão
                  </div>
                  <div className="ai-sec-body">
                    <p style={{ fontSize: '13px', color: 'var(--d)', lineHeight: 1.65 }}>{result.summary}</p>
                  </div>
                </div>
              )}

              {/* Alertas de risco */}
              {riskAlerts.length > 0 && (
                <div className="ai-section">
                  <div className="ai-sec-header" style={{ color: hasHighRisk ? 'var(--danger)' : 'var(--warn)' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    Alertas de Risco
                  </div>
                  <div className="ai-sec-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {riskAlerts.map((alert, i) => {
                      const sty = SEVERITY_STYLES[alert.level] || SEVERITY_STYLES.low
                      return (
                        <div key={i} style={{ background: sty.bg, border: `1px solid ${sty.border}30`, borderLeft: `3px solid ${sty.border}`, borderRadius: 'var(--r)', padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: sty.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{sty.label}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--d)', lineHeight: 1.5 }}>{alert.description}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Hipóteses diagnósticas */}
              {hypotheses.length > 0 && (
                <div className="ai-section">
                  <div className="ai-sec-header">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    Hipóteses Diagnósticas
                  </div>
                  <div className="ai-sec-body">
                    {hypotheses.map((h, i) => (
                      <div key={i} style={{ marginBottom: i < hypotheses.length - 1 ? '16px' : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--d)' }}>{h.label || h.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--gr5)' }}>
                              {h.code}{h.system ? ` · ${h.system}` : ''}
                            </div>
                          </div>
                          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '24px', color: 'var(--g500)', fontWeight: 400, flexShrink: 0, marginLeft: '8px' }}>
                            {h.probability}%
                          </div>
                        </div>
                        <div className="prog-track" style={{ marginBottom: '6px' }}>
                          <div className="prog-fill" style={{ width: `${h.probability}%` }} />
                        </div>
                        {(h.rationale || h.reasoning) && (
                          <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.5, background: 'var(--gr1)', padding: '7px 10px', borderRadius: '6px' }}>
                            {h.rationale || h.reasoning}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Padrões identificados */}
              {patterns.length > 0 && (
                <div className="ai-section">
                  <div className="ai-sec-header">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    Padrões Identificados
                  </div>
                  <div className="ai-sec-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {patterns.map((pat, i) => {
                      const sev = SEVERITY_STYLES[pat.severity] || SEVERITY_STYLES.low
                      const label = PATTERN_LABELS[pat.type] || pat.type
                      return (
                        <div key={i} className="conn-item" style={{ borderLeft: `3px solid ${sev.border}`, background: sev.bg, borderRadius: '0 var(--r) var(--r) 0', padding: '8px 10px', display: 'block' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                            <div className="conn-dot" style={{ background: sev.border }} />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--d)' }}>{label}</span>
                            <span style={{ fontSize: '10px', fontWeight: 600, color: sev.color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{sev.label}</span>
                          </div>
                          {pat.description && (
                            <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.5, paddingLeft: '16px' }}>{pat.description}</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Sugestões para próxima sessão */}
              {suggestions.length > 0 && (
                <div className="ai-section">
                  <div className="ai-sec-header">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                    Sugestões para Próxima Sessão
                  </div>
                  <div className="ai-sec-body" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {suggestions.map((s, i) => (
                      <div key={i} className="sugg-item" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%', background: 'var(--g50)', color: 'var(--g600)', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: '1px' }}>{i + 1}</span>
                        <span style={{ fontSize: '12px', color: 'var(--d)', lineHeight: 1.55 }}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => { onSave?.(result); onClose() }}
                  style={{ flex: 1, background: 'var(--g500)', color: '#fff', border: 'none', padding: '12px', borderRadius: 'var(--r)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--g600)'}
                  onMouseOut={e => e.currentTarget.style.background = 'var(--g500)'}
                >
                  Salvar análise no prontuário
                </button>
                <button
                  onClick={onClose}
                  style={{ background: 'var(--gr1)', color: 'var(--gr5)', border: '1px solid var(--gr2)', padding: '12px 16px', borderRadius: 'var(--r)', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
