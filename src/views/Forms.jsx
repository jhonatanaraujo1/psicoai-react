import { useState, useEffect } from 'react'
import { api } from '../services'
import { showToast } from '../components/Toast'
import FormBuilder, { loadCustomForms, saveCustomForms } from '../components/FormBuilder'
import { DatePicker, CustomSelect } from '../components/DateTimePickers'

// ── Ícones SVG para templates (substituem emojis) ─────────────────────────────
const TEMPLATE_ICONS = {
  anamnese: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  tcle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  beck: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  phq: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  srs: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  gad7: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  dass21: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  ors: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  ),
  contrato: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="13" y1="17" x2="8" y2="17"/>
    </svg>
  ),
}

// ── Metadados de templates (country-aware gerado em runtime) ──────────────────
function getFormTemplates(country) {
  const isPT = country === 'PT'
  const docRef = isPT ? 'OPP' : 'CFP'
  const consentRef = isPT ? 'RGPD (Reg. UE 2016/679)' : 'LGPD (Lei 13.709/2018)'
  const beckDesc = isPT
    ? 'Inventário de depressão de Beck, validado para população portuguesa'
    : 'Inventário de depressão de Beck, validado para população brasileira'
  return [
    { id: 'anamnese', name: 'Anamnese inicial', desc: 'Coleta dados demográficos, queixa principal e histórico de saúde', meta: '12 campos', type: 'anamnese', badge: `Padrão ${docRef}`, badgeClass: 'badge-green' },
    { id: 'tcle', name: isPT ? 'Consentimento Informado' : 'TCLE — Consentimento', desc: `Termo de consentimento livre e esclarecido conforme ${consentRef}`, meta: '6 campos', type: 'tcle', badge: 'Obrigatório', badgeClass: 'badge-green' },
    { id: 'beck', name: 'BDI-II — Beck', desc: beckDesc, meta: '21 itens', type: 'beck', badge: 'Clínico', badgeClass: 'badge-gray' },
    { id: 'phq', name: 'PHQ-9 — Depressão', desc: 'Patient Health Questionnaire, rastreio de depressão maior', meta: '9 itens', type: 'phq', badge: 'Clínico', badgeClass: 'badge-gray' },
    { id: 'srs', name: 'SRS — Aliança terapêutica', desc: 'Session Rating Scale — feedback do paciente após sessão', meta: '4 escalas', type: 'srs', badge: 'Sessão', badgeClass: 'badge-green' },
    { id: 'gad7', name: 'GAD-7 — Ansiedade', desc: 'Generalized Anxiety Disorder scale, rastreio de ansiedade', meta: '7 itens', type: 'gad7', badge: 'Clínico', badgeClass: 'badge-gray' },
    { id: 'dass21', name: 'DASS-21', desc: 'Escala de Depressão, Ansiedade e Estresse — triagem rápida e validada', meta: '21 itens', type: 'dass21', badge: 'Clínico', badgeClass: 'badge-gray' },
    { id: 'ors', name: 'ORS — Resultado', desc: 'Outcome Rating Scale — avaliação de bem-estar pelo paciente a cada sessão', meta: '4 escalas', type: 'ors', badge: 'Sessão', badgeClass: 'badge-green' },
    { id: 'contrato', name: 'Contrato Terapêutico', desc: 'Define regras, frequência, honorários e cláusulas éticas do vínculo terapêutico', meta: '8 campos', type: 'contrato', badge: 'Ético', badgeClass: 'badge-green' },
  ]
}

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
          Este documento está em conformidade com a legislação de proteção de dados pessoais e o código de ética profissional aplicável.
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
          Este contrato estabelece os termos do vínculo terapêutico em conformidade com o Código de Ética Profissional e normas regulatórias aplicáveis.
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

// ── Score automático de escalas clínicas ─────────────────────────────────────

function scoreFromOption(val) {
  const n = parseInt(String(val ?? '')[0])
  return isNaN(n) ? null : n
}

