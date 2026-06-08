/**
 * realApi.js — Cliente HTTP para o backend PsicoNotes.
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

const BASE = import.meta.env.VITE_API_BASE_URL // e.g. https://api.psicnotes.com

// ── Token helpers ──────────────────────────────────────────────────────────────

const getToken    = ()  => localStorage.getItem('psicoai_token')
const getRefresh  = ()  => localStorage.getItem('psicoai_refresh')
const setTokens   = (at, rt) => {
  localStorage.setItem('psicoai_token', at)
  if (rt) localStorage.setItem('psicoai_refresh', rt)
}
// Chaves que NÃO devem ser removidas no logout — persistem entre sessões no mesmo dispositivo
const PERSIST_KEYS = new Set(['psicoai_lgpd_consent', 'psicoai_onboarding_seen'])

const clearTokens = () => {
  // Remove auth + TODOS os dados clínicos (canvas, quicknote, session ativa)
  // Preserva consentimento LGPD — deve ser solicitado apenas 1× por dispositivo.
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith('psicoai_') && !PERSIST_KEYS.has(k)) keysToRemove.push(k)
  }
  keysToRemove.forEach(k => localStorage.removeItem(k))
}

// ── Token refresh (singleton) ─────────────────────────────────────────────────

let _refreshPromise = null

async function doRefresh() {
  const rt = getRefresh()
  if (!rt) throw new Error('no_refresh_token')

  // Retry 1× após 3s — Railway reinicia em ~2s durante deploys.
  // Sem retry, o usuário seria deslogado por um 503 transitório.
  // 401/403 no refresh = token genuinamente inválido → não retentar, deslogar.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 3000))

    let res
    try {
      res = await fetch(`${BASE}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      })
    } catch {
      if (attempt === 0) continue          // rede caiu momentaneamente — tenta de novo
      throw new Error('network_error')     // segunda falha → propaga sem deslogar
    }

    // 401/403 = refresh token inválido ou expirado → deslogar (não retentar)
    if (res.status === 401 || res.status === 403) throw new Error('refresh_failed')
    // 5xx = servidor temporariamente indisponível → tenta de novo na 1ª vez
    if (!res.ok) {
      if (attempt === 0) continue
      throw new Error('server_error')      // segunda falha → propaga sem deslogar
    }

    const data = await res.json()
    setTokens(data.accessToken, data.refreshToken)
    if (data.user) localStorage.setItem('psicoai_user', JSON.stringify(normalizeUser(data.user)))
    return data.accessToken
  }
  // Nunca alcançado normalmente, mas satisfaz o tipo de retorno do TS
  throw new Error('server_error')
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

// FE-004: validação de redirect URLs — previne open redirect via backend comprometido
const ALLOWED_REDIRECT_ORIGINS = new Set([
  'https://checkout.stripe.com',
  'https://billing.stripe.com',
  'https://accounts.google.com',
  'https://oauth2.googleapis.com',
])

export function assertSafeRedirectUrl(url) {
  try {
    const parsed = new URL(url)
    if (!ALLOWED_REDIRECT_ORIGINS.has(parsed.origin)) {
      throw new Error(`Redirect bloqueado: domínio não autorizado (${parsed.origin})`)
    }
    if (parsed.protocol !== 'https:') {
      throw new Error('Redirect bloqueado: apenas HTTPS é permitido')
    }
  } catch (e) {
    if (e.message.startsWith('Redirect bloqueado')) throw e
    throw new Error('Redirect bloqueado: URL inválida')
  }
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

  async forgotPassword(email) {
    return post('/api/v1/auth/forgot-password', { email })
  },

  async resetPassword(token, newPassword) {
    return post('/api/v1/auth/reset-password', { token, newPassword })
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
  async getPatients({ search, status, active, page = 0, size = 20 } = {}) {
    return get('/api/v1/patients', { search, status, active, page, size })
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
    // Mapeia campos do formulário (nome/abordagem/…) para os campos da API (name/approach/…)
    // Suporta tanto form keys (CadastroModal) quanto API keys diretas.
    const body = {
      name:       data.name       || data.nome       || undefined,
      birthDate:  data.birthDate  || data.dataNasc   || undefined,
      gender:     data.gender     || data.genero      || undefined,
      email:      data.email      ?? undefined,
      phone:      data.phone      || data.telefone   || undefined,
      complaint:  data.complaint  || data.queixa     || undefined,
      history:    data.history    || data.historico  || undefined,
      medication: data.medication || data.medicacao  || undefined,
      approach:   data.approach   || data.abordagem  || undefined,
      frequency:  data.frequency  || data.frequencia || undefined,
      payment:    data.payment    || data.pagamento  || undefined,
      sessionValue: data.sessionValue !== undefined
        ? data.sessionValue
        : (data.valor !== undefined && data.valor !== '' ? Number(data.valor) : undefined),
      cid:        data.cid        ?? undefined,
      active:               data.active               !== undefined ? Boolean(data.active) : undefined,
      recurringDayOfWeek:   data.recurringDayOfWeek  !== undefined ? (data.recurringDayOfWeek  ? Number(data.recurringDayOfWeek)  : null) : undefined,
      recurringTime:        data.recurringTime        !== undefined ? (data.recurringTime        || null) : undefined,
      recurringDurationMin: data.recurringDurationMin !== undefined ? (data.recurringDurationMin ? Number(data.recurringDurationMin) : null) : undefined,
      billingType:          data.billingType          !== undefined ? (data.billingType          || null) : undefined,
      monthlyValue:         data.monthlyValue         !== undefined ? (data.monthlyValue         ? Number(data.monthlyValue)         : null) : undefined,
    }
    // Remove undefined — PATCH deve enviar apenas campos que mudaram
    const clean = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined))
    return patch(`/api/v1/patients/${id}`, clean)
  },

  async deletePatient(id) {
    return del(`/api/v1/patients/${id}`)
  },

  // ── Notes (caderno do paciente) ───────────────────────────────────────────
  // Modelo "1 caderno por paciente": cada página é uma Note. As funções com
  // nome "*Session" são adaptadores legados que apontam para /notes — a UI
  // continua chamando os nomes antigos enquanto migra para os nomes "*Note".

  // Normaliza uma Note do backend para o formato que a UI espera (compat sessão)
  _noteToSession(n) {
    if (!n) return n
    return {
      ...n,
      type: n.contentType ?? n.type ?? 'text',
      sessionDate: n.noteDate ?? n.sessionDate ?? null,
      canvasDataJson: (n.contentType === 'canvas' || n.type === 'canvas') ? (n.canvasData ?? null) : null,
      notePreview: n.preview ?? n.notePreview ?? null,
      num: n.position != null ? `P${n.position + 1}` : (n.num ?? null),
      status: 'finished',
      statusLabel: 'Anotação',
    }
  },

  async getPatientNotes(patientId, { page = 0, size = 100 } = {}) {
    const res = await get(`/api/v1/patients/${patientId}/notes`, { page, size })
    if (res?.content) res.content = res.content.map(n => this._noteToSession(n))
    return res
  },
  async getNote(noteId) { return this._noteToSession(await get(`/api/v1/notes/${noteId}`)) },
  async createNote(patientId, data = {}) {
    return this._noteToSession(await post(`/api/v1/patients/${patientId}/notes`, {
      contentType: data.contentType ?? data.type ?? 'text',
      noteDate: data.noteDate ?? data.sessionDate ?? null,
      title: data.title ?? null,
    }))
  },
  async autosaveNote(noteId, data) {
    const payload = {
      textContent: data.textContent,
      htmlContent: data.htmlContent,
      canvasData: data.canvasData ?? data.canvasDataJson,
      imageBase64: data.imageBase64,
    }
    return this._noteToSession(await patch(`/api/v1/notes/${noteId}/autosave`, payload))
  },
  async updateNote(noteId, data) {
    return this._noteToSession(await patch(`/api/v1/notes/${noteId}`, {
      noteDate: data.noteDate ?? data.sessionDate,
      title: data.title,
    }))
  },
  async deleteNote(noteId) { return del(`/api/v1/notes/${noteId}`) },
  async reorderNotes(patientId, items) {
    return patch(`/api/v1/patients/${patientId}/notes/reorder`, { items })
  },
  async getNoteAnalysis(noteId) { return get(`/api/v1/notes/${noteId}/analysis`) },

  // ── Adaptadores legados (nome "*Session" → endpoints /notes) ───────────────
  async getPatientSessions(patientId, opts) { return this.getPatientNotes(patientId, opts) },
  async getSession(noteId) { return this.getNote(noteId) },
  async getTodaySessions() { return [] },             // conceito não existe mais (usar agenda)
  async getOpenSessions() { return [] },              // sem open/finished em anotações
  async createSession(data) { return this.createNote(data.patientId, data) },
  async finishSession(noteId, data) {
    // Anotação é sempre viva — "finish" vira autosave; data clínica via updateNote
    const saved = await this.autosaveNote(noteId, data)
    if (data?.sessionDate || data?.noteDate) {
      try { await this.updateNote(noteId, { noteDate: data.sessionDate ?? data.noteDate }) } catch {}
    }
    return saved
  },
  async autosaveSession(noteId, data) { return this.autosaveNote(noteId, data) },
  async deleteSession(noteId) { return this.deleteNote(noteId) },
  async getSessionAnalysis(noteId) { return this.getNoteAnalysis(noteId) },

  // Analyses
  async getAnalysis(analysisId) {
    return get(`/api/v1/analyses/${analysisId}`)
  },

  async getPatientAnalyses(patientId, { page = 0, size = 20 } = {}) {
    return get(`/api/v1/patients/${patientId}/analyses`, { page, size })
  },

  async createAnalysis({ sessionId, noteIds, patientId, additionalSessionIds = [], scope = null, template = null }) {
    // Novo contrato: análise por anotações. Mapeia chamadas legadas (sessionId)
    // para noteIds, mantendo compatibilidade com call sites antigos.
    const ids = noteIds ?? [sessionId, ...additionalSessionIds].filter(Boolean)
    // POST retorna 202 imediatamente com { id, status: "processing" }
    const initial = await post('/api/v1/analyses', { patientId, noteIds: ids, scope, template })

    // Se já veio completo (análise muito rápida ou resposta legada), retorna direto
    if (!initial?.id || initial.status === 'completed' || !initial.status) return initial

    // Polling: verifica a cada 3 segundos por até 3 minutos
    const analysisId = initial.id
    for (let attempt = 0; attempt < 60; attempt++) {
      await new Promise(r => setTimeout(r, 3000))
      const status = await get(`/api/v1/analyses/${analysisId}/status`).catch(() => null)
      if (!status) continue  // erro de rede transitório — tenta de novo
      if (status.status === 'completed') return get(`/api/v1/analyses/${analysisId}`)
      if (status.status === 'failed') {
        throw new Error(status.errorMessage || 'Falha na análise clínica. Tente novamente.')
      }
      // status === 'processing' → continua polling
    }
    throw new Error('Tempo de análise excedido. O servidor pode estar sobrecarregado. Tente novamente em instantes.')
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
    // Busca dados do paciente e análises para montar o relatório
    const [patient, sessionsRes, analysesRes] = await Promise.all([
      api.getPatient(patientId).catch(() => ({ name: 'Paciente', id: patientId })),
      api.getPatientSessions(patientId, { size: 10 }).catch(() => ({ content: [] })),
      api.getPatientAnalyses(patientId, { size: 5 }).catch(() => ({ content: [] })),
    ])

    const meta = {
      psychiatrist: { label: 'Encaminhamento Psiquiátrico', audience: 'Psiquiatra' },
      evolution:    { label: 'Relatório de Evolução',       audience: 'Arquivo / Supervisão' },
      summary:      { label: 'Resumo para o Paciente',      audience: 'Paciente' },
      full:         { label: 'Prontuário Completo',          audience: 'Arquivo / Transferência' },
    }[type] || { label: 'Relatório', audience: 'Arquivo' }

    const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
    const today = new Date().toLocaleDateString('pt-BR')

    const p = patient
    const sessionList = sessionsRes.content || []
    const analysisList = analysesRes.content || []
    const latestAnalysis = analysisList[0] || null

    // ── Seções do relatório ───────────────────────────────────────────────────
    const built = []

    // Dados clínicos
    if (sections?.clinical !== false) {
      const lines = [
        `Nome: ${p.name || '—'}`,
        p.birthDate ? `Data de nascimento: ${fmt(p.birthDate)}` : null,
        p.gender    ? `Gênero: ${p.gender}` : null,
        p.cid       ? `Hipótese diagnóstica: ${p.cid} (hipótese CID-11/DSM-5)` : null,
        '',
        `Queixa principal: ${p.complaint || 'Não informado'}`,
        p.history   ? `Histórico: ${p.history}` : null,
        p.medication ? `Medicamentos em uso: ${p.medication}` : null,
        '',
        `Abordagem terapêutica: ${p.approach || p.abordagem || 'Não informado'}`,
        p.frequency ? `Frequência de atendimento: ${p.frequency}` : null,
      ].filter(Boolean).join('\n')
      built.push({ id: 'clinical', label: 'Dados Clínicos', text: lines })
    }

    // Histórico de sessões
    if (sections?.sessions !== false && sessionList.length > 0) {
      const sessText = sessionList.slice(0, 6).map((s, i) => {
        const date = fmt(s.sessionDate || s.finishedAt || s.createdAt)
        const preview = s.summary || s.notePreview || (s.type === 'canvas' ? 'Anotação em canvas' : 'Sem resumo')
        return `Sessão ${s.num || (i + 1)} — ${date}\n${preview.slice(0, 200)}${preview.length > 200 ? '…' : ''}`
      }).join('\n\n')
      built.push({ id: 'sessions', label: 'Histórico de Sessões', text: `Total de ${sessionList.length} sessões registradas.\n\n${sessText}` })
    }

    // Hipóteses e padrões (se houver análise)
    if (sections?.hypotheses !== false && latestAnalysis) {
      const hypoText = latestAnalysis.hypotheses?.length
        ? latestAnalysis.hypotheses.map(h => `• ${h.label || h.code} — probabilidade ${Math.round((h.probability || 0) * 100)}%`).join('\n')
        : 'Análise IA realizada. Consulte os Insights para detalhes.'
      built.push({ id: 'hypotheses', label: 'Hipóteses Diagnósticas (IA)', text: hypoText })
    }

    if (sections?.patterns !== false && latestAnalysis?.patterns?.length) {
      const patternsText = latestAnalysis.patterns.map(pt => `• ${pt.label || pt}`).join('\n')
      built.push({ id: 'patterns', label: 'Padrões Identificados', text: patternsText })
    }

    // Assinatura profissional
    built.push({
      id: 'signature',
      label: null,
      isSignature: true,
      text: `Gerado em ${today} via PsicoNotes\n\nPsicólogo(a) responsável`,
    })

    // Fallback se não construiu nenhuma seção
    if (built.length <= 1) {
      built.unshift({
        id: 'intro',
        label: 'Sumário',
        text: `Relatório gerado em ${today} para ${p.name}.\nNenhuma seção selecionada ou dados insuficientes — cadastre sessões e análises IA para enriquecer o documento.`,
      })
    }

    return {
      id: 'rpt-' + Date.now(),
      patientId,
      patientName: p.name,
      type,
      typeLabel: meta.label,
      audience: meta.audience,
      sections: built,
      sentChannels: [],
      createdAt: new Date().toISOString(),
    }
  },

  async getPatientReports() {
    return []
  },

  async sendReport({ channels }) {
    return { success: true, sentAt: new Date().toISOString(), channels }
  },

  // Anotações — listagem global (backend endpoint a ser implementado)
  async getRecentAnnotations({ search = '', patientId = '' } = {}) {
    const normalize = (s) => ({
      ...s,
      canvasDataJson: s.type === 'canvas' ? (s.canvasData ?? null) : null,
    })
    if (patientId) {
      const res = await get(`/api/v1/patients/${patientId}/sessions`, { page: 0, size: 50 })
      return (res.content || []).map(normalize)
    }
    // Global: usa o novo endpoint /api/v1/sessions/finished
    const res = await get('/api/v1/sessions/finished', { page: 0, size: 100 })
    return (res?.content || []).map(normalize)
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

  // ── Feedback ──────────────────────────────────────────────────────────────
  async submitFeedback({ type, message, context }) {
    return post('/api/v1/feedback', { type, message, context })
  },
}

export default api
