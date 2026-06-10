import { useState, useEffect } from 'react'

const STEP_LABELS = [
  'Lendo suas anotações clínicas…',
  'Identificando padrões nas suas observações…',
  'Formulando hipóteses baseadas no seu relato…',
  'Preparando sugestões para a próxima sessão…',
]

const SEVERITY_STYLES = {
  high:     { bg: 'var(--danger-l)', border: 'var(--danger)', color: 'var(--danger)', label: 'Recente' },
  critical: { bg: 'var(--danger-l)', border: 'var(--danger)', color: 'var(--danger)', label: 'Frequente' },
  medium:   { bg: 'var(--warn-l)',   border: 'var(--warn)',   color: 'var(--warn)',   label: 'Pontual' },
  low:      { bg: 'var(--g50)',      border: 'var(--g300)',   color: 'var(--g600)',   label: 'Isolado' },
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
      <div className="ai-loading-text">PsicoAI está analisando as anotações…</div>
      <div className="ai-loading-steps">
        {STEP_LABELS.map((s, i) => (
          <div key={i} className="ai-step" style={{ opacity: i <= step ? 1 : 0.35, transition: 'opacity 0.4s' }}>
            <span className="ai-step-dot" style={{ background: i < step ? 'var(--g500)' : i === step ? 'var(--g300)' : 'var(--gr2)', transition: 'background 0.4s' }} />
            {s}
          </div>
        ))}
      </div>
      <div style={{ marginTop: '24px', fontSize: '11px', color: 'var(--gr4)', textAlign: 'center', lineHeight: 1.6 }}>
        A IA organiza o que você já observou — não substitui seu julgamento.<br/>
        <span style={{ color: 'var(--g500)', fontWeight: 600 }}>Baseado nas suas anotações · ~30 segundos</span>
      </div>
    </div>
  )
}

const TEMPLATE_LABELS = {
  reflexao_clinica:      '✦ Reflexão clínica',
  foco_risco:            '⚠ Foco em risco',
  evolucao_longitudinal: '↑ Evolução longitudinal',
  supervisao_clinica:    '◉ Supervisão clínica',
  psicodinamica:         'Ψ Psicodinâmica',
}

