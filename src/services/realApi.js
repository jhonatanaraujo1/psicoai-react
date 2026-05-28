/**
 * realApi.js — Cliente HTTP para o backend PsicoAI.
 * Interface idêntica à mockApi.js — troca transparente via services/index.js.
 *
 * Token lifecycle:
 *   psicoai_token   → access token (JWT, 15 min)
 *   psicoai_refresh → refresh token (30 dias)
 *   psicoai_user    → JSON do usuário logado
 *
 * Auto-refresh: singleton lock evita race conditions em paralelo.
 * Session expired: dispara evento 'psicoai:session-expired' e limpa storage.
 */

const BASE = import.meta.env.VITE_API_BASE_URL // e.g. https://api.psicoai.com.br

// ── Token helpers ──────────────────────────────────────────────────────────────

const getToken    = ()  => localStorage.getItem('psicoai_token')
const getRefresh  = ()  => localStorage.getItem('psicoai_refresh')
const setTokens   = (at, rt) => {
  localStorage.setItem('psicoai_token', at)
  if (rt) localStorage.setItem('psicoai_refresh', rt)
}
const clearTokens = () => {
  // Remove auth + TODOS os dados clínicos (canvas, quicknote, session ativa)
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith('psicoai_')) keysToRemove.push(k)
  }
  keysToRemove.forEach(k => localStorage.removeItem(k))
}

// ── Token refresh (singleton) ─────────────────────────────────────────────────

let _refreshPromise = null

async function doRefresh() {
  const rt = getRefresh()
  if (!rt) throw new Error('no_refresh_token')

  let res
  try {
    res = await fetch(`${BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    })
  } catch {
    // Erro de rede: servidor offline, connection refused, timeout de deploy
    throw new Error('network_error')
  }

  // 401/403 = token realmente inválido ou expirado → deslogar
  if (res.status === 401 || res.status === 403) throw new Error('refresh_failed')
  // 5xx / outro = servidor temporariamente indisponível (restart Railway) → NÃO deslogar
  if (!res.ok) throw new Error('server_error')

  const data = await res.json()
  setTokens(data.accessToken, data.refreshToken)
  if (data.user) localStorage.setItem('psicoai_user', JSON.stringify(normalizeUser(data.user)))
  return data.accessToken
}

async function refreshOnce() {
  if (!_refreshPromise) {
    _refreshPromise = doRefresh().finally(() => { _refreshPromise = null })
  }
  return _refreshPromise
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────────

async function req(method, path, body, opts = {}) {
  const url = `${BASE}${path}`
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, ...opts })

  // Auto-refresh on 401 — apenas para endpoints protegidos.
  // Endpoints de auth (/api/v1/auth/*) retornam 401 para credenciais erradas,
  // não para token expirado — nunca fazer refresh nesse caso.
  if (res.status === 401 && !opts._retry && !path.startsWith('/api/v1/auth/')) {
    try {
      const newToken = await refreshOnce()
      headers['Authorization'] = `Bearer ${newToken}`
      res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined, _retry: true })
    } catch (e) {
      if (e.message === 'network_error' || e.message === 'server_error') {
        // Servidor temporariamente down (deploy Railway, restart) — mantém sessão, propaga erro
        throw new Error('Serviço temporariamente indisponível. Aguarde alguns segundos e tente novamente.')
      }
      // Token realmente inválido ou expirado — desloga
      clearTokens()
      window.dispatchEvent(new CustomEvent('psicoai:session-expired'))
      window.location.replace('/')
      return
    }
  }

  // 403 em endpoints protegidos = conta suspensa, token revogado ou acesso negado
  // pelo backend ao recurso do próprio usuário → deslogar imediatamente.
  // Nota: não se aplica a /api/v1/auth/* (403 ali = credencial errada, não sessão).
  if (res.status === 403 && !path.startsWith('/api/v1/auth/')) {
    clearTokens()
    window.dispatchEvent(new CustomEvent('psicoai:session-expired'))
    window.location.replace('/')
    return
  }

  if (res.status === 204) return null

  if (res.status === 402) {
    window.dispatchEvent(new CustomEvent('psicoai:payment-required'))
    throw new Error('Sua conta está bloqueada. Regularize o pagamento para continuar.')
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.message || json?.error || `Erro ${res.status}`
    throw new Error(msg)
  }
  return json
}

const get    = (path, params) => {
  const qs = params ? '?' + new URLSearchParams(Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  )).toString() : ''
  return req('GET', path + qs)
}
const post   = (path, body) => req('POST', path, body)
const patch  = (path, body) => req('PATCH', path, body)
const del    = (path)       => req('DELETE', path)

// ── Blob/file fetch (for PDF download, file download) ────────────────────────

async function reqBlob(method, path) {
  const url = `${BASE}${path}`
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, { method, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Erro ${res.status}`)
  }
  return res.blob()
}

