import { useState, useEffect } from 'react'
import { api } from '../services'

const formTemplates = [
  { id: 'anamnese', name: 'Anamnese inicial', desc: 'Coleta dados demográficos, queixa principal e histórico de saúde', meta: '12 campos', type: 'anamnese', icon: '📋', badge: 'Padrão CFP', badgeClass: 'badge-green' },
  { id: 'tcle', name: 'TCLE — Consentimento', desc: 'Termo de consentimento livre e esclarecido conforme Res. CFP 09/2024', meta: '6 campos', type: 'tcle', icon: '✍️', badge: 'Obrigatório', badgeClass: 'badge-green' },
  { id: 'beck', name: 'BDI-II — Beck', desc: 'Inventário de depressão de Beck, validado para população brasileira', meta: '21 itens', type: 'beck', icon: '🧠', badge: 'Clínico', badgeClass: 'badge-gray' },
  { id: 'phq', name: 'PHQ-9 — Depressão', desc: 'Patient Health Questionnaire, rastreio de depressão maior', meta: '9 itens', type: 'phq', icon: '📊', badge: 'Clínico', badgeClass: 'badge-gray' },
  { id: 'srs', name: 'SRS — Aliança terapêutica', desc: 'Session Rating Scale — feedback do paciente após sessão', meta: '4 escalas', type: 'srs', icon: '🤝', badge: 'Sessão', badgeClass: 'badge-green' },
  { id: 'gad7', name: 'GAD-7 — Ansiedade', desc: 'Generalized Anxiety Disorder scale, rastreio de ansiedade', meta: '7 itens', type: 'gad7', icon: '⚡', badge: 'Clínico', badgeClass: 'badge-gray' },
]

