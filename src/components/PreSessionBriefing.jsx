/**
 * PreSessionBriefing — simplificado para foco em anotações.
 * Não é mais "início de sessão" — é escolha do tipo de anotação.
 * Mostra contexto compacto da última anotação e escolha direta: texto ou canvas.
 */

import { useState, useEffect } from 'react'
import { api } from '../services'

export default function PreSessionBriefing({ patient, onStart, onCancel, isOpen }) {
  const [lastSession, setLastSession]   = useState(null)
  const [summary, setSummary]           = useState(null)
  const [loadingCtx, setLoadingCtx]     = useState(false)

  useEffect(() => {
    if (!isOpen || !patient?.id) return
    setLoadingCtx(true)
    Promise.allSettled([
      api.getPatientSessions(patient.id, { page: 0, size: 5 }),
      api.getPatientSummary(patient.id),
    ]).then(([sessionsRes, summaryRes]) => {
      if (sessionsRes.status === 'fulfilled') {
        const items = sessionsRes.value?.content || []
        setLastSession(items.find(s => s.status === 'finished') || null)
      }
      if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value)
    }).finally(() => setLoadingCtx(false))
  }, [isOpen, patient?.id])

  if (!isOpen || !patient) return null

  const sessionsSinceAi = summary?.analysesSinceLastAi ?? null

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 250,
      background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: 'var(--w)', borderRadius: 'var(--r3)',
        width: '100%', maxWidth: '480px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          background: 'var(--g700)', padding: '18px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '17px', color: '#fff', fontWeight: 400 }}>
              Nova anotação
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginTop: '3px' }}>
              {patient.name}
              {patient.cid && (
                <span style={{ marginLeft: '8px', background: 'rgba(255,255,255,0.12)', padding: '2px 8px', borderRadius: '20px' }}>
                  {patient.cid}
                </span>
              )}
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

        {/* Contexto compacto da última anotação */}
        {!loadingCtx && lastSession && (
          <div style={{ padding: '14px 20px', background: 'var(--ow)', borderBottom: '1px solid var(--gr2)' }}>
            <div style={{
              fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px',
              textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '6px',
              display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Última anotação · {lastSession.finishedAt ? new Date(lastSession.finishedAt).toLocaleDateString('pt-BR') : '—'}
            </div>

            {lastSession.notePreview ? (
              <div style={{ fontSize: '12.5px', color: 'var(--d)', lineHeight: 1.6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {lastSession.notePreview}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--gr4)', fontStyle: 'italic' }}>
                Anotação em canvas — sem prévia de texto.
              </div>
            )}

            {/* Alerta de análise IA pendente */}
            {sessionsSinceAi !== null && sessionsSinceAi > 0 && (
              <div style={{
                marginTop: '8px', fontSize: '11px', color: 'var(--warn)', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: '5px',
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                </svg>
                {sessionsSinceAi} anotaç{sessionsSinceAi === 1 ? 'ão' : 'ões'} sem análise IA — considere analisar após esta.
              </div>
            )}

            {/* Alerta clínico ativo */}
            {patient.status === 'danger' && (
              <div style={{
                marginTop: '8px', fontSize: '11px', color: 'var(--danger)', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '5px',
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Alerta clínico ativo — revise a última análise IA.
              </div>
            )}
          </div>
        )}

        {/* Escolha do tipo */}
        <div style={{ padding: '20px' }}>
          <div style={{
            fontSize: '11px', fontWeight: 600, letterSpacing: '0.7px',
            textTransform: 'uppercase', color: 'var(--gr4)',
            marginBottom: '12px', textAlign: 'center',
          }}>
            Como deseja anotar?
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            {/* Texto */}
            <button
              onClick={() => onStart({ meetLink: '', type: 'text' })}
              style={{
                padding: '18px 14px', border: '2px solid var(--gr2)',
                borderRadius: 'var(--r2)', background: 'var(--ow)',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                textAlign: 'left', transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--g400)'; e.currentTarget.style.background = 'var(--g50)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--gr2)'; e.currentTarget.style.background = 'var(--ow)' }}
            >
              <div style={{ marginBottom: '10px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="1.6">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--d)', marginBottom: '4px' }}>
                Anotação em texto
              </div>
              <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.4 }}>
                Escreva e organize com formatação — ideal para digitar
              </div>
            </button>

            {/* Canvas */}
            <button
              onClick={() => onStart({ meetLink: '', type: 'canvas' })}
              style={{
                padding: '18px 14px', border: '2px solid var(--gr2)',
                borderRadius: 'var(--r2)', background: 'var(--ow)',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                textAlign: 'left', transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--g400)'; e.currentTarget.style.background = 'var(--g50)' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--gr2)'; e.currentTarget.style.background = 'var(--ow)' }}
            >
              <div style={{ marginBottom: '10px' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="1.6">
                  <path d="M12 19l7-7 3 3-7 7-3-3z"/>
                  <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
                  <path d="M2 2l7.586 7.586"/>
                  <circle cx="11" cy="11" r="2"/>
                </svg>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--d)', marginBottom: '4px' }}>
                Canvas livre
              </div>
              <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.4 }}>
                Desenhe e escreva à mão — otimizado para tablet
              </div>
            </button>
          </div>

          <button
            onClick={onCancel}
            style={{
              width: '100%', padding: '9px', border: '1px solid var(--gr2)',
              borderRadius: 'var(--r)', background: 'transparent',
              fontSize: '12px', color: 'var(--gr5)', cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
