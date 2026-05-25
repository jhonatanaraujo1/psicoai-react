/**
 * supabaseApi.js — Camada de dados via Supabase (Postgres + RLS).
 *
 * Interface idêntica à mockApi.api e realApi.api — troca transparente.
 * RLS garante que cada psicólogo só acessa seus próprios dados (IDOR impossível).
 *
 * Endpoints de IA (análises Claude) ainda são roteados via Railway/Kotlin.
 * Tudo mais (pacientes, sessões, agenda, financeiro) vai direto no Supabase.
 */

import { supabase } from './supabase.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Não autenticado')
  return session.user.id
}

function paginate(query, { page = 0, size = 20 } = {}) {
  const from = page * size
  const to   = from + size - 1
  return query.range(from, to)
}

function throwSupabaseError(error, context = '') {
  console.error(`[PsicoAI] Supabase error${context ? ' — ' + context : ''}:`, error)
  throw new Error(error.message || 'Erro ao acessar o banco de dados.')
}

// ── normalizers ──────────────────────────────────────────────────────────────

function normalizePatient(p) {
  return {
    id:           p.id,
    name:         p.name,
    email:        p.email        || null,
    phone:        p.phone        || null,
    birthDate:    p.birth_date   || null,
    cpf:          p.cpf          || null,
    address:      p.address      || null,
    insurance:    p.insurance    || null,
    cid:          p.cid          || null,
    cidLabel:     p.cid_label    || null,
    notes:        p.notes        || null,
    sessionValue: p.session_value ?? null,
    sessionDay:   p.session_day  || null,
    sessionTime:  p.session_time || null,
    status:       p.status       || 'active',
    createdAt:    p.created_at,
    updatedAt:    p.updated_at,
    // Frontend compat fields
    statusColor: (() => {
      if (p.status === 'inactive' || p.status === 'archived') return 'gray'
      return 'green'
    })(),
  }
}

function normalizeSession(s) {
  return {
    id:                 s.id,
    patientId:          s.patient_id,
    appointmentId:      s.appointment_id  || null,
    type:               s.type            || 'text',
    noteType:           s.note_type       || null,
    status:             s.status          || 'completed',
    textContent:        s.text_content    || null,
    htmlContent:        s.html_content    || null,
    canvasDataJson:     s.canvas_data_json ?? null,
    canvasTextContent:  s.canvas_text_content || null,
    canvasImageUrl:     s.canvas_image_url || null,
    durationSeconds:    s.duration_seconds ?? null,
    meetLink:           s.meet_link       || null,
    startedAt:          s.started_at,
    finishedAt:         s.finished_at     || null,
    createdAt:          s.created_at,
    updatedAt:          s.updated_at,
    // Frontend compat
    date: s.started_at?.slice(0, 10) || s.created_at?.slice(0, 10),
  }
}

function normalizeAnalysis(a) {
  return {
    id:              a.id,
    patientId:       a.patient_id,
    sessionIds:      a.session_ids || [],
    status:          a.status      || 'pending',
    template:        a.template    || 'standard',
    summary:         a.summary     || null,
    hypotheses:      a.hypotheses  || [],
    alerts:          a.alerts      || [],
    patterns:        a.patterns    || [],
    recommendations: a.recommendations || [],
    fullResult:      a.full_result || null,
    errorMessage:    a.error_message || null,
    createdAt:       a.created_at,
    updatedAt:       a.updated_at,
  }
}

function normalizeAppointment(a) {
  return {
    id:              a.id,
    patientId:       a.patient_id,
    date:            a.date,
    time:            a.time,
    durationMinutes: a.duration_minutes || 50,
    type:            a.type             || 'presencial',
    platform:        a.platform         || null,
    meetLink:        a.meet_link        || null,
    status:          a.status           || 'scheduled',
    notes:           a.notes            || null,
    createdAt:       a.created_at,
    // compat fields esperados pelo Agenda.jsx
    title:           a.patient_name || 'Paciente',
    start:           `${a.date}T${a.time}`,
  }
}

// ── API ───────────────────────────────────────────────────────────────────────