const formPreviews = {
  anamnese: {
    title: 'Anamnese inicial',
    color: 'var(--g500)',
    body: (
      <div>
        <div className="form-section-title">Identificação</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-field"><label>NOME COMPLETO</label><input type="text" placeholder="Nome do paciente" /></div>
          <div className="form-field"><label>DATA DE NASCIMENTO</label><input type="date" /></div>
          <div className="form-field"><label>PROFISSÃO</label><input type="text" placeholder="Sua profissão" /></div>
          <div className="form-field"><label>ESTADO CIVIL</label><select><option>Solteiro(a)</option><option>Casado(a)</option><option>Divorciado(a)</option><option>Viúvo(a)</option></select></div>
        </div>
        <div className="form-section-title" style={{ marginTop: '8px' }}>Queixa principal</div>
        <div className="form-field"><label>O QUE TE TROUXE À TERAPIA?</label><textarea placeholder="Descreva brevemente o que te levou a buscar atendimento…" /></div>
        <div className="form-field"><label>HÁ QUANTO TEMPO SENTE ISSO?</label><input type="text" placeholder="Ex: 6 meses, 2 anos…" /></div>
        <div className="form-section-title">Histórico de saúde</div>
        <div className="form-field">
          <label>TRATAMENTOS PSICOLÓGICOS ANTERIORES?</label>
          <div className="form-radio-group">
            <label className="form-radio-item"><input type="radio" name="tratamento" /> Sim</label>
            <label className="form-radio-item"><input type="radio" name="tratamento" /> Não</label>
          </div>
        </div>
        <div className="form-field"><label>CONDIÇÕES DE SAÚDE RELEVANTES</label><textarea placeholder="Diabetes, hipertensão, hipotireoidismo…" /></div>
      </div>
    )
  },
  tcle: {
    title: 'Termo de Consentimento (TCLE)',
    color: '#2980B9',
    body: (
      <div>
        <div style={{ background: '#EBF3FD', borderRadius: 'var(--r)', padding: '14px', marginBottom: '20px', fontSize: '13px', color: '#1a5276', lineHeight: 1.6 }}>
          Este documento está em conformidade com a Resolução CFP 09/2024 e a LGPD (Lei 13.709/2018).
        </div>
        <div className="form-section-title">Termos do atendimento</div>
        <div style={{ fontSize: '13px', color: 'var(--d2)', lineHeight: 1.7, marginBottom: '16px', background: 'var(--ow)', padding: '14px', borderRadius: 'var(--r)' }}>
          Declaro que fui informado(a) sobre os objetivos e a natureza do atendimento psicológico, a preservação do sigilo das informações conforme o Código de Ética Profissional dos Psicólogos, e meu direito de interromper o atendimento a qualquer momento sem prejuízo.
        </div>
        <div className="form-field">
          <label>AUTORIZO O REGISTRO EM PRONTUÁRIO ELETRÔNICO</label>
          <div className="form-radio-group">
            <label className="form-radio-item"><input type="radio" name="pron" /> Sim, autorizo</label>
            <label className="form-radio-item"><input type="radio" name="pron" /> Não autorizo</label>
          </div>
        </div>
        <div className="form-field">
          <label>AUTORIZO ANÁLISE DE IA COMO SUPORTE CLÍNICO</label>
          <div style={{ fontSize: '11px', color: 'var(--gr5)', marginBottom: '8px' }}>A análise de IA é um suporte ao raciocínio clínico — não substitui o julgamento profissional.</div>
          <div className="form-radio-group">
            <label className="form-radio-item"><input type="radio" name="ia" /> Sim, autorizo</label>
            <label className="form-radio-item"><input type="radio" name="ia" /> Não autorizo</label>
          </div>
        </div>
        <div className="form-field"><label>ASSINATURA DIGITAL</label><input type="text" placeholder="Digite seu nome completo para assinar" /></div>
        <div className="form-field"><label>CPF</label><input type="text" placeholder="000.000.000-00" /></div>
      </div>
    )
  },
  beck: {
    title: 'Inventário Beck de Depressão (BDI-II)',
    color: 'var(--warn)',
    body: (
      <div>
        <div style={{ background: 'var(--warn-l)', borderRadius: 'var(--r)', padding: '12px', marginBottom: '20px', fontSize: '12px', color: 'var(--warn)', lineHeight: 1.5 }}>
          Escolha a afirmação que melhor descreve como você se sentiu nas <strong>últimas duas semanas</strong>, incluindo hoje.
        </div>
        {[['Tristeza', 'Não me sinto triste', 'Me sinto triste com frequência', 'Me sinto muito triste o tempo todo'],
          ['Pessimismo', 'Não estou pessimista', 'Tenho mais motivos para pessimismo', 'Não espero que as coisas melhorem'],
          ['Fracasso', 'Não me sinto fracassado', 'Fracassei mais do que deveria', 'Quando olho atrás, vejo muitos fracassos'],
          ['Perda de prazer', 'Sinto tanto prazer quanto antes', 'Sinto menos prazer nas coisas', 'Não consigo sentir prazer em nada'],
        ].map(([label, ...opts], i) => (
          <div key={i} style={{ marginBottom: '18px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.3px', marginBottom: '8px' }}>{i+1}. {label.toUpperCase()}</div>
            <div className="form-radio-group">
              {opts.map((o, j) => (
                <label key={j} className="form-radio-item">
                  <input type="radio" name={`bdi${i}`} />
                  <span style={{ color: 'var(--gr4)', fontWeight: 600, marginRight: '4px' }}>{j}</span> {o}
                </label>
              ))}
            </div>
          </div>
        ))}
        <div style={{ fontSize: '11px', color: 'var(--gr4)', textAlign: 'center', paddingTop: '8px' }}>Pontuação calculada automaticamente após envio</div>
      </div>
    )
  },
  phq: {
    title: 'PHQ-9 — Rastreio de Depressão',
    color: '#8E44AD',
    body: (
      <div>
        <div style={{ background: '#F5EEF8', borderRadius: 'var(--r)', padding: '12px', marginBottom: '20px', fontSize: '12px', color: '#6C3483', lineHeight: 1.5 }}>
          Durante as <strong>últimas 2 semanas</strong>, com que frequência você foi incomodado(a) por:
        </div>
        {['Pouco interesse ou prazer em fazer as coisas',
          'Se sentiu para baixo, deprimido(a) ou sem perspectiva',
          'Dificuldade para adormecer ou dormir demais',
          'Se sentiu cansado(a) ou com pouca energia',
          'Apetite diminuído ou aumentado',
          'Se sentiu mal sobre si mesmo(a)',
          'Dificuldade de concentração',
          'Se moveu ou falou muito devagar (ou o oposto)',
          'Pensamentos de que seria melhor estar morto(a)',
        ].map((q, i) => (
          <div key={i} style={{ padding: '10px', background: 'var(--ow)', borderRadius: 'var(--r)', border: '1px solid var(--gr2)', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', color: 'var(--d)', marginBottom: '8px' }}>{i+1}. {q}</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['Nunca (0)', 'Alguns dias (1)', 'Mais da metade (2)', 'Quase todos (3)'].map(o => (
                <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--gr5)', cursor: 'pointer' }}>
                  <input type="radio" name={`phq${i}`} style={{ accentColor: '#8E44AD' }} /> {o}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  },
}

const STATUS_CHIP = {
  answered: { bg: 'var(--g50)',      color: 'var(--g600)',   label: '✓ Respondido' },
  pending:  { bg: 'var(--warn-l)',   color: 'var(--warn)',   label: '⏳ Pendente' },
  expired:  { bg: 'var(--gr1)',      color: 'var(--gr4)',    label: 'Expirado' },
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Formularios() {
  const [preview, setPreview] = useState(null)
  const [allForms, setAllForms] = useState([])
  const [sendModal, setSendModal] = useState(false)
  const [sendPatient, setSendPatient] = useState('')
  const [sendFormType, setSendFormType] = useState('')
  const [sendPatients, setSendPatients] = useState([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    // Load forms for all patients p-001 and p-002 (demo data)
    Promise.all([
      api.getPatientForms('p-001'),
      api.getPatientForms('p-002'),
    ]).then(([f1, f2]) => setAllForms([...f1, ...f2]))
  }, [])

  useEffect(() => {
    if (sendModal) {
      api.getPatients({ size: 100 }).then(res => {
        setSendPatients(res.data || res || [])
      }).catch(() => setSendPatients([]))
    }
  }, [sendModal])

  return (
    <div className="view">
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: '13px', color: 'var(--gr5)', marginBottom: '16px', fontWeight: 400 }}>
          Selecione um formulário para enviar ao paciente ou visualizar o modelo
        </div>
        <div className="form-template-grid">
          {formTemplates.map(t => (
            <div key={t.id} className={`form-template-card ${t.type}`} onClick={() => formPreviews[t.id] && setPreview(t.id)}>
              <div className="form-template-icon" style={t.type === 'anamnese' ? { background: 'var(--g50)' } : t.type === 'tcle' ? { background: '#EBF3FD' } : t.type === 'beck' ? { background: 'var(--warn-l)' } : t.type === 'phq' ? { background: '#F5EEF8' } : t.type === 'srs' ? { background: 'var(--g50)' } : { background: 'var(--danger-l)' }}>
                {t.icon}
              </div>
              <div className="form-template-name">{t.name}</div>
              <div className="form-template-desc">{t.desc}</div>
              <div className="form-template-footer">
                <span className="form-template-count">{t.meta}</span>
                <span className={`card-badge ${t.badgeClass}`} style={t.badgeStyle ? { background: t.badgeStyle.split(';')[0].split(':')[1], color: t.badgeStyle.split(';')[1].split(':')[1] } : {}}>
                  {t.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Status de formulários por paciente</div>
            <div className="card-sub">Envio e recebimento de respostas</div>
          </div>
          <button className="btn-primary" style={{ fontSize: '12px', padding: '8px 14px' }} onClick={() => { setSendPatient(''); setSendFormType(''); setSendModal(true) }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Enviar formulário
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="form-status-table">
            <thead>
              <tr><th>Paciente</th><th>Formulário</th><th>Enviado em</th><th>Respondido</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody>
              {allForms.map((row, i) => {
                const chip = STATUS_CHIP[row.status] || STATUS_CHIP.pending
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{row.patientName || '—'}</td>
                    <td>{row.title}</td>
                    <td>{fmtDate(row.createdAt)}</td>
                    <td>{row.answeredAt ? fmtDate(row.answeredAt) : '—'}</td>
                    <td>
                      <span style={{ display: 'inline-block', fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '20px', background: chip.bg, color: chip.color }}>
                        {chip.label}
                      </span>
                    </td>
                    <td>
                      <button
                        className="fin-action"
                        style={row.status === 'pending' ? { color: 'var(--g600)', borderColor: 'var(--g300)' } : {}}
                        onClick={() => row.status === 'pending' && alert(`Link copiado para envio!`)}
                      >
                        {row.status === 'answered' ? 'Ver resposta' : 'Reenviar'}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {allForms.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--gr4)', fontSize: '13px' }}>Nenhum formulário enviado ainda</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Send form modal */}
      {sendModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setSendModal(false)}
        >
          <div style={{ background: 'var(--w)', borderRadius: 'var(--r2)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: '100%', maxWidth: '460px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: '1px solid var(--gr2)' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '16px', fontWeight: 400, color: 'var(--d)' }}>Enviar Formulário ao Paciente</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--gr5)', lineHeight: 1 }} onClick={() => setSendModal(false)}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.5px', marginBottom: '8px' }}>PACIENTE</div>
                <select
                  value={sendPatient}
                  onChange={e => setSendPatient(e.target.value)}
                  style={{ border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '9px 12px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: 'var(--ow)', width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="">Selecione um paciente…</option>
                  {sendPatients.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.5px', marginBottom: '8px' }}>FORMULÁRIO</div>
                <select
                  value={sendFormType}
                  onChange={e => setSendFormType(e.target.value)}
                  style={{ border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '9px 12px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: 'var(--ow)', width: '100%', boxSizing: 'border-box' }}
                >
                  <option value="">Selecione um formulário…</option>
                  {formTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: '1px solid var(--gr2)', background: 'var(--ow)' }}>
              <button className="btn-outline" style={{ fontSize: '13px' }} onClick={() => setSendModal(false)}>Cancelar</button>
              <button
                className="btn-primary"
                style={{ fontSize: '13px' }}
                disabled={!sendPatient || !sendFormType || sending}
                onClick={() => {
                  if (!sendPatient || !sendFormType) return
                  setSending(true)
                  const newEntry = {
                    id: Date.now(),
                    patientId: sendPatient,
                    patientName: sendPatients.find(p => p.id === sendPatient)?.name || sendPatient,
                    title: formTemplates.find(t => t.id === sendFormType)?.name || sendFormType,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    answeredAt: null,
                  }
                  setAllForms(prev => [newEntry, ...prev])
                  setSending(false)
                  setSendModal(false)
                }}
              >
                {sending ? 'Enviando…' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      <div className={`form-preview-modal${preview ? ' open' : ''}`} onClick={e => e.target === e.currentTarget && setPreview(null)}>
        <div className="form-preview-box">
          {preview && formPreviews[preview] && (
            <>
              <div className="form-preview-header">
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', fontWeight: 400, color: 'var(--d)' }}>{formPreviews[preview].title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '3px' }}>Modelo PsicoAI · Enviado via link seguro</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-outline" style={{ fontSize: '12px', padding: '7px 14px' }} onClick={() => alert('Link copiado!')}>Copiar link</button>
                  <button className="btn-primary" style={{ fontSize: '12px' }} onClick={() => alert('Selecione o paciente na tela principal.')}>Enviar a paciente</button>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--gr5)', marginLeft: '4px' }} onClick={() => setPreview(null)}>×</button>
                </div>
              </div>
              <div className="form-preview-body">{formPreviews[preview].body}</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
