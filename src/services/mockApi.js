/**
 * mockApi.js — Camada de API mockada que espelha os endpoints reais do backend.
 * Quando o backend estiver disponível, basta trocar as funções aqui para usar fetch() real.
 *
 * Demo user: demo@psicoai.com.br / demo123
 */

const delay = (ms = 400) => new Promise(r => setTimeout(r, ms + Math.random() * 200))

// ── Clinical data cleanup — chamado no logout e em session-expired ────────────
// Remove TODOS os dados clínicos do localStorage para não vazar entre usuários.
// Os dados de canvas e anotações são dados de saúde — não devem persistir após logout.
export function psicoaiClearClinicalStorage() {
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith('psicoai_')) keysToRemove.push(k)
  }
  keysToRemove.forEach(k => localStorage.removeItem(k))
}

// ── Auth ──────────────────────────────────────────────────────────────────────

const DEMO_USER = {
  id: 'usr-demo-001',
  email: 'demo@psicoai.com.br',
  name: 'Dra. Camila Rezende',
  crp: '06/89234',
  specialty: 'Psicologia Clínica',
  phone: '(11) 98765-0001',
  clinicName: 'Consultório Dra. Camila',
  address: 'Av. Paulista, 1000, Sala 42 — São Paulo, SP',
  bio: 'Psicóloga clínica com foco em trauma e transtornos de ansiedade. Supervisora de estágio. Abordagem integrativa com ênfase em TCC e EMDR.',
  plan: 'clinico',
  analysesRemaining: 14,
  analysesUsedThisMonth: 6,
  subscriptionStatus: 'active',
  trialDaysRemaining: null,
  preferences: {
    defaultApproach: 'TCC',
    defaultSessionDuration: 50,
    defaultSessionValue: 200,
    workingHours: { start: 8, end: 18 },
    notifyOnAlert: true,
    notifyByEmail: true,
    notifyByWhatsApp: false,
    theme: 'light',
  },
}

