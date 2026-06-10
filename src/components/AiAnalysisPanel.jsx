/**
 * AiAnalysisPanel — Painel premium de análise clínica IA
 * Usado em: Anotacoes (expandido), Paciente (expandido na sessão)
 */
import { useState, useEffect } from 'react'
import { api } from '../services'

const PAT_LABELS = {
  avoidance:      'Evitação comportamental',
  rumination:     'Ruminação cognitiva',
  hypervigilance: 'Hipervigilância',
  catastrophizing:'Catastrofização',
  dissociation:   'Dissociação',
  isolation:      'Isolamento social',
  other:          'Outro padrão identificado',
}

const SEV = {
  high:   { label: 'Elevada',  color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   dot: '#ef4444' },
  medium: { label: 'Moderada', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  dot: '#f59e0b' },
  low:    { label: 'Baixa',    color: '#4ade80', bg: 'rgba(74,222,128,0.10)',  dot: '#4ade80' },
}

const EV_STRENGTH = {
  strong:   { label: 'Evidência forte',    color: '#4ade80', bg: 'rgba(74,222,128,0.12)' },
  moderate: { label: 'Evidência moderada', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)' },
  weak:     { label: 'Evidência fraca',    color: '#94a3b8', bg: 'rgba(148,163,184,0.10)' },
}

const RISK = {
  high:     { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)',  icon: '🔴', label: 'ALTO' },
  critical: { color: '#dc2626', bg: 'rgba(220,38,38,0.12)',  border: 'rgba(220,38,38,0.3)',   icon: '🚨', label: 'CRÍTICO' },
  medium:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', icon: '🟡', label: 'MODERADO' },
  low:      { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)',  icon: '🔵', label: 'BAIXO' },
}

function fmtDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function tryParse(raw, fallback = []) {
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw || '[]') } catch { return fallback }
}

function SectionLabel({ children, right }) {
  return (
    <div style={{ padding: '12px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
        {children}
      </div>
      {right && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '20px' }}>{right}</span>}
    </div>
  )
}

// Anel de probabilidade SVG
function ProbRing({ pct, color }) {
  const r = 22
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" style={{ flexShrink: 0 }}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle
        cx="28" cy="28" r={r} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
        style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
      <text x="28" y="32" textAnchor="middle" fill="white"
        style={{ fontSize: '12px', fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>
        {pct}%
      </text>
    </svg>
  )
}

// Barra de hipótese
function HypothesisBar({ h, index }) {
  const [animated, setAnimated] = useState(false)
  const prob = h.probability || 0
  const color = prob >= 70 ? '#ef4444' : prob >= 50 ? '#f59e0b' : '#4ade80'

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), index * 120 + 80)
    return () => clearTimeout(t)
  }, [index])

  return (
    <div style={{
      padding: '16px 20px',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
      display: 'flex', gap: '16px', alignItems: 'flex-start',
    }}>
      <ProbRing pct={prob} color={color} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: '15px', color: '#f1f5f9', fontWeight: 400, lineHeight: 1.3 }}>
            {h.label || h.name}
          </span>
          <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.6px', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
            {h.code}{h.system ? ` · ${h.system}` : ''}
          </span>
          {h.evidenceStrength && EV_STRENGTH[h.evidenceStrength] && (
            <span style={{ fontSize: '9.5px', fontWeight: 600, color: EV_STRENGTH[h.evidenceStrength].color, background: EV_STRENGTH[h.evidenceStrength].bg, padding: '2px 7px', borderRadius: '20px', whiteSpace: 'nowrap', letterSpacing: '0.3px' }}>
              {EV_STRENGTH[h.evidenceStrength].label}
            </span>
          )}
        </div>
        {/* Barra de progresso */}
        <div style={{ height: '3px', background: 'rgba(255,255,255,0.07)', borderRadius: '2px', margin: '8px 0', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: '2px',
            background: `linear-gradient(90deg, ${color}cc, ${color})`,
            width: animated ? `${prob}%` : '0%',
            transition: 'width 0.9s cubic-bezier(0.34,1.56,0.64,1)',
          }} />
        </div>
        {h.rationale && (
          <div style={{ fontSize: '11.5px', color: 'rgba(241,245,249,0.45)', lineHeight: 1.6, fontStyle: 'italic', marginTop: '4px' }}>
            "{h.rationale}"
          </div>
        )}
      </div>
    </div>
  )
}

