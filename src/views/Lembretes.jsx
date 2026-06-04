/**
 * Lembretes — derivado de dados reais da Agenda.
 *
 * Não existe backend específico de lembretes ainda.
 * A fila e o histórico são derivados dos eventos de sessão da agenda:
 *   - Confirmação 24h antes → agenda event startAt - 24h
 *   - Lembrete no dia 2h antes → agenda event startAt - 2h
 *   - Cobrança / Satisfação → derivados do paciente (a implementar)
 *
 * Estado dos configs persiste em localStorage (sem backend ainda).
 */

import { useState, useEffect } from 'react'
import { api } from '../services'
import { showToast } from '../components/Toast'

// ── Ícones ────────────────────────────────────────────────────────────────────

const EmailIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(d) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDateLabel(d) {
  const now = new Date()
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  const day = new Date(d); day.setHours(0, 0, 0, 0)

  if (day.getTime() === today.getTime())     return 'hoje'
  if (day.getTime() === tomorrow.getTime())  return 'amanhã'
  if (day.getTime() === yesterday.getTime()) return 'ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

// Configs padrão — estado persiste em localStorage
const DEFAULT_CONFIGS = [
  { id: 'confirm24',     title: 'Confirmação de sessão — 24h antes',         enabled: true  },
  { id: 'dayof2',        title: 'Lembrete no dia da sessão — 2h antes',      enabled: true  },
  { id: 'billing3days',  title: 'Cobrança — 3 dias após sessão sem pagamento', enabled: false },
  { id: 'feedback1day',  title: 'Pesquisa de satisfação — 1 dia após sessão', enabled: false },
]

const LS_KEY = 'psicoai_lembrete_configs'

function loadConfigs() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '[]')
    if (!Array.isArray(saved) || saved.length !== DEFAULT_CONFIGS.length) return DEFAULT_CONFIGS
    return DEFAULT_CONFIGS.map((def, i) => ({ ...def, enabled: saved[i]?.enabled ?? def.enabled }))
  } catch { return DEFAULT_CONFIGS }
}

