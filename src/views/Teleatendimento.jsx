import { useState, useEffect } from 'react'
import { api } from '../services'
import { DatePicker, TimePicker, CustomSelect } from '../components/DateTimePickers'
import { showToast } from '../components/Toast'

export default function Teleatendimento() {
  const [platform, setPlatform] = useState('whereby')
  const [teleModal, setTeleModal] = useState(false)
  const [teleForm, setTeleForm] = useState({ patientId: '', patientName: '', date: '', time: '', platform: 'whereby', notes: '' })
  const [allPatients, setAllPatients] = useState([])
  const [teleSaving, setTeleSaving] = useState(false)

  useEffect(() => {
    if (teleModal) api.getPatients({ size: 100 }).then(r => setAllPatients(r.content || []))
  }, [teleModal])

  const inputSt = { border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '9px 12px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: 'var(--ow)', width: '100%', boxSizing: 'border-box', color: 'var(--d)' }
  const labelSt = { fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)', display: 'block', marginBottom: '6px' }

  async function handleTeleSave() {
    setTeleSaving(true)
    try {
      const selectedPatient = allPatients.find(p => String(p.id) === String(teleForm.patientId))
      const patientName = selectedPatient?.name || teleForm.patientName
      if (typeof api.createTeleSession === 'function') {
        await api.createTeleSession({ patientId: teleForm.patientId, patientName, date: teleForm.date, time: teleForm.time, platform: teleForm.platform, notes: teleForm.notes, status: 'scheduled' })
      } else {
        showToast('Sessão agendada!', 'success')
      }
      setTeleModal(false)
      setTeleForm({ patientId: '', patientName: '', date: '', time: '', platform: 'whereby', notes: '' })
    } finally {
      setTeleSaving(false)
    }
  }

  return (
    <>
    <div className="view">
      <div className="tele-grid">
        <div>
          <div className="tele-stats-mini">
            <div className="tele-stat"><div className="tele-stat-val">6</div><div className="tele-stat-label">Sessões remotas em maio</div></div>
          </div>

          <button className="btn-primary" style={{ fontSize: '12px', padding: '8px 14px', marginBottom: '16px' }} onClick={() => setTeleModal(true)}>
            + Agendar sessão remota
          </button>

          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '13px', color: 'var(--gr5)', marginBottom: '12px' }}>Próximas sessões remotas</div>

          <div className="tele-session-card live">
            <div className="tele-av" style={{ background: 'var(--g400)' }}>LM</div>
            <div className="tele-info">
              <div className="tele-name">Lucas Martins</div>
              <div className="tele-meta">Sessão #15 · Hoje às <strong>09:00</strong> · Remota</div>
              <div style={{ fontSize: '11px', color: 'var(--g600)', marginTop: '4px', fontWeight: 600 }}>● Em andamento</div>
            </div>
            <div className="tele-actions">
              <button className="btn-start-call" onClick={() => showToast('Funcionalidade disponível em breve', 'info')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                Entrar na sala
              </button>
            </div>
          </div>

          <div className="tele-session-card">
            <div className="tele-av">RF</div>
            <div className="tele-info">
              <div className="tele-name">Rafael Ferreira</div>
              <div className="tele-meta">Sessão #8 · <strong>19 mai (amanhã)</strong> às 14:00 · Remota</div>
              <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '4px' }}>Link de sala gerado · Lembrete enviado</div>
            </div>
            <div className="tele-actions">
              <button className="btn-start-call secondary" onClick={() => { navigator.clipboard && navigator.clipboard.writeText('https://psico.ai/sala/rf-s8-20mai').then(() => showToast('Link copiado!', 'success')) }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copiar link
              </button>
              <button className="btn-start-call" onClick={() => showToast('Funcionalidade disponível em breve', 'info')}>Abrir sala</button>
            </div>
          </div>

          <div className="tele-session-card">
            <div className="tele-av">JO</div>
            <div className="tele-info">
              <div className="tele-name">João Oliveira</div>
              <div className="tele-meta">Sessão #4 · <strong>20 mai</strong> às 11:00 · Remota</div>
              <div style={{ fontSize: '11px', color: 'var(--warn)', marginTop: '4px' }}>⚠ Confirmação pendente</div>
            </div>
            <div className="tele-actions">
              <button className="btn-start-call secondary" onClick={() => showToast('Funcionalidade disponível em breve', 'info')}>Enviar link</button>
            </div>
          </div>

          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header"><div className="card-title">Histórico de sessões remotas</div></div>
            <div style={{ padding: 0 }}>
              {[
                { initials: 'CS', name: 'Carla Silva', meta: 'Sessão #5 · 12 mai 2026 · Google Meet' },
                { initials: 'BL', name: 'Beatriz Lima', meta: 'Sessão #4 · 10 mai 2026 · Whereby' },
                { initials: 'MA', name: 'Marina Costa', meta: 'Sessão #8 · 8 mai 2026 · Google Meet' },
              ].map((h, i) => (
                <div key={i} className="tele-hist-item">
                  <div className="tele-av" style={{ width: '36px', height: '36px', fontSize: '13px', borderRadius: '10px', background: 'var(--g50)', color: 'var(--g600)' }}>{h.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{h.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '2px' }}>{h.meta}</div>
                  </div>
                  <span className="card-badge badge-green" style={{ marginLeft: '8px' }}>Concluída</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="tele-platform-card">
            <div className="tele-platform-title">Plataforma</div>
            <label className="platform-option selected">
              <input type="radio" name="platform" checked readOnly />
              <div className="platform-icon">🎥</div>
              <div>
                <div className="platform-name">Google Meet</div>
                <div className="platform-desc">Gera link automático via Google Calendar</div>
              </div>
            </label>
            <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '10px', padding: '0 4px' }}>
              Em breve: WhatsApp, SMS e Instagram
            </div>
          </div>

          <div className="card" style={{ marginBottom: '16px' }}>
            <div className="card-header"><div className="card-title">Sua sala permanente</div></div>
            <div className="card-body">
              <div className="tele-link-box">psico.ai/sala/dra-ana-ferreira</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="fin-action" style={{ flex: 1, textAlign: 'center' }} onClick={() => { navigator.clipboard && navigator.clipboard.writeText('https://psico.ai/sala/dra-ana-ferreira').then(() => showToast('Link copiado!', 'success')) }}>Copiar link</button>
                <button className="fin-action" style={{ flex: 1, textAlign: 'center' }} onClick={() => showToast('Funcionalidade disponível em breve', 'info')}>Abrir sala</button>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '10px', lineHeight: 1.5 }}>A sala fica ativa só quando você abre. O paciente aguarda na antessala.</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><div className="card-title">Configurações</div></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { title: 'Enviar link automático no lembrete', desc: 'Inclui o link da sala nos lembretes de sessão remota', checked: true },
                { title: 'Antessala ativada', desc: 'Paciente aguarda até você autorizar a entrada', checked: true },
              ].map((c, i) => (
                <div key={i}>
                  {i > 0 && <div style={{ height: '1px', background: 'var(--gr1)', marginBottom: '14px' }} />}
                  <div className="lembrete-config-row" style={{ padding: 0, border: 'none' }}>
                    <div className="lembrete-cfg-info">
                      <div className="lembrete-cfg-title" style={{ fontSize: '13px' }}>{c.title}</div>
                      <div className="lembrete-cfg-desc">{c.desc}</div>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" defaultChecked={c.checked} />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>

    {teleModal && (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', touchAction: 'none', overscrollBehavior: 'none' }}>
        <div style={{ background: 'var(--w)', borderRadius: 'var(--r2)', width: '100%', maxWidth: '480px', maxHeight: 'min(90dvh,90svh,90vh)', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--gr1)' }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--d)', fontFamily: "'DM Sans', sans-serif" }}>Agendar Anotação Remota</div>
            <button onClick={() => setTeleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gr4)', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Paciente */}
            <div>
              <label style={labelSt}>Paciente</label>
              <CustomSelect
                value={teleForm.patientId}
                onChange={v => setTeleForm(f => ({ ...f, patientId: v }))}
                options={[{ label: 'Selecione um paciente…', value: '' }, ...allPatients.map(p => ({ label: p.name, value: p.id }))]}
                placeholder="Selecione um paciente…"
                style={inputSt}
              />
            </div>

            {/* Data + Horário */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelSt}>Data</label>
                <DatePicker
                  value={teleForm.date}
                  onChange={v => setTeleForm(f => ({ ...f, date: v }))}
                  style={inputSt}
                />
              </div>
              <div>
                <label style={labelSt}>Horário</label>
                <TimePicker
                  value={teleForm.time}
                  onChange={v => setTeleForm(f => ({ ...f, time: v }))}
                  style={inputSt}
                />
              </div>
            </div>

            {/* Plataforma */}
            <div>
              <label style={labelSt}>Plataforma</label>
              <div style={{ ...inputSt, opacity: 0.7, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--d)' }}>
                <span>Google Meet</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
            </div>

            {/* Notas */}
            <div>
              <label style={labelSt}>Notas (opcional)</label>
              <textarea
                value={teleForm.notes}
                onChange={e => setTeleForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Observações sobre a anotação…"
                rows={3}
                style={{ ...inputSt, resize: 'vertical', lineHeight: 1.5 }}
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--gr1)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              onClick={() => setTeleModal(false)}
              style={{ padding: '9px 18px', borderRadius: 'var(--r)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", border: '1px solid var(--gr2)', background: 'none', color: 'var(--d)' }}
            >
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={handleTeleSave}
              disabled={teleSaving || !teleForm.patientId || !teleForm.date || !teleForm.time}
              style={{ padding: '9px 20px', fontSize: '13px', opacity: (teleSaving || !teleForm.patientId || !teleForm.date || !teleForm.time) ? 0.6 : 1 }}
            >
              {teleSaving ? 'Agendando…' : 'Agendar'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
