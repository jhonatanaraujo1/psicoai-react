import { useState, useEffect } from 'react'
import { api } from '../services'
import { showToast } from '../components/Toast'
import FormBuilder, { loadCustomForms, saveCustomForms } from '../components/FormBuilder'
import { DatePicker, CustomSelect } from '../components/DateTimePickers'

const formTemplates = [
  { id: 'anamnese', name: 'Anamnese inicial', desc: 'Coleta dados demográficos, queixa principal e histórico de saúde', meta: '12 campos', type: 'anamnese', icon: '📋', badge: 'Padrão CFP', badgeClass: 'badge-green' },
  { id: 'tcle', name: 'TCLE — Consentimento', desc: 'Termo de consentimento livre e esclarecido conforme Res. CFP 09/2024', meta: '6 campos', type: 'tcle', icon: '✍️', badge: 'Obrigatório', badgeClass: 'badge-green' },
  { id: 'beck', name: 'BDI-II — Beck', desc: 'Inventário de depressão de Beck, validado para população brasileira', meta: '21 itens', type: 'beck', icon: '🧠', badge: 'Clínico', badgeClass: 'badge-gray' },
  { id: 'phq', name: 'PHQ-9 — Depressão', desc: 'Patient Health Questionnaire, rastreio de depressão maior', meta: '9 itens', type: 'phq', icon: '📊', badge: 'Clínico', badgeClass: 'badge-gray' },
  { id: 'srs', name: 'SRS — Aliança terapêutica', desc: 'Session Rating Scale — feedback do paciente após sessão', meta: '4 escalas', type: 'srs', icon: '🤝', badge: 'Sessão', badgeClass: 'badge-green' },
  { id: 'gad7', name: 'GAD-7 — Ansiedade', desc: 'Generalized Anxiety Disorder scale, rastreio de ansiedade', meta: '7 itens', type: 'gad7', icon: '⚡', badge: 'Clínico', badgeClass: 'badge-gray' },
  { id: 'dass21', name: 'DASS-21', desc: 'Escala de Depressão, Ansiedade e Estresse — triagem rápida e validada', meta: '21 itens', type: 'dass21', icon: '🎯', badge: 'Clínico', badgeClass: 'badge-gray' },
  { id: 'ors', name: 'ORS — Resultado', desc: 'Outcome Rating Scale — avaliação de bem-estar pelo paciente a cada sessão', meta: '4 escalas', type: 'ors', icon: '📈', badge: 'Sessão', badgeClass: 'badge-green' },
  { id: 'contrato', name: 'Contrato Terapêutico', desc: 'Define regras, frequência, honorários e cláusulas éticas do vínculo terapêutico', meta: '8 campos', type: 'contrato', icon: '📝', badge: 'Ético', badgeClass: 'badge-green' },
]

