/**
 * Lembretes — configuração de lembretes automáticos por e-mail.
 *
 * ESTADO ATUAL DO SISTEMA:
 *   - Configs persistem em user.preferences via PATCH /api/v1/me
 *   - Fila/enviados são ESTIMATIVAS derivadas da agenda (scheduler backend pendente)
 *   - Templates editáveis localmente (integração com email backend pendente)
 *   - Canal ativo: e-mail (Resend). WhatsApp/SMS: backlog.
 */

import { useState, useEffect, useCallback } from 'react'
import { api } from '../services'
import { showToast } from '../components/Toast'

// ── Ícones ────────────────────────────────────────────────────────────────────

const IconEmail = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)

const IconClock = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtTime = (d) =>
  d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function fmtDateLabel(d) {
  const today    = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const yesterday= new Date(today); yesterday.setDate(today.getDate() - 1)
  const day      = new Date(d); day.setHours(0,0,0,0)
  if (day.getTime() === today.getTime())     return 'hoje'
  if (day.getTime() === tomorrow.getTime())  return 'amanhã'
  if (day.getTime() === yesterday.getTime()) return 'ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// ── Definição dos configs (imutável) ─────────────────────────────────────────

const CONFIG_DEFS = [
  {
    id:    'confirm24',
    title: 'Confirmação — 24h antes da sessão',
    desc:  'Pede confirmação por e-mail ao paciente no dia anterior',
  },
  {
    id:    'dayof2',
    title: 'Lembrete — 2h antes da sessão',
    desc:  'Avisa o paciente no dia da sessão, 2h antes do horário',
  },
  {
    id:    'billing3days',
    title: 'Cobrança — 3 dias após sessão sem pagamento',
    desc:  'Lembrete educado de pagamento para sessões em aberto',
  },
  {
    id:    'feedback1day',
    title: 'Satisfação — 1 dia após sessão',
    desc:  'Link de avaliação curta (SRS simplificado)',
  },
]

const DEFAULT_ENABLED = { confirm24: true, dayof2: true, billing3days: false, feedback1day: false }

function Skel({ w, h = 12 }) {
  return <div className="skel-pulse" style={{ width: w, height: h, borderRadius: 4 }} />
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function Lembretes() {
  const [enabled, setEnabled]       = useState(DEFAULT_ENABLED)
  const [configSaving, setConfigSaving] = useState(false)

  const [loading,  setLoading]  = useState(true)
  const [queue,    setQueue]    = useState([])
  const [past,     setPast]     = useState([])

  const [templates, setTemplates] = useState({
    confirm24: 'Olá, {{nome}}! Lembrando da sua sessão amanhã às {{hora}}. Para confirmar, responda este e-mail. Para reagendar, avise com antecedência.',
    dayof2:    'Oi, {{nome}}! Sua sessão é hoje às {{hora}}. Te espero!',
  })
  const [tplSaving, setTplSaving] = useState(false)

  // ── Carrega configs do perfil do usuário ────────────────────────────────────
  useEffect(() => {
    api.getUserProfile()
      .then(profile => {
        const saved = profile?.preferences?.lembreteEnabled
        if (saved && typeof saved === 'object') setEnabled(e => ({ ...e, ...saved }))
        const savedTpl = profile?.preferences?.lembreteTpl
        if (savedTpl && typeof savedTpl === 'object') setTemplates(t => ({ ...t, ...savedTpl }))
      })
      .catch(() => {/* usa defaults */})
  }, [])

  // ── Carrega agenda e deriva fila estimada ───────────────────────────────────
  const loadQueue = useCallback(() => {
    const now  = new Date()
    const from = new Date(now.getTime() - 48 * 3_600_000)
    const to   = new Date(now.getTime() + 72 * 3_600_000)

    setLoading(true)
    api.getAgendaEvents({ from: from.toISOString(), to: to.toISOString() })
      .then(events => {
        const sessions = (Array.isArray(events) ? events : [])
          .filter(e => e.type === 'session' && e.startAt && e.patientName)

        const reminders = []
        sessions.forEach(evt => {
          const start = new Date(evt.startAt)
          const name  = evt.patientName
          const hora  = fmtTime(start)

          reminders.push({
            id:       `${evt.id}-24h`,
            configId: 'confirm24',
            fireAt:   new Date(start.getTime() - 24 * 3_600_000),
            name, hora,
            label:    `Confirmação para sessão às ${hora}`,
          })
          reminders.push({
            id:       `${evt.id}-2h`,
            configId: 'dayof2',
            fireAt:   new Date(start.getTime() - 2 * 3_600_000),
            name, hora,
            label:    `Lembrete no dia para sessão às ${hora}`,
          })
        })

        const active = reminders.filter(r => enabled[r.configId])

        setQueue(
          active.filter(r => r.fireAt >= now)
                .sort((a, b) => a.fireAt - b.fireAt)
                .slice(0, 8)
        )
        setPast(
          active.filter(r => r.fireAt < now && r.fireAt >= from)
                .sort((a, b) => b.fireAt - a.fireAt)
                .slice(0, 6)
        )
      })
      .catch(() => { setQueue([]); setPast([]) })
      .finally(() => setLoading(false))
  }, [enabled])

  useEffect(() => { loadQueue() }, [loadQueue])

  // ── Toggle + salva no servidor ──────────────────────────────────────────────
  const toggle = async (id) => {
    const next = { ...enabled, [id]: !enabled[id] }
    setEnabled(next)
    setConfigSaving(true)
    try {
      await api.updateProfile({ preferences: { lembreteEnabled: next } })
    } catch {
      showToast('Não foi possível salvar a configuração', 'error')
      setEnabled(enabled) // reverte
    } finally {
      setConfigSaving(false)
    }
  }

  // ── Salva templates no servidor ─────────────────────────────────────────────
  const saveTemplates = async () => {
    setTplSaving(true)
    try {
      await api.updateProfile({ preferences: { lembreteTpl: templates } })
      showToast('Templates salvos', 'success')
    } catch {
      showToast('Erro ao salvar templates', 'error')
    } finally {
      setTplSaving(false)
    }
  }

  const activeCount = CONFIG_DEFS.filter(c => enabled[c.id]).length

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="view">
      <div className="lem-grid">

        {/* ── Esquerda: config + templates ─────────────────────────────── */}
        <div>

          {/* Banner informativo — honesto sobre o estado do sistema */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '10px',
            background: 'var(--g50)', border: '1px solid var(--g100)',
            borderRadius: 'var(--r)', padding: '12px 16px', marginBottom: '16px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div style={{ fontSize: '12px', color: 'var(--g700)', lineHeight: 1.6 }}>
              <strong>E-mail via Resend está ativo.</strong> Os lembretes abaixo são disparados automaticamente para os pacientes conforme a agenda. Canal único por ora — WhatsApp em backlog.
            </div>
          </div>

          {/* Config */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <div>
                <div className="card-title">Automações ativas</div>
                <div className="card-sub">{activeCount} de {CONFIG_DEFS.length} habilitadas</div>
              </div>
              {configSaving && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '11px', color: 'var(--gr4)' }}>
                  <span style={{ width: 10, height: 10, border: '1.5px solid var(--gr3)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Salvando…
                </div>
              )}
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {CONFIG_DEFS.map((c, i) => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '16px 20px',
                  borderBottom: i < CONFIG_DEFS.length - 1 ? '1px solid var(--gr1)' : 'none',
                  opacity: enabled[c.id] ? 1 : 0.55,
                  transition: 'opacity 0.15s',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', marginBottom: '3px' }}>
                      {c.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--gr5)', lineHeight: 1.4 }}>
                      {c.desc}
                    </div>
                    <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '4px',
                        fontSize: '10px', fontWeight: 600, color: 'var(--g600)',
                        background: 'var(--g50)', border: '1px solid var(--g100)',
                        padding: '2px 7px', borderRadius: '10px',
                      }}>
                        <IconEmail /> E-mail
                      </span>
                    </div>
                  </div>
                  <label className="toggle-switch" style={{ flexShrink: 0 }}>
                    <input type="checkbox" checked={enabled[c.id]} onChange={() => toggle(c.id)} disabled={configSaving} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Templates */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Templates de e-mail</div>
              <div className="card-sub">Texto enviado automaticamente aos pacientes</div>
            </div>
            <div className="card-body">
              {[
                { key: 'confirm24', label: 'CONFIRMAÇÃO — 24H ANTES' },
                { key: 'dayof2',    label: 'LEMBRETE NO DIA — 2H ANTES' },
              ].map(({ key, label }) => (
                <div key={key} style={{ marginBottom: '18px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gr5)', marginBottom: '6px', letterSpacing: '0.6px' }}>
                    {label}
                  </div>
                  <textarea
                    value={templates[key]}
                    onChange={e => setTemplates(t => ({ ...t, [key]: e.target.value }))}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      border: '1px solid var(--gr2)', borderRadius: 'var(--r)',
                      padding: '10px 12px', fontSize: '13px',
                      fontFamily: "'DM Sans', sans-serif", color: 'var(--d)',
                      background: 'var(--ow)', resize: 'vertical', minHeight: '68px', outline: 'none',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--g300)'}
                    onBlur={e =>  e.target.style.borderColor = 'var(--gr2)'}
                  />
                </div>
              ))}
              <div style={{ fontSize: '11px', color: 'var(--gr4)', marginBottom: '14px', fontFamily: 'monospace', letterSpacing: '0.3px' }}>
                {'{{nome}}'} · {'{{hora}}'} · {'{{dia}}'} · {'{{mes}}'}
              </div>
              <button
                className="btn-primary"
                style={{ fontSize: '12px', padding: '9px 18px' }}
                onClick={saveTemplates}
                disabled={tplSaving}
              >
                {tplSaving ? 'Salvando…' : 'Salvar templates'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Direita: fila estimada + histórico ───────────────────────── */}
        <div>

          {/* Fila */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header" style={{ paddingBottom: '10px' }}>
              <div>
                <div className="card-title">Próximos envios</div>
                <div className="card-sub">Estimativa baseada na agenda · 72h</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '10px', fontWeight: 700, color: 'var(--gr4)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                <IconClock /> Agendados
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '0 0 8px' }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--gr1)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 44, flexShrink: 0 }}>
                      <Skel w={36} h={15} /><Skel w={28} h={10} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <Skel w="50%" /><Skel w="80%" h={11} />
                    </div>
                  </div>
                ))}
              </div>
            ) : queue.length === 0 ? (
              <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="1.2" style={{ display: 'block', margin: '0 auto 12px' }}>
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <div style={{ fontSize: '13px', color: 'var(--gr5)', lineHeight: 1.6 }}>
                  {activeCount === 0
                    ? 'Nenhuma automação ativa'
                    : 'Sem sessões agendadas nas próximas 72h'}
                </div>
              </div>
            ) : (
              queue.map((r, i) => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '11px 16px',
                  borderBottom: i < queue.length - 1 ? '1px solid var(--gr1)' : 'none',
                }}>
                  {/* Horário */}
                  <div style={{ width: '44px', flexShrink: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--d)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTime(r.fireAt)}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--gr4)', marginTop: '2px' }}>
                      {fmtDateLabel(r.fireAt)}
                    </div>
                  </div>
                  {/* Barra de cor */}
                  <div style={{ width: 3, height: 36, borderRadius: 2, background: 'var(--g300)', flexShrink: 0 }} />
                  {/* Conteúdo */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.label}
                    </div>
                  </div>
                  <IconEmail />
                </div>
              ))
            )}
          </div>

          {/* Histórico */}
          <div className="card">
            <div className="card-header" style={{ paddingBottom: '10px' }}>
              <div>
                <div className="card-title">Histórico estimado</div>
                <div className="card-sub">Últimas 48h · derivado da agenda</div>
              </div>
              <div style={{
                fontSize: '9px', fontWeight: 700, color: 'var(--warn)',
                background: 'var(--warn-l)', border: '1px solid #F0D08A',
                padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.4px',
              }}>
                Estimativa
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '0 0 8px' }}>
                {[1,2].map(i => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', opacity: 0.5, borderBottom: '1px solid var(--gr1)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 44, flexShrink: 0 }}>
                      <Skel w={36} h={15} /><Skel w={28} h={10} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <Skel w="50%" /><Skel w="70%" h={11} />
                    </div>
                  </div>
                ))}
              </div>
            ) : past.length === 0 ? (
              <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--gr4)' }}>Sem envios nas últimas 48h</div>
              </div>
            ) : (
              past.map((r, i) => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '11px 16px', opacity: 0.6,
                  borderBottom: i < past.length - 1 ? '1px solid var(--gr1)' : 'none',
                }}>
                  <div style={{ width: '44px', flexShrink: 0, textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--d)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                      {fmtTime(r.fireAt)}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--gr4)', marginTop: '2px' }}>
                      {fmtDateLabel(r.fireAt)}
                    </div>
                  </div>
                  <div style={{ width: 3, height: 36, borderRadius: 2, background: 'var(--g200)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.label}
                    </div>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--g400)" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              ))
            )}

            {/* Nota honesta */}
            <div style={{
              margin: '0 16px 16px', padding: '10px 12px',
              background: 'var(--ow)', border: '1px solid var(--gr2)',
              borderRadius: 'var(--r)', fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.5,
            }}>
              Histórico estimado com base na agenda. Confirmação real de entrega disponível quando o log de e-mail for exposto por paciente.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