function calcScoreForForm(type, response) {
  if (type === 'phq') {
    const keys = ['q1','q2','q3','q4','q5','q6','q7','q8','q9']
    const scores = keys.map(k => scoreFromOption(response[k]))
    if (scores.some(s => s === null)) return null
    const total = scores.reduce((a,b) => a + b, 0)
    const riskAlert = (scores[8] ?? 0) > 0
    let severity, color
    if (total <= 4)       { severity = 'Mínima';               color = 'var(--g600)' }
    else if (total <= 9)  { severity = 'Leve';                  color = '#CA8A04' }
    else if (total <= 14) { severity = 'Moderada';              color = '#D97706' }
    else if (total <= 19) { severity = 'Moderadamente grave';   color = '#EA580C' }
    else                  { severity = 'Grave';                 color = 'var(--danger)' }
    return { label: 'PHQ-9', total, max: 27, severity, color, riskAlert }
  }
  if (type === 'gad7') {
    const keys = ['q1','q2','q3','q4','q5','q6','q7']
    const scores = keys.map(k => scoreFromOption(response[k]))
    if (scores.some(s => s === null)) return null
    const total = scores.reduce((a,b) => a + b, 0)
    let severity, color
    if (total <= 4)       { severity = 'Mínima';  color = 'var(--g600)' }
    else if (total <= 9)  { severity = 'Leve';     color = '#CA8A04' }
    else if (total <= 14) { severity = 'Moderada'; color = '#D97706' }
    else                  { severity = 'Grave';    color = 'var(--danger)' }
    return { label: 'GAD-7', total, max: 21, severity, color, riskAlert: false }
  }
  if (type === 'beck') {
    const keys = ['tristeza','pessimismo','fracasso','perda_prazer','culpa','punicao','autoavaliacao','autocritica','suicidio','choro','agitacao','perda_interesse','indecisao','desvalorizacao','perda_energia','sono','irritabilidade','apetite','concentracao','cansaco','interesse_sexo']
    const scores = keys.map(k => scoreFromOption(response[k])).filter(s => s !== null)
    if (scores.length < 10) return null
    const total = scores.reduce((a,b) => a + b, 0)
    const riskAlert = (scoreFromOption(response['suicidio']) ?? 0) > 0
    let severity, color
    if (total <= 13)      { severity = 'Mínima';  color = 'var(--g600)' }
    else if (total <= 19) { severity = 'Leve';     color = '#CA8A04' }
    else if (total <= 28) { severity = 'Moderada'; color = '#D97706' }
    else                  { severity = 'Grave';    color = 'var(--danger)' }
    return { label: 'BDI-II', total, max: 63, severity, color, riskAlert }
  }
  return null
}