export const api = {

  // ── Dashboard ───────────────────────────────────────────────────────────────
  async getDashboard() {
    const userId = await getCurrentUserId()
    const today  = new Date().toISOString().slice(0, 10)

    // Pacientes ativos
    const { count: totalPatients, error: e1 } = await supabase
      .from('patients')
      .select('id', { count: 'exact', head: true })
      .eq('psychologist_id', userId)
      .eq('status', 'active')
    if (e1) throwSupabaseError(e1, 'getDashboard/patients')

    // Sessões hoje
    const { data: todaySessions, error: e2 } = await supabase
      .from('appointments')
      .select('*, patients(name)')
      .eq('psychologist_id', userId)
      .eq('date', today)
      .order('time', { ascending: true })
    if (e2) throwSupabaseError(e2, 'getDashboard/appointments')

    // Análises pendentes
    const { count: pendingAnalyses, error: e3 } = await supabase
      .from('analyses')
      .select('id', { count: 'exact', head: true })
      .eq('psychologist_id', userId)
      .in('status', ['pending', 'processing'])
    if (e3) throwSupabaseError(e3, 'getDashboard/analyses')

    return {
      totalPatients: totalPatients || 0,
      sessionsToday: (todaySessions || []).map(a => ({
        id:          a.id,
        patientId:   a.patient_id,
        patientName: a.patients?.name || 'Paciente',
        time:        a.time,
        type:        a.type,
        status:      a.status,
      })),
      pendingAnalyses: pendingAnalyses || 0,
    }
  },

  // ── Patients ─────────────────────────────────────────────────────────────────
  async getPatients({ search = '', status = '', page = 0, size = 20 } = {}) {
    const userId = await getCurrentUserId()
    let query = supabase
      .from('patients')
      .select('*', { count: 'exact' })
      .eq('psychologist_id', userId)
      .order('name', { ascending: true })

    if (search) query = query.ilike('name', `%${search}%`)
    if (status) query = query.eq('status', status)

    const { data, count, error } = await paginate(query, { page, size })
    if (error) throwSupabaseError(error, 'getPatients')

    return {
      content: (data || []).map(normalizePatient),
      totalElements: count || 0,
      totalPages: Math.ceil((count || 0) / size),
      page,
    }
  },

  async getPatient(id) {
    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throwSupabaseError(error, 'getPatient')
    return normalizePatient(data)
  },

  async getPatientSummary(id) {
    // Retorna dados do paciente + contagem de sessões + última análise
    const [{ data: patient, error: e1 }, { count: sessionsCount }, { data: lastAnalysis }] = await Promise.all([
      supabase.from('patients').select('*').eq('id', id).single(),
      supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('patient_id', id),
      supabase.from('analyses').select('*').eq('patient_id', id).order('created_at', { ascending: false }).limit(1),
    ])
    if (e1) throwSupabaseError(e1, 'getPatientSummary')
    return {
      ...normalizePatient(patient),
      sessionsCount: sessionsCount || 0,
      lastAnalysis:  lastAnalysis?.[0] ? normalizeAnalysis(lastAnalysis[0]) : null,
    }
  },

  async createPatient(data) {
    const userId = await getCurrentUserId()
    const { data: created, error } = await supabase
      .from('patients')
      .insert({
        psychologist_id: userId,
        name:          data.name,
        email:         data.email         || null,
        phone:         data.phone         || null,
        birth_date:    data.birthDate     || null,
        cpf:           data.cpf           || null,
        address:       data.address       || null,
        insurance:     data.insurance     || null,
        cid:           data.cid           || null,
        cid_label:     data.cidLabel      || null,
        notes:         data.notes         || null,
        session_value: data.sessionValue  ? Number(data.sessionValue) : null,
        session_day:   data.sessionDay    || null,
        session_time:  data.sessionTime   || null,
        status:        'active',
      })
      .select()
      .single()
    if (error) throwSupabaseError(error, 'createPatient')
    return normalizePatient(created)
  },

  async updatePatient(id, data) {
    const patch = {}
    if (data.name         !== undefined) patch.name          = data.name
    if (data.email        !== undefined) patch.email         = data.email
    if (data.phone        !== undefined) patch.phone         = data.phone
    if (data.birthDate    !== undefined) patch.birth_date    = data.birthDate
    if (data.cpf          !== undefined) patch.cpf           = data.cpf
    if (data.address      !== undefined) patch.address       = data.address
    if (data.insurance    !== undefined) patch.insurance     = data.insurance
    if (data.cid          !== undefined) patch.cid           = data.cid
    if (data.cidLabel     !== undefined) patch.cid_label     = data.cidLabel
    if (data.notes        !== undefined) patch.notes         = data.notes
    if (data.sessionValue !== undefined) patch.session_value = data.sessionValue ? Number(data.sessionValue) : null
    if (data.sessionDay   !== undefined) patch.session_day   = data.sessionDay
    if (data.sessionTime  !== undefined) patch.session_time  = data.sessionTime
    if (data.status       !== undefined) patch.status        = data.status

    const { data: updated, error } = await supabase
      .from('patients')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throwSupabaseError(error, 'updatePatient')
    return normalizePatient(updated)
  },

  async deletePatient(id) {
    // Soft delete — mantém dados no banco (LGPD: retenção mínima 5 anos para dados clínicos)
    const { error } = await supabase
      .from('patients')
      .update({ status: 'archived' })
      .eq('id', id)
    if (error) throwSupabaseError(error, 'deletePatient')
    return null
  },

  // CSV import — processa no frontend, insere em batch
  async importPatients(file) {
    const userId  = await getCurrentUserId()
    const text    = await file.text()
    const lines   = text.split('\n').filter(l => l.trim())
    if (lines.length < 2) throw new Error('Arquivo CSV vazio ou sem dados.')

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''))
    const rows    = lines.slice(1)

    const records = []
    const errors  = []

    for (const [i, line] of rows.entries()) {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const row    = Object.fromEntries(headers.map((h, j) => [h, values[j] || '']))

      if (!row.name && !row.nome) {
        errors.push(`Linha ${i + 2}: nome é obrigatório`)
        continue
      }
      records.push({
        psychologist_id: userId,
        name:   row.name  || row.nome,
        email:  row.email || null,
        phone:  row.phone || row.telefone || null,
        status: 'active',
      })
    }

    if (records.length === 0) throw new Error('Nenhum paciente válido no arquivo.')

    const { error } = await supabase.from('patients').insert(records)
    if (error) throwSupabaseError(error, 'importPatients')

    return {
      imported: records.length,
      skipped:  rows.length - records.length - errors.length,
      errors,
    }
  },

  // ── Sessions ──────────────────────────────────────────────────────────────────
  async getPatientSessions(patientId, { page = 0, size = 20 } = {}) {
    let query = supabase
      .from('sessions')
      .select('*', { count: 'exact' })
      .eq('patient_id', patientId)
      .order('started_at', { ascending: false })

    const { data, count, error } = await paginate(query, { page, size })
    if (error) throwSupabaseError(error, 'getPatientSessions')
    return {
      content: (data || []).map(normalizeSession),
      totalElements: count || 0,
      totalPages: Math.ceil((count || 0) / size),
      page,
    }
  },

  async getTodaySessions() {
    const userId = await getCurrentUserId()
    const today  = new Date().toISOString().slice(0, 10)
    const { data, error } = await supabase
      .from('sessions')
      .select('*, patients(name)')
      .eq('psychologist_id', userId)
      .gte('started_at', `${today}T00:00:00`)
      .lte('started_at', `${today}T23:59:59`)
      .order('started_at', { ascending: false })
    if (error) throwSupabaseError(error, 'getTodaySessions')
    return (data || []).map(s => ({ ...normalizeSession(s), patientName: s.patients?.name }))
  },

  async createSession(data) {
    const userId = await getCurrentUserId()
    const { data: created, error } = await supabase
      .from('sessions')
      .insert({
        psychologist_id: userId,
        patient_id:      data.patientId,
        appointment_id:  data.appointmentId || null,
        type:            data.type          || 'text',
        note_type:       data.noteType      || null,
        status:          'in_progress',
        meet_link:       data.meetLink      || null,
      })
      .select()
      .single()
    if (error) throwSupabaseError(error, 'createSession')
    return normalizeSession(created)
  },

  async finishSession(sessionId, data) {
    const patch = {
      status:               'completed',
      finished_at:          new Date().toISOString(),
      duration_seconds:     data.durationSeconds ?? null,
      text_content:         data.textContent     ?? null,
      html_content:         data.htmlContent     ?? null,
      canvas_text_content:  data.canvasTextContent ?? null,
    }

    // canvas_data_json é JSONB — não salvar base64 de imagem aqui
    if (data.canvasDataJson) patch.canvas_data_json = data.canvasDataJson

    // canvas_image_url: upload para storage
    if (data.imageBase64 && sessionId) {
      try {
        const base64 = data.imageBase64.replace(/^data:image\/\w+;base64,/, '')
        const bytes  = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const { data: { session } } = await supabase.auth.getSession()
        const path   = `${session.user.id}/${sessionId}.png`
        const { error: uploadError } = await supabase.storage
          .from('canvas-images')
          .upload(path, bytes, { contentType: 'image/png', upsert: true })
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('canvas-images').getPublicUrl(path)
          patch.canvas_image_url = urlData?.publicUrl || null
        }
      } catch (e) {
        console.warn('[PsicoAI] canvas image upload failed:', e)
      }
    }

    const { data: updated, error } = await supabase
      .from('sessions')
      .update(patch)
      .eq('id', sessionId)
      .select()
      .single()
    if (error) throwSupabaseError(error, 'finishSession')
    return normalizeSession(updated)
  },

  async autosaveSession(sessionId, data) {
    if (!sessionId) return null
    const patch = {}
    if (data.textContent     !== undefined) patch.text_content     = data.textContent
    if (data.htmlContent     !== undefined) patch.html_content     = data.htmlContent
    if (data.canvasDataJson  !== undefined) patch.canvas_data_json = data.canvasDataJson

    const { error } = await supabase.from('sessions').update(patch).eq('id', sessionId)
    if (error) console.warn('[PsicoAI] autosave error:', error.message)
    return null
  },

  async deleteSession(sessionId) {
    // Hard delete apenas para sessões in_progress sem conteúdo
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'abandoned' })
      .eq('id', sessionId)
    if (error) throwSupabaseError(error, 'deleteSession')
  },

  // ── Analyses ──────────────────────────────────────────────────────────────────
  async getPatientAnalyses(patientId, { page = 0, size = 20 } = {}) {
    let query = supabase
      .from('analyses')
      .select('*', { count: 'exact' })
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })

    const { data, count, error } = await paginate(query, { page, size })
    if (error) throwSupabaseError(error, 'getPatientAnalyses')
    return {
      content: (data || []).map(normalizeAnalysis),
      totalElements: count || 0,
      totalPages: Math.ceil((count || 0) / size),
      page,
    }
  },

  async createAnalysis({ sessionId, additionalSessionIds = [], template = null, patientId }) {
    // 1. Cria o registro 'pending' no Supabase
    const userId = await getCurrentUserId()
    const sessionIds = [sessionId, ...additionalSessionIds].filter(Boolean)

    const { data: record, error: insertError } = await supabase
      .from('analyses')
      .insert({
        psychologist_id: userId,
        patient_id:      patientId,
        session_ids:     sessionIds,
        status:          'pending',
        template:        template || 'standard',
      })
      .select()
      .single()
    if (insertError) throwSupabaseError(insertError, 'createAnalysis/insert')

    // 2. Dispara análise via Railway/Kotlin (AI pipeline) — fire & poll
    //    O Railway atualiza o registro Supabase diretamente com service_role key.
    const railwayBase = import.meta.env.VITE_API_BASE_URL
    if (railwayBase) {
      try {
        await fetch(`${railwayBase}/api/v1/analyses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({ analysisId: record.id, sessionIds, patientId, template }),
        })
      } catch (e) {
        console.warn('[PsicoAI] Railway análise dispatch error:', e)
      }
    }

    // 3. Poll até status = 'ready' | 'failed' (máx 60s)
    const MAX_ATTEMPTS = 30
    const INTERVAL     = 2000
    let attempt = 0
    while (attempt < MAX_ATTEMPTS) {
      await new Promise(r => setTimeout(r, INTERVAL))
      const { data: current } = await supabase
        .from('analyses')
        .select('*')
        .eq('id', record.id)
        .single()

      if (!current) break
      if (current.status === 'ready')  return normalizeAnalysis(current)
      if (current.status === 'failed') throw new Error(current.error_message || 'Análise falhou. Tente novamente.')
      attempt++
    }

    throw new Error('Análise está demorando mais que o esperado. Tente novamente em instantes.')
  },

  async refineAnalysis(analysisId, feedback = null) {
    const railwayBase = import.meta.env.VITE_API_BASE_URL
    if (!railwayBase) {
      // fallback mock — sem Railway
      return { id: analysisId, status: 'ready', summary: 'Refinamento não disponível no modo mock.' }
    }
    const session = (await supabase.auth.getSession()).data.session
    const res = await fetch(`${railwayBase}/api/v1/analyses/${analysisId}/refine`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body:    JSON.stringify({ feedback }),
    })
    if (!res.ok) throw new Error(`Erro ao refinar análise: ${res.status}`)
    const data = await res.json()
    return normalizeAnalysis(data)
  },

  // ── Agenda ────────────────────────────────────────────────────────────────────
  async getAgendaEvents({ from, to } = {}) {
    const userId = await getCurrentUserId()
    if (!from) { const d = new Date(); d.setDate(1); from = d.toISOString().slice(0, 10) }
    if (!to)   { const d = new Date(); d.setMonth(d.getMonth() + 3); to = d.toISOString().slice(0, 10) }

    const { data, error } = await supabase
      .from('appointments')
      .select('*, patients(name)')
      .eq('psychologist_id', userId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
    if (error) throwSupabaseError(error, 'getAgendaEvents')
    return (data || []).map(a => normalizeAppointment({ ...a, patient_name: a.patients?.name }))
  },

  async createAgendaEvent(data) {
    const userId = await getCurrentUserId()
    const { data: created, error } = await supabase
      .from('appointments')
      .insert({
        psychologist_id:  userId,
        patient_id:       data.patientId,
        date:             data.date,
        time:             data.time,
        duration_minutes: data.durationMinutes || 50,
        type:             data.type            || 'presencial',
        platform:         data.platform        || null,
        meet_link:        data.meetLink        || null,
        notes:            data.notes           || null,
        status:           'scheduled',
      })
      .select()
      .single()
    if (error) throwSupabaseError(error, 'createAgendaEvent')
    return normalizeAppointment(created)
  },

  async updateAgendaEvent(id, data) {
    const patch = {}
    if (data.date            !== undefined) patch.date             = data.date
    if (data.time            !== undefined) patch.time             = data.time
    if (data.durationMinutes !== undefined) patch.duration_minutes = data.durationMinutes
    if (data.type            !== undefined) patch.type             = data.type
    if (data.platform        !== undefined) patch.platform         = data.platform
    if (data.meetLink        !== undefined) patch.meet_link        = data.meetLink
    if (data.notes           !== undefined) patch.notes            = data.notes
    if (data.status          !== undefined) patch.status           = data.status

    const { data: updated, error } = await supabase
      .from('appointments')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throwSupabaseError(error, 'updateAgendaEvent')
    return normalizeAppointment(updated)
  },

  async deleteAgendaEvent(id) {
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', id)
    if (error) throwSupabaseError(error, 'deleteAgendaEvent')
    return null
  },

  // ── Financial ─────────────────────────────────────────────────────────────────
  async getFinancialEvents({ page = 0, size = 50 } = {}) {
    const userId = await getCurrentUserId()
    let query = supabase
      .from('financial_records')
      .select('*, patients(name)', { count: 'exact' })
      .eq('psychologist_id', userId)
      .order('due_date', { ascending: false })

    const { data, count, error } = await paginate(query, { page, size })
    if (error) throwSupabaseError(error, 'getFinancialEvents')
    return {
      content: (data || []).map(r => ({
        id:             r.id,
        patientId:      r.patient_id   || null,
        patientName:    r.patients?.name || null,
        sessionId:      r.session_id   || null,
        type:           r.type,
        amount:         r.amount,
        description:    r.description  || null,
        category:       r.category     || null,
        status:         r.status,
        dueDate:        r.due_date     || null,
        paidDate:       r.paid_date    || null,
        paymentMethod:  r.payment_method || null,
        receiptUrl:     r.receipt_url  || null,
        createdAt:      r.created_at,
      })),
      totalElements: count || 0,
      totalPages: Math.ceil((count || 0) / size),
      page,
    }
  },

  async getFinancialSummary() {
    const userId = await getCurrentUserId()
    const now    = new Date()
    const from   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const to     = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

    const { data, error } = await supabase
      .from('financial_records')
      .select('type, amount, status')
      .eq('psychologist_id', userId)
      .gte('due_date', from)
      .lte('due_date', to)
    if (error) throwSupabaseError(error, 'getFinancialSummary')

    const income  = (data || []).filter(r => r.type === 'income' && r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0)
    const pending = (data || []).filter(r => r.type === 'income' && r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0)
    const expenses= (data || []).filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0)

    return { income, pending, expenses, net: income - expenses }
  },

  async createFinancialEvent(data) {
    const userId = await getCurrentUserId()
    const { data: created, error } = await supabase
      .from('financial_records')
      .insert({
        psychologist_id: userId,
        patient_id:      data.patientId     || null,
        session_id:      data.sessionId     || null,
        type:            data.type,
        amount:          Number(data.amount),
        description:     data.description   || null,
        category:        data.category      || null,
        status:          data.status        || 'pending',
        due_date:        data.dueDate       || null,
        paid_date:       data.paidDate      || null,
        payment_method:  data.paymentMethod || null,
      })
      .select()
      .single()
    if (error) throwSupabaseError(error, 'createFinancialEvent')
    return created
  },

  async updateFinancialEvent(id, data) {
    const patch = {}
    if (data.status        !== undefined) patch.status         = data.status
    if (data.paidDate      !== undefined) patch.paid_date      = data.paidDate
    if (data.paymentMethod !== undefined) patch.payment_method = data.paymentMethod
    if (data.amount        !== undefined) patch.amount         = Number(data.amount)
    if (data.description   !== undefined) patch.description    = data.description

    const { data: updated, error } = await supabase
      .from('financial_records')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throwSupabaseError(error, 'updateFinancialEvent')
    return updated
  },

  async deleteFinancialEvent(id) {
    const { error } = await supabase.from('financial_records').delete().eq('id', id)
    if (error) throwSupabaseError(error, 'deleteFinancialEvent')
    return null
  },

  // ── User profile ──────────────────────────────────────────────────────────────
  async getUserProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Não autenticado')
    const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    if (error) throwSupabaseError(error, 'getUserProfile')
    return {
      id:                session.user.id,
      email:             session.user.email,
      name:              data.name,
      crp:               data.crp       || null,
      plan:              data.plan      || 'trial',
      analysesRemaining: data.analyses_remaining ?? 5,
    }
  },

  async updateProfile(data) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Não autenticado')

    const patch = {}
    if (data.name    !== undefined) patch.name    = data.name
    if (data.crp     !== undefined) patch.crp     = data.crp
    if (data.phone   !== undefined) patch.phone   = data.phone

    const { data: updated, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', session.user.id)
      .select()
      .single()
    if (error) throwSupabaseError(error, 'updateProfile')

    const user = {
      id:    session.user.id,
      email: session.user.email,
      name:  updated.name,
      crp:   updated.crp || null,
      plan:  updated.plan || 'trial',
    }
    localStorage.setItem('psicoai_user', JSON.stringify(user))
    return user
  },

  // ── Features com mocks (implementação futura) ─────────────────────────────────
  async getFormTemplates() {
    return [
      { id: 'tpl-001', title: 'Anamnese inicial', category: 'Avaliação', fields: 12 },
      { id: 'tpl-002', title: 'TCLE — Consentimento Informado', category: 'Legal', fields: 5 },
      { id: 'tpl-003', title: 'BDI-II — Inventário Beck de Depressão', category: 'Escala validada', fields: 21 },
      { id: 'tpl-004', title: 'BAI — Inventário Beck de Ansiedade', category: 'Escala validada', fields: 21 },
      { id: 'tpl-005', title: 'PHQ-9', category: 'Escala validada', fields: 9 },
      { id: 'tpl-006', title: 'GAD-7', category: 'Escala validada', fields: 7 },
    ]
  },

  async getPatientForms(patientId) {
    const { data, error } = await supabase
      .from('forms')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
    if (error) throwSupabaseError(error, 'getPatientForms')
    return data || []
  },

  async createForm(data) {
    const userId = await getCurrentUserId()
    const { data: created, error } = await supabase
      .from('forms')
      .insert({ psychologist_id: userId, patient_id: data.patientId || null, type: data.type, title: data.title, status: 'draft' })
      .select()
      .single()
    if (error) throwSupabaseError(error, 'createForm')
    return created
  },

  async updateForm(id, data) {
    const { data: updated, error } = await supabase.from('forms').update(data).eq('id', id).select().single()
    if (error) throwSupabaseError(error, 'updateForm')
    return updated
  },

  async deleteForm(id) {
    const { error } = await supabase.from('forms').delete().eq('id', id)
    if (error) throwSupabaseError(error, 'deleteForm')
  },

  async getInsights() { return { trends: [], alerts: [] } },
  async getLembretes() { return [] },
  async updateLembrete(id, data) { return { id, ...data } },
  async saveLembreteTemplate(id, t) { return { id, template: t } },
  async getTeleSessions() { return [] },
  async createTeleSession(data) { return { id: 'ts-' + Date.now(), ...data } },
  async updateTeleSession(id, data) { return { id, ...data } },
  async deleteTeleSession() {},
  async getRecentAnnotations({ search = '', patientId = '' } = {}) {
    const userId = await getCurrentUserId()
    let query = supabase
      .from('sessions')
      .select('*, patients(name)')
      .eq('psychologist_id', userId)
      .not('status', 'eq', 'abandoned')
      .order('started_at', { ascending: false })
      .limit(50)
    if (patientId) query = query.eq('patient_id', patientId)
    if (search) query = query.ilike('text_content', `%${search}%`)
    const { data, error } = await query
    if (error) throwSupabaseError(error, 'getRecentAnnotations')
    return (data || []).map(s => ({ ...normalizeSession(s), patientName: s.patients?.name }))
  },
  async getPatientDocuments() { return [] },
  async uploadDocument() { throw new Error('Upload de documentos disponível em breve.') },
  async downloadDocument() { throw new Error('Download disponível em breve.') },
  async deleteDocument() {},
  async exportProntuarioPdf() { throw new Error('Exportação PDF disponível em breve.') },
  async exportRelatorioPdf() { throw new Error('Exportação PDF disponível em breve.') },
  async generateReport() { return { sections: [{ id: 'note', label: null, text: 'Relatório disponível em breve.' }] } },
  async getPatientReports() { return [] },
  async sendReport() { return { success: true } },
  async getGoogleStatus() { return { connected: false } },
  async getGoogleAuthUrl() { return { url: null } },
  async disconnectGoogle() {},
  async setGoogleCalendarSync() {},
  async createGoogleMeet() { throw new Error('Google Meet disponível com backend Railway ativo.') },
  async getGoogleCalendarEvents() { return [] },
  async createBillingPortalSession() { throw new Error('Billing via Stripe — Railway necessário.') },
  async createCheckoutSession() { throw new Error('Billing via Stripe — Railway necessário.') },
  async validateCoupon() { return { valid: false } },
}

export default api