function saveConfigs(configs) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(configs)) } catch {}
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skel({ w, h = 13 }) {
  return <div className="skel-pulse" style={{ width: w, height: h, borderRadius: 4 }} />
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function Lembretes() {
  const [configs, setConfigs] = useState(loadConfigs)
  const [loading, setLoading] = useState(true)
  const [queue, setQueue]   = useState([])   // lembretes futuros
  const [sent, setSent]     = useState([])   // lembretes passados (estimado)

  // Templates editáveis
  const [templates, setTemplates] = useState({
    confirm24: 'Olá, {{nome}}! Lembrando da sua sessão amanhã, {{dia}} de {{mes}}, às {{hora}}. Para confirmar, basta responder este e-mail. Para reagendar, me avise com antecedência.',
    dayof2:    'Oi, {{nome}}! Sua sessão é hoje às {{hora}}. Te espero!',
  })
  const [tplSaved, setTplSaved] = useState(false)

  // ── Carrega agenda e deriva lembretes ──────────────────────────────────────
  useEffect(() => {
    const now = new Date()
    // Janela: 48h atrás → 72h à frente (para pegar enviados recentes + próximos)
    const from = new Date(now.getTime() - 48 * 3600_000)
    const to   = new Date(now.getTime() + 72 * 3600_000)

    api.getAgendaEvents({ from: from.toISOString(), to: to.toISOString() })
      .then(events => {
        const sessions = (Array.isArray(events) ? events : [])
          .filter(e => e.type === 'session' && e.startAt && e.patientName)

        const remind = []

        sessions.forEach(evt => {
          const start = new Date(evt.startAt)
          const name  = evt.patientName || evt.title || 'Paciente'
          const hora  = fmtTime(start)

          // Confirmação 24h antes
          const fire24 = new Date(start.getTime() - 24 * 3600_000)
          remind.push({
            id:       `${evt.id}-24h`,
            configId: 'confirm24',
            fireAt:   fire24,
            past:     fire24 < now,
            name,
            desc:     `Confirmação — sessão às ${hora}`,
          })

          // Lembrete 2h antes
          const fire2 = new Date(start.getTime() - 2 * 3600_000)
          remind.push({
            id:       `${evt.id}-2h`,
            configId: 'dayof2',
            fireAt:   fire2,
            past:     fire2 < now,
            name,
            desc:     `Lembrete no dia — sessão às ${hora}`,
          })
        })

        // Só mostra se o config correspondente estiver ativo
        const enabledIds = new Set(configs.filter(c => c.enabled).map(c => c.id))

        setQueue(
          remind
            .filter(r => !r.past && enabledIds.has(r.configId))
            .sort((a, b) => a.fireAt - b.fireAt)
            .slice(0, 8)
        )

        setSent(
          remind
            .filter(r => r.past && enabledIds.has(r.configId) && r.fireAt > from)
            .sort((a, b) => b.fireAt - a.fireAt)
            .slice(0, 6)
        )
      })
      .catch(() => {
        // sem agenda = sem lembretes — estado vazio correto
      })
      .finally(() => setLoading(false))
  }, [configs]) // re-deriva quando config muda

  // ── Toggle config ──────────────────────────────────────────────────────────
  const toggle = (id) => {
    setConfigs(prev => {
      const next = prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c)
      saveConfigs(next)
      return next
    })
  }

  // ── Salvar templates ───────────────────────────────────────────────────────
  const saveTemplates = () => {
    try { localStorage.setItem('psicoai_lembrete_tpl', JSON.stringify(templates)) } catch {}
    setTplSaved(true)
    showToast('Templates salvos', 'success')
    setTimeout(() => setTplSaved(false), 3000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="view">
      <div className="lem-grid">

        {/* ── Coluna esquerda: configuração + templates ── */}
        <div>

          {/* Config */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <div>
                <div className="card-title">Configuração de lembretes</div>
                <div className="card-sub">Automáticos por e-mail para todos os pacientes</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--g600)', fontWeight: 600 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                {configs.filter(c => c.enabled).length} ativos
              </div>
            </div>
            <div className="card-body">
              {configs.map(c => (
                <div key={c.id} className="lembrete-config-row">
                  <div className="lembrete-cfg-info">
                    <div className="lembrete-cfg-title">{c.title}</div>
                    <div className="lembrete-cfg-channel">
                      <span className="channel-chip active email"><EmailIcon /> E-mail</span>
                      <span style={{ fontSize: '10px', color: 'var(--gr4)', marginLeft: 6 }}>WhatsApp · SMS em breve</span>
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={c.enabled} onChange={() => toggle(c.id)} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Templates */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Templates de mensagem</div>
              <div className="card-sub">Texto dos e-mails enviados automaticamente</div>
            </div>
            <div className="card-body">
              {[
                { key: 'confirm24', label: 'CONFIRMAÇÃO — 24H ANTES' },
                { key: 'dayof2',    label: 'LEMBRETE NO DIA' },
              ].map(({ key, label }) => (
                <div key={key} style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gr5)', marginBottom: '6px', letterSpacing: '0.4px' }}>{label}</div>
                  <textarea
                    value={templates[key]}
                    onChange={e => setTemplates(t => ({ ...t, [key]: e.target.value }))}
                    style={{ width: '100%', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", color: 'var(--d)', background: 'var(--ow)', resize: 'vertical', minHeight: '72px', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={e => e.target.style.borderColor = 'var(--g300)'}
                    onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
                  />
                </div>
              ))}
              <div style={{ fontSize: '11px', color: 'var(--gr4)', marginBottom: '14px' }}>
                Variáveis: <code>{'{{nome}}'}</code> <code>{'{{dia}}'}</code> <code>{'{{mes}}'}</code> <code>{'{{hora}}'}</code>
              </div>
              <button
                className="btn-primary"
                style={{ fontSize: '12px', padding: '9px 18px' }}
                onClick={saveTemplates}
              >
                {tplSaved ? '✓ Salvo' : 'Salvar templates'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Coluna direita: fila real + enviados ── */}
        <div>

          {/* Fila de envio */}
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <div className="card-title">Fila de envio</div>
              <div className="card-sub">Próximas 72h · derivado da sua agenda</div>
            </div>
            <div style={{ padding: 0 }}>
              {loading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="lembrete-queue-item" style={{ gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 48, flexShrink: 0 }}>
                      <Skel w={40} h={16} />
                      <Skel w={32} h={11} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <Skel w="55%" />
                      <Skel w="75%" h={11} />
                    </div>
                  </div>
                ))
              ) : queue.length === 0 ? (
                <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="1.2" style={{ display: 'block', margin: '0 auto 12px' }}>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <div style={{ fontSize: '13px', color: 'var(--gr5)', lineHeight: 1.6 }}>
                    {configs.some(c => c.enabled)
                      ? 'Nenhuma sessão agendada nas próximas 72h'
                      : 'Ative um lembrete para ver a fila de envio'}
                  </div>
                </div>
              ) : (
                queue.map(r => (
                  <div key={r.id} className="lembrete-queue-item">
                    <div className="lembrete-time-box">
                      <div className="lembrete-time">{fmtTime(r.fireAt)}</div>
                      <div className="lembrete-date">{fmtDateLabel(r.fireAt)}</div>
                    </div>
                    <div className="lembrete-msg">
                      <strong>{r.name}</strong>
                      <br />{r.desc}
                    </div>
                    <div title="E-mail" style={{ color: 'var(--gr4)', display: 'flex', alignItems: 'center' }}>
                      <EmailIcon />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Enviados recentemente */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Enviados recentemente</div>
              <div className="card-sub">Últimas 48h</div>
            </div>
            <div style={{ padding: 0 }}>
              {loading ? (
                [1, 2].map(i => (
                  <div key={i} className="lembrete-queue-item" style={{ opacity: 0.5, gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 48, flexShrink: 0 }}>
                      <Skel w={40} h={16} />
                      <Skel w={32} h={11} />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <Skel w="50%" />
                      <Skel w="70%" h={11} />
                    </div>
                  </div>
                ))
              ) : sent.length === 0 ? (
                <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', color: 'var(--gr4)' }}>
                    Nenhum lembrete enviado nas últimas 48h
                  </div>
                </div>
              ) : (
                sent.map(r => (
                  <div key={r.id} className="lembrete-queue-item" style={{ opacity: 0.65 }}>
                    <div className="lembrete-time-box">
                      <div className="lembrete-time">{fmtTime(r.fireAt)}</div>
                      <div className="lembrete-date">{fmtDateLabel(r.fireAt)}</div>
                    </div>
                    <div className="lembrete-msg">
                      <strong>{r.name}</strong>
                      <br />
                      <span style={{ color: 'var(--g600)', fontWeight: 500 }}>✓</span> {r.desc}
                    </div>
                    <div title="E-mail" style={{ color: 'var(--g400)', display: 'flex', alignItems: 'center' }}>
                      <EmailIcon />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