export default function AiAnalysisPanel({ sessionId, analysis: propAnalysis, createdAt }) {
  const [analysis, setAnalysis] = useState(propAnalysis || null)
  const [loading, setLoading] = useState(!propAnalysis && !!sessionId)

  useEffect(() => {
    if (propAnalysis) { setAnalysis(propAnalysis); return }
    if (!sessionId) return
    setLoading(true)
    api.getSessionAnalysis(sessionId)
      .then(a => setAnalysis(a))
      .catch(() => setAnalysis(null))
      .finally(() => setLoading(false))
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const hypotheses   = tryParse(analysis?.hypotheses)
  const patterns     = tryParse(analysis?.patterns)
  const risks        = tryParse(analysis?.riskAlerts)
  const suggestions  = tryParse(analysis?.nextSessionSuggestions)
  const summary      = analysis?.summary
  const clinicalBasis = analysis?.clinicalBasis

  const hasRisks     = risks.length > 0
  const hasSuggest   = suggestions.length > 0
  const hasPatterns  = patterns.length > 0
  const hasHypo      = hypotheses.length > 0

  return (
    <div style={{
      background: 'linear-gradient(160deg, #0d1f15 0%, #0f1a14 60%, #111820 100%)',
      borderRadius: '14px',
      border: '1px solid rgba(74,222,128,0.12)',
      overflow: 'hidden',
      boxShadow: '0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      animation: 'fadeIn 0.35s ease',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        background: 'rgba(74,222,128,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: 'rgba(74,222,128,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#4ade80', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
            Análise Clínica IA
          </span>
        </div>
        {(createdAt || analysis?.createdAt) && (
          <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
            {fmtDate(createdAt || analysis.createdAt)}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '40px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <span style={{ width: 18, height: 18, border: '2px solid rgba(74,222,128,0.3)', borderTopColor: '#4ade80', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>Carregando análise…</span>
        </div>
      ) : !analysis ? (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>Análise não disponível para esta sessão.</span>
        </div>
      ) : !summary && !hasHypo && !hasPatterns && !hasRisks && !hasSuggest ? (
        /* Análise salva como completed mas sem conteúdo — backend retornou vazio */
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(245,158,11,0.4)" strokeWidth="1.2"
            style={{ margin: '0 auto 14px', display: 'block' }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>
            A IA não gerou hipóteses nesta análise
          </div>
          <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.2)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
            O processo foi concluído mas não produziu conteúdo com base nas anotações disponíveis. Adicione mais detalhes nas sessões e gere uma nova análise.
          </div>
        </div>
      ) : (
        <>
          {/* ── Raciocínio clínico (summary) ─────────────────────────────── */}
          {summary && (
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
                Raciocínio clínico
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(241,245,249,0.75)', lineHeight: 1.75, fontStyle: 'italic' }}>
                {summary}
              </div>
            </div>
          )}

          {/* ── Base clínica (clinicalBasis) ─────────────────────────────── */}
          {clinicalBasis && (
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,0.5)" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              <div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(74,222,128,0.5)', letterSpacing: '0.7px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Com base em quê
                </div>
                <div style={{ fontSize: '12px', color: 'rgba(241,245,249,0.5)', lineHeight: 1.6 }}>
                  {clinicalBasis}
                </div>
              </div>
            </div>
          )}

          {/* ── Hipóteses diagnósticas ───────────────────────────────────── */}
          {hasHypo && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <SectionLabel right="DSM-5 · CID-11">Hipóteses Diagnósticas</SectionLabel>
              {hypotheses.map((h, i) => <HypothesisBar key={h.code || i} h={h} index={i} />)}
            </div>
          )}

          {/* ── Padrões detectados ───────────────────────────────────────── */}
          {hasPatterns && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <SectionLabel>Padrões Detectados</SectionLabel>
              <div style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {patterns.map((pat, i) => {
                  const s = SEV[pat.severity] || SEV.low
                  return (
                    <div key={i} style={{
                      padding: '12px 14px',
                      background: s.bg,
                      borderRadius: '10px',
                      border: `1px solid ${s.color}22`,
                    }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: pat.sessionEvidence ? '8px' : 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flexShrink: 0, paddingTop: '2px' }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, display: 'inline-block', boxShadow: `0 0 6px ${s.dot}` }} />
                          <span style={{ fontSize: '8.5px', fontWeight: 700, color: s.color, letterSpacing: '0.4px', textTransform: 'uppercase', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>
                            {s.label}
                          </span>
                        </div>
                        <div>
                          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#f1f5f9', marginBottom: '3px' }}>
                            {PAT_LABELS[pat.type] || pat.type}
                          </div>
                          {pat.description && (
                            <div style={{ fontSize: '11.5px', color: 'rgba(241,245,249,0.55)', lineHeight: 1.5 }}>
                              {pat.description}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Evidência nas anotações */}
                      {pat.sessionEvidence && (
                        <div style={{
                          marginTop: '8px', marginLeft: '18px',
                          padding: '8px 12px',
                          background: 'rgba(0,0,0,0.25)',
                          borderRadius: '6px',
                          borderLeft: `2px solid ${s.color}55`,
                        }}>
                          <div style={{ fontSize: '9.5px', fontWeight: 700, color: `${s.color}99`, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '3px' }}>
                            Evidência nas anotações
                          </div>
                          <div style={{ fontSize: '11px', color: 'rgba(241,245,249,0.4)', lineHeight: 1.5, fontStyle: 'italic' }}>
                            "{pat.sessionEvidence}"
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Alertas clínicos ─────────────────────────────────────────── */}
          {hasRisks && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 20px 16px' }}>
              <SectionLabel>Alertas Clínicos</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {risks.map((r, i) => {
                  const rv = RISK[r.level] || RISK.medium
                  return (
                    <div key={i} style={{
                      padding: '12px 14px',
                      background: rv.bg, borderRadius: '10px',
                      border: `1px solid ${rv.border}`,
                    }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>{rv.icon}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '9px', fontWeight: 800, color: rv.color, letterSpacing: '1px', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                            {rv.label}
                          </span>
                          <span style={{ fontSize: '12.5px', color: 'rgba(241,245,249,0.8)', lineHeight: 1.55, display: 'block' }}>
                            {r.description}
                          </span>
                          {/* Ação recomendada */}
                          {r.recommendedAction && (
                            <div style={{
                              marginTop: '8px',
                              padding: '8px 12px',
                              background: 'rgba(0,0,0,0.2)',
                              borderRadius: '6px',
                              borderLeft: `2px solid ${rv.color}55`,
                            }}>
                              <div style={{ fontSize: '9.5px', fontWeight: 700, color: `${rv.color}99`, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '3px' }}>
                                Ação recomendada
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'rgba(241,245,249,0.55)', lineHeight: 1.5 }}>
                                {r.recommendedAction}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Para a próxima sessão ────────────────────────────────────── */}
          {hasSuggest && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 20px 20px' }}>
              <SectionLabel>Para a próxima sessão</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                {suggestions.map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <span style={{
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(74,222,128,0.12)',
                      border: '1px solid rgba(74,222,128,0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', fontWeight: 800, color: '#4ade80',
                      marginTop: '1px',
                    }}>{i + 1}</span>
                    <span style={{ fontSize: '12.5px', color: 'rgba(241,245,249,0.7)', lineHeight: 1.65 }}>
                      {typeof s === 'string' ? s : s.text || s.suggestion || JSON.stringify(s)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer disclaimer ────────────────────────────────────────── */}
          <div style={{
            padding: '10px 20px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(245,158,11,0.05)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{ fontSize: '10px', color: 'rgba(245,158,11,0.6)', lineHeight: 1.4 }}>
              Hipóteses de apoio ao raciocínio clínico. O diagnóstico é responsabilidade exclusiva do psicólogo.
            </span>
          </div>
        </>
      )}
    </div>
  )
}