export const auth = {
  async login({ email, password }) {
    await delay(700)
    const isDemo = email === 'demo@psicoai.com.br' && password === 'demo123'
    const isReal = email && password && password.length >= 6
    if (!isDemo && !isReal) {
      throw new Error('E-mail ou senha incorretos.')
    }
    const token = 'mock-jwt-token-' + Date.now()
    localStorage.setItem('psicoai_token', token)
    localStorage.setItem('psicoai_user', JSON.stringify(DEMO_USER))
    return { accessToken: token, user: DEMO_USER }
  },

  logout() {
    // Limpa auth
    localStorage.removeItem('psicoai_token')
    localStorage.removeItem('psicoai_user')
    // Limpa TODOS os dados clínicos — nunca deixar dado de paciente no browser após logout
    psicoaiClearClinicalStorage()
  },

  getStoredUser() {
    try {
      const raw = localStorage.getItem('psicoai_user')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },

  isAuthenticated() {
    return !!localStorage.getItem('psicoai_token')
  },
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const FORM_TEMPLATES = [
  { id: 'tpl-001', title: 'Anamnese inicial', category: 'Avaliação', fields: 12, description: 'Histórico completo do paciente — dados pessoais, queixa, histórico familiar e clínico.' },
  { id: 'tpl-002', title: 'TCLE — Consentimento Informado', category: 'Legal', fields: 5, description: 'Termo de consentimento livre e esclarecido para início do atendimento.' },
  { id: 'tpl-003', title: 'BDI-II — Inventário Beck de Depressão', category: 'Escala validada', fields: 21, description: 'Escala de autorrelato com 21 itens para avaliação da intensidade depressiva.' },
  { id: 'tpl-004', title: 'BAI — Inventário Beck de Ansiedade', category: 'Escala validada', fields: 21, description: 'Avaliação de sintomas de ansiedade nas últimas duas semanas.' },
  { id: 'tpl-005', title: 'PHQ-9 — Triagem de Depressão', category: 'Escala validada', fields: 9, description: 'Instrumento rápido de triagem para episódio depressivo maior.' },
  { id: 'tpl-006', title: 'GAD-7 — Ansiedade Generalizada', category: 'Escala validada', fields: 7, description: 'Escala de triagem para Transtorno de Ansiedade Generalizada.' },
  { id: 'tpl-007', title: 'SRS — Session Rating Scale', category: 'Aliança terapêutica', fields: 4, description: 'Avaliação da aliança terapêutica ao final de cada sessão (4 itens visuais).' },
  { id: 'tpl-008', title: 'PCL-5 — PTSD Checklist', category: 'Escala validada', fields: 20, description: 'Avaliação de sintomas de TEPT baseada no DSM-5.' },
]

let REMINDER_CONFIGS = [
  { id: 'rem-001', title: 'Confirmação de consulta — 24h antes', hoursBeforeSession: 24, channels: ['whatsapp', 'email'], enabled: true, template: 'Olá, {{nome}}! 👋 Lembrando da sua sessão amanhã, {{dia}} de {{mes}}, às {{hora}}. Para confirmar, responda SIM. — {{psicologo}}' },
  { id: 'rem-002', title: 'Lembrete no dia da sessão — 2h antes', hoursBeforeSession: 2, channels: ['whatsapp'], enabled: true, template: 'Oi, {{nome}}! Sua sessão é hoje às {{hora}}. Te espero! 🌱 — {{psicologo}}' },
  { id: 'rem-003', title: 'Cobrança — 3 dias após sessão sem pagamento', hoursBeforeSession: -72, channels: ['whatsapp'], enabled: false, template: 'Olá, {{nome}}! 😊 Passando para lembrar do pagamento da sessão do dia {{dia}}. — {{psicologo}}' },
  { id: 'rem-004', title: 'Pesquisa de satisfação — 1 dia após sessão', hoursBeforeSession: -24, channels: ['whatsapp'], enabled: false, template: 'Oi, {{nome}}! Tudo bem? Deixo um link rápido para avaliar nossa sessão 😊 {{link}} — {{psicologo}}' },
]

let TELE_SESSIONS = [
  { id: 'ts-001', patientId: 'p-001', patientName: 'Lucas Martins', patientInitials: 'LM', platform: 'whereby', roomLink: 'https://whereby.com/psicoai-lucas', status: 'live', scheduledAt: new Date(new Date().setHours(9,0,0,0)).toISOString(), duration: 50, confirmationStatus: 'confirmed', notes: '' },
  { id: 'ts-002', patientId: 'p-003', patientName: 'Rafael Fonseca', patientInitials: 'RF', platform: 'meet', roomLink: 'https://meet.google.com/rf-s23', status: 'scheduled', scheduledAt: new Date(new Date(Date.now()+86400000).setHours(14,0,0,0)).toISOString(), duration: 50, confirmationStatus: 'pending', notes: '' },
  { id: 'ts-003', patientId: 'p-005', patientName: 'João Oliveira', patientInitials: 'JO', platform: 'whereby', roomLink: 'https://whereby.com/psicoai-joao', status: 'scheduled', scheduledAt: new Date(new Date(Date.now()+86400000).setHours(11,0,0,0)).toISOString(), duration: 50, confirmationStatus: 'pending', notes: '' },
  { id: 'ts-004', patientId: 'p-002', patientName: 'Carla Silva', patientInitials: 'CS', platform: 'meet', roomLink: 'https://meet.google.com/cs-s5', status: 'done', scheduledAt: new Date(new Date(Date.now()-691200000).setHours(10,30,0,0)).toISOString(), duration: 48, confirmationStatus: 'confirmed', notes: 'Sessão encerrada normalmente.' },
  { id: 'ts-005', patientId: 'p-006', patientName: 'Beatriz Almeida', patientInitials: 'BA', platform: 'whereby', roomLink: 'https://whereby.com/psicoai-beatriz', status: 'done', scheduledAt: new Date(new Date(Date.now()-864000000).setHours(15,0,0,0)).toISOString(), duration: 45, confirmationStatus: 'confirmed', notes: '' },
  { id: 'ts-006', patientId: 'p-004', patientName: 'Marina Costa', patientInitials: 'MC', platform: 'meet', roomLink: 'https://meet.google.com/mc-s8', status: 'done', scheduledAt: new Date(new Date(Date.now()-1036800000).setHours(11,0,0,0)).toISOString(), duration: 38, confirmationStatus: 'confirmed', notes: '' },
]

const PATIENTS = [
  {
    id: 'p-001', initials: 'LM', name: 'Lucas Martins', age: 34, gender: 'Masculino',
    email: 'lucas.martins@email.com', phone: '(11) 98765-4321',
    birthDate: '1991-08-14',
    complaint: 'Ansiedade crônica, pesadelos recorrentes e dificuldade em manter vínculos afetivos estáveis. Relata episódios de dissociação leve após conflitos interpessoais.',
    history: 'Trauma infantil (abuso emocional paterno). Dois relacionamentos longos encerrados por dificuldade comunicativa. Sem histórico de internações. Uso pontual de ansiolíticos (2019-2020).',
    medication: 'Nenhuma no momento. Avaliação psiquiátrica em curso.',
    approach: 'TCC', frequency: 'Semanal', payment: 'Particular', sessionValue: 200,
    cid: 'F43.1', status: 'red', statusLabel: 'Alerta IA',
    avatarBg: 'var(--g50)', avatarColor: 'var(--g600)',
    sessions: 14, months: 8, createdAt: '2025-09-16T10:00:00Z',
  },
  {
    id: 'p-002', initials: 'CS', name: 'Carla Silva', age: 28, gender: 'Feminino',
    email: 'carla.silva@email.com', phone: '(11) 91234-5678',
    birthDate: '1997-03-22',
    complaint: 'Fobia social com evitação de ambientes públicos e dificuldade em falar em grupo.',
    history: 'Bullying na adolescência. Nenhum tratamento anterior. Funcionamento preservado no trabalho remoto.',
    medication: 'Nenhuma.',
    approach: 'Psicanálise', frequency: 'Quinzenal', payment: 'Convênio', sessionValue: 150,
    cid: 'F40.1', status: 'green', statusLabel: 'Evolução positiva',
    avatarBg: 'var(--g100)', avatarColor: 'var(--g700)',
    sessions: 6, months: 3, createdAt: '2026-02-10T09:00:00Z',
  },
  {
    id: 'p-003', initials: 'RF', name: 'Rafael Fonseca', age: 41, gender: 'Masculino',
    email: 'rafael.fonseca@email.com', phone: '(21) 99876-5432',
    birthDate: '1984-11-05',
    complaint: 'Depressão recorrente e ruminação. Episódios há 6 meses sem progressão terapêutica clara.',
    history: 'Episódio depressivo maior em 2018 (hospitalização breve). Uso de fluoxetina 20mg.',
    medication: 'Fluoxetina 20mg (prescrito por psiquiatra Dr. Almeida).',
    approach: 'TCC', frequency: 'Semanal', payment: 'Particular', sessionValue: 200,
    cid: 'F33.1', status: 'yellow', statusLabel: 'Monitorar',
    avatarBg: 'var(--warn-l)', avatarColor: 'var(--warn)',
    sessions: 22, months: 12, createdAt: '2025-05-20T14:00:00Z',
  },
  {
    id: 'p-004', initials: 'MC', name: 'Marina Costa', age: 25, gender: 'Feminino',
    email: 'marina.costa@email.com', phone: '(31) 98765-1234',
    birthDate: '2000-07-18',
    complaint: 'Transtorno de ansiedade generalizada. Preocupação excessiva com desempenho acadêmico e carreira.',
    history: 'Sem histórico de tratamento. Primeira experiência terapêutica.',
    medication: 'Nenhuma.',
    approach: 'TCC', frequency: 'Semanal', payment: 'Particular', sessionValue: 180,
    cid: 'F41.1', status: 'green', statusLabel: 'Estável',
    avatarBg: 'var(--g50)', avatarColor: 'var(--g500)',
    sessions: 9, months: 4, createdAt: '2026-01-15T11:00:00Z',
  },
  {
    id: 'p-005', initials: 'JO', name: 'João Oliveira', age: 29, gender: 'Masculino',
    email: 'joao.oliveira@email.com', phone: '(85) 97654-3210',
    birthDate: '1996-04-30',
    complaint: 'Dificuldade de regulação emocional em situações de estresse profissional.',
    history: 'Sem tratamentos anteriores. Histórico familiar de transtorno bipolar (pai).',
    medication: 'Nenhuma.',
    approach: 'Humanista', frequency: 'Quinzenal', payment: 'Particular', sessionValue: 160,
    cid: null, status: 'gray', statusLabel: 'Início',
    avatarBg: 'var(--gr1)', avatarColor: 'var(--gr5)',
    sessions: 3, months: 1, createdAt: '2026-04-10T15:00:00Z',
  },
  {
    id: 'p-006', initials: 'BA', name: 'Beatriz Almeida', age: 32, gender: 'Feminino',
    email: 'beatriz.almeida@email.com', phone: '(41) 96543-2109',
    birthDate: '1993-12-08',
    complaint: 'Luto complicado após perda de filho. Isolamento social progressivo.',
    history: 'Perda perinatal em 2023. Sem tratamento após o evento. Suporte familiar limitado.',
    medication: 'Nenhuma (recusou indicação psiquiátrica).',
    approach: 'Integrativa', frequency: 'Semanal', payment: 'Particular', sessionValue: 200,
    cid: 'F43.2', status: 'red', statusLabel: 'Alerta',
    avatarBg: 'var(--danger-l)', avatarColor: 'var(--danger)',
    sessions: 5, months: 2, createdAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'p-007', initials: 'PA', name: 'Pedro Alves', age: 38, gender: 'Masculino',
    email: 'pedro.alves@email.com', phone: '(51) 95432-1098',
    birthDate: '1987-06-22',
    complaint: 'Síndrome de burnout. Esgotamento emocional e despersonalização.',
    history: 'Executivo de TI. Segundo episódio de burnout (primeiro em 2021). Hipertensão leve.',
    medication: 'Losartana 25mg (cardiologista).',
    approach: 'Cognitivo-Comportamental', frequency: 'Semanal', payment: 'Plano Empresarial', sessionValue: 0,
    cid: 'Z73.0', status: 'yellow', statusLabel: 'Monitorar',
    avatarBg: 'var(--g100)', avatarColor: 'var(--g600)',
    sessions: 18, months: 7, createdAt: '2025-10-01T09:00:00Z',
  },
  {
    id: 'p-008', initials: 'SA', name: 'Sofia Andrade', age: 22, gender: 'Feminino',
    email: 'sofia.andrade@email.com', phone: '(48) 94321-0987',
    birthDate: '2003-09-15',
    complaint: 'Transtorno alimentar — histórico de restrição alimentar. Em acompanhamento multidisciplinar.',
    history: 'Anorexia nervosa diagnosticada aos 18. Tratamento hospitalar em 2021. Manutenção há 3 anos.',
    medication: 'Sertralina 50mg (prescrito por psiquiatra).',
    approach: 'TCC + DBT', frequency: 'Semanal', payment: 'Convênio', sessionValue: 0,
    cid: 'F50.0', status: 'yellow', statusLabel: 'Acompanhamento',
    avatarBg: 'var(--warn-l)', avatarColor: 'var(--warn)',
    sessions: 11, months: 5, createdAt: '2025-12-05T13:00:00Z',
  },
]

const SESSIONS_BY_PATIENT = {
  'p-001': [
    { id: 's-014', patientId: 'p-001', patientName: 'Lucas Martins', num: 'S14', type: 'text', status: 'open', durationSeconds: null, finishedAt: null, createdAt: new Date().toISOString(), hasAnalysis: false, statusLabel: 'Aberta', evolution: null, summary: 'Sessão em andamento.' },
    { id: 's-013', patientId: 'p-001', patientName: 'Lucas Martins', num: 'S13', type: 'text', status: 'finished', durationSeconds: 3120, finishedAt: '2026-05-17T16:30:00Z', createdAt: '2026-05-17T15:30:00Z', hasAnalysis: true, statusLabel: 'Alerta IA', evolution: 'red', summary: 'Evitação ao tema familiar detectada 4x. Flashback verbal na marca 23min. Tema familiar evitado pela 3ª vez consecutiva.', textContent: 'Paciente chegou 10min atrasado, visivelmente agitado. Mencionou "semana difícil" sem detalhar. Ao perguntar sobre o pai, desviou o assunto imediatamente — mudou de postura, cruzou os braços, começou a falar sobre o trabalho. Fiz três tentativas de retomar o tema familiar e nas três ele evitou.\n\nNa marca de ~23min, ao mencionar o natal de 2019, houve uma pausa longa (~8s) e ele disse "não sei por que me lembro disso agora" — possível intrusão de memória traumática (flashback verbal). Voz ficou mais baixa por cerca de 5min depois.\n\nRetomou o ritmo ao falar sobre a namorada — tema mais seguro para ele. Finalizamos com exercício de respiração. Paciente saiu aparentemente mais calmo mas sem elaborar o conteúdo central.' },
    { id: 's-012', patientId: 'p-001', patientName: 'Lucas Martins', num: 'S12', type: 'text', status: 'finished', durationSeconds: 3000, finishedAt: '2026-05-03T16:30:00Z', createdAt: '2026-05-03T15:30:00Z', hasAnalysis: true, statusLabel: 'Neutro', evolution: 'yellow', summary: 'Processamento de memória traumática. Paciente mais receptivo. Sem crises durante a sessão.', textContent: 'Sessão mais fluida que as anteriores. Lucas conseguiu nomear o episódio de conflito com o pai pela segunda vez — sinal importante de que a resistência está diminuindo levemente.\n\nTrabalhamos com a técnica de janela de tolerância. Ele identificou sozinho quando começou a sair da zona de conforto e pediu para pausar — ótimo sinal de auto-regulação emergindo.\n\nAinda há evitação, mas com menor intensidade. Não houve manifestações físicas de ativação (sem alteração na voz, sem pausas longas). Tarefa de casa: escrever 3 coisas positivas da relação com o pai antes das S13.' },
    { id: 's-011', patientId: 'p-001', patientName: 'Lucas Martins', num: 'S11', type: 'text', status: 'finished', durationSeconds: 2880, finishedAt: '2026-04-19T16:30:00Z', createdAt: '2026-04-19T15:30:00Z', hasAnalysis: false, statusLabel: 'Neutro', evolution: 'yellow', summary: 'Estabilização após crise. Técnicas de regulação emocional trabalhadas.', textContent: 'Sessão de contenção após a crise relatada entre S10 e S11 (contato por WhatsApp na semana passada — choro intenso, pensamentos intrusivos sobre o acidente).\n\nFoco em estabilização: respiração diafragmática 4-7-8, grounding com os 5 sentidos. Lucas respondeu bem — conseguiu se regular em ~15min de prática.\n\nNão aprofundamos o trauma hoje. Apenas validei o que ele sentiu e reforçamos a janela de tolerância como conceito. Ele disse que "nunca teve recursos para isso antes".\n\nPlano para S12: retomar o trabalho narrativo com cuidado. Avaliar se encaminhamento psiquiátrico é necessário — sono continua fragmentado (relatou 3-4h por noite nas últimas 2 semanas).' },
    { id: 's-010', patientId: 'p-001', patientName: 'Lucas Martins', num: 'S10', type: 'text', status: 'finished', durationSeconds: 3300, finishedAt: '2026-04-05T16:30:00Z', createdAt: '2026-04-05T15:30:00Z', hasAnalysis: true, statusLabel: 'Regressão', evolution: 'red', summary: 'Evitação marcante. Humor deprimido. Sem abertura para aprofundamento. Resistência ao aprofundamento aumentada.', textContent: 'Sessão muito difícil. Paciente chegou monossilábico, olhar baixo. Disse que "não tem muito o que falar hoje". Tentei diferentes abordagens — tema do trabalho, da namorada, do corpo — sem abertura significativa.\n\nHumor visivelmente deprimido. Sem choro, mas sem afeto também — flat. Perguntei diretamente sobre ideação suicida: negou, mas com pouca energia na resposta — vou monitorar.\n\nÚnica abertura foi quando falou sobre o cachorro que morreu quando tinha 12 anos — "meu pai disse que eu era fraco por chorar". Tema paterno surgiu lateralmente mas não conseguimos aprofundar.\n\nEncerrei a sessão mais cedo (50min) a pedido dele. Combinei contato por mensagem em 3 dias para verificar o estado.' },
    { id: 's-009', patientId: 'p-001', patientName: 'Lucas Martins', num: 'S9', type: 'canvas', status: 'finished', durationSeconds: 2700, finishedAt: '2026-03-22T16:30:00Z', createdAt: '2026-03-22T15:45:00Z', hasAnalysis: false, statusLabel: 'Neutro', evolution: 'yellow', summary: 'Mapeamento relacional feito no canvas — rede de vínculos do paciente.', canvasTextContent: 'Mapa de vínculos: Pai (conflito central), Mãe (suporte, mas evita confronto com pai), Namorada Ana (vínculo seguro, ancoragem), Amigo Felipe (afastamento progressivo desde o acidente). Padrão: Lucas aproxima-se de figuras femininas e evita confronto com figuras masculinas de autoridade.', canvasDataJson: JSON.stringify({ v: 2, savedAt: Date.now(), patientId: 'p-001', sessionId: 's-009', elementCount: 8, elements: [{ type: 'ellipse', version: 1, versionNonce: 1, x: 340, y: 220, width: 120, height: 60, angle: 0, strokeColor: '#4A7C59', backgroundColor: '#d4edda', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 1, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-center' }, { type: 'text', version: 1, versionNonce: 2, x: 355, y: 240, width: 90, height: 25, angle: 0, strokeColor: '#1C1C1C', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 2, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-center-txt', text: 'LUCAS', fontSize: 18, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', containerId: null, originalText: 'LUCAS', lineHeight: 1.25, baseline: 18 }, { type: 'rectangle', version: 1, versionNonce: 3, x: 100, y: 100, width: 140, height: 50, angle: 0, strokeColor: '#c0392b', backgroundColor: '#fadbd8', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 3, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-pai' }, { type: 'text', version: 1, versionNonce: 4, x: 115, y: 118, width: 110, height: 20, angle: 0, strokeColor: '#c0392b', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 4, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-pai-txt', text: 'Pai — conflito', fontSize: 14, fontFamily: 1, textAlign: 'left', verticalAlign: 'top', containerId: null, originalText: 'Pai — conflito', lineHeight: 1.25, baseline: 14 }, { type: 'rectangle', version: 1, versionNonce: 5, x: 560, y: 100, width: 150, height: 50, angle: 0, strokeColor: '#4A7C59', backgroundColor: '#d4edda', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 5, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-ana' }, { type: 'text', version: 1, versionNonce: 6, x: 575, y: 118, width: 120, height: 20, angle: 0, strokeColor: '#4A7C59', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 6, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-ana-txt', text: 'Ana — vínculo seguro', fontSize: 14, fontFamily: 1, textAlign: 'left', verticalAlign: 'top', containerId: null, originalText: 'Ana — vínculo seguro', lineHeight: 1.25, baseline: 14 }, { type: 'rectangle', version: 1, versionNonce: 7, x: 100, y: 340, width: 150, height: 50, angle: 0, strokeColor: '#8e44ad', backgroundColor: '#f5eef8', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 7, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-mae' }, { type: 'text', version: 1, versionNonce: 8, x: 115, y: 358, width: 120, height: 20, angle: 0, strokeColor: '#8e44ad', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 8, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-mae-txt', text: 'Mãe — suporte passivo', fontSize: 14, fontFamily: 1, textAlign: 'left', verticalAlign: 'top', containerId: null, originalText: 'Mãe — suporte passivo', lineHeight: 1.25, baseline: 14 }], appState: { viewBackgroundColor: '#F7F4EF' }, files: {} }) },
  ],
  'p-002': [
    { id: 's-007', patientId: 'p-002', patientName: 'Carla Silva', num: 'S7', type: 'canvas', status: 'finished', durationSeconds: 2400, finishedAt: '2026-05-20T11:30:00Z', createdAt: '2026-05-20T10:50:00Z', hasAnalysis: false, statusLabel: 'Evolução', evolution: 'green', summary: 'Mapa de situações ansiogênicas — hierarquia de exposição construída com a paciente.', canvasTextContent: 'Hierarquia de exposição (SUDs 0-100): Almoço com equipe (SUDs 30 — já consegue), Reunião presencial <10 pessoas (SUDs 45), Apresentação para equipe (SUDs 65), Evento social fora do trabalho (SUDs 75), Festa de casamento (SUDs 90). Próximos passos: Exposição nível 3 nas próximas 3 semanas.', canvasDataJson: JSON.stringify({ v: 2, savedAt: Date.now(), patientId: 'p-002', sessionId: 's-007', elementCount: 6, elements: [{ type: 'text', version: 1, versionNonce: 1, x: 60, y: 30, width: 400, height: 35, angle: 0, strokeColor: '#1C1C1C', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 1, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-title', text: 'Hierarquia de Exposição — Carla', fontSize: 22, fontFamily: 3, textAlign: 'left', verticalAlign: 'top', containerId: null, originalText: 'Hierarquia de Exposição — Carla', lineHeight: 1.25, baseline: 22 }, { type: 'rectangle', version: 1, versionNonce: 2, x: 60, y: 100, width: 500, height: 45, angle: 0, strokeColor: '#4A7C59', backgroundColor: '#d4edda', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 2, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-l1' }, { type: 'text', version: 1, versionNonce: 3, x: 75, y: 115, width: 470, height: 20, angle: 0, strokeColor: '#1C1C1C', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 3, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-l1-txt', text: '✓ SUDs 30 — Almoço com equipe (já consegue!)', fontSize: 14, fontFamily: 1, textAlign: 'left', verticalAlign: 'top', containerId: null, originalText: '✓ SUDs 30 — Almoço com equipe (já consegue!)', lineHeight: 1.25, baseline: 14 }, { type: 'rectangle', version: 1, versionNonce: 4, x: 60, y: 165, width: 500, height: 45, angle: 0, strokeColor: '#f39c12', backgroundColor: '#fef9e7', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 4, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-l2' }, { type: 'text', version: 1, versionNonce: 5, x: 75, y: 180, width: 470, height: 20, angle: 0, strokeColor: '#1C1C1C', backgroundColor: 'transparent', fillStyle: 'solid', strokeWidth: 1, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 5, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-l2-txt', text: '→ SUDs 45 — Reunião presencial <10 pessoas (próximo passo)', fontSize: 14, fontFamily: 1, textAlign: 'left', verticalAlign: 'top', containerId: null, originalText: '→ SUDs 45 — Reunião presencial <10 pessoas (próximo passo)', lineHeight: 1.25, baseline: 14 }, { type: 'rectangle', version: 1, versionNonce: 6, x: 60, y: 230, width: 500, height: 45, angle: 0, strokeColor: '#c0392b', backgroundColor: '#fadbd8', fillStyle: 'solid', strokeWidth: 2, strokeStyle: 'solid', roughness: 0, opacity: 100, groupIds: [], frameId: null, roundness: null, seed: 6, isDeleted: false, boundElements: null, updated: 1, link: null, locked: false, id: 'el-l3' }], appState: { viewBackgroundColor: '#F7F4EF' }, files: {} }) },
    { id: 's-006', patientId: 'p-002', patientName: 'Carla Silva', num: 'S6', type: 'text', status: 'finished', durationSeconds: 3000, finishedAt: '2026-05-18T11:30:00Z', createdAt: '2026-05-18T10:30:00Z', hasAnalysis: false, statusLabel: 'Evolução', evolution: 'green', summary: 'Paciente relatou melhora significativa em situações sociais no trabalho.', textContent: 'Carla chegou sorrindo — raridade nas primeiras sessões. Contou que participou de um almoço de equipe na sexta-feira e conseguiu ficar por 1h sem precisar sair. Para ela, isso é enorme.\n\nRelatou que usou a técnica de respiração antes de entrar na sala de reunião. Disse que sentiu o coração acelerar mas "ficou de boa". Validei muito essa conquista — é a primeira vez que ela nomeou um recurso interno que funcionou.\n\nAinda há ansiedade antecipatória intensa (começa a se preocupar dias antes de qualquer evento social), mas a resposta no momento do evento está melhorando. Plano: continuar exposição gradual, próximo passo seria um evento social fora do trabalho.' },
    { id: 's-005', patientId: 'p-002', patientName: 'Carla Silva', num: 'S5', type: 'text', status: 'finished', durationSeconds: 3000, finishedAt: '2026-05-04T11:30:00Z', createdAt: '2026-05-04T10:30:00Z', hasAnalysis: true, statusLabel: 'Evolução', evolution: 'green', summary: 'Exposição gradual bem tolerada. Primeira vez em reunião presencial sem crise.', textContent: 'Primeira grande vitória de Carla: ficou em reunião presencial com toda a equipe (11 pessoas) por 45min. Ela tinha tentado antes e saído em pânico depois de 10min.\n\nRelatou que sentiu o coração disparar no início, mas "respirei e fiquei". Nenhuma crise, nenhuma necessidade de sair. Terminou a reunião com os colegas.\n\nProcessamos juntos o que aconteceu: ela esperava o pior e o pior não veio. Trabalho cognitivo sobre catastrofização — "o que você previa x o que aconteceu de verdade".\n\nEla perguntou espontaneamente: "será que eu vou ficar boa?" — primeira vez que ela demonstra esperança real no processo. Progresso significativo em 5 sessões.' },
  ],
}

const ANALYSES = {
  'p-001': [
    {
      id: 'a-001', sessionId: 's-013', patientId: 'p-001', patientName: 'Lucas Martins',
      evolution: 'negative',
      summary: 'A sessão revelou padrão consistente de evitação ao tema familiar, com terceiro registro consecutivo de comportamento evasivo. O paciente demonstrou ativação emocional intensa ao mencionar o pai, incluindo lapsus verbal e alteração no ritmo da fala. O vínculo terapêutico permanece sólido, mas a resistência ao aprofundamento do trauma aumentou.',
      hypotheses: JSON.stringify([
        { label: 'Estresse pós-traumático (TEPT)', code: 'F43.1', system: 'CID-11', probability: 72, sessionCount: 3, rationale: 'Comportamento evasivo recorrente, flashback verbal e ativação emocional intensa ao mencionar o tema apareceram nas últimas 3 sessões' },
        { label: 'Transtorno de ansiedade — ruminação focalizada', code: 'F41.1', system: 'CID-11', probability: 48, sessionCount: 2, rationale: 'Preocupações circulam em torno do mesmo episódio; não há generalização para outros temas' },
      ]),
      patterns: JSON.stringify([
        { type: 'avoidance', description: 'Desvio de assunto ao mencionar relação paterna — 4 ocorrências nesta sessão', severity: 'high' },
        { type: 'rumination', description: 'Retorno involuntário ao mesmo episódio de conflito (2019) por 3 sessões', severity: 'medium' },
        { type: 'hypervigilance', description: 'Tom defensivo ao abordar relacionamentos afetivos', severity: 'low' },
      ]),
      riskAlerts: JSON.stringify([
        { level: 'high', description: 'Padrão de evitação progressiva — risco de abandono terapêutico se não manejado' },
        { level: 'medium', description: 'Isolamento social auto-relatado aumentou nas últimas 3 semanas' },
      ]),
      nextSessionSuggestions: JSON.stringify([
        'Introduzir técnica de exposição narrativa ao tema paterno com ritmo controlado pelo paciente',
        'Explorar recursos de regulação emocional (respiração, grounding) antes de avançar no trauma',
        'Avaliar se avaliação psiquiátrica está progredindo — possível necessidade de suporte farmacológico',
      ]),
      cost: 4.90, usedIncluded: false, inputTokens: 1240, outputTokens: 680,
      createdAt: '2026-05-17T16:32:00Z',
    },
    {
      id: 'a-002', sessionId: 's-012', patientId: 'p-001', patientName: 'Lucas Martins',
      evolution: 'neutral',
      summary: 'Sessão de processamento com abertura moderada. O paciente conseguiu nomear a memória traumática pela segunda vez, sinal positivo de progresso. Resistência presente mas manejável.',
      hypotheses: JSON.stringify([
        { label: 'Estresse pós-traumático (TEPT)', code: 'F43.1', system: 'CID-11', probability: 65, sessionCount: 2, rationale: 'Critérios mantidos; leve melhora na resposta de evitação em relação à sessão anterior' },
      ]),
      patterns: JSON.stringify([
        { type: 'avoidance', description: 'Evitação presente mas com menor intensidade vs sessão anterior', severity: 'medium' },
      ]),
      riskAlerts: JSON.stringify([]),
      nextSessionSuggestions: JSON.stringify([
        'Continuar exposição narrativa gradual',
        'Reforçar ganhos da sessão com exercício de mindfulness como tarefa de casa',
      ]),
      cost: 4.90, usedIncluded: true, inputTokens: 980, outputTokens: 520,
      createdAt: '2026-05-03T16:35:00Z',
    },
  ],
  'p-007': [
    {
      id: 'a-010', sessionId: 's-pa-018', patientId: 'p-007', patientName: 'Pedro Alves',
      evolution: 'neutral',
      summary: 'Paciente apresenta quadro consistente com segundo episódio de burnout. Despersonalização marcante — relata se sentir "robô" no trabalho. Há sinais de melhora na consciência dos próprios limites, mas ainda sem mudança comportamental concreta.',
      hypotheses: JSON.stringify([
        { label: 'Síndrome de Burnout (esgotamento ocupacional)', code: 'QD85', system: 'CID-11', probability: 84, sessionCount: 2, rationale: 'Segundo episódio identificado. Exaustão emocional, despersonalização e redução da realização profissional aparecem consistentemente' },
        { label: 'Episódio depressivo leve-moderado', code: 'F32.1', system: 'CID-11', probability: 51, sessionCount: 2, rationale: 'Humor rebaixado persistente nos últimos 3 meses, mas paciente ainda funcional' },
        { label: 'Transtorno de ansiedade — preocupação excessiva', code: 'F41.1', system: 'CID-11', probability: 38, sessionCount: 1, rationale: 'Controle e performance como temas recorrentes — acompanhar se persiste nas próximas sessões' },
      ]),
      patterns: JSON.stringify([
        { type: 'rumination', description: 'Pensamentos repetitivos sobre falhas no trabalho — relata "loop mental" antes de dormir há 6 semanas', severity: 'high' },
        { type: 'isolation', description: 'Cancelou eventos sociais 4 vezes nas últimas 3 semanas — comportamento novo para ele', severity: 'medium' },
        { type: 'catastrophizing', description: 'Antecipa demissão em cenários onde não há evidência objetiva de risco', severity: 'medium' },
      ]),
      riskAlerts: JSON.stringify([
        { level: 'medium', description: 'Sono fragmentado há 6 semanas (3-4h por noite) — risco de agravamento do quadro' },
        { level: 'low', description: 'Hipertensão leve pode ser agravada pelo estresse crônico — manter contato com cardiologista' },
      ]),
      nextSessionSuggestions: JSON.stringify([
        'Mapear concretamente o que está gerando mais sobrecarga — volume de trabalho vs conflito de valores',
        'Introduzir técnica de delimitação de horários (boundary setting) com tarefa de casa prática',
        'Avaliar se afastamento temporário é viável — discutir com o paciente sem induzi-lo',
        'Encaminhar para avaliação psiquiátrica se sono não melhorar nas próximas 2 semanas',
      ]),
      cost: 4.90, usedIncluded: true, inputTokens: 1100, outputTokens: 590,
      createdAt: '2026-05-14T16:20:00Z',
    },
  ],
  'p-002': [
    {
      id: 'a-003', sessionId: 's-005', patientId: 'p-002', patientName: 'Carla Silva',
      evolution: 'positive',
      summary: 'Sessão marcada por avanço significativo. Pela primeira vez, a paciente participou de uma reunião presencial sem apresentar sintomas de pânico. O relato foi entusiasmado e com senso de autoeficácia elevado.',
      hypotheses: JSON.stringify([
        { label: 'Fobia social / Transtorno de ansiedade social', code: 'F40.1', system: 'CID-11', probability: 78, sessionCount: 3, rationale: 'Padrão de ansiedade antecipatória e evitação em redução — resposta positiva às intervenções registradas' },
      ]),
      patterns: JSON.stringify([
        { type: 'avoidance', description: 'Evitação em redução progressiva — melhor resultado desde início do tratamento', severity: 'low' },
      ]),
      riskAlerts: JSON.stringify([]),
      nextSessionSuggestions: JSON.stringify([
        'Planejar próxima situação de exposição (reunião com clientes externos)',
        'Consolidar ganhos com psicoeducação sobre manutenção dos avanços',
      ]),
      cost: 4.90, usedIncluded: false, inputTokens: 760, outputTokens: 410,
      createdAt: '2026-05-04T11:38:00Z',
    },
  ],
}

const AGENDA_EVENTS = (() => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const toISO = (d, h, m = 0) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString()
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

  return [
    { id: 'ag-001', patientId: 'p-001', patientName: 'Lucas Martins', patientInitials: 'LM', patientAvatarBg: 'var(--g50)', patientAvatarColor: 'var(--g600)', title: 'Sessão 14 — Lucas Martins', type: 'session', status: 'scheduled', startAt: toISO(today, 9), endAt: toISO(today, 10), meetLink: null },
    { id: 'ag-002', patientId: 'p-002', patientName: 'Carla Silva', patientInitials: 'CS', patientAvatarBg: 'var(--g100)', patientAvatarColor: 'var(--g700)', title: 'Sessão 7 — Carla Silva', type: 'session', status: 'scheduled', startAt: toISO(today, 10, 30), endAt: toISO(today, 11, 30), meetLink: 'https://meet.google.com/abc-defg-hij' },
    { id: 'ag-003', patientId: 'p-003', patientName: 'Rafael Fonseca', patientInitials: 'RF', patientAvatarBg: 'var(--warn-l)', patientAvatarColor: 'var(--warn)', title: 'Sessão 23 — Rafael Fonseca', type: 'session', status: 'scheduled', startAt: toISO(today, 14), endAt: toISO(today, 15), meetLink: null },
    { id: 'ag-004', patientId: 'p-004', patientName: 'Marina Costa', patientInitials: 'MC', patientAvatarBg: 'var(--g50)', patientAvatarColor: 'var(--g500)', title: 'Sessão 10 — Marina Costa', type: 'session', status: 'scheduled', startAt: toISO(addDays(today, 1), 11), endAt: toISO(addDays(today, 1), 12), meetLink: null },
    { id: 'ag-005', patientId: null, patientName: null, patientInitials: null, patientAvatarBg: null, patientAvatarColor: null, title: 'Supervisão clínica', type: 'supervision', status: 'scheduled', startAt: toISO(addDays(today, 2), 8), endAt: toISO(addDays(today, 2), 9, 30), meetLink: 'https://meet.google.com/sup-001' },
    { id: 'ag-006', patientId: 'p-007', patientName: 'Pedro Alves', patientInitials: 'PA', patientAvatarBg: 'var(--g100)', patientAvatarColor: 'var(--g600)', title: 'Sessão 19 — Pedro Alves', type: 'session', status: 'scheduled', startAt: toISO(addDays(today, 2), 15), endAt: toISO(addDays(today, 2), 16), meetLink: null },
    { id: 'ag-007', patientId: 'p-006', patientName: 'Beatriz Almeida', patientInitials: 'BA', patientAvatarBg: 'var(--danger-l)', patientAvatarColor: 'var(--danger)', title: 'Sessão 6 — Beatriz Almeida', type: 'session', status: 'scheduled', startAt: toISO(addDays(today, 3), 10), endAt: toISO(addDays(today, 3), 11), meetLink: null },
    { id: 'ag-008', patientId: 'p-005', patientName: 'João Oliveira', patientInitials: 'JO', patientAvatarBg: 'var(--gr1)', patientAvatarColor: 'var(--gr5)', title: 'Sessão 4 — João Oliveira', type: 'session', status: 'scheduled', startAt: toISO(addDays(today, 4), 9), endAt: toISO(addDays(today, 4), 10), meetLink: 'https://meet.google.com/jo-001' },
  ]
})()

const FINANCIAL_EVENTS = [
  { id: 'f-001', patientId: 'p-001', patientName: 'Lucas Martins', type: 'session_payment', description: 'Sessão 13', amount: 200, direction: 'credit', status: 'received', dueDate: '2026-05-17', paidAt: '2026-05-17T17:00:00Z', paymentMethod: 'pix', createdAt: '2026-05-17T10:00:00Z' },
  { id: 'f-002', patientId: 'p-002', patientName: 'Carla Silva', type: 'session_payment', description: 'Sessão 6', amount: 150, direction: 'credit', status: 'received', dueDate: '2026-05-18', paidAt: '2026-05-18T12:00:00Z', paymentMethod: 'pix', createdAt: '2026-05-18T09:00:00Z' },
  { id: 'f-003', patientId: 'p-003', patientName: 'Rafael Fonseca', type: 'session_payment', description: 'Sessão 22', amount: 200, direction: 'credit', status: 'received', dueDate: '2026-05-17', paidAt: '2026-05-17T11:00:00Z', paymentMethod: 'transfer', createdAt: '2026-05-17T09:00:00Z' },
  { id: 'f-004', patientId: 'p-008', patientName: 'Sofia Andrade', type: 'session_payment', description: 'Sessão 11', amount: 0, direction: 'credit', status: 'received', dueDate: '2026-05-15', paidAt: '2026-05-15T10:00:00Z', paymentMethod: 'insurance', notes: 'Convênio processado', createdAt: '2026-05-15T09:00:00Z' },
  { id: 'f-005', patientId: 'p-007', patientName: 'Pedro Alves', type: 'session_payment', description: 'Sessão 18', amount: 0, direction: 'credit', status: 'pending', dueDate: '2026-05-14', paidAt: null, paymentMethod: 'corporate', notes: 'Plano empresarial — aguardando processamento', createdAt: '2026-05-14T09:00:00Z' },
  { id: 'f-006', patientId: 'p-006', patientName: 'Beatriz Almeida', type: 'session_payment', description: 'Sessão 5', amount: 200, direction: 'credit', status: 'pending', dueDate: '2026-05-12', rescheduledDueDate: '2026-06-05', rescheduledCount: 1, rescheduleHistory: JSON.stringify([{ from: '2026-05-12', to: '2026-06-05', changedAt: '2026-05-20T10:00:00Z' }]), paidAt: null, paymentMethod: null, createdAt: '2026-05-12T09:00:00Z' },
  { id: 'f-007', patientId: 'p-004', patientName: 'Marina Costa', type: 'session_payment', description: 'Sessão 9', amount: 180, direction: 'credit', status: 'received', dueDate: '2026-05-10', paidAt: '2026-05-10T11:00:00Z', paymentMethod: 'pix', createdAt: '2026-05-10T09:00:00Z' },
  { id: 'f-008', patientId: null, patientName: null, type: 'expense', description: 'Supervisão clínica — Dr. Menezes', amount: 300, direction: 'debit', status: 'received', dueDate: '2026-05-08', paidAt: '2026-05-08T09:00:00Z', paymentMethod: 'pix', createdAt: '2026-05-08T08:00:00Z' },
]

// ── Generated Reports ─────────────────────────────────────────────────────────
let REPORTS_BY_PATIENT = {}

const REPORT_TYPE_META = {
  psychiatrist: { label: 'Encaminhamento Psiquiátrico', audience: 'Psiquiatra' },
  evolution:    { label: 'Relatório de Evolução',        audience: 'Arquivo / Supervisão' },
  summary:      { label: 'Resumo Clínico',               audience: 'Paciente' },
  full:         { label: 'Prontuário Completo',          audience: 'Arquivo / Transferência' },
}

function buildReportSections(patient, type, sections, analyses, sessions, psicologoName, crp) {
  const fmtDate = (iso) => iso
    ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'
  const today = fmtDate(new Date().toISOString())
  const latestAnalysis = analyses[0] || null
  const hypotheses = latestAnalysis ? JSON.parse(latestAnalysis.hypotheses || '[]') : []
  const patterns   = latestAnalysis ? JSON.parse(latestAnalysis.patterns   || '[]') : []
  const alerts     = latestAnalysis ? JSON.parse(latestAnalysis.riskAlerts  || '[]') : []
  const sessionCount   = sessions.length
  const finishedSessions = sessions.filter(s => s.status === 'finished')
  const lastSession = finishedSessions[0]
  const monthsStr = patient.months
    ? `${patient.months} meses (${sessionCount} sessões)`
    : `${sessionCount} sessões registradas`
  const dob = patient.birthDate
    ? new Date(patient.birthDate).toLocaleDateString('pt-BR')
    : '—'
  const PAT_LABELS = {
    avoidance: 'Evitação comportamental', rumination: 'Ruminação cognitiva',
    hypervigilance: 'Hipervigilância', catastrophizing: 'Catastrofização',
    dissociation: 'Dissociação', isolation: 'Isolamento social',
  }
  const SEV_LABELS = { high: 'Elevada', medium: 'Moderada', low: 'Baixa' }

  if (type === 'psychiatrist') {
    const topHyp = hypotheses[0]
    const referralReason = alerts.length > 0
      ? alerts.map(a => a.description).join('. ')
      : 'Avaliar indicação de suporte farmacológico complementar ao tratamento psicológico em curso.'
    return [
      { id: 'date',     label: null,                        text: `${today}` },
      { id: 'greeting', label: null,                        text: `Prezado(a) Dr./Dra.,\n\nEncaminho para avaliação e conduta psiquiátrica o(a) paciente identificado(a) abaixo, atualmente em acompanhamento psicológico sob minha supervisão.` },
      { id: 'patient',  label: 'Identificação do Paciente', text: `Nome: ${patient.name}\nData de nascimento: ${dob}${patient.age ? ` (${patient.age} anos)` : ''}\nGênero: ${patient.gender || '—'}\nContato: ${patient.phone || '—'} ${patient.email ? `| ${patient.email}` : ''}` },
      sections.clinical && { id: 'clinical', label: 'Acompanhamento Psicológico', text: `Início do tratamento: ${fmtDate(patient.createdAt)}\nDuração: ${monthsStr}\nAbordagem: ${patient.approach || '—'}\nFrequência: ${patient.frequency || '—'}` },
      sections.clinical && { id: 'queixa',   label: 'Queixa e Histórico Clínico',  text: `${patient.complaint || '—'}${patient.history ? `\n\nHistórico relevante: ${patient.history}` : ''}` },
      sections.hypotheses && topHyp && { id: 'hyp', label: 'Observações Clínicas Relevantes', text: `${topHyp.label}${topHyp.sessionCount ? ` — observado em ${topHyp.sessionCount} sessões` : ''}\n${topHyp.description || ''}\n\n${hypotheses.slice(1).map(h => `• ${h.label}${h.sessionCount ? ` (${h.sessionCount} sessões)` : ''}`).join('\n')}` },
      { id: 'med',      label: 'Medicação em Uso',           text: patient.medication || 'Nenhuma medicação em uso no momento.' },
      { id: 'referral', label: 'Motivo do Encaminhamento',  text: referralReason },
      sections.patterns && patterns.length > 0 && { id: 'patterns', label: 'Observações Clínicas Relevantes', text: patterns.map(p => `• ${PAT_LABELS[p.type] || p.type} — ${SEV_LABELS[p.severity] || p.severity}: ${p.description}`).join('\n') },
      { id: 'closing',  label: null, text: `Solicito avaliação clínica e conduta quanto à indicação ou ajuste farmacológico.\nColoco-me à disposição para esclarecimentos adicionais pelo contato informado abaixo.` },
      { id: 'sig',      label: null, isSignature: true, text: `${psicologoName}${crp ? `\nCRP ${crp}` : ''}` },
    ].filter(Boolean)
  }

  if (type === 'evolution') {
    const evTrend = finishedSessions.map(s => s.evolution).filter(Boolean)
    const positives = evTrend.filter(e => e === 'green').length
    const negatives = evTrend.filter(e => e === 'red').length
    const neutral   = evTrend.filter(e => e === 'yellow').length
    const overallLabel = positives > negatives ? 'Tendência positiva' : negatives > positives ? 'Atenção redobrada necessária' : 'Evolução estável / neutra'
    return [
      { id: 'period',   label: 'Período Avaliado',           text: `${fmtDate(patient.createdAt)} — ${today}` },
      { id: 'patient',  label: 'Identificação',              text: `Paciente: ${patient.name}, ${patient.age || '—'} anos\nAbordagem: ${patient.approach || '—'} · Frequência: ${patient.frequency || '—'}\nSessões realizadas: ${sessionCount} (${finishedSessions.length} concluídas, ${sessions.filter(s=>s.status==='open').length} em aberto)` },
      sections.clinical && { id: 'queixa', label: 'Queixa e Histórico Inicial', text: `${patient.complaint || '—'}${patient.history ? `\n\nHistórico: ${patient.history}` : ''}` },
      sections.sessions && finishedSessions.length > 0 && { id: 'sessions', label: 'Resumo das Sessões Recentes', text: finishedSessions.slice(0, 5).map(s => `• ${s.num} (${fmtDate(s.finishedAt)}): ${s.summary || '—'}`).join('\n') },
      sections.hypotheses && hypotheses.length > 0 && { id: 'hyp', label: 'Temas Clínicos Identificados', text: hypotheses.map(h => `• ${h.label}${h.sessionCount ? ` — ${h.sessionCount} sessão(ões)` : ''}\n  ${h.description || h.rationale || ''}`).join('\n\n') },
      sections.patterns && patterns.length > 0 && { id: 'patterns', label: 'Padrões Comportamentais Detectados', text: patterns.map(p => `• ${PAT_LABELS[p.type] || p.type} (${SEV_LABELS[p.severity] || p.severity}): ${p.description}`).join('\n') },
      sections.alerts && alerts.length > 0 && { id: 'alerts', label: 'Alertas Clínicos Ativos', text: alerts.map(a => `• [${a.level.toUpperCase()}] ${a.description}`).join('\n') },
      { id: 'overall',  label: 'Avaliação Geral da Evolução', text: `${overallLabel}\nSessões com evolução positiva: ${positives} · Neutras: ${neutral} · Atenção: ${negatives}${latestAnalysis ? `\n\nÚltima análise IA (${fmtDate(latestAnalysis.createdAt)}): ${latestAnalysis.summary}` : ''}` },
    ].filter(Boolean)
  }

  if (type === 'summary') {
    const overallNote = latestAnalysis?.summary || 'O processo terapêutico está em andamento.'
    return [
      { id: 'intro',    label: null, text: `Prezado(a) ${patient.name.split(' ')[0]},\n\nSegue abaixo um resumo do seu acompanhamento psicológico. Este documento é de uso pessoal e pode ser compartilhado com outros profissionais de saúde quando necessário.` },
      { id: 'data',     label: 'Seu Acompanhamento',          text: `Início: ${fmtDate(patient.createdAt)}\nTempo de tratamento: ${patient.months || 0} meses · ${sessionCount} sessões\nAbordagem terapêutica: ${patient.approach || '—'}\nFrequência: ${patient.frequency || '—'}` },
      sections.clinical && patient.complaint && { id: 'focus', label: 'Foco do Tratamento',   text: patient.complaint },
      { id: 'evolution',label: 'Como Está Sendo o Processo', text: overallNote },
      sections.patterns && patterns.length > 0 && { id: 'patterns', label: 'O Que Trabalhamos', text: patterns.map(p => `• ${PAT_LABELS[p.type] || p.type}: estamos trabalhando estratégias específicas para este padrão`).join('\n') },
      { id: 'closing',  label: null, text: `Em caso de dúvidas ou intercorrências, entre em contato diretamente com seu(sua) psicólogo(a).` },
      { id: 'sig', label: null, isSignature: true, text: `${psicologoName}${crp ? `\nCRP ${crp}` : ''}` },
    ].filter(Boolean)
  }

  // full
  const allSessions = sessions.slice(0, 20)
  return [
    { id: 'header',   label: 'Prontuário Clínico',          text: `Gerado em: ${today}\nPaciente: ${patient.name}` },
    { id: 'patient',  label: 'Dados do Paciente',           text: `Nome: ${patient.name}\nData de nascimento: ${dob}${patient.age ? ` (${patient.age} anos)` : ''}\nGênero: ${patient.gender || '—'}\nE-mail: ${patient.email || '—'}\nTelefone: ${patient.phone || '—'}` },
    sections.clinical && { id: 'clinical', label: 'Dados Clínicos', text: `Queixa: ${patient.complaint || '—'}\nHistórico: ${patient.history || '—'}\nMedicação: ${patient.medication || 'Nenhuma'}\nAbordagem: ${patient.approach || '—'}\nFrequência: ${patient.frequency || '—'}\nInício: ${fmtDate(patient.createdAt)}` },
    sections.hypotheses && hypotheses.length > 0 && { id: 'hyp', label: 'Temas Clínicos Identificados', text: hypotheses.map(h => `• ${h.label}${h.sessionCount ? ` (${h.sessionCount} sessão${h.sessionCount !== 1 ? 'ões' : ''})` : ''}`).join('\n') },
    sections.patterns && patterns.length > 0 && { id: 'patterns', label: 'Padrões Comportamentais', text: patterns.map(p => `• ${PAT_LABELS[p.type] || p.type} (${SEV_LABELS[p.severity] || p.severity}): ${p.description}`).join('\n') },
    sections.alerts && alerts.length > 0 && { id: 'alerts', label: 'Alertas Clínicos', text: alerts.map(a => `• [${a.level.toUpperCase()}] ${a.description}`).join('\n') },
    sections.sessions && allSessions.length > 0 && { id: 'sessions', label: 'Histórico de Sessões', text: allSessions.map(s => `• ${s.num} — ${fmtDate(s.finishedAt || s.createdAt)} — ${s.statusLabel}\n  ${s.summary || '—'}`).join('\n\n') },
    { id: 'sig', label: null, isSignature: true, text: `${psicologoName}${crp ? `\nCRP ${crp}` : ''}` },
  ].filter(Boolean)
}

const DOCUMENTS_BY_PATIENT = {
  'p-001': [
    { id: 'doc-001', name: 'Anamnese inicial — Lucas', originalName: 'anamnese_lucas.pdf', mimeType: 'application/pdf', fileSize: 245000, category: 'anamnese', createdAt: '2025-09-16T10:30:00Z' },
    { id: 'doc-002', name: 'TCLE assinado', originalName: 'tcle_lucas.pdf', mimeType: 'application/pdf', fileSize: 89000, category: 'tcle', createdAt: '2025-09-16T11:00:00Z' },
  ],
  'p-002': [
    { id: 'doc-003', name: 'Laudo de encaminhamento', originalName: 'laudo_carla.pdf', mimeType: 'application/pdf', fileSize: 112000, category: 'laudo', createdAt: '2025-12-01T09:00:00Z' },
  ],
}

const FORMS_BY_PATIENT = {
  'p-001': [
    { id: 'fm-001', patientId: 'p-001', patientName: 'Lucas Martins', title: 'Anamnese inicial', status: 'answered', answeredAt: '2025-09-16T11:30:00Z', createdAt: '2025-09-16T10:00:00Z' },
    { id: 'fm-002', patientId: 'p-001', patientName: 'Lucas Martins', title: 'TCLE — Consentimento Informado', status: 'answered', answeredAt: '2025-09-16T11:45:00Z', createdAt: '2025-09-16T10:00:00Z' },
    { id: 'fm-003', patientId: 'p-001', patientName: 'Lucas Martins', title: 'BDI-II — Inventário Beck (mai/26)', status: 'pending', answeredAt: null, createdAt: '2026-05-17T16:00:00Z' },
  ],
  'p-002': [
    { id: 'fm-004', patientId: 'p-002', patientName: 'Carla Silva', title: 'Anamnese inicial', status: 'answered', answeredAt: '2026-02-11T10:00:00Z', createdAt: '2026-02-10T09:00:00Z' },
    { id: 'fm-005', patientId: 'p-002', patientName: 'Carla Silva', title: 'SRS — Aliança terapêutica', status: 'answered', answeredAt: '2026-05-04T12:00:00Z', createdAt: '2026-05-04T11:30:00Z' },
  ],
}

// ── API Functions ─────────────────────────────────────────────────────────────

export const api = {

  // Dashboard
  async getDashboard() {
    await delay(500)
    const today = AGENDA_EVENTS.filter(e => {
      const d = new Date(e.startAt)
      const now = new Date()
      return d.toDateString() === now.toDateString()
    })
    return {
      account: {
        name: DEMO_USER.name,
        plan: DEMO_USER.plan,
        subscriptionStatus: DEMO_USER.subscriptionStatus,
        trialDaysRemaining: null,
        analysesRemaining: DEMO_USER.analysesRemaining,
      },
      stats: {
        activePatients: PATIENTS.length,
        sessionsThisMonth: 38,
        analyzedPatients: 3,
        pendingForms: 1,
      },
      todaySessions: today,
      recentAlerts: [
        { patientId: 'p-001', patientName: 'Lucas Martins', level: 'high', description: 'Padrão de evitação progressiva — 4 ocorrências registradas nesta sessão, tema recorrente há 3 sessões.', analysisId: 'a-001', createdAt: '2026-05-17T16:32:00Z' },
        { patientId: 'p-001', patientName: 'Lucas Martins', level: 'medium', description: 'Isolamento social auto-relatado aumentou nas últimas 3 semanas.', analysisId: 'a-001', createdAt: '2026-05-17T16:32:00Z' },
        { patientId: 'p-006', patientName: 'Beatriz Almeida', level: 'high', description: 'Luto complicado — isolamento social severo. Avaliação de risco recomendada.', analysisId: 'a-010', createdAt: '2026-05-12T11:00:00Z' },
      ],
      financialSnapshot: {
        receivedThisMonth: 1730,
        pendingReceivables: 200,
        overdueCount: 1,
      },
    }
  },

  // Patients
  async getPatients({ search = '', status = '', page = 0, size = 20 } = {}) {
    await delay(350)
    let list = [...PATIENTS]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.cid || '').toLowerCase().includes(q))
    }
    if (status) {
      list = list.filter(p => p.status === status)
    }
    const start = page * size
    return {
      content: list.slice(start, start + size),
      totalElements: list.length,
      totalPages: Math.ceil(list.length / size),
      number: page,
    }
  },

  async getPatient(id) {
    await delay(300)
    const p = PATIENTS.find(p => p.id === id)
    if (!p) throw new Error('Paciente não encontrado')
    return p
  },

  async getPatientSummary(id) {
    await delay(450)
    const p = PATIENTS.find(p => p.id === id)
    if (!p) throw new Error('Paciente não encontrado')
    const analyses = ANALYSES[id] || []
    const sessions = SESSIONS_BY_PATIENT[id] || []
    const forms = FORMS_BY_PATIENT[id] || []
    const lastAnalysis = analyses[0] || null
    const finishedSessions = sessions.filter(s => s.status === 'finished')
    const analysesSinceLastAi = lastAnalysis
      ? finishedSessions.filter(s => new Date(s.finishedAt) > new Date(lastAnalysis.createdAt)).length
      : finishedSessions.length
    const riskAlerts = analyses.flatMap(a => JSON.parse(a.riskAlerts || '[]').filter(r => ['high', 'critical'].includes(r.level)))
    return {
      patient: { ...p, sessions: sessions.length },
      sessionCount: sessions.length,
      hasAiAnalysis: analyses.length > 0,
      lastAnalysisDate: lastAnalysis?.createdAt || null,
      analysesSinceLastAi,
      activeAlerts: riskAlerts.length,
      formCount: forms.length,
    }
  },

  async createPatient(data) {
    await delay(600)
    const initials = data.name.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')
    const newPatient = {
      id: 'p-' + Date.now(),
      initials,
      name: data.name.trim(),
      age: data.birthDate ? Math.floor((Date.now() - new Date(data.birthDate)) / (365.25 * 24 * 3600 * 1000)) : null,
      gender: data.gender || null,
      email: data.email || null,
      phone: data.phone || null,
      birthDate: data.birthDate || null,
      complaint: data.complaint || null,
      history: data.history || null,
      medication: data.medication || null,
      approach: data.approach || null,
      frequency: data.frequency || null,
      payment: data.payment || null,
      sessionValue: data.sessionValue || null,
      cid: data.cid || null,
      status: 'gray', statusLabel: 'Início',
      avatarBg: 'var(--g50)', avatarColor: 'var(--g600)',
      sessions: 0, months: 0, createdAt: new Date().toISOString(),
    }
    PATIENTS.push(newPatient)
    return newPatient
  },

  async updatePatient(id, data) {
    await delay(400)
    const idx = PATIENTS.findIndex(p => p.id === id)
    if (idx === -1) throw new Error('Paciente não encontrado')
    Object.assign(PATIENTS[idx], data)
    return PATIENTS[idx]
  },

  // Sessions
  async getPatientSessions(patientId, { page = 0, size = 20 } = {}) {
    await delay(350)
    const sessions = SESSIONS_BY_PATIENT[patientId] || []
    return {
      content: sessions.slice(page * size, page * size + size),
      totalElements: sessions.length,
      totalPages: Math.ceil(sessions.length / size),
    }
  },

  async getTodaySessions() {
    await delay(300)
    return AGENDA_EVENTS.filter(e => {
      const d = new Date(e.startAt)
      return d.toDateString() === new Date().toDateString()
    })
  },

  async createSession(data) {
    await delay(500)
    const patient = PATIENTS.find(p => p.id === data.patientId)
    if (!patient) throw new Error('Paciente não encontrado')
    const sessions = SESSIONS_BY_PATIENT[data.patientId] || []
    const newSession = {
      id: 's-' + Date.now(),
      patientId: data.patientId,
      patientName: patient.name,
      type: data.type || 'text',
      status: 'open',
      textContent: null, htmlContent: null, canvasData: null,
      meetLink: data.meetLink || null,
      durationSeconds: null, finishedAt: null,
      createdAt: new Date().toISOString(),
    }
    sessions.unshift(newSession)
    SESSIONS_BY_PATIENT[data.patientId] = sessions
    return newSession
  },

  async autosaveSession(sessionId, data) {
    // No-op in mock — just acknowledge silently
    await delay(100)
    return { sessionId, saved: true }
  },

  async finishSession(sessionId, data) {
    await delay(400)
    const { textContent, htmlContent, imageBase64, canvasDataJson, canvasTextContent, durationSeconds } = data
    for (const sessions of Object.values(SESSIONS_BY_PATIENT)) {
      const s = sessions.find(s => s.id === sessionId)
      if (s) {
        Object.assign(s, {
          textContent:      textContent      ?? s.textContent,
          htmlContent:      htmlContent      ?? s.htmlContent,
          imageBase64:      imageBase64      ?? s.imageBase64,
          canvasDataJson:   canvasDataJson   ?? s.canvasDataJson,
          canvasTextContent: canvasTextContent ?? s.canvasTextContent,
          durationSeconds:  durationSeconds  ?? s.durationSeconds,
          status:    'finished',
          finishedAt: new Date().toISOString(),
        })
        return s
      }
    }
    // Sessão não existe no mock ainda (criada em background) — adiciona ao primeiro paciente como fallback
    console.warn('[mockApi] finishSession: sessionId não encontrado, ignorando:', sessionId)
    return { sessionId, saved: true }
  },

  // Analyses
  async getPatientAnalyses(patientId, { page = 0, size = 20 } = {}) {
    await delay(350)
    const analyses = ANALYSES[patientId] || []
    return {
      content: analyses.slice(page * size, page * size + size),
      totalElements: analyses.length,
    }
  },

  async createAnalysis({ sessionId, patientId, additionalSessionIds = [], template = null }) {
    await delay(2800) // simula chamada à IA

    // Busca sessão atual para extrair todo conteúdo disponível
    let currentSession = null
    for (const sessions of Object.values(SESSIONS_BY_PATIENT)) {
      const found = sessions.find(s => s.id === sessionId)
      if (found) { currentSession = found; break }
    }

    // Constrói contexto rico — o que o backend real enviaria para Claude/GPT-4o
    // Camadas de informação em ordem de fidelidade:
    //  1. canvasTextContent → texto extraído diretamente dos elementos (sem OCR, 100% fiel)
    //  2. imageBase64       → imagem do canvas (IA usa visão para estrutura, setas, diagramas)
    //  3. textContent       → notas de texto da sessão
    //  4. sessões anteriores → contexto longitudinal
    const hasCanvas    = !!(currentSession?.imageBase64)
    const hasText      = !!(currentSession?.textContent || currentSession?.canvasTextContent)
    const sessionCount = 1 + (additionalSessionIds?.length || 0)

    // Usa análise de Lucas como template realista
    const baseTemplate = ANALYSES['p-001'][0]
    const analysis = {
      ...baseTemplate,
      id: 'a-' + Date.now(),
      sessionId,
      sessionCount,
      template: template || 'reflexao_clinica',
      refineCount: 0,
      patientId: patientId || 'p-001',
      createdAt: new Date().toISOString(),
      clinicalBasis: [
        hasCanvas && 'anotações manuscritas do canvas (texto extraído + visão da imagem)',
        hasText   && 'conteúdo textual da sessão',
        sessionCount > 1 && `${sessionCount - 1} sessão(ões) anterior(es) incluída(s) na análise longitudinal`,
      ].filter(Boolean).join(', ') || 'conteúdo da sessão atual',
    }

    // Persiste no registro do paciente correto
    if (patientId && patientId !== 'p-001') {
      if (!ANALYSES[patientId]) ANALYSES[patientId] = []
      ANALYSES[patientId].unshift(analysis)
    }
    return analysis
  },

  async refineAnalysis(analysisId, feedback = null) {
    await delay(2200) // Haiku é mais rápido
    // Simula uma análise levemente modificada (sem alterar estrutura)
    const baseTemplate = ANALYSES['p-001'][0]
    return {
      ...baseTemplate,
      id: analysisId,
      template: baseTemplate.template || 'reflexao_clinica',
      refineCount: 1,
      summary: feedback
        ? `[Análise refinada com base no feedback: "${feedback.slice(0, 60)}${feedback.length > 60 ? '...' : ''}"]\n\n${baseTemplate.summary}`
        : `[Análise revisada — maior especificidade e foco nas anotações]\n\n${baseTemplate.summary}`,
      createdAt: new Date().toISOString(),
    }
  },

  // Agenda
  async getAgendaEvents({ from, to } = {}) {
    await delay(350)
    if (!from || !to) return AGENDA_EVENTS
    const f = new Date(from), t = new Date(to)
    return AGENDA_EVENTS.filter(e => {
      const d = new Date(e.startAt)
      return d >= f && d < t
    })
  },

  async createAgendaEvent(data) {
    await delay(500)
    const patient = data.patientId ? PATIENTS.find(p => p.id === data.patientId) : null
    const newEvent = {
      id: 'ag-' + Date.now(),
      patientId: data.patientId || null,
      patientName: patient?.name || null,
      patientInitials: patient?.initials || null,
      patientAvatarBg: patient?.avatarBg || null,
      patientAvatarColor: patient?.avatarColor || null,
      title: data.title,
      description: data.description || null,
      startAt: data.startAt,
      endAt: data.endAt,
      meetLink: data.meetLink || null,
      type: data.type || 'session',
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    }
    AGENDA_EVENTS.push(newEvent)
    return newEvent
  },

  async updateAgendaEvent(id, data) {
    await delay(400)
    const idx = AGENDA_EVENTS.findIndex(e => e.id === id)
    if (idx === -1) throw new Error('Evento não encontrado')
    Object.assign(AGENDA_EVENTS[idx], data)
    return AGENDA_EVENTS[idx]
  },

  async deleteAgendaEvent(id) {
    await delay(300)
    const idx = AGENDA_EVENTS.findIndex(e => e.id === id)
    if (idx !== -1) AGENDA_EVENTS.splice(idx, 1)
  },

  // Financial
  async getFinancialEvents({ page = 0, size = 50 } = {}) {
    await delay(350)
    const start = page * size
    return {
      content: FINANCIAL_EVENTS.slice(start, start + size),
      totalElements: FINANCIAL_EVENTS.length,
    }
  },

  async getFinancialSummary() {
    await delay(300)
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const received = FINANCIAL_EVENTS
      .filter(e => e.direction === 'credit' && e.status === 'received' && new Date(e.paidAt) >= startOfMonth)
      .reduce((sum, e) => sum + e.amount, 0)
    const pending = FINANCIAL_EVENTS
      .filter(e => e.direction === 'credit' && e.status === 'pending')
      .reduce((sum, e) => sum + e.amount, 0)
    const overdue = FINANCIAL_EVENTS.filter(e => e.status === 'overdue').length
    return { receivedThisMonth: received, pendingReceivables: pending, overdueCount: overdue }
  },

  async createFinancialEvent(data) {
    await delay(500)
    const patient = data.patientId ? PATIENTS.find(p => p.id === data.patientId) : null
    const newEvent = {
      id: 'f-' + Date.now(),
      patientId: data.patientId || null,
      patientName: patient?.name || null,
      type: data.type,
      description: data.description,
      amount: data.amount,
      direction: data.direction || 'credit',
      status: data.status || 'pending',
      dueDate: data.dueDate || null,
      paidAt: data.status === 'received' ? new Date().toISOString() : null,
      paymentMethod: data.paymentMethod || null,
      notes: data.notes || null,
      createdAt: new Date().toISOString(),
    }
    FINANCIAL_EVENTS.unshift(newEvent)
    return newEvent
  },

  async updateFinancialEvent(id, data) {
    await delay(400)
    const idx = FINANCIAL_EVENTS.findIndex(e => e.id === id)
    if (idx === -1) throw new Error('Lançamento não encontrado')
    const ev = FINANCIAL_EVENTS[idx]
    if (data.status === 'received' && !ev.paidAt) {
      data.paidAt = new Date().toISOString()
    }
    if (data.clearRescheduledDueDate) {
      ev.rescheduledDueDate = null
      ev.rescheduledCount = 0
      ev.rescheduleHistory = null
      delete data.clearRescheduledDueDate
    } else if (data.rescheduledDueDate) {
      const prev = ev.rescheduledDueDate || ev.dueDate || 'sem vencimento'
      const history = ev.rescheduleHistory ? JSON.parse(ev.rescheduleHistory) : []
      history.push({ from: prev, to: data.rescheduledDueDate, changedAt: new Date().toISOString() })
      ev.rescheduleHistory = JSON.stringify(history)
      ev.rescheduledCount = (ev.rescheduledCount || 0) + 1
      if (ev.status === 'overdue') ev.status = 'pending'
    }
    Object.assign(ev, data)
    return ev
  },

  // Forms
  async getPatientForms(patientId) {
    await delay(300)
    return FORMS_BY_PATIENT[patientId] || []
  },

  async createForm(data) {
    await delay(500)
    const patient = PATIENTS.find(p => p.id === data.patientId)
    if (!patient) throw new Error('Paciente não encontrado')
    const newForm = {
      id: 'fm-' + Date.now(),
      patientId: data.patientId,
      patientName: patient.name,
      title: data.title,
      fields: JSON.stringify(data.fields || []),
      response: null,
      token: 'tok-' + Math.random().toString(36).slice(2),
      status: 'pending',
      answeredAt: null,
      expiresAt: null,
      createdAt: new Date().toISOString(),
    }
    if (!FORMS_BY_PATIENT[data.patientId]) FORMS_BY_PATIENT[data.patientId] = []
    FORMS_BY_PATIENT[data.patientId].unshift(newForm)
    return newForm
  },

  // Insights
  async getInsights() {
    await delay(500)
    const analyzedIds = ['p-001', 'p-002', 'p-007']
    const unanalyzed = PATIENTS.filter(p => !analyzedIds.includes(p.id)).map(p => ({
      id: p.id, name: p.name, initials: p.initials,
      avatarBg: p.avatarBg, avatarColor: p.avatarColor,
      sessionCount: (SESSIONS_BY_PATIENT[p.id] || []).length,
    }))
    return {
      totalPatients: PATIENTS.length,
      analyzedPatients: analyzedIds.length,
      coveragePercent: Math.round(analyzedIds.length / PATIENTS.length * 100),
      analyzedPatientIds: analyzedIds,
      unanalyzedPatients: unanalyzed,
      patternSummary: [
        { type: 'avoidance', count: 5, severity: 'high' },
        { type: 'rumination', count: 3, severity: 'medium' },
        { type: 'hypervigilance', count: 2, severity: 'low' },
        { type: 'catastrophizing', count: 1, severity: 'medium' },
      ],
      topHypotheses: [
        { label: 'Estresse e reatividade a tema traumático', occurrences: 3 },
        { label: 'Ruminação ansiosa com foco específico', occurrences: 2 },
        { label: 'Ansiedade social com exposição progressiva', occurrences: 1 },
        { label: 'Exaustão emocional e despersonalização', occurrences: 1 },
      ],
      alertCount: { low: 0, medium: 1, high: 2, critical: 0 },
      recentAnalyses: [
        { analysisId: 'a-001', patientId: 'p-001', patientName: 'Lucas Martins', evolution: 'negative', summary: 'Padrão de evitação ao tema familiar — 4 ocorrências. Tema recorrente nos seus registros por 3 sessões consecutivas.', createdAt: '2026-05-17T16:32:00Z' },
        { analysisId: 'a-003', patientId: 'p-002', patientName: 'Carla Silva', evolution: 'positive', summary: 'Primeiro evento de exposição bem-sucedido. Fobia social em regressão.', createdAt: '2026-05-04T11:38:00Z' },
        { analysisId: 'a-010', patientId: 'p-007', patientName: 'Pedro Alves', evolution: 'neutral', summary: 'Segundo episódio de burnout. Despersonalização presente. Sono fragmentado há 6 semanas.', createdAt: '2026-05-14T16:20:00Z' },
      ],
    }
  },

  // Delete operations
  async deletePatient(id) {
    await delay(400)
    const idx = PATIENTS.findIndex(p => p.id === id)
    if (idx !== -1) PATIENTS.splice(idx, 1)
  },

  async deleteSession(sessionId) {
    await delay(300)
    for (const sessions of Object.values(SESSIONS_BY_PATIENT)) {
      const idx = sessions.findIndex(s => s.id === sessionId)
      if (idx !== -1) { sessions.splice(idx, 1); return }
    }
  },

  async deleteFinancialEvent(id) {
    await delay(300)
    const idx = FINANCIAL_EVENTS.findIndex(e => e.id === id)
    if (idx !== -1) FINANCIAL_EVENTS.splice(idx, 1)
  },

  async deleteForm(id) {
    await delay(300)
    for (const forms of Object.values(FORMS_BY_PATIENT)) {
      const idx = forms.findIndex(f => f.id === id)
      if (idx !== -1) { forms.splice(idx, 1); return }
    }
  },

  async updateForm(id, data) {
    await delay(400)
    for (const forms of Object.values(FORMS_BY_PATIENT)) {
      const f = forms.find(f => f.id === id)
      if (f) { Object.assign(f, data); return f }
    }
    throw new Error('Formulário não encontrado')
  },

  async getFormTemplates() {
    await delay(300)
    return [...FORM_TEMPLATES]
  },

  async getLembretes() {
    await delay(300)
    return [...REMINDER_CONFIGS]
  },

  async updateLembrete(id, data) {
    await delay(400)
    const idx = REMINDER_CONFIGS.findIndex(r => r.id === id)
    if (idx !== -1) { Object.assign(REMINDER_CONFIGS[idx], data); return REMINDER_CONFIGS[idx] }
    throw new Error('Lembrete não encontrado')
  },

  async saveLembreteTemplate(id, template) {
    await delay(400)
    const r = REMINDER_CONFIGS.find(r => r.id === id)
    if (r) { r.template = template; return r }
    throw new Error('Lembrete não encontrado')
  },

  async getTeleSessions() {
    await delay(400)
    return [...TELE_SESSIONS].sort((a, b) => new Date(b.scheduledAt) - new Date(a.scheduledAt))
  },

  async createTeleSession(data) {
    await delay(500)
    const patient = data.patientId ? PATIENTS.find(p => p.id === data.patientId) : null
    const newTs = {
      id: 'ts-' + Date.now(),
      patientId: data.patientId || null,
      patientName: patient?.name || null,
      patientInitials: patient?.initials || null,
      platform: data.platform || 'whereby',
      roomLink: data.roomLink || `https://whereby.com/psicoai-${(patient?.name || 'sessao').toLowerCase().replace(/\s+/g, '-')}`,
      status: 'scheduled',
      scheduledAt: data.scheduledAt,
      duration: data.duration || 50,
      confirmationStatus: 'pending',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
    }
    TELE_SESSIONS.unshift(newTs)
    return newTs
  },

  async updateTeleSession(id, data) {
    await delay(400)
    const idx = TELE_SESSIONS.findIndex(t => t.id === id)
    if (idx === -1) throw new Error('Sessão remota não encontrada')
    Object.assign(TELE_SESSIONS[idx], data)
    return TELE_SESSIONS[idx]
  },

  async deleteTeleSession(id) {
    await delay(300)
    const idx = TELE_SESSIONS.findIndex(t => t.id === id)
    if (idx !== -1) TELE_SESSIONS.splice(idx, 1)
  },

  // ── Reports ────────────────────────────────────────────────────────────────

  async generateReport({ patientId, type, sections }) {
    await delay(1400) // simulates IA + formatting pipeline
    const patient = PATIENTS.find(p => p.id === patientId)
    if (!patient) throw new Error('Paciente não encontrado')
    const analyses = ANALYSES[patientId] || []
    const sessions = SESSIONS_BY_PATIENT[patientId] || []
    const profile = { ...DEMO_USER }
    const meta = REPORT_TYPE_META[type] || REPORT_TYPE_META.summary
    const reportSections = buildReportSections(
      patient, type, sections, analyses, sessions,
      profile.name || 'Psicólogo(a)', profile.crp || ''
    )
    const report = {
      id: 'rpt-' + Date.now(),
      patientId,
      patientName: patient.name,
      type,
      typeLabel: meta.label,
      audience: meta.audience,
      sections: reportSections,
      sentChannels: [],
      createdAt: new Date().toISOString(),
    }
    if (!REPORTS_BY_PATIENT[patientId]) REPORTS_BY_PATIENT[patientId] = []
    REPORTS_BY_PATIENT[patientId].unshift(report)
    return report
  },

  async getPatientReports(patientId) {
    await delay(300)
    return REPORTS_BY_PATIENT[patientId] || []
  },

  async sendReport({ reportId, patientId, channels }) {
    await delay(700)
    const reports = REPORTS_BY_PATIENT[patientId] || []
    const rpt = reports.find(r => r.id === reportId)
    if (rpt) {
      rpt.sentChannels = [...new Set([...rpt.sentChannels, ...channels])]
      rpt.sentAt = new Date().toISOString()
    }
    return { success: true, sentAt: new Date().toISOString(), channels }
  },

  async getUserProfile() {
    await delay(300)
    return { ...DEMO_USER }
  },

  async updateProfile(data) {
    await delay(500)
    Object.assign(DEMO_USER, data)
    localStorage.setItem('psicoai_user', JSON.stringify(DEMO_USER))
    return { ...DEMO_USER }
  },

  async changePassword(_currentPassword, _newPassword) {
    await delay(600)
    // mock: aceita sempre
    return null
  },

  // Billing — mock redireciona para simulação local
  async createCheckoutSession({ planId, couponCode }) {
    await delay(400)
    const qs = couponCode ? `&coupon=${couponCode}` : ''
    return { url: `${window.location.origin}/?payment=demo&plan=${planId}${qs}` }
  },

  async createBillingPortalSession() {
    await delay(400)
    return { url: `${window.location.origin}/?billing=demo` }
  },

  async getOpenSessions() {
    await delay(150)
    // No mock, sessões abertas são gerenciadas apenas via estado local — retorna vazio
    return []
  },

  // Busca análise IA de uma sessão específica pelo sessionId
  async getSessionAnalysis(sessionId) {
    await delay(280)
    const all = Object.values(ANALYSES).flat()
    return all.find(a => a.sessionId === sessionId) || null
  },

  // Anotações — listagem global de sessões com texto
  async getRecentAnnotations({ search = '', patientId = '' } = {}) {
    await delay(400)
    const all = Object.entries(SESSIONS_BY_PATIENT).flatMap(([pid, sessions]) => {
      const patient = PATIENTS.find(p => p.id === pid)
      return sessions
        .filter(s => s.textContent || s.status === 'finished')
        .map(s => ({
          ...s,
          patientId: pid,
          patientName: patient?.name || '—',
          patientInitials: patient?.initials || '??',
          patientAvatarBg: patient?.avatarBg || 'var(--gr1)',
          patientAvatarColor: patient?.avatarColor || 'var(--gr5)',
          patient,
        }))
    }).sort((a, b) => new Date(b.finishedAt || b.createdAt) - new Date(a.finishedAt || a.createdAt))

    let result = all
    if (patientId) result = result.filter(s => s.patientId === patientId)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.textContent?.toLowerCase().includes(q) ||
        s.patientName?.toLowerCase().includes(q)
      )
    }
    return result
  },

  // Documents (pasta de documentos)
  async getPatientDocuments(patientId) {
    await delay(350)
    return (DOCUMENTS_BY_PATIENT[patientId] || [])
  },

  async uploadDocument(patientId, file, category = 'outros', name = null) {
    await delay(800)
    const doc = {
      id: 'doc-' + Date.now(),
      name: name?.trim() || file.name,
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileSize: file.size,
      category: category || 'outros',
      createdAt: new Date().toISOString(),
    }
    if (!DOCUMENTS_BY_PATIENT[patientId]) DOCUMENTS_BY_PATIENT[patientId] = []
    DOCUMENTS_BY_PATIENT[patientId].unshift(doc)
    return doc
  },

  async downloadDocument(patientId, docId) {
    await delay(400)
    // Return a tiny placeholder blob in mock mode
    return new Blob(['[arquivo de demonstração]'], { type: 'text/plain' })
  },

  async deleteDocument(patientId, docId) {
    await delay(400)
    if (DOCUMENTS_BY_PATIENT[patientId]) {
      DOCUMENTS_BY_PATIENT[patientId] = DOCUMENTS_BY_PATIENT[patientId].filter(d => d.id !== docId)
    }
  },

  async exportProntuarioPdf(patientId) {
    await delay(1200)
    const patient = PATIENTS.find(p => p.id === patientId)
    const text = `PRONTUÁRIO ELETRÔNICO\nPsicoAI · Demo\n\nPaciente: ${patient?.name || 'Paciente'}\nGerado em: ${new Date().toLocaleString('pt-BR')}\n\n[Versão de demonstração — conecte o backend para PDF real]`
    return new Blob([text], { type: 'application/pdf' })
  },

  async exportRelatorioPdf(patientId, type = 'encaminhamento') {
    await delay(1000)
    const patient = PATIENTS.find(p => p.id === patientId)
    const text = `RELATÓRIO DE ENCAMINHAMENTO\nPsicoAI · Demo\n\nPaciente: ${patient?.name || 'Paciente'}\nTipo: ${type}\nGerado em: ${new Date().toLocaleString('pt-BR')}\n\n[Versão de demonstração — conecte o backend para PDF real]`
    return new Blob([text], { type: 'application/pdf' })
  },

  async importPatients(file) {
    await delay(1500)
    // In mock: just report simulated import
    return { imported: 3, skipped: 0, errors: [] }
  },

  // ── Google OAuth / Calendar / Meet ───────────────────────────────────────
  _googleConnected: false,
  _googleCalendarSync: false,

  async getGoogleStatus() {
    await delay(200)
    return { connected: this._googleConnected, email: this._googleConnected ? 'demo@gmail.com' : null, calendarSync: this._googleCalendarSync }
  },

  async getGoogleAuthUrl() {
    await delay(100)
    // No mock, simula conexão diretamente
    return { url: null, _mock: true }
  },

  async disconnectGoogle() {
    await delay(400)
    this._googleConnected = false
    this._googleCalendarSync = false
    return null
  },

  async setGoogleCalendarSync(enabled) {
    await delay(300)
    this._googleCalendarSync = enabled
    return null
  },

  async createGoogleMeet(patientName) {
    await delay(800)
    const code = Math.random().toString(36).slice(2, 5) + '-' + Math.random().toString(36).slice(2, 5) + '-' + Math.random().toString(36).slice(2, 5)
    return { meetLink: `https://meet.google.com/${code}`, eventId: 'mock-event-id' }
  },

  async getGoogleCalendarEvents(from, to) {
    await delay(500)
    if (!this._googleCalendarSync) return []
    const now = new Date()
    return [
      { id: 'gev-1', summary: 'Supervisão clínica', start: new Date(now.getTime() + 86400000).toISOString(), end: new Date(now.getTime() + 90000000).toISOString(), meetLink: 'https://meet.google.com/abc-defg-hij', source: 'google' },
      { id: 'gev-2', summary: 'Reunião de equipe', start: new Date(now.getTime() + 172800000).toISOString(), end: new Date(now.getTime() + 176400000).toISOString(), meetLink: null, source: 'google' },
    ]
  },

  // Cupons — mock com códigos de teste
  async validateCoupon(code, planId) {
    await delay(600)
    const MOCK_COUPONS = {
      'LANCAMENTO':  { discountType: 'percentage', discountValue: 30, message: '30% de desconto aplicado!' },
      'YOUTUBE30':   { discountType: 'percentage', discountValue: 30, message: '30% de desconto — parceria YouTube!' },
      'PSICOAI14':   { discountType: 'percentage', discountValue: 0,  message: 'Trial de 14 dias ativo!' },
      'DEMO50':      { discountType: 'percentage', discountValue: 50, message: '50% de desconto aplicado!' },
    }
    const c = MOCK_COUPONS[code.toUpperCase()]
    if (!c) return { code, valid: false, discountType: 'percentage', discountValue: 0, planRestriction: null, message: 'Cupom não encontrado ou inválido.' }
    return { code: code.toUpperCase(), valid: true, planRestriction: null, ...c }
  },
}

export default api