function getTemplateFields(country) {
  const isPT = country === 'PT'
  const docId = isPT ? 'NIF' : 'CPF'
  const docPlaceholder = isPT ? '123456789' : '000.000.000-00'
  const currency = isPT ? '€' : 'R$'
  const paymentOptions = isPT
    ? ['MB Way', 'Transferência bancária', 'Multibanco', 'Dinheiro']
    : ['PIX', 'Cartão de crédito', 'Transferência bancária', 'Dinheiro']
  return {
  anamnese: [
    { id: 'nome', label: 'Nome completo', type: 'text', required: true },
    { id: 'nascimento', label: 'Data de nascimento', type: 'text', required: true },
    { id: 'profissao', label: 'Profissão', type: 'text', required: false },
    { id: 'estado_civil', label: 'Estado civil', type: 'select', required: false, options: ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)'] },
    { id: 'queixa', label: 'O que te trouxe à terapia?', type: 'textarea', required: true },
    { id: 'tempo_sintomas', label: 'Há quanto tempo sente isso?', type: 'text', required: false },
    { id: 'tratamento_anterior', label: 'Tratamentos psicológicos anteriores?', type: 'radio', required: false, options: ['Sim', 'Não'] },
    { id: 'condicoes_saude', label: 'Condições de saúde relevantes', type: 'textarea', required: false },
    { id: 'medicamentos', label: 'Uso de medicamentos', type: 'textarea', required: false },
    { id: 'historico_familiar', label: 'Histórico familiar de saúde mental', type: 'textarea', required: false },
    { id: 'contato_emergencia', label: 'Contato de emergência', type: 'text', required: false },
    { id: 'como_conheceu', label: 'Como nos encontrou?', type: 'text', required: false },
  ],
  tcle: [
    { id: 'autoriza_prontuario', label: 'Autorizo o registo em prontuário eletrónico', type: 'radio', required: true, options: ['Sim, autorizo', 'Não autorizo'] },
    { id: 'autoriza_ia', label: 'Autorizo análise de IA como suporte clínico', type: 'radio', required: true, options: ['Sim, autorizo', 'Não autorizo'] },
    { id: 'assinatura', label: 'Assinatura digital (nome completo)', type: 'text', required: true },
    { id: 'doc_id', label: docId, type: 'text', required: true, placeholder: docPlaceholder },
    { id: 'ciencia', label: 'Declaro que li e compreendi os termos do atendimento', type: 'radio', required: true, options: ['Sim, declaro'] },
  ],
  beck: [
    { id: 'tristeza', label: '1. Tristeza', type: 'radio', required: true, options: ['0 - Não me sinto triste', '1 - Me sinto triste com frequência', '2 - Me sinto muito triste o tempo todo', '3 - Não consigo suportar a tristeza'] },
    { id: 'pessimismo', label: '2. Pessimismo', type: 'radio', required: true, options: ['0 - Não estou pessimista', '1 - Tenho mais motivos para pessimismo', '2 - Não espero que as coisas melhorem', '3 - O futuro é sem esperança'] },
    { id: 'fracasso', label: '3. Fracasso', type: 'radio', required: true, options: ['0 - Não me sinto fracassado', '1 - Fracassei mais do que deveria', '2 - Quando olho atrás, vejo muitos fracassos', '3 - Sou um completo fracasso'] },
    { id: 'perda_prazer', label: '4. Perda de prazer', type: 'radio', required: true, options: ['0 - Sinto tanto prazer quanto antes', '1 - Sinto menos prazer nas coisas', '2 - Não consigo sentir prazer na maioria das coisas', '3 - Não consigo sentir prazer em nada'] },
    { id: 'culpa', label: '5. Sentimentos de culpa', type: 'radio', required: true, options: ['0 - Não me sinto culpado', '1 - Me sinto culpado por muitas coisas', '2 - Me sinto culpado na maior parte do tempo', '3 - Me sinto culpado o tempo todo'] },
    { id: 'punicao', label: '6. Sentimentos de punição', type: 'radio', required: true, options: ['0 - Não me sinto sendo punido', '1 - Posso estar sendo punido', '2 - Espero ser punido', '3 - Sinto que estou sendo punido'] },
    { id: 'autoavaliacao', label: '7. Autoavaliação negativa', type: 'radio', required: true, options: ['0 - Sinto o mesmo sobre mim', '1 - Perdi a confiança em mim mesmo', '2 - Estou desapontado comigo mesmo', '3 - Não gosto de mim mesmo'] },
    { id: 'autocritica', label: '8. Autocrítica', type: 'radio', required: true, options: ['0 - Não me critico mais do que antes', '1 - Sou mais autocrítico do que antes', '2 - Critico-me por todas as minhas falhas', '3 - Me culpo por tudo de ruim que acontece'] },
    { id: 'suicidio', label: '9. Pensamentos suicidas', type: 'radio', required: true, options: ['0 - Não tenho pensamentos de me machucar', '1 - Às vezes penso em me machucar, mas não faria', '2 - Gostaria de me matar', '3 - Me mataria se tivesse oportunidade'] },
    { id: 'choro', label: '10. Choro', type: 'radio', required: true, options: ['0 - Não choro mais do que antes', '1 - Choro mais do que antes', '2 - Choro por qualquer coisa', '3 - Tenho vontade de chorar mas não consigo'] },
    { id: 'agitacao', label: '11. Agitação', type: 'radio', required: true, options: ['0 - Não estou mais agitado do que antes', '1 - Estou mais agitado do que antes', '2 - Estou muito agitado e tenho dificuldade de me acalmar', '3 - Estou tão agitado que preciso ficar em movimento'] },
    { id: 'perda_interesse', label: '12. Perda de interesse', type: 'radio', required: true, options: ['0 - Não perdi o interesse nas outras pessoas', '1 - Estou menos interessado nas outras pessoas', '2 - Perdi a maior parte do interesse nas outras pessoas', '3 - Não tenho mais interesse nas outras pessoas'] },
    { id: 'indecisao', label: '13. Indecisão', type: 'radio', required: true, options: ['0 - Tomo decisões tão bem quanto antes', '1 - Tomo decisões com mais dificuldade', '2 - Tenho muita dificuldade em tomar decisões', '3 - Não consigo mais tomar decisões'] },
    { id: 'desvalorizacao', label: '14. Desvalorização', type: 'radio', required: true, options: ['0 - Não me sinto sem valor', '1 - Não me sinto tão valioso quanto antes', '2 - Me sinto sem valor comparado a outros', '3 - Me sinto completamente sem valor'] },
    { id: 'perda_energia', label: '15. Perda de energia', type: 'radio', required: true, options: ['0 - Tenho tanta energia quanto antes', '1 - Tenho menos energia do que antes', '2 - Não tenho energia suficiente para muito', '3 - Não tenho energia suficiente para nada'] },
    { id: 'sono', label: '16. Mudanças no sono', type: 'radio', required: true, options: ['0 - Sem mudanças no sono', '1 - Durmo um pouco mais/menos do que antes', '2 - Durmo muito mais/menos do que antes', '3 - Não consigo dormir ou durmo quase o dia todo'] },
    { id: 'irritabilidade', label: '17. Irritabilidade', type: 'radio', required: true, options: ['0 - Não estou mais irritado', '1 - Estou mais irritado do que antes', '2 - Estou muito mais irritado do que antes', '3 - Estou irritado o tempo todo'] },
    { id: 'apetite', label: '18. Mudanças no apetite', type: 'radio', required: true, options: ['0 - Meu apetite não mudou', '1 - Meu apetite está um pouco diferente', '2 - Meu apetite está muito diferente', '3 - Não tenho apetite ou só quero comer'] },
    { id: 'concentracao', label: '19. Dificuldade de concentração', type: 'radio', required: true, options: ['0 - Concentro-me tão bem quanto antes', '1 - Não consigo me concentrar tão bem', '2 - É difícil manter minha atenção por muito tempo', '3 - Não consigo me concentrar em nada'] },
    { id: 'cansaco', label: '20. Cansaço', type: 'radio', required: true, options: ['0 - Não estou mais cansado do que antes', '1 - Fico cansado mais facilmente', '2 - Fico cansado ao fazer qualquer coisa', '3 - Estou cansado demais para qualquer coisa'] },
    { id: 'interesse_sexo', label: '21. Interesse em sexo', type: 'radio', required: true, options: ['0 - Sem mudança no interesse por sexo', '1 - Estou menos interessado em sexo', '2 - Estou muito menos interessado em sexo', '3 - Perdi completamente o interesse em sexo'] },
  ],
  phq: [
    { id: 'q1', label: '1. Pouco interesse ou prazer em fazer as coisas', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q2', label: '2. Se sentiu para baixo, deprimido(a) ou sem perspectiva', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q3', label: '3. Dificuldade para adormecer ou dormindo demais', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q4', label: '4. Se sentiu cansado(a) ou com pouca energia', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q5', label: '5. Apetite diminuído ou aumentado', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q6', label: '6. Se sentiu mal sobre si mesmo(a) ou que é um fracasso', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q7', label: '7. Dificuldade para se concentrar', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q8', label: '8. Se moveu ou falou devagar (ou o oposto)', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q9', label: '9. Pensamentos de que seria melhor estar morto(a)', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
  ],
  srs: [
    { id: 'relacionamento', label: 'Relacionamento — Me senti ouvido(a), compreendido(a) e respeitado(a)', type: 'scale', required: true },
    { id: 'objetivos', label: 'Objetivos e tópicos — Trabalhamos nas questões que eu queria trabalhar', type: 'scale', required: true },
    { id: 'abordagem', label: 'Abordagem — A abordagem do terapeuta foi adequada para mim', type: 'scale', required: true },
    { id: 'geral', label: 'Geral — A sessão de hoje foi adequada para mim', type: 'scale', required: true },
  ],
  gad7: [
    { id: 'q1', label: '1. Se sentiu nervoso(a), ansioso(a) ou muito tenso(a)', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q2', label: '2. Não conseguiu parar ou controlar as preocupações', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q3', label: '3. Preocupou-se muito com diversas coisas', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q4', label: '4. Teve dificuldade para relaxar', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q5', label: '5. Ficou tão agitado(a) que ficou difícil ficar parado(a)', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q6', label: '6. Irritou-se ou ficou facilmente aborrecido(a)', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
    { id: 'q7', label: '7. Sentiu medo, como se algo terrível fosse acontecer', type: 'radio', required: true, options: ['0 - Nunca', '1 - Alguns dias', '2 - Mais da metade dos dias', '3 - Quase todos os dias'] },
  ],
  dass21: [
    { id: 'q1', label: '1. Achei difícil me acalmar', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q2', label: '2. Percebi que minha boca estava seca', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q3', label: '3. Não conseguia ter nenhum sentimento positivo', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q4', label: '4. Tive dificuldade em respirar', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q5', label: '5. Achei difícil ter iniciativa para fazer as coisas', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q6', label: '6. Tendi a reagir de forma exagerada às situações', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q7', label: '7. Senti tremores nas mãos', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q8', label: '8. Me senti consumindo muita energia nervosa', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q9', label: '9. Me preocupei com situações de pânico', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q10', label: '10. Senti que não tinha nada pelo que esperar', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q11', label: '11. Me senti agitado(a)', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q12', label: '12. Achei difícil relaxar', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q13', label: '13. Me senti para baixo e melancólico(a)', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q14', label: '14. Fui intolerante com o que me impedia de agir', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q15', label: '15. Senti que estava quase entrando em pânico', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q16', label: '16. Não consegui me entusiasmar com nada', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q17', label: '17. Senti que não tinha muito valor como pessoa', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q18', label: '18. Me senti bastante irritadiço(a)', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q19', label: '19. Percebi minha ação cardíaca acelerada', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q20', label: '20. Me senti com medo sem motivo razoável', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
    { id: 'q21', label: '21. Senti que a vida não tinha sentido', type: 'radio', required: true, options: ['0 - Não se aplicou', '1 - Às vezes', '2 - Bastante frequente', '3 - Sempre'] },
  ],
  ors: [
    { id: 'individual', label: 'Individualmente — Bem-estar pessoal', type: 'scale', required: true },
    { id: 'interpessoal', label: 'Interpessoalmente — Família, relacionamentos íntimos', type: 'scale', required: true },
    { id: 'social', label: 'Socialmente — Trabalho, escola, amizades', type: 'scale', required: true },
    { id: 'geral', label: 'Geral — Bem-estar global', type: 'scale', required: true },
  ],
  contrato: [
    { id: 'nome_paciente', label: 'Nome completo do paciente', type: 'text', required: true },
    { id: 'doc_id', label: docId, type: 'text', required: true, placeholder: docPlaceholder },
    { id: 'frequencia', label: 'Frequência das sessões', type: 'select', required: true, options: ['Semanal', 'Quinzenal', 'Mensal'] },
    { id: 'duracao', label: 'Duração da sessão', type: 'select', required: true, options: ['45 min', '50 min', '60 min'] },
    { id: 'honorarios', label: `Honorários (${currency})`, type: 'text', required: true },
    { id: 'pagamento', label: 'Forma de pagamento', type: 'select', required: true, options: paymentOptions },
    { id: 'cancelamento', label: 'Prazo mínimo de aviso para cancelamento', type: 'select', required: true, options: ['12 horas', '24 horas', '48 horas', '72 horas'] },
    { id: 'cobranca_falta', label: 'Cobrança em caso de falta sem aviso', type: 'radio', required: true, options: ['Sim, cobro 100% do valor', 'Sim, cobro 50% do valor', 'Não cobro'] },
    { id: 'assinatura', label: 'Assinatura digital (nome completo)', type: 'text', required: true },
  ],
}
}

export default function Forms({ currentUser }) {
  const country = currentUser?.country || 'BR'
  const isPT = country === 'PT'
  const formTemplates = getFormTemplates(country)
  const templateFields = getTemplateFields(country)
  const [preview, setPreview] = useState(null)
  const [allForms, setAllForms] = useState([])
  const [sendModal, setSendModal] = useState(false)
  const [sendPatient, setSendPatient] = useState('')
  const [sendFormType, setSendFormType] = useState('')
  const [sendPatients, setSendPatients] = useState([])
  const [sending, setSending] = useState(false)
  const [viewForm, setViewForm] = useState(null) // { id, title, fields, response, patientName }

  // ── Custom forms (localStorage) ───────────────────────────────────────────
  const [customForms, setCustomForms] = useState(() => loadCustomForms())
  const [builderOpen, setBuilderOpen] = useState(false)
  const [editingForm, setEditingForm] = useState(null) // null = new, obj = edit

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
            <div key={t.id} className={`form-template-card ${t.type}`}
              style={{ cursor: 'pointer', position: 'relative' }}
              onClick={() => { setSendFormType(t.id); setSendPatient(''); setSendModal(true) }}
            >
              <div className="form-template-icon" style={t.type === 'anamnese' ? { background: 'var(--g50)', color: 'var(--g600)' } : t.type === 'tcle' ? { background: '#EBF3FD', color: '#2980B9' } : t.type === 'beck' ? { background: 'var(--warn-l)', color: '#B7791F' } : t.type === 'phq' ? { background: '#F5EEF8', color: '#7D3C98' } : t.type === 'srs' ? { background: 'var(--g50)', color: 'var(--g600)' } : { background: 'var(--danger-l)', color: 'var(--danger)' }}>
                {TEMPLATE_ICONS[t.type] || TEMPLATE_ICONS.anamnese}
              </div>
              <div className="form-template-name">{t.name}</div>
              <div className="form-template-desc">{t.desc}</div>
              <div className="form-template-footer">
                <span className="form-template-count">{t.meta}</span>
                <span className={`card-badge ${t.badgeClass}`}>{t.badge}</span>
              </div>
              {allPreviews[t.id] && (
                <button
                  onClick={e => { e.stopPropagation(); setPreview(t.id) }}
                  style={{ position: 'absolute', top: '8px', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gr4)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7 }}
                  title="Pré-visualizar"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
              )}
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
                style={{ position: 'relative', cursor: 'pointer' }}
                onClick={() => { setSendFormType(f.id); setSendPatient(''); setSendModal(true) }}
              >
                <div className="form-template-icon" style={{ background: 'var(--ow)', fontSize: '20px' }}>🗒️</div>
                <div className="form-template-name">{f.name}</div>
                <div className="form-template-desc">{f.desc || 'Formulário personalizado'}</div>
                <div className="form-template-footer">
                  <span className="form-template-count">{f.meta}</span>
                  <span className="card-badge badge-gray">Personalizado</span>
                </div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <button onClick={e => { e.stopPropagation(); openBuilder(f) }}
                    style={{ flex: 1, fontSize: '11px', padding: '5px 0', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', color: 'var(--g600)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                    Editar
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteCustomForm(f.id) }}
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
                      {row.status === 'answered' ? (
                        <button
                          className="fin-action"
                          onClick={async () => {
                            try {
                              const full = await api.getForm(row.id)
                              let fields = []
                              let response = {}
                              try { fields = JSON.parse(full.fields) } catch (_) {}
                              try { response = JSON.parse(full.response || '{}') } catch (_) {}
                              setViewForm({ id: full.id, title: full.title, patientName: full.patientName, fields, response, type: full.type })
                            } catch (_) {
                              showToast('Erro ao carregar resposta.', 'error')
                            }
                          }}
                        >Ver resposta</button>
                      ) : (
                        <button
                          className="fin-action"
                          style={{ color: 'var(--g600)', borderColor: 'var(--g300)' }}
                          onClick={() => {
                            const link = window.location.origin + '/f/' + (row.token || row.id)
                            navigator.clipboard?.writeText(link).catch(() => null)
                            showToast('Link copiado! Envie para o paciente.', 'success')
                          }}
                        >Copiar link</button>
                      )}
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
      {sendModal && (() => {
        const allTemplates = [...formTemplates, ...customForms]
        const selectedTpl = allTemplates.find(t => t.id === sendFormType)
        const doSend = async () => {
          if (!sendPatient || !sendFormType) return
          setSending(true)
          try {
            const tpl = allTemplates.find(t => t.id === sendFormType)
            const title = tpl?.name || sendFormType
            const fields = templateFields[sendFormType] || tpl?.fields
              || [{ id: 'resposta', label: 'Resposta', type: 'textarea', required: true }]
            const created = await api.createForm({ patientId: sendPatient, type: sendFormType, title, fields })
            if (created) setAllForms(prev => [created, ...prev])
            showToast('Formulário enviado! O paciente receberá o link por email.', 'success')
            setSendModal(false)
          } catch (e) {
            showToast('Erro ao enviar formulário. Tente novamente.', 'error')
          } finally {
            setSending(false)
          }
        }
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
            onClick={e => e.target === e.currentTarget && setSendModal(false)}
          >
            <div style={{ background: 'var(--w)', borderRadius: '16px', boxShadow: '0 16px 48px rgba(0,0,0,0.22)', width: '100%', maxWidth: '420px', overflow: 'hidden' }}>

              {/* Header verde */}
              <div style={{ background: 'var(--g700, #1E3328)', padding: '20px 22px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.8px', fontWeight: 600, marginBottom: '4px' }}>ENVIAR FORMULÁRIO</div>
                  {selectedTpl ? (
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: '17px', color: '#fff', fontWeight: 400, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {TEMPLATE_ICONS[selectedTpl.type] && (
                        <span style={{ opacity: 0.85 }}>{TEMPLATE_ICONS[selectedTpl.type]}</span>
                      )}
                      {selectedTpl.name}
                    </div>
                  ) : (
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: '17px', color: '#fff', fontWeight: 400 }}>Escolha o formulário</div>
                  )}
                </div>
                <button onClick={() => setSendModal(false)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0, marginLeft: '12px' }}>×</button>
              </div>

              <div style={{ padding: '20px 22px' }}>

                {/* Se não tem template selecionado, mostra o seletor de formulário */}
                {!sendFormType && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gr5)', letterSpacing: '0.5px', marginBottom: '8px' }}>FORMULÁRIO</div>
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
                )}

                {/* Se tem template selecionado mas usuário quer trocar */}
                {sendFormType && (
                  <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '12px', color: 'var(--gr4)' }}>
                      {selectedTpl?.meta} · {selectedTpl?.badge}
                    </div>
                    <button
                      onClick={() => setSendFormType('')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--g600)', fontFamily: "'DM Sans', sans-serif", padding: 0, textDecoration: 'underline' }}
                    >Trocar</button>
                  </div>
                )}

                {/* Seletor de paciente */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gr5)', letterSpacing: '0.5px', marginBottom: '8px' }}>PARA QUAL PACIENTE?</div>
                  {sendPatients.length === 0 ? (
                    <div style={{ padding: '12px', background: 'var(--ow)', borderRadius: 'var(--r)', fontSize: '13px', color: 'var(--gr4)', textAlign: 'center' }}>
                      Carregando pacientes…
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                      {sendPatients.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setSendPatient(p.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 14px', borderRadius: 'var(--r)',
                            border: `1.5px solid ${sendPatient === p.id ? 'var(--g500)' : 'var(--gr2)'}`,
                            background: sendPatient === p.id ? 'var(--g50)' : 'var(--w)',
                            cursor: 'pointer', textAlign: 'left', width: '100%',
                            fontFamily: "'DM Sans', sans-serif', transition: 'all 0.12s'",
                          }}
                        >
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: sendPatient === p.id ? 'var(--g500)' : 'var(--gr2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: sendPatient === p.id ? '#fff' : 'var(--gr5)', flexShrink: 0 }}>
                            {(p.name || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)' }}>{p.name}</div>
                            {p.email && <div style={{ fontSize: '11px', color: 'var(--gr4)' }}>{p.email}</div>}
                          </div>
                          {sendPatient === p.id && (
                            <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g500)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {!sendPatient && sendFormType && sendPatients.length > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--gr4)', textAlign: 'center' }}>
                    Selecione um paciente acima para enviar
                  </div>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 22px 20px', borderTop: '1px solid var(--gr2)', display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setSendModal(false)}
                  style={{ flex: 1, padding: '11px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', color: 'var(--d)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}
                >Cancelar</button>
                <button
                  onClick={doSend}
                  disabled={!sendPatient || !sendFormType || sending}
                  style={{ flex: 2, padding: '11px', border: 'none', borderRadius: 'var(--r)', background: (!sendPatient || !sendFormType || sending) ? 'var(--gr2)' : 'var(--g500)', color: (!sendPatient || !sendFormType || sending) ? 'var(--gr4)' : '#fff', cursor: (!sendPatient || !sendFormType || sending) ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {sending ? (
                    <><span style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />Enviando…</>
                  ) : (
                    <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>Enviar formulário</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Preview modal */}
      <div className={`form-preview-modal${preview ? ' open' : ''}`} onClick={e => e.target === e.currentTarget && setPreview(null)}>
        <div className="form-preview-box">
          {preview && allPreviews[preview] && (
            <>
              <div className="form-preview-header">
                <div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', fontWeight: 400, color: 'var(--d)' }}>{allPreviews[preview].title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '3px' }}>Modelo Psic Notes · Enviado via link seguro</div>
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

      {/* Ver resposta modal */}
      {viewForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}
          onClick={e => e.target === e.currentTarget && setViewForm(null)}
        >
          <div style={{ background: 'var(--w)', borderRadius: 'var(--r2)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', width: '100%', maxWidth: '540px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: '1px solid var(--gr2)', flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: '16px', fontWeight: 400, color: 'var(--d)' }}>{viewForm.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--gr4)', marginTop: '2px' }}>Respondido por {viewForm.patientName}</div>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px', color: 'var(--gr5)', lineHeight: 1, marginLeft: '12px', flexShrink: 0 }} onClick={() => setViewForm(null)}>×</button>
            </div>
            <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {(() => {
                const sc = calcScoreForForm(viewForm.type, viewForm.response)
                if (!sc) return null
                return (
                  <div style={{ background: 'var(--ow)', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ textAlign: 'center', minWidth: '60px' }}>
                      <div style={{ fontSize: '30px', fontWeight: 700, color: sc.color, lineHeight: 1 }}>{sc.total}</div>
                      <div style={{ fontSize: '10px', color: 'var(--gr4)', marginTop: '1px' }}>de {sc.max}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--gr4)', letterSpacing: '0.5px', marginBottom: '3px' }}>{sc.label} — PONTUAÇÃO TOTAL</div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: sc.color }}>{sc.severity}</div>
                      {sc.riskAlert && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px', padding: '6px 10px', background: '#FEE2E2', borderRadius: '6px', fontSize: '11px', color: 'var(--danger)', fontWeight: 600 }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          Item de risco identificado — avaliar ideação na próxima sessão
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
              {viewForm.fields.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--gr4)', padding: '24px' }}>Sem campos definidos para este formulário.</div>
              ) : viewForm.fields.map(field => {
                const val = viewForm.response[field.id]
                return (
                  <div key={field.id}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', letterSpacing: '0.4px', marginBottom: '5px' }}>{field.label.toUpperCase()}</div>
                    <div style={{ fontSize: '13px', color: val !== undefined ? 'var(--d)' : 'var(--gr4)', background: 'var(--ow)', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '8px 12px', minHeight: '36px', wordBreak: 'break-word' }}>
                      {val !== undefined ? String(val) : <em>Não respondido</em>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
