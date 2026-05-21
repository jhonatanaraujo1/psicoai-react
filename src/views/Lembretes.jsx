import { useState, useEffect } from 'react'
import { api } from '../services'
import { showToast } from '../components/Toast'

const WaIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
)

const EmailIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)

export default function Lembretes() {
  const [configs, setConfigs] = useState([
    { title: 'Confirmação de consulta — 24h antes', desc: 'Mensagem automática pedindo confirmação da sessão. Se não houver resposta em 4h, uma segunda mensagem é enviada.', channels: ['whatsapp', 'email'], enabled: true },
    { title: 'Lembrete no dia da sessão — 2h antes', desc: 'Aviso no dia para reduzir no-shows. Inclui link de localização ou link de teleatendimento se a sessão for remota.', channels: ['whatsapp'], enabled: true },
    { title: 'Cobrança automática — 3 dias após sessão sem pagamento', desc: 'Mensagem educada lembrando do pagamento pendente. Não ativa para pacientes com plano de saúde.', channels: ['whatsapp'], enabled: false },
    { title: 'Pesquisa de satisfação — 1 dia após sessão', desc: 'Link curto com 3 perguntas (SRS simplificado). Opcional — desligado por padrão.', channels: ['whatsapp'], enabled: false },
  ])

  useEffect(() => {
    if (typeof api.getLembretes === 'function') {
      api.getLembretes().then(data => {
        if (Array.isArray(data) && data.length > 0) setConfigs(data)
      }).catch(() => {})
    }
  }, [])

  const toggle = (i) => {
    setConfigs(c => {
      const updated = c.map((item, idx) => idx === i ? { ...item, enabled: !item.enabled } : item)
      if (typeof api.updateLembrete === 'function') {
        api.updateLembrete(i, { enabled: updated[i].enabled })
      }
      return updated
    })
  }

  const fila = [
    { time: '08:00', date: 'amanhã', name: 'Lucas Martins', desc: 'Confirmação — Sessão #15 às 09h', type: 'wp' },
    { time: '08:00', date: 'amanhã', name: 'Rafael Ferreira', desc: 'Confirmação — Sessão #8 às 14h', type: 'wp' },
    { time: '07:00', date: 'amanhã', name: 'Lucas Martins', desc: 'Confirmação — Sessão #15 às 09h', type: 'em' },
    { time: '07:00', date: '20 mai', name: 'João Oliveira', desc: 'Lembrete no dia — Sessão às 11h', type: 'wp' },
    { time: '07:00', date: '20 mai', name: 'Sofia Andrade', desc: 'Lembrete no dia — Sessão às 15h', type: 'wp' },
  ]

  const enviados = [
    { time: '08:00', date: 'ontem', name: 'Beatriz Lima', desc: 'Confirmação ✓ respondeu SIM', type: 'wp' },
    { time: '08:00', date: 'ontem', name: 'Marina Costa', desc: 'Confirmação ✓ respondeu SIM', type: 'wp' },
  ]

  return (
    <div className="view">
      <div className="lem-grid">
        <div>
          <div className="card" style={{ marginBottom: '20px' }}>
            <div className="card-header">
              <div>
                <div className="card-title">Configuração de lembretes</div>
                <div className="card-sub">Automáticos para todos os pacientes</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--g600)', fontWeight: 600 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Ativos agora
              </div>
            </div>
            <div className="card-body">
              {configs.map((c, i) => (
                <div key={i} className="lembrete-config-row">
                  <div className="lembrete-cfg-info">
                    <div className="lembrete-cfg-title">{c.title}</div>
                    <div className="lembrete-cfg-desc">{c.desc}</div>
                    <div className="lembrete-cfg-channel">
                      {c.channels.includes('whatsapp') && (
                        <span className={`channel-chip active whatsapp`}><WaIcon /> WhatsApp</span>
                      )}
                      {c.channels.includes('email') && (
                        <span className={`channel-chip active email`}><EmailIcon /> Email</span>
                      )}
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={c.enabled} onChange={() => toggle(i)} />
                    <span className="toggle-slider" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Templates de mensagem</div>
              <div className="card-sub">Edite o texto dos lembretes automáticos</div>
            </div>
            <div className="card-body">
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gr5)', marginBottom: '8px', letterSpacing: '0.3px' }}>CONFIRMAÇÃO — 24H ANTES</div>
                <textarea
                  style={{ width: '100%', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", color: 'var(--d)', background: 'var(--ow)', resize: 'vertical', minHeight: '80px', outline: 'none' }}
                  defaultValue="Olá, {{nome}}! 👋 Lembrando da sua sessão amanhã, {{dia}} de {{mes}}, às {{hora}}. Para confirmar, responda SIM. Para reagendar, me avise com antecedência. — Dra. Ana Ferreira"
                />
                <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '4px' }}>Variáveis: {'{{nome}}'}, {'{{dia}}'}, {'{{mes}}'}, {'{{hora}}'}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gr5)', marginBottom: '8px', letterSpacing: '0.3px' }}>LEMBRETE NO DIA</div>
                <textarea
                  style={{ width: '100%', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '10px 12px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", color: 'var(--d)', background: 'var(--ow)', resize: 'vertical', minHeight: '80px', outline: 'none' }}
                  defaultValue="Oi, {{nome}}! Sua sessão é hoje às {{hora}}. Te espero! 🌱"
                />
              </div>
              <button className="btn-primary" style={{ marginTop: '16px', fontSize: '12px' }} onClick={() => {
                if (typeof api.saveLembreteTemplate === 'function') {
                  api.saveLembreteTemplate({ confirmation: '', dayOf: '' })
                }
                showToast('Templates salvos!', 'success')
              }}>
                Salvar templates
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header">
              <div className="card-title">Fila de envio</div>
              <div className="card-sub">Próximas 48h</div>
            </div>
            <div style={{ padding: 0 }}>
              {fila.map((f, i) => (
                <div key={i} className="lembrete-queue-item">
                  <div className="lembrete-time-box">
                    <div className="lembrete-time">{f.time}</div>
                    <div className="lembrete-date">{f.date}</div>
                  </div>
                  <div className="lembrete-msg"><strong>{f.name}</strong><br />{f.desc}</div>
                  <div className={`lembrete-channel-icon ${f.type}`}>{f.type === 'wp' ? '💬' : '✉️'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Enviados recentemente</div></div>
            <div style={{ padding: 0 }}>
              {enviados.map((e, i) => (
                <div key={i} className="lembrete-queue-item" style={{ opacity: 0.6 }}>
                  <div className="lembrete-time-box">
                    <div className="lembrete-time">{e.time}</div>
                    <div className="lembrete-date">{e.date}</div>
                  </div>
                  <div className="lembrete-msg"><strong>{e.name}</strong><br />{e.desc}</div>
                  <div className={`lembrete-channel-icon ${e.type}`}>💬</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