const formPreviews = {
  anamnese: {
    title: 'Anamnese inicial',
    color: 'var(--g500)',
    body: (
      <div>
        <div className="form-section-title">Identificação</div>
        <div className="form-anamnese-grid">
          <div className="form-field"><label>NOME COMPLETO</label><input type="text" placeholder="Nome do paciente" /></div>
          <div className="form-field"><label>DATA DE NASCIMENTO</label><DatePicker value="" onChange={() => {}} /></div>
          <div className="form-field"><label>PROFISSÃO</label><input type="text" placeholder="Sua profissão" /></div>
          <div className="form-field"><label>ESTADO CIVIL</label><CustomSelect value="" onChange={() => {}} options={[{ label: 'Solteiro(a)', value: 'solteiro' }, { label: 'Casado(a)', value: 'casado' }, { label: 'Divorciado(a)', value: 'divorciado' }, { label: 'Viúvo(a)', value: 'viuvo' }]} placeholder="Solteiro(a)" /></div>
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

const formPreviews_extra = {
  dass21: {
    title: 'DASS-21 — Depressão, Ansiedade e Estresse',
    color: '#E67E22',
    body: (
      <div>
        <div style={{ background: '#FEF9E7', borderRadius: 'var(--r)', padding: '12px', marginBottom: '20px', fontSize: '12px', color: '#7D6608', lineHeight: 1.5 }}>
          Por favor, leia cada item e marque com que frequência ele se aplicou a você na <strong>última semana</strong>.
        </div>
        {[
          'Achei difícil me acalmar',
          'Percebi que minha boca estava seca',
          'Não conseguia ter nenhum sentimento positivo',
          'Tive dificuldade em respirar (ex: respiração acelerada, falta de ar)',
          'Achei difícil ter iniciativa para fazer as coisas',
          'Tendi a reagir de forma exagerada às situações',
          'Senti tremores nas mãos',
        ].map((q, i) => (
          <div key={i} style={{ padding: '10px', background: 'var(--ow)', borderRadius: 'var(--r)', border: '1px solid var(--gr2)', marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', color: 'var(--d)', marginBottom: '8px' }}>{i+1}. {q}</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {['Não se aplicou (0)', 'Às vezes (1)', 'Bastante (2)', 'Sempre (3)'].map(o => (
                <label key={o} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--gr5)', cursor: 'pointer' }}>
                  <input type="radio" name={`dass${i}`} style={{ accentColor: '#E67E22' }} /> {o}
                </label>
              ))}
            </div>
          </div>
        ))}
        <div style={{ fontSize: '11px', color: 'var(--gr4)', textAlign: 'center', paddingTop: '8px' }}>Subescalas D/A/E calculadas automaticamente</div>
      </div>
    )
  },
  ors: {
    title: 'ORS — Outcome Rating Scale',
    color: '#27AE60',
    body: (
      <div>
        <div style={{ background: 'var(--g50)', borderRadius: 'var(--r)', padding: '12px', marginBottom: '20px', fontSize: '12px', color: 'var(--g600)', lineHeight: 1.5 }}>
          Pensando em como você se sentiu durante a <strong>última semana</strong>, marque nos itens abaixo onde esteve seu bem-estar. À esquerda = mal, à direita = bem.
        </div>
        {[
          { label: 'Individualmente', sub: 'Bem-estar pessoal' },
          { label: 'Interpessoalmente', sub: 'Família, relacionamentos íntimos' },
          { label: 'Socialmente', sub: 'Trabalho, escola, amizades' },
          { label: 'Geral', sub: 'Bem-estar global' },
        ].map((item, i) => (
          <div key={i} style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)' }}>{item.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--gr4)' }}>{item.sub}</div>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <input type="range" min="0" max="10" defaultValue="5"
                style={{ width: '100%', accentColor: 'var(--g500)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--gr4)', marginTop: '2px' }}>
                <span>Mal</span><span>Bem</span>
              </div>
            </div>
          </div>
        ))}
        <div style={{ fontSize: '11px', color: 'var(--gr4)', textAlign: 'center' }}>Pontuação total (0–40) calculada automaticamente. Corte clínico: 25.</div>
      </div>
    )
  },
  contrato: {
    title: 'Contrato Terapêutico',
    color: '#2D4A38',
    body: (
      <div>
        <div style={{ background: 'var(--g50)', borderRadius: 'var(--r)', padding: '14px', marginBottom: '20px', fontSize: '13px', color: 'var(--g600)', lineHeight: 1.6 }}>
          Este contrato estabelece os termos do vínculo terapêutico e está em conformidade com o Código de Ética dos Psicólogos e a Resolução CFP 09/2024.
        </div>
        <div className="form-section-title">Partes</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '8px' }}>
          <div className="form-field"><label>NOME DO PACIENTE</label><input type="text" placeholder="Nome completo" /></div>
          <div className="form-field"><label>CPF</label><input type="text" placeholder="000.000.000-00" /></div>
        </div>
        <div className="form-section-title">Condições do atendimento</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="form-field"><label>FREQUÊNCIA</label>
            <div style={{ border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', background: 'var(--ow)', color: 'var(--gr4)', pointerEvents: 'none' }}><span>Semanal</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></div>
          </div>
          <div className="form-field"><label>DURAÇÃO DA SESSÃO</label>
            <div style={{ border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', background: 'var(--ow)', color: 'var(--gr4)', pointerEvents: 'none' }}><span>50 min</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></div>
          </div>
          <div className="form-field"><label>HONORÁRIOS (R$)</label><input type="text" placeholder="Ex: 180,00" /></div>
          <div className="form-field"><label>FORMA DE PAGAMENTO</label>
            <div style={{ border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', background: 'var(--ow)', color: 'var(--gr4)', pointerEvents: 'none' }}><span>PIX</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></div>
          </div>
        </div>
        <div className="form-section-title" style={{ marginTop: '8px' }}>Cancelamento</div>
        <div className="form-field"><label>PRAZO MÍNIMO DE AVISO</label>
          <div style={{ border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: '13px', display: 'flex', justifyContent: 'space-between', background: 'var(--ow)', color: 'var(--gr4)', pointerEvents: 'none' }}><span>24 horas</span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gr4)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg></div>
        </div>
        <div className="form-field" style={{ marginTop: '8px' }}><label>COBRANÇA EM CASO DE FALTA SEM AVISO</label>
          <div className="form-radio-group">
            <label className="form-radio-item"><input type="radio" name="falta" /> Sim, cobro 100% do valor</label>
            <label className="form-radio-item"><input type="radio" name="falta" /> Sim, cobro 50% do valor</label>
            <label className="form-radio-item"><input type="radio" name="falta" /> Não cobro</label>
          </div>
        </div>
        <div className="form-section-title">Assinatura</div>
        <div className="form-field"><label>ASSINATURA DO PACIENTE (nome completo)</label><input type="text" placeholder="Digite o nome para assinar digitalmente" /></div>
        <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '12px' }}>Data de assinatura registrada automaticamente no momento do envio.</div>
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

const allPreviews = { ...formPreviews, ...formPreviews_extra }

export default function Forms() {
  const [preview, setPreview] = useState(null)
  const [allForms, setAllForms] = useState([])
  const [sendModal, setSendModal] = useState(false)
  const [sendPatient, setSendPatient] = useState('')
  const [sendFormType, setSendFormType] = useState('')
  const [sendPatients, setSendPatients] = useState([])
  const [sending, setSending] = useState(false)

  // ── Custom forms (localStorage) ───────────────────────────────────────────
  const [customForms, setCustomForms] = useState(() => loadCustomForms())
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingForm, setEditingForm] = useState(null) // null = new, obj = edit

  // ── Sugestão de formulário ────────────────────────────────────────────────
  const [suggOpen, setSuggOpen] = useState(false)
  const [suggText, setSuggText] = useState('')
  const [suggSent, setSuggSent] = useState(false)
  const SUGG_MAX = 1000

  const handleSuggSubmit = () => {
    if (!suggText.trim()) return
    // TODO: wired to backend quando endpoint estiver pronto
    // Por agora: registra no console + fecha com feedback positivo
    console.info('[PsicoAI] Sugestão de formulário recebida:', suggText.trim())
    setSuggSent(true)
    setTimeout(() => {
      setSuggOpen(false)
      setSuggText('')
      setSuggSent(false)
    }, 1800)
  }

  const handleSaveCustomForm = (form) => {
    const updated = editingForm
      ? customForms.map(f => f.id === form.id ? form : f)
      : [...customForms, form]
    setCustomForms(updated)
    saveCustomForms(updated)
    setBuilderOpen(false)
    setEditingForm(null)
  }

  const handleDeleteCustomForm = (id) => {
    if (!confirm('Excluir este formulário personalizado?')) return
    const updated = customForms.filter(f => f.id !== id)
    setCustomForms(updated)
    saveCustomForms(updated)
  }

  const openBuilder = (form = null) => {
    setEditingForm(form)
    setBuilderOpen(true)
  }

  useEffect(() => {
    // Carrega formulários de todos os pacientes ativos (máx 50)
    api.getPatients({ size: 50 })
      .then(res => {
        const patients = res.content || res.data || []
        if (patients.length === 0) { setAllForms([]); return }
        return Promise.all(patients.map(p => api.getPatientForms(p.id)))
          .then(results => setAllForms(results.flat()))
      })
      .catch(() => setAllForms([]))
  }, [])

  useEffect(() => {
    if (sendModal) {
      api.getPatients({ size: 100 }).then(res => {
        setSendPatients(res.content || res.data || [])
      }).catch(() => setSendPatients([]))
    }
  }, [sendModal])

  // Derived stats
  const totalSent = allForms.length
  const pending   = allForms.filter(f => f.status === 'pending').length
  const answered  = allForms.filter(f => f.status === 'answered').length

  return (
    <div className="view">

      {/* ── Dashboard stats ──────────────────────────────────────────────── */}
      <div className="form-stats-snap">
        {[
          { label: 'Total enviados', value: totalSent, color: 'var(--g500)', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          )},
          { label: 'Aguardando resposta', value: pending, color: 'var(--warn)', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          )},
          { label: 'Respondidos', value: answered, color: 'var(--g600)', icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="20 6 9 17 4 12"/></svg>
          )},
        ].map(({ label, value, color, icon }) => (
          <div key={label} style={{ background: 'var(--w)', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: 38, height: 38, borderRadius: '10px', background: `color-mix(in srgb, ${color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--d)', lineHeight: 1.1, fontFamily: "'Fraunces', serif" }}>{value}</div>
              <div style={{ fontSize: '11px', color: 'var(--gr5)', marginTop: '2px' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modelos prontos ───────────────────────────────────────────────── */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '15px', color: 'var(--d)', fontWeight: 400 }}>
            Modelos prontos
          </div>
          <span style={{ fontSize: '12px', color: 'var(--gr4)' }}>{formTemplates.length} formulários</span>
        </div>
        <div className="form-template-grid">
          {formTemplates.map(t => (
            <div key={t.id} className={`form-template-card ${t.type}`} onClick={() => allPreviews[t.id] && setPreview(t.id)}>
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

      {/* ── Meus formulários (personalizados) ────────────────────────────── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '15px', color: 'var(--d)', fontWeight: 400 }}>
            Meus formulários
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Sugestão de formulário */}
            <button
              onClick={() => setSuggOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', color: 'var(--gr5)', cursor: 'pointer', fontSize: '12px', fontWeight: 500, fontFamily: "'DM Sans', sans-serif", transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--g300)'; e.currentTarget.style.color = 'var(--g600)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gr2)'; e.currentTarget.style.color = 'var(--gr5)' }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Sugerir formulário
            </button>
            <button
              onClick={() => openBuilder(null)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', border: 'none', borderRadius: 'var(--r)', background: 'var(--g500)', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Criar formulário
            </button>
          </div>
        </div>

        {customForms.length === 0 ? (
          <div style={{ border: '1.5px dashed var(--gr2)', borderRadius: 'var(--r)', padding: '32px 24px', textAlign: 'center', background: 'var(--ow)' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="1.2" style={{ display: 'block', margin: '0 auto 12px' }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--d)', marginBottom: '6px' }}>Nenhum formulário personalizado ainda</div>
            <div style={{ fontSize: '12px', color: 'var(--gr4)', marginBottom: '14px' }}>Crie formulários com seus próprios campos e envie para qualquer paciente</div>
            <button onClick={() => openBuilder(null)}
              style={{ padding: '8px 18px', border: '1px solid var(--g300)', borderRadius: 'var(--r)', background: 'var(--g50)', color: 'var(--g600)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
              Criar meu primeiro formulário
            </button>
          </div>
        ) : (
          <div className="form-template-grid">
            {customForms.map(f => (
              <div key={f.id} className="form-template-card custom"
                style={{ position: 'relative', cursor: 'default' }}>
                <div className="form-template-icon" style={{ background: 'var(--ow)', fontSize: '20px' }}>🗒️</div>
                <div className="form-template-name">{f.name}</div>
                <div className="form-template-desc">{f.desc || 'Formulário personalizado'}</div>
                <div className="form-template-footer">
                  <span className="form-template-count">{f.meta}</span>
                  <span className="card-badge badge-gray">Personalizado</span>
                </div>
                {/* Actions overlay */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <button onClick={() => openBuilder(f)}
                    style={{ flex: 1, fontSize: '11px', padding: '5px 0', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', color: 'var(--g600)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                    Editar
                  </button>
                  <button onClick={() => handleDeleteCustomForm(f.id)}
                    style={{ width: '32px', fontSize: '14px', padding: '5px 0', border: '1px solid var(--danger-l)', borderRadius: 'var(--r)', background: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
                        onClick={() => row.status === 'pending' && (navigator.clipboard?.writeText(row.link || window.location.origin + '/f/' + row.id).catch(() => null), showToast('Link copiado para envio!', 'success'))}
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
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', touchAction: 'none', overscrollBehavior: 'none' }}
          onClick={e => e.target === e.currentTarget && setSendModal(false)}
        >
          <div style={{ background: 'var(--w)', borderRadius: 'var(--r2)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', width: '100%', maxWidth: '460px', maxHeight: 'min(90dvh,90svh,90vh)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: '1px solid var(--gr2)' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '16px', fontWeight: 400, color: 'var(--d)' }}>Enviar Formulário ao Paciente</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--gr5)', lineHeight: 1 }} onClick={() => setSendModal(false)}>×</button>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.5px', marginBottom: '8px' }}>PACIENTE</div>
                <CustomSelect
                  value={sendPatient}
                  onChange={v => setSendPatient(v)}
                  options={[{ label: 'Selecione um paciente…', value: '' }, ...sendPatients.map(p => ({ label: p.name, value: p.id }))]}
                  placeholder="Selecione um paciente…"
                />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.5px', marginBottom: '8px' }}>FORMULÁRIO</div>
                <CustomSelect
                  value={sendFormType}
                  onChange={v => setSendFormType(v)}
                  options={[
                    { label: 'Selecione um formulário…', value: '' },
                    ...formTemplates.map(t => ({ label: t.name, value: t.id })),
                    ...customForms.map(f => ({ label: f.name, value: f.id })),
                  ]}
                  placeholder="Selecione um formulário…"
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: '1px solid var(--gr2)', background: 'var(--ow)' }}>
              <button className="btn-outline" style={{ fontSize: '13px' }} onClick={() => setSendModal(false)}>Cancelar</button>
              <button
                className="btn-primary"
                style={{ fontSize: '13px' }}
                disabled={!sendPatient || !sendFormType || sending}
                onClick={async () => {
                  if (!sendPatient || !sendFormType) return
                  setSending(true)
                  try {
                    const title = [...formTemplates, ...customForms].find(t => t.id === sendFormType)?.name || sendFormType
                    const created = await api.createForm({ patientId: sendPatient, type: sendFormType, title })
                    if (created) setAllForms(prev => [created, ...prev])
                    setSendModal(false)
                  } catch (e) {
                    console.error('Erro ao criar formulário:', e)
                    showToast('Erro ao criar formulário. Tente novamente.', 'error')
                  } finally {
                    setSending(false)
                  }
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
          {preview && allPreviews[preview] && (
            <>
              <div className="form-preview-header">
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', fontWeight: 400, color: 'var(--d)' }}>{allPreviews[preview].title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '3px' }}>Modelo PsicoNotes · Enviado via link seguro</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-outline" style={{ fontSize: '12px', padding: '7px 14px' }} onClick={() => { navigator.clipboard?.writeText(window.location.origin + '/f/' + preview).catch(() => null); showToast('Link copiado!', 'success') }}>Copiar link</button>
                  <button className="btn-primary" style={{ fontSize: '12px' }} onClick={() => showToast('Selecione o paciente na tela principal para enviar.', 'info')}>Enviar a paciente</button>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--gr5)', marginLeft: '4px' }} onClick={() => setPreview(null)}>×</button>
                </div>
              </div>
              <div className="form-preview-body">{allPreviews[preview].body}</div>
            </>
          )}
        </div>
      </div>

      {/* Form Builder */}
      <FormBuilder
        isOpen={builderOpen}
        initial={editingForm}
        onSave={handleSaveCustomForm}
        onClose={() => { setBuilderOpen(false); setEditingForm(null) }}
      />

      {/* ── Modal: Sugestão de formulário ─────────────────────────────────── */}
      {suggOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) { setSuggOpen(false); setSuggText(''); setSuggSent(false) } }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.38)', zIndex: 500,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div style={{
            background: 'var(--w)', borderRadius: 16, width: '100%', maxWidth: 480,
            boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden',
            animation: 'scaleIn 0.18s ease',
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gr1)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: 18, color: 'var(--d)', fontWeight: 400, marginBottom: 4 }}>
                    Sugerir formulário
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gr5)', lineHeight: 1.5 }}>
                    Tem algum formulário, escala ou instrumento clínico que deveria estar aqui? Conta pra gente.
                  </div>
                </div>
                <button
                  onClick={() => { setSuggOpen(false); setSuggText(''); setSuggSent(false) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gr4)', padding: 4, borderRadius: 6, flexShrink: 0, marginTop: 2 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px' }}>
              {suggSent ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '20px 0' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--g50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--g500)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--d)' }}>Sugestão enviada!</div>
                  <div style={{ fontSize: 12, color: 'var(--gr5)', textAlign: 'center' }}>Obrigado — a equipe vai avaliar a inclusão.</div>
                </div>
              ) : (
                <>
                  <textarea
                    value={suggText}
                    onChange={e => setSuggText(e.target.value.slice(0, SUGG_MAX))}
                    placeholder="Ex: PHQ-A (versão adolescente), PCL-5 para trauma, AUDIT para triagem de álcool…&#10;&#10;Qualquer sugestão é bem-vinda."
                    style={{
                      width: '100%', minHeight: 140, maxHeight: 260,
                      border: '1.5px solid var(--gr2)', borderRadius: 'var(--r)',
                      padding: '12px 14px', fontSize: 13, color: 'var(--d)',
                      fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6,
                      outline: 'none', resize: 'vertical', background: 'var(--ow)',
                      boxSizing: 'border-box', transition: 'border-color 0.15s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--g300)'}
                    onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
                    autoFocus
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                    <span style={{ fontSize: 11, color: suggText.length > SUGG_MAX * 0.9 ? 'var(--warn)' : 'var(--gr4)' }}>
                      {suggText.length}/{SUGG_MAX}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => { setSuggOpen(false); setSuggText(''); setSuggSent(false) }}
                        style={{ padding: '8px 16px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'none', color: 'var(--gr5)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSuggSubmit}
                        disabled={!suggText.trim()}
                        style={{
                          padding: '8px 18px', border: 'none', borderRadius: 'var(--r)',
                          background: suggText.trim() ? 'var(--g500)' : 'var(--gr2)',
                          color: suggText.trim() ? '#fff' : 'var(--gr4)',
                          fontSize: 12, fontWeight: 600, cursor: suggText.trim() ? 'pointer' : 'not-allowed',
                          fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s',
                        }}
                      >
                        Enviar sugestão
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