async function reqMultipart(method, path, formData) {
  const url = `${BASE}${path}`
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(url, { method, headers, body: formData })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json?.message || `Erro ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ── Normalize backend user → frontend user shape ───────────────────────────────

const DEFAULT_PREFERENCES = {
  defaultApproach: 'TCC',
  defaultSessionDuration: 50,
  defaultSessionValue: 200,
  workingHours: { start: 8, end: 18 },
  notifyOnAlert: true,
  notifyByEmail: true,
  notifyByWhatsApp: false,
  theme: 'light',
}

function normalizeUser(u) {
  // Backend can send workingHours as { start, end } or flat workingHoursStart/workingHoursEnd
  const prefs = u.preferences || {}
  const workingHours = prefs.workingHours || {
    start: prefs.workingHoursStart ?? DEFAULT_PREFERENCES.workingHours.start,
    end:   prefs.workingHoursEnd   ?? DEFAULT_PREFERENCES.workingHours.end,
  }
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    crp: u.crp || null,
    specialty: u.specialty || null,
    phone: u.phone || null,
    clinicName: u.clinicName || null,
    address: u.address || null,
    bio: u.bio || null,
    plan: u.plan || 'base',
    analysesRemaining: u.analysesRemaining ?? 0,
    analysesUsedThisMonth: u.analysesUsedThisMonth ?? 0,
    subscriptionStatus: u.subscriptionStatus || 'trialing',
    trialDaysRemaining: u.trialDaysRemaining ?? null,
    graceDaysRemaining: u.graceDaysRemaining ?? 0,
    preferences: {
      ...DEFAULT_PREFERENCES,
      ...prefs,
      workingHours,
    },
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const auth = {
  async login({ email, password }) {
    const data = await post('/api/v1/auth/login', { email, password })
    setTokens(data.accessToken, data.refreshToken)
    const user = normalizeUser(data.user)
    localStorage.setItem('psicoai_user', JSON.stringify(user))
    return { accessToken: data.accessToken, user }
  },

  async logout() {
    try { await post('/api/v1/auth/logout') } catch { /* ignore */ }
    clearTokens()
  },

  getStoredUser() {
    try {
      const raw = localStorage.getItem('psicoai_user')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  },

  isAuthenticated() {
    return !!getToken()
  },

  async register({ name, email, password, crp }) {
    // Captura UTM params do localStorage (gravados pelo script de tracking da landing page)
    const tracking = {}
    try {
      const stored = JSON.parse(localStorage.getItem('psicoai_tracking') || '{}')
      if (stored.utmSource)    tracking.utmSource    = stored.utmSource
      if (stored.utmMedium)    tracking.utmMedium    = stored.utmMedium
      if (stored.utmCampaign)  tracking.utmCampaign  = stored.utmCampaign
      if (stored.utmContent)   tracking.utmContent   = stored.utmContent
      if (stored.utmTerm)      tracking.utmTerm      = stored.utmTerm
      if (stored.fbclid)       tracking.fbclid       = stored.fbclid
      if (stored.referralCode) tracking.referralCode = stored.referralCode
    } catch { /* silently ignore */ }

    const data = await post('/api/v1/auth/register', { name, email, password, crp, ...tracking })
    setTokens(data.accessToken, data.refreshToken)
    const user = normalizeUser(data.user)
    localStorage.setItem('psicoai_user', JSON.stringify(user))
    return { accessToken: data.accessToken, user }
  },
}

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {

  // Dashboard
  async getDashboard() {
    return get('/api/v1/dashboard')
  },

  // Patients
  async getPatients({ search, status, page = 0, size = 20 } = {}) {
    return get('/api/v1/patients', { search, status, page, size })
  },

  async getPatient(id) {
    return get(`/api/v1/patients/${id}`)
  },

  async getPatientSummary(id) {
    return get(`/api/v1/patients/${id}/summary`)
  },

  async createPatient(data) {
    return post('/api/v1/patients', {
      name:       data.name       || data.nome,
      birthDate:  data.birthDate  || data.dataNasc  || null,
      gender:     data.gender     || data.genero    || null,
      email:      data.email      || null,
      phone:      data.phone      || data.telefone  || null,
      complaint:  data.complaint  || data.queixa    || null,
      history:    data.history    || data.historico || null,
      medication: data.medication || data.medicacao || null,
      approach:   data.approach   || data.abordagem || null,
      frequency:  data.frequency  || data.frequencia || null,
      payment:    data.payment    || data.pagamento  || null,
      sessionValue: data.sessionValue || (data.valor ? Number(data.valor) : null),
      cid:        data.cid || null,
      // Recorrência
      recurringDayOfWeek:  data.recurringDayOfWeek  ? Number(data.recurringDayOfWeek)  : null,
      recurringTime:       data.recurringTime        || null,
      recurringDurationMin:data.recurringDurationMin ? Number(data.recurringDurationMin): null,
      billingType:         data.billingType          || null,
      monthlyValue:        data.monthlyValue         ? Number(data.monthlyValue)         : null,
    })
  },

  async updatePatient(id, data) {
    return patch(`/api/v1/patients/${id}`, data)
  },

  async deletePatient(id) {
    return del(`/api/v1/patients/${id}`)
  },

  // Sessions
  async getPatientSessions(patientId, { page = 0, size = 20 } = {}) {
    const res = await get(`/api/v1/patients/${patientId}/sessions`, { page, size })
    // Normalize: backend uses `canvasData`, frontend (Anotacoes) checks `canvasDataJson`
    if (res?.content) {
      res.content = res.content.map(s => ({
        ...s,
        canvasDataJson: s.type === 'canvas' ? (s.canvasData ?? true) : null,
      }))
    }
    return res
  },

  async getTodaySessions() {
    return get('/api/v1/sessions/today')
  },

  async createSession(data) {
    return post('/api/v1/sessions', data)
  },

  async finishSession(sessionId, data) {
    const payload = { ...data }
    // Backend field is `canvasData`; frontend sessions send `canvasDataJson` — normalize before POST
    if (payload.canvasDataJson !== undefined) {
      payload.canvasData = payload.canvasDataJson
      delete payload.canvasDataJson
    }
    // Canvas text content — backend expects it as `textContent`
    if (payload.canvasTextContent !== undefined) {
      if (!payload.textContent) payload.textContent = payload.canvasTextContent
      delete payload.canvasTextContent
    }
    return post(`/api/v1/sessions/${sessionId}/finish`, payload)
  },

  async autosaveSession(sessionId, data) {
    // Same normalization as finishSession
    const payload = { ...data }
    if (payload.canvasDataJson !== undefined) {
      payload.canvasData = payload.canvasDataJson
      delete payload.canvasDataJson
    }
    return patch(`/api/v1/sessions/${sessionId}/autosave`, payload)
  },

  async deleteSession(sessionId) {
    return del(`/api/v1/sessions/${sessionId}`)
  },

  async getSessionAnalysis(sessionId) {
    return get(`/api/v1/sessions/${sessionId}/analysis`)
  },

  async getOpenSessions() {
    return get('/api/v1/sessions/open')
  },

  // Analyses
  async getPatientAnalyses(patientId, { page = 0, size = 20 } = {}) {
    return get(`/api/v1/patients/${patientId}/analyses`, { page, size })
  },

  async createAnalysis({ sessionId, additionalSessionIds = [], template = null }) {
    return post('/api/v1/analyses', { sessionId, additionalSessionIds, template })
  },

  async refineAnalysis(analysisId, feedback = null) {
    return post(`/api/v1/analyses/${analysisId}/refine`, { feedback })
  },

  // Agenda
  async getAgendaEvents({ from, to } = {}) {
    if (!from || !to) {
      // fallback: busca do início do mês até 3 meses à frente
      // Backend exige ISO-8601 instant (ex: 2026-05-01T00:00:00.000Z), não só data
      const f = new Date(); f.setDate(1); f.setHours(0, 0, 0, 0)
      const t = new Date(); t.setMonth(t.getMonth() + 3); t.setHours(23, 59, 59, 999)
      from = f.toISOString()
      to = t.toISOString()
    }
    return get('/api/v1/agenda', { from, to })
  },

  async createAgendaEvent(data) {
    return post('/api/v1/agenda', data)
  },

  async updateAgendaEvent(id, data) {
    return patch(`/api/v1/agenda/${id}`, data)
  },

  async deleteAgendaEvent(id) {
    return del(`/api/v1/agenda/${id}`)
  },

  // Financial
  async getFinancialEvents({ page = 0, size = 50 } = {}) {
    return get('/api/v1/financial', { page, size })
  },

  async getFinancialSummary() {
    return get('/api/v1/financial/summary')
  },

  async createFinancialEvent(data) {
    return post('/api/v1/financial', data)
  },

  async updateFinancialEvent(id, data) {
    return patch(`/api/v1/financial/${id}`, data)
  },

  async deleteFinancialEvent(id) {
    // backend não expõe DELETE /financial — soft-delete via status:'cancelled'
    return patch(`/api/v1/financial/${id}`, { status: 'cancelled' })
  },

  // Forms
  async getPatientForms(patientId) {
    return get(`/api/v1/patients/${patientId}/forms`)
  },

  async getFormTemplates() {
    // Templates são estáticos no backend; retorna lista local
    return [
      { id: 'tpl-001', title: 'Anamnese inicial', category: 'Avaliação', fields: 12, description: 'Histórico completo do paciente.' },
      { id: 'tpl-002', title: 'TCLE — Consentimento Informado', category: 'Legal', fields: 5, description: 'Termo de consentimento livre e esclarecido.' },
      { id: 'tpl-003', title: 'BDI-II — Inventário Beck de Depressão', category: 'Escala validada', fields: 21, description: 'Escala de autorrelato com 21 itens.' },
      { id: 'tpl-004', title: 'BAI — Inventário Beck de Ansiedade', category: 'Escala validada', fields: 21, description: 'Avaliação de sintomas de ansiedade.' },
      { id: 'tpl-005', title: 'PHQ-9 — Triagem de Depressão', category: 'Escala validada', fields: 9, description: 'Instrumento rápido de triagem.' },
      { id: 'tpl-006', title: 'GAD-7 — Ansiedade Generalizada', category: 'Escala validada', fields: 7, description: 'Escala de triagem para TAG.' },
      { id: 'tpl-007', title: 'SRS — Session Rating Scale', category: 'Aliança terapêutica', fields: 4, description: 'Avaliação da aliança terapêutica.' },
      { id: 'tpl-008', title: 'PCL-5 — PTSD Checklist', category: 'Escala validada', fields: 20, description: 'Avaliação de sintomas de TEPT.' },
    ]
  },

  async createForm(data) {
    return post('/api/v1/forms', data)
  },

  async updateForm(id, data) {
    return patch(`/api/v1/forms/${id}`, data)
  },

  async deleteForm(id) {
    return del(`/api/v1/forms/${id}`)
  },

  // Insights
  async getInsights() {
    return get('/api/v1/insights')
  },

  // User profile
  async getUserProfile() {
    const data = await get('/api/v1/me')
    return normalizeUser(data)
  },

  async updateProfile(data) {
    const res = await patch('/api/v1/me', data)
    const user = normalizeUser(res)
    localStorage.setItem('psicoai_user', JSON.stringify(user))
    return user
  },

  async changePassword(currentPassword, newPassword) {
    return patch('/api/v1/me/password', { currentPassword, newPassword })
  },

  // Billing
  async createCheckoutSession({ planId, successUrl, cancelUrl, couponCode = null }) {
    return post('/api/v1/billing/checkout', { planId, successUrl, cancelUrl, couponCode })
  },

  async createBillingPortalSession({ returnUrl }) {
    return post('/api/v1/billing/portal', { returnUrl })
  },

  async validateCoupon(code, planId) {
    return post('/api/v1/billing/coupon/validate', { code: code.trim().toUpperCase(), planId })
  },

  // ── Mock-only features (sem endpoint backend ainda) ─────────────────────────
  // Lembretes, Teleatendimento e Relatórios são features futuras do backend.
  // Por ora retornam dados mock mesmo quando o backend está ativo.

  async getLembretes() {
    return [
      { id: 'rem-001', title: 'Confirmação de consulta — 24h antes', hoursBeforeSession: 24, channels: ['whatsapp', 'email'], enabled: true, template: 'Olá, {{nome}}! Lembrando da sua sessão amanhã, {{dia}} de {{mes}}, às {{hora}}.' },
      { id: 'rem-002', title: 'Lembrete no dia da sessão — 2h antes', hoursBeforeSession: 2, channels: ['whatsapp'], enabled: true, template: 'Oi, {{nome}}! Sua sessão é hoje às {{hora}}.' },
      { id: 'rem-003', title: 'Cobrança — 3 dias após sessão sem pagamento', hoursBeforeSession: -72, channels: ['whatsapp'], enabled: false, template: 'Olá, {{nome}}! Passando para lembrar do pagamento da sessão do dia {{dia}}.' },
      { id: 'rem-004', title: 'Pesquisa de satisfação — 1 dia após sessão', hoursBeforeSession: -24, channels: ['whatsapp'], enabled: false, template: 'Oi, {{nome}}! Avalie nossa sessão: {{link}}' },
    ]
  },

  async updateLembrete(id, data) {
    return { id, ...data }
  },

  async saveLembreteTemplate(id, template) {
    return { id, template }
  },

  async getTeleSessions() {
    return []
  },

  async createTeleSession(data) {
    return { id: 'ts-' + Date.now(), ...data, status: 'scheduled', createdAt: new Date().toISOString() }
  },

  async updateTeleSession(id, data) {
    return { id, ...data }
  },

  async deleteTeleSession(id) { // eslint-disable-line no-unused-vars
  },

  async generateReport({ patientId, type, sections }) {
    // Relatórios serão gerados via IA no backend em v2
    // Por ora: estrutura básica sem conteúdo IA
    const patient = await api.getPatient(patientId)
    const meta = {
      psychiatrist: { label: 'Encaminhamento Psiquiátrico', audience: 'Psiquiatra' },
      evolution:    { label: 'Relatório de Evolução', audience: 'Arquivo / Supervisão' },
      summary:      { label: 'Resumo Clínico', audience: 'Paciente' },
      full:         { label: 'Prontuário Completo', audience: 'Arquivo / Transferência' },
    }[type] || { label: 'Relatório', audience: 'Arquivo' }

    const report = {
      id: 'rpt-' + Date.now(),
      patientId,
      patientName: patient.name,
      type,
      typeLabel: meta.label,
      audience: meta.audience,
      sections: [
        { id: 'header', label: 'Relatório', text: `Paciente: ${patient.name}\nGerado em: ${new Date().toLocaleDateString('pt-BR')}` },
        { id: 'note', label: null, text: 'Geração automática de relatório disponível em breve via backend.' },
      ],
      sentChannels: [],
      createdAt: new Date().toISOString(),
    }
    return report
  },

  async getPatientReports() {
    return []
  },

  async sendReport({ channels }) {
    return { success: true, sentAt: new Date().toISOString(), channels }
  },

  // Anotações — listagem global (backend endpoint a ser implementado)
  async getRecentAnnotations({ search = '', patientId = '' } = {}) {
    if (patientId) {
      const res = await get(`/api/v1/patients/${patientId}/sessions`, { page: 0, size: 50 })
      return (res.content || []).map(s => ({
        ...s,
        patientId,
        canvasDataJson: s.type === 'canvas' ? (s.canvasData ?? true) : null,
      }))
    }
    return [] // listagem global requer endpoint futuro
  },

  // Documents
  async getPatientDocuments(patientId) {
    return get(`/api/v1/patients/${patientId}/documents`)
  },

  async uploadDocument(patientId, file, category = 'outros', name = null) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('category', category)
    if (name) fd.append('name', name)
    return reqMultipart('POST', `/api/v1/patients/${patientId}/documents`, fd)
  },

  async downloadDocument(patientId, docId) {
    return reqBlob('GET', `/api/v1/patients/${patientId}/documents/${docId}/download`)
  },

  async deleteDocument(patientId, docId) {
    return del(`/api/v1/patients/${patientId}/documents/${docId}`)
  },

  async exportProntuarioPdf(patientId) {
    return reqBlob('GET', `/api/v1/patients/${patientId}/documents/export/prontuario`)
  },

  async exportRelatorioPdf(patientId, type = 'encaminhamento') {
    return reqBlob('GET', `/api/v1/patients/${patientId}/documents/export/relatorio?type=${type}`)
  },

  // CSV import
  async importPatients(file) {
    const fd = new FormData()
    fd.append('file', file)
    return reqMultipart('POST', '/api/v1/patients/import', fd)
  },

  // ── Google OAuth / Calendar / Meet ───────────────────────────────────────
  async getGoogleStatus() {
    return get('/api/v1/google/status')
  },

  async getGoogleAuthUrl() {
    return get('/api/v1/google/auth-url')
  },

  async disconnectGoogle() {
    return del('/api/v1/google/disconnect')
  },

  async setGoogleCalendarSync(enabled) {
    return patch('/api/v1/google/calendar-sync', { enabled })
  },

  async createGoogleMeet(patientName) {
    return post('/api/v1/google/meet', { patientName })
  },

  async getGoogleCalendarEvents(from, to) {
    return get('/api/v1/google/calendar-events', { from, to })
  },
}

export default api