export default function AiDrawer({ isOpen, onClose, onSave, patient, result, loading, onRefine, onOpenFeedback }) {
  const [refineOpen, setRefineOpen] = useState(false)
  const [refineFeedback, setRefineFeedback] = useState('')
  const [refining, setRefining] = useState(false)

  const patientName = patient?.name || 'Paciente'
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })

  // Reset refine panel when a new result arrives
  useEffect(() => {
    setRefineOpen(false)
    setRefineFeedback('')
    setRefining(false)
  }, [result?.id])

  const handleRefine = async () => {
    if (refining) return
    setRefining(true)
    try {
      await onRefine?.(result.id, refineFeedback.trim() || null)
    } finally {
      setRefining(false)
    }
  }

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
              Reflexão Clínica
            </div>
            <div className="ai-drawer-sub">{patientName} · Baseado nas suas anotações · {today}</div>
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
              {/* Aviso ético — obrigatório CFP 09/2024 */}
              <div style={{ background: 'var(--warn-l)', border: '1px solid #F0D08A', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: '14px', fontSize: '11px', color: '#7D5A00', lineHeight: 1.6 }}>
                <strong style={{ display: 'block', marginBottom: '2px' }}>⚠ Suporte ao raciocínio clínico — não é diagnóstico</strong>
                Esta análise foi gerada por IA com base nas suas anotações. O diagnóstico é responsabilidade exclusiva do psicólogo. Conforme Resolução CFP 09/2024, toda interpretação clínica requer julgamento profissional qualificado.
              </div>

              {/* Meta */}
              {result.createdAt && (
                <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                  {[
                    result.evolution === 'positive' ? ['Evolução', '↑', 'var(--g600)', 'var(--g50)']
                      : result.evolution === 'negative' ? ['Regressão', '↓', 'var(--danger)', 'var(--danger-l)']
                      : ['Neutro', '→', 'var(--warn)', 'var(--warn-l)'],
                  ].map(([label, icon, c, bg], idx) => (
                    <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: bg, color: c }}>
                      <span>{icon}</span>{label}
                    </div>
                  ))}
                </div>
              )}

              {/* Template badge */}
              {result.template && result.template !== 'reflexao_clinica' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '20px', background: 'var(--gr1)', color: 'var(--gr5)', marginBottom: '12px' }}>
                  {TEMPLATE_LABELS[result.template] || result.template}
                </div>
              )}

              {/* Resumo da análise */}
              {result.summary && (
                <div className="ai-section">
                  <div className="ai-sec-header">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Resumo da Análise
                  </div>
                  <div className="ai-sec-body">
                    <p style={{ fontSize: '13px', color: 'var(--d)', lineHeight: 1.65 }}>{result.summary}</p>
                  </div>
                </div>
              )}

              {/* Base clínica — "com base em quê?" */}
              {result.clinicalBasis && (
                <div style={{
                  background: 'linear-gradient(135deg, #F0F7F3 0%, #E8F4EC 100%)',
                  border: '1px solid var(--g100)',
                  borderLeft: '3px solid var(--g400)',
                  borderRadius: 'var(--r)',
                  padding: '10px 12px',
                  marginBottom: '8px',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'flex-start',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--g500)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--g600)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '3px' }}>
                      Com base em quê
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--g700)', lineHeight: 1.55 }}>
                      {result.clinicalBasis}
                    </div>
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
                      const riskLabel = { critical: 'Atenção', high: 'Observar', medium: 'Monitorar', low: 'Registrado' }[alert.level] || 'Registrado'
                      return (
                        <div key={i} style={{ background: sty.bg, border: `1px solid ${sty.border}30`, borderLeft: `3px solid ${sty.border}`, borderRadius: 'var(--r)', padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: sty.color, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{riskLabel}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--d)', lineHeight: 1.5 }}>{alert.description}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* O que seus registros revelam */}
              {hypotheses.length > 0 && (
                <div className="ai-section">
                  <div className="ai-sec-header">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    O que seus registros revelam
                  </div>
                  <div className="ai-sec-body">
                    {hypotheses.map((h, i) => (
                      <div key={i} style={{ marginBottom: i < hypotheses.length - 1 ? '16px' : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--d)' }}>{h.label || h.name}</div>
                          </div>
                          {(h.sessionCount != null) && (
                            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '13px', color: 'var(--g600)', fontWeight: 600, flexShrink: 0, marginLeft: '8px', background: 'var(--g50)', padding: '3px 8px', borderRadius: '12px' }}>
                              {h.sessionCount} {h.sessionCount === 1 ? 'anotação' : 'anotações'}
                            </div>
                          )}
                        </div>
                        {(h.rationale || h.reasoning || h.description) && (
                          <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.5, background: 'var(--gr1)', padding: '7px 10px', borderRadius: '6px' }}>
                            {String(h.rationale || h.reasoning || h.description)}
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

              {/* Quantas anotações foram analisadas */}
              {result.sessionCount > 1 && (
                <div style={{ background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: 'var(--r)', padding: '8px 12px', marginBottom: '8px', fontSize: '11px', color: 'var(--g700)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  Reflexão baseada em <strong>{result.sessionCount} anotações</strong> — análise longitudinal
                </div>
              )}

              {/* CTA principal */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button
                  onClick={() => { onSave?.(result); onClose() }}
                  style={{ flex: 1, background: 'var(--g500)', color: '#fff', border: 'none', padding: '12px', borderRadius: 'var(--r)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s' }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--g600)'}
                  onMouseOut={e => e.currentTarget.style.background = 'var(--g500)'}
                >
                  Ver no prontuário
                </button>
                <button
                  onClick={onClose}
                  style={{ background: 'var(--gr1)', color: 'var(--gr5)', border: '1px solid var(--gr2)', padding: '12px 16px', borderRadius: 'var(--r)', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                  Fechar
                </button>
              </div>

              {/* Refazer análise (collapsible) */}
              {onRefine && (result.refineCount ?? 0) < 3 && (
                <div style={{ marginTop: '12px', borderTop: '1px solid var(--gr1)', paddingTop: '12px' }}>
                  {!refineOpen ? (
                    <button
                      onClick={() => setRefineOpen(true)}
                      style={{ background: 'none', border: 'none', color: 'var(--gr4)', fontSize: '12px', cursor: 'pointer', padding: '4px 0', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', gap: '5px', width: '100%' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.49"/></svg>
                      A análise não ficou satisfatória? Refazer
                      {(result.refineCount ?? 0) > 0 && (
                        <span style={{ fontSize: '10px', color: 'var(--gr3)', marginLeft: 'auto' }}>
                          {result.refineCount}/3 refinamentos
                        </span>
                      )}
                    </button>
                  ) : (
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--d)', marginBottom: '8px' }}>
                        O que ficou impreciso?
                        <span style={{ fontWeight: 400, color: 'var(--gr4)', marginLeft: '4px' }}>(opcional)</span>
                      </div>
                      <textarea
                        value={refineFeedback}
                        onChange={e => setRefineFeedback(e.target.value)}
                        placeholder="Ex: As hipóteses não refletem o que escrevi. A análise foi genérica. Foco mais nos padrões de evitação que mencionei..."
                        disabled={refining}
                        style={{
                          width: '100%', minHeight: '72px', padding: '10px 12px',
                          border: '1px solid var(--gr2)', borderRadius: 'var(--r)',
                          fontSize: '12px', lineHeight: 1.6, color: 'var(--d)',
                          fontFamily: "'DM Sans', sans-serif", resize: 'vertical',
                          background: refining ? 'var(--gr1)' : 'var(--w)',
                          outline: 'none', boxSizing: 'border-box',
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = 'var(--g400)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'var(--gr2)'}
                      />
                      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <button
                          onClick={handleRefine}
                          disabled={refining}
                          style={{
                            flex: 1, background: refining ? 'var(--gr2)' : 'var(--d)', color: refining ? 'var(--gr4)' : '#fff',
                            border: 'none', padding: '10px', borderRadius: 'var(--r)',
                            fontSize: '12px', fontWeight: 600, cursor: refining ? 'wait' : 'pointer',
                            fontFamily: "'DM Sans', sans-serif",
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          }}
                        >
                          {refining ? (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 0.8s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                              Refinando…
                            </>
                          ) : (
                            <>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.49"/></svg>
                              Refazer análise
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => { setRefineOpen(false); setRefineFeedback('') }}
                          disabled={refining}
                          style={{ background: 'none', border: '1px solid var(--gr2)', color: 'var(--gr5)', padding: '10px 14px', borderRadius: 'var(--r)', fontSize: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                        >
                          Cancelar
                        </button>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--gr4)', marginTop: '6px', textAlign: 'center' }}>
                        Refinamento não consome crédito · {3 - (result.refineCount ?? 0)} restante(s)
                      </div>
                    </div>
                  )}
                </div>
              )}
              {(result.refineCount ?? 0) >= 3 && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--gr4)', textAlign: 'center', padding: '6px' }}>
                  Limite de 3 refinamentos atingido para esta análise.
                </div>
              )}

              {/* Feedback sutil sobre qualidade da IA */}
              {onOpenFeedback && (
                <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => onOpenFeedback({
                      type: 'AI_ISSUE',
                      context: {
                        analysisId: result?.id,
                        template:   result?.template,
                        sessionCount: result?.sessionCount,
                      },
                    })}
                    style={{
                      background: 'none', border: 'none',
                      color: 'var(--gr3)', fontSize: '11px',
                      cursor: 'pointer', padding: '4px 8px',
                      fontFamily: "'DM Sans', sans-serif",
                      textDecoration: 'underline', textDecorationStyle: 'dotted',
                      textUnderlineOffset: '2px', transition: 'color 0.12s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--gr5)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--gr3)'}
                  >
                    Resultado incorreto ou estranho? Relate
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé legal — sempre visível, independente do estado */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--gr1)',
          background: 'var(--ow)',
          fontSize: '10px',
          color: 'var(--gr4)',
          lineHeight: 1.5,
          flexShrink: 0,
        }}>
          PsicoNotes não realiza diagnósticos. Esta análise é um instrumento de apoio ao raciocínio clínico do psicólogo e não substitui avaliação profissional presencial. Conforme Resolução CFP 09/2024.
        </div>
      </div>
    </>
  )
}
