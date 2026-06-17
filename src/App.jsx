import { useState, useEffect, useRef, lazy, Suspense } from 'react'

import { auth, api } from './services'
import { showToast, dismissToast, ToastContainer } from './components/Toast'
import ProgressBar, { startProgress, finishProgress, failProgress } from './components/ProgressBar'
import ConfirmDialog, { confirm } from './components/ConfirmDialog'
import OnboardingTour from './components/OnboardingTour'
import FeedbackModal from './components/FeedbackModal'
import OpenSessionsPanel from './components/OpenSessionsPanel'
import PaymentModal from './components/PaymentModal'
import LgpdBanner from './components/LgpdBanner'

import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import BottomNav from './components/BottomNav'
import AiDrawer from './components/AiDrawer'
import PreSessionBriefing from './components/PreSessionBriefing'
import SessionTypePicker from './components/SessionTypePicker'
import PatientPicker from './components/PatientPicker'
import PatientFormModal from './components/PatientFormModal'
import AnalyzeSessionsModal from './components/AnalyzeSessionsModal'

import Login from './views/Login'
// Lazy: views de rotas secundárias — carregam sob demanda, não no boot
const AnnotationSession   = lazy(() => import('./views/AnnotationSession'))
const Dashboard           = lazy(() => import('./views/Dashboard'))
const Patients            = lazy(() => import('./views/Patients'))
const Patient             = lazy(() => import('./views/Patient'))
const MedicalRecordView   = lazy(() => import('./views/MedicalRecordView'))
const Agenda              = lazy(() => import('./views/Agenda'))
const Insights            = lazy(() => import('./views/Insights'))
const Finance             = lazy(() => import('./views/Finance'))
const Reminders           = lazy(() => import('./views/Reminders'))
const Forms               = lazy(() => import('./views/Forms'))
const Annotations         = lazy(() => import('./views/Annotations'))
const Notebooks           = lazy(() => import('./views/Notebooks'))
const Telehealth          = lazy(() => import('./views/Telehealth'))
const Settings            = lazy(() => import('./views/Settings'))
const TermsOfUse          = lazy(() => import('./views/TermsOfUse'))
const PrivacyPolicy       = lazy(() => import('./views/PrivacyPolicy'))
const PatientAnalysisHub  = lazy(() => import('./views/PatientAnalysisHub'))
const AnalysisDetailView  = lazy(() => import('./views/AnalysisDetailView'))
import AnalysisConfigModal from './components/AnalysisConfigModal'

const safeStorage = {
  get:    (key)      => { try { return localStorage.getItem(key) }    catch { return null } },
  set:    (key, val) => { try { localStorage.setItem(key, val) }      catch {} },
  remove: (key)      => { try { localStorage.removeItem(key) }        catch {} },
}

const UNLIMITED = 2147483647

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(() => auth.getStoredUser())

  // ── Onboarding (declarado antes de handleLogin para evitar TDZ) ───────────
  const [onboardingOpen, setOnboardingOpen] = useState(false)

  const handleLogin = (user) => {
    setCurrentUser(user)
    if (!safeStorage.get('psicoai_onboarding_seen')) {
      setOnboardingOpen(true)
    }
  }
  const handleLogout = () => { auth.logout(); setCurrentUser(null) }

  // ── Prontuário overlay (A4 view) — abre sobre o perfil do paciente ──────
  const [prontuarioOpen, setProntuarioOpen] = useState(false)

  // ── Payment required (conta bloqueada) ───────────────────────────────────
  const [paymentRequired, setPaymentRequired] = useState(false)

  // ── Feedback modal ────────────────────────────────────────────────────────
  const [feedbackOpen, setFeedbackOpen]     = useState(false)
  const [feedbackPreset, setFeedbackPreset] = useState(null)

  const openFeedback = (preset = null) => {
    setFeedbackPreset(preset)
    setFeedbackOpen(true)
  }

  useEffect(() => {
    const onSessionExpired = () => { auth.logout(); setCurrentUser(null) }
    const onPaymentRequired = () => setPaymentRequired(true)
    window.addEventListener('psicoai:session-expired', onSessionExpired)
    window.addEventListener('psicoai:payment-required', onPaymentRequired)
    return () => {
      window.removeEventListener('psicoai:session-expired', onSessionExpired)
      window.removeEventListener('psicoai:payment-required', onPaymentRequired)
    }
  }, [])

  // Atualiza perfil do usuário no mount para garantir trialDaysRemaining,
  // subscriptionStatus e analysesRemaining sempre frescos (localStorage pode estar stale).
  useEffect(() => {
    if (!currentUser) return
    api.getUserProfile()
      .then(updated => { if (updated) setCurrentUser(prev => ({ ...prev, ...updated })) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Stripe / Google OAuth return handlers ─────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    const google  = params.get('google')

    if (payment === 'success') {
      window.history.replaceState({}, '', window.location.pathname)
      setPaymentRequired(false)
      showToast('✓ Pagamento confirmado! Sua conta está ativa.', 'success')
      api.getUserProfile().then(updated => {
        if (updated) setCurrentUser(prev => ({ ...prev, ...updated }))
      }).catch(() => {})
    }

    const analysesPurchased = params.get('analyses_purchased')
    if (analysesPurchased) {
      const qty = parseInt(analysesPurchased, 10)
      window.history.replaceState({}, '', window.location.pathname)
      // Refresh do perfil para pegar o analysesRemaining atualizado pelo webhook
      api.getUserProfile().then(updated => {
        if (updated) setCurrentUser(prev => ({ ...prev, ...updated }))
      }).catch(() => {})
      if (!isNaN(qty) && qty > 0) {
        showToast(`✓ ${qty} ${qty === 1 ? 'análise adicionada' : 'análises adicionadas'}!`, 'success', {
          description: 'Os créditos já estão disponíveis na sua conta.',
          duration: 7000,
        })
      }
    }

    if (google === 'connected') {
      window.history.replaceState({}, '', window.location.pathname)
      showToast('✓ Google Meet conectado! Agora você pode gerar links de sessão.', 'success')
      // Redireciona para teleatendimento — é de lá que o usuário veio
      setCurrentView('teleatendimento')
    }
    if (google === 'error') {
      window.history.replaceState({}, '', window.location.pathname)
      showToast('Erro ao conectar com o Google. Tente novamente.', 'error')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // (Removido) Recuperação de "sessões abertas" — anotações não têm estado
  // open/finished no modelo de caderno; o conceito deixou de existir.

  // ── Navigation — persiste em sessionStorage (por aba, não cross-tab) ────────
  // sessionStorage sobrevive reload mas não fechar aba — comportamento correto
  const [currentView, setCurrentViewRaw] = useState(() => {
    try {
      // Priority 0: URL path-based public routes (/terms, /privacy)
      const path = window.location.pathname
      if (path === '/terms')   return 'termos'
      if (path === '/privacy') return 'privacidade'

      // Priority 1: URL params (link compartilhado de análise)
      const params = new URLSearchParams(window.location.search)
      const urlView = params.get('view')
      if (urlView === 'analise' && params.get('id')) return 'analise'

      // Priority 2: sessionStorage (reload normal)
      const saved = sessionStorage.getItem('psicoai_nav_view')
      const needsPatient = ['paciente']
      if (saved && needsPatient.includes(saved)) {
        const hasPat = !!sessionStorage.getItem('psicoai_nav_patient') ||
                       !!JSON.parse(safeStorage.get('psicoai_active_session') || 'null')?.patient
        return hasPat ? saved : 'agenda'
      }
      return saved || 'agenda'
    } catch { return 'agenda' }
  })

  // ── Analysis context (hub + detail) ─────────────────────────────────────────
  const [currentAnalysisId, setCurrentAnalysisId] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('view') === 'analise') return params.get('id') || null
      return sessionStorage.getItem('psicoai_nav_analysis') || null
    } catch { return null }
  })

  // Modal de configuração de análise disparado a partir de qualquer view
  const [analysisConfigTarget, setAnalysisConfigTarget] = useState(null) // patient | null

  const setCurrentView = (view) => {
    setCurrentViewRaw(view)
    try { sessionStorage.setItem('psicoai_nav_view', view) } catch {}
  }

  // Navega para o hub de análises de um paciente
  const handleOpenAnalysisHub = (patient) => {
    setCurrentPatient(patient)
    setCurrentView('analise-paciente')
  }

  // Navega para uma análise específica (com ID referenciável)
  const handleOpenAnalysis = (analysisId, patient) => {
    if (patient) setCurrentPatient(patient)
    setCurrentAnalysisId(analysisId)
    try { sessionStorage.setItem('psicoai_nav_analysis', analysisId) } catch {}
    setCurrentView('analise')
  }

  // Abre modal de configuração de análise para um paciente
  const handleOpenAnalysisConfig = (patient) => {
    setAnalysisConfigTarget(patient)
  }

  // ── Título dinâmico da aba por tela ──────────────────────────────────────
  useEffect(() => {
    const TITLES = {
      agenda:          'Agenda',
      dashboard:       'Painel clínico',
      pacientes:       'Meus pacientes',
      paciente:        'Prontuário',
      anotacoes:       'Anotações',
      insights:        'Insights clínicos',
      financeiro:      'Financeiro',
      lembretes:       'Lembretes',
      formularios:     'Formulários',
      cadernos:        'Cadernos',
      teleatendimento: 'Videoatendimento',
      configuracoes:   'Configurações',
      sessao:          'Sessão em andamento',
      liveSession:     'Sessão em andamento',
      prontuario:      'Prontuário',
    }
    const label = TITLES[currentView] || 'PsicNotes'
    document.title = `${label} — PsicNotes`
  }, [currentView])

  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Patient context ──────────────────────────────────────────────────────
  // Inicializa do localStorage — prioridade: sessão ativa (canvas/text) > quicknote > nav context
  const [currentPatient, setCurrentPatientRaw] = useState(() => {
    try {
      const s = JSON.parse(safeStorage.get('psicoai_active_session') || 'null')
      if (s?.patient) return s.patient
      // Fallback: quicknote
      const qn = JSON.parse(safeStorage.get('psicoai_quicknote_state') || 'null')
      if (qn?.open && qn?.patientId) return { id: qn.patientId, name: qn.patientName }
      // Fallback: contexto de navegação da sessão anterior
      const nav = JSON.parse(sessionStorage.getItem('psicoai_nav_patient') || 'null')
      return nav || null
    } catch { return null }
  })

  const setCurrentPatient = (pat) => {
    setCurrentPatientRaw(pat)
    // Persiste contexto de navegação para sobreviver reload
    try {
      if (pat) sessionStorage.setItem('psicoai_nav_patient', JSON.stringify(pat))
      else sessionStorage.removeItem('psicoai_nav_patient')
    } catch {}
  }

  // ── Active session tracking ────────────────────────────────────────────────
  const activeSessionRef  = useRef(null)

  const [activeSessionId, setActiveSessionId] = useState(() => {
    try {
      const s = JSON.parse(safeStorage.get('psicoai_active_session') || 'null')
      if (!s?.sessionId) return null
      // Ignora sessões com mais de 8 horas (provável abandono)
      const age = Date.now() - (s.startedAt || 0)
      if (age > 8 * 60 * 60 * 1000) { safeStorage.remove('psicoai_active_session'); return null }
      activeSessionRef.current = s.sessionId
      return s.sessionId
    } catch { return null }
  })

  const [activeSessionType, setActiveSessionType] = useState(() => {
    try {
      const s = JSON.parse(safeStorage.get('psicoai_active_session') || 'null')
      return s?.sessionType || null
    } catch { return null }
  })

  // ── Sessões paralelas (background) ───────────────────────────────────────
  // Cada item: { id, type, patient: {id,name}, startedAt }
  const [backgroundSessions, setBackgroundSessions] = useState([])
  // Painel de listagem de sessões abertas
  const [sessionsPanelOpen, setSessionsPanelOpen] = useState(false)
  // Ação pendente para quando o usuário fechar/retomar sessão e quiser iniciar nova
  const [pendingNewSessionAction, setPendingNewSessionAction] = useState(null) // () => void

  // Total de sessões abertas = foreground (se houver) + background
  const totalOpenSessions = (activeSessionId ? 1 : 0) + backgroundSessions.length

  // Persiste sessão no localStorage sempre que mudar
  // e atualiza a URL com o session ID
  const setSession = (id) => { activeSessionRef.current = id; setActiveSessionId(id) }

  useEffect(() => {
    if (activeSessionId) {
      // Persiste no localStorage
      const current = (() => { try { return JSON.parse(safeStorage.get('psicoai_active_session') || 'null') } catch { return null } })()
      const pat = currentPatient || current?.patient || null
      safeStorage.set('psicoai_active_session', JSON.stringify({
        sessionId:   activeSessionId,
        sessionType: activeSessionType,
        patientId:   pat?.id || current?.patientId || null,
        patient:     pat ? { id: pat.id, name: pat.name } : null,
        startedAt:   current?.startedAt || Date.now(),
      }))
      // Atualiza URL
      const params = new URLSearchParams(window.location.search)
      params.set('sessao', activeSessionId)
      if (activeSessionType) params.set('tipo', activeSessionType)
      window.history.replaceState({}, '', `${window.location.pathname}?${params}`)
    } else {
      // Limpa localStorage e URL
      safeStorage.remove('psicoai_active_session')
      const params = new URLSearchParams(window.location.search)
      if (params.has('sessao')) {
        params.delete('sessao')
        params.delete('tipo')
        const q = params.toString()
        window.history.replaceState({}, '', q ? `${window.location.pathname}?${q}` : window.location.pathname)
      }
    }
  }, [activeSessionId, activeSessionType]) // eslint-disable-line react-hooks/exhaustive-deps


  // ── Session modals ────────────────────────────────────────────────────────
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerMode, setPickerMode] = useState('live')
  // textOpen mantido como alias para não quebrar referências internas — sempre false
  const [textOpen, setTextOpen] = useState(false)
  const [canvasInitialPageType, setCanvasInitialPageType] = useState(null)
  // Inicializa do localStorage — sobrevive refresh, deploy do Vercel, fechar aba
  const [canvasOpen, setCanvasOpen] = useState(() => {
    try {
      const s = JSON.parse(safeStorage.get('psicoai_active_session') || 'null')
      if (!s?.patientId) return false
      return (Date.now() - (s.startedAt || 0)) < 8 * 3600 * 1000
    } catch { return false }
  })
  const [cadastroOpen, setCadastroOpen] = useState(false)
  // Incrementar força Pacientes + Anotacoes a refazer o fetch sem precisar de prop drilling complexo
  const [patientsRefreshKey, setPatientsRefreshKey] = useState(0)
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0)
  const bumpPatients  = () => setPatientsRefreshKey(k => k + 1)
  const bumpSessions  = () => setSessionsRefreshKey(k => k + 1)
  // Pre-loaded content for reopening a session
  const [textInitialHtml, setTextInitialHtml] = useState('')
  const [canvasInitialData, setCanvasInitialData] = useState(null)
  // Modo visualização de sessão histórica — não cria sessão ativa, sem badge
  const [canvasViewOnly, setCanvasViewOnly] = useState(false)
  const [viewOnlySessionId, setViewOnlySessionId] = useState(null)
  // Sessão alvo para scroll automático ao abrir o caderno
  const [scrollToSessionId, setScrollToSessionId] = useState(null)

  // ── Annotation browser-history routing ───────────────────────────────────
  // Declarado AQUI — depois de canvasOpen (315), canvasInitialPageType (313) e currentPatient (217)
  const canvasOpenRef = useRef(false)
  const [annotationTargetPage, setAnnotationTargetPage] = useState(null)

  useEffect(() => { canvasOpenRef.current = canvasOpen }, [canvasOpen])

  useEffect(() => {
    if (!canvasOpen) return
    const params = new URLSearchParams(window.location.search)
    params.set('view', 'anotacao')
    if (currentPatient?.id) params.set('paciente', String(currentPatient.id))
    window.history.pushState(
      { psicoai_canvas: true, page: 0 },
      '',
      `${window.location.pathname}?${params}`
    )
  }, [canvasOpen]) // eslint-disable-line

  useEffect(() => {
    const handler = (e) => {
      if (!canvasOpenRef.current) return
      if (e.state?.psicoai_canvas && typeof e.state.page === 'number') {
        setAnnotationTargetPage(e.state.page)
      } else {
        // Browser back: fecha canvas e limpa sessão ativa do localStorage
        // para que o próximo refresh não reabra uma anotação vazia
        setCanvasOpen(false)
        setCanvasInitialPageType(null)
        setSession(null)
        setActiveSessionType(null)
        safeStorage.remove('psicoai_active_session')
        const p = new URLSearchParams(window.location.search)
        if (p.get('view') === 'anotacao') {
          p.delete('view'); p.delete('paciente')
          const q = p.toString()
          window.history.replaceState({}, '', q ? `${window.location.pathname}?${q}` : window.location.pathname)
        }
      }
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, []) // eslint-disable-line

  // ── Notifications panel ───────────────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifItems, setNotifItems] = useState([])

  useEffect(() => {
    if (!currentUser) return
    // Carrega eventos de agenda das próximas 48h para badge de notificações
    const from = new Date().toISOString()
    const to   = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    api.getAgendaEvents({ from, to })
      .then(evs => setNotifItems(evs || []))
      .catch(() => {})
  }, [currentUser])

  // ── AI Drawer ─────────────────────────────────────────────────────────────
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // ── Analyze Sessions Modal ────────────────────────────────────────────────
  // Holds { imageBase64, textContent, htmlContent, duration, sessionId } while user picks sessions
  const [pendingAnalysis, setPendingAnalysis] = useState(null)

  // Sessão está "em background" quando existe mas a view está fechada (usuário navegou para outra tela)
  // ── Handlers ──────────────────────────────────────────────────────────────

  // ── Session type picker (Texto / Canvas) ─────────────────────────────────
  // Aparece depois de selecionar paciente — permite escolher o modo da sessão
  const [typePickerPatient, setTypePickerPatient] = useState(null)

  // Abre AnnotationSession com nova página de TEXTO.
  // O histórico de páginas do paciente é carregado automaticamente — a nova página é adicionada ao final.
  const _openTextSession = (patient) => {
    const pat = patient || currentPatient
    activeSessionRef.current = null
    setCanvasViewOnly(false)
    setViewOnlySessionId(null)
    setCurrentPatient(pat)
    setActiveSessionType('canvas')
    setCanvasInitialPageType('text')
    if (pat) {
      safeStorage.set('psicoai_active_session', JSON.stringify({
        sessionId:   null,
        sessionType: 'canvas',
        patientId:   pat.id,
        patient:     { id: pat.id, name: pat.name },
        startedAt:   Date.now(),
      }))
    }
    // Caderno página-por-nota: cada página vira uma anotação própria no autosave.
    setSession(null)
    setCanvasOpen(true)
  }

  // Abre AnnotationSession com nova página de DESENHO.
  const _openCanvasSession = (patient) => {
    const pat = patient || currentPatient
    activeSessionRef.current = null
    setCanvasViewOnly(false)
    setViewOnlySessionId(null)
    setCurrentPatient(pat)
    setActiveSessionType('canvas')
    setCanvasInitialPageType('draw')
    if (pat) {
      safeStorage.set('psicoai_active_session', JSON.stringify({
        sessionId:   null,
        sessionType: 'canvas',
        patientId:   pat.id,
        patient:     { id: pat.id, name: pat.name },
        startedAt:   Date.now(),
      }))
    }
    setSession(null)  // caderno página-por-nota: anotações criadas sob demanda (sem sessão-fantasma)
    setCanvasOpen(true)
  }

  // ── Agenda: sincroniza eventos recorrentes do paciente ───────────────────
  // isUpdate=true → apaga eventos futuros deste paciente antes de recriar
  const _syncRecurringAgenda = async (patientId, patientName, form, isUpdate = false) => {
    const { recurringDayOfWeek, recurringTime, recurringDurationMin } = form
    if (!recurringDayOfWeek || !recurringTime) return

    // Converte dia ISO (1=Seg…7=Dom) para JS getDay() (0=Dom, 1=Seg…6=Sáb)
    const jsDay   = parseInt(recurringDayOfWeek) % 7
    const [h, m]  = recurringTime.split(':').map(Number)
    const duration = parseInt(recurringDurationMin) || 50
    const today   = new Date(); today.setHours(0, 0, 0, 0)

    // Se edição: remove eventos futuros deste paciente para recriar
    if (isUpdate) {
      try {
        const toDate = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000)
        const existing = await api.getAgendaEvents({ from: today.toISOString(), to: toDate.toISOString() })
        const future = (existing || []).filter(e => e.patientId === patientId && new Date(e.startAt) >= today)
        await Promise.all(future.map(e => api.deleteAgendaEvent(e.id).catch(() => {})))
      } catch {}
    }

    // Encontra a próxima ocorrência do dia da semana a partir de hoje
    let cursor = new Date(today)
    while (cursor.getDay() !== jsDay) cursor.setDate(cursor.getDate() + 1)

    // Cria 12 semanas (≈3 meses) de eventos na agenda
    const creates = []
    for (let i = 0; i < 12; i++) {
      const startAt = new Date(cursor); startAt.setHours(h, m, 0, 0)
      const endAt   = new Date(startAt); endAt.setMinutes(endAt.getMinutes() + duration)
      creates.push(api.createAgendaEvent({
        title: `Sessão — ${patientName}`,
        type: 'session',
        patientId,
        startAt: startAt.toISOString(),
        endAt:   endAt.toISOString(),
      }).catch(() => {}))
      cursor.setDate(cursor.getDate() + 7)
    }
    await Promise.all(creates)
  }

  // Verifica se paciente já tem anotações salvas no localStorage
  const _hasAnnotations = (patientId) => {
    const raw = safeStorage.get(`psicoai_canvas3_p${patientId}`)
    return !!raw  // dados criptografados — só verifica existência
  }

  // Abre o caderno do paciente. Se localStorage vazio (ex: notas rápidas anteriores),
  // reconstrói o notebook a partir das sessões do backend antes de abrir.
  const _openExistingAnnotation = async (patient, targetSessionId = null) => {
    const pat = patient || currentPatient
    setScrollToSessionId(targetSessionId)
    activeSessionRef.current = null
    setCanvasViewOnly(false)
    setViewOnlySessionId(null)
    setCurrentPatient(pat)
    setActiveSessionType('canvas')
    setCanvasInitialPageType(null)
    setCanvasInitialData(null) // reset antes de carregar do backend

    // Limpa localStorage stale do paciente para forçar uso dos dados frescos do backend.
    // O AnnotationSession vai receber initialCanvasData via prop e ignorar localStorage vazio.
    safeStorage.remove(`psicoai_canvas3_p${pat?.id}`)

    // Carrega caderno completo do backend — notebook retorna NoteResponse com htmlContent/textContent.
    if (pat?.id) {
      try {
        const sessions = await api.getPatientNotebook(pat.id)
        const list = [...(sessions || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        const pages = list.flatMap(s => {
          const nd = s.sessionDate || null
          // Canvas page: canvasData tem o JSON de strokes/pages
          const cd = s.canvasData || s.canvasDataJson
          if (cd) {
            try {
              const parsed = JSON.parse(cd)
              if (Array.isArray(parsed) && parsed.length > 0)
                return parsed.map(p => ({ ...p, sessionId: s.id, noteDate: p.noteDate || nd }))
              if (parsed && Array.isArray(parsed.strokes))
                return [{ id: `p-${s.id}`, pageType: 'draw', strokes: parsed.strokes, dataUrl: null, textHtml: null, sessionId: s.id, noteDate: nd }]
              if (parsed && parsed.dataUrl)
                return [{ id: `p-${s.id}`, pageType: 'draw', dataUrl: parsed.dataUrl, textHtml: null, sessionId: s.id, noteDate: nd }]
            } catch {}
          }
          // Text page: htmlContent ou textContent
          const html = s.htmlContent ||
            (s.textContent ? s.textContent.split('\n').map(l => `<p>${l || '<br>'}</p>`).join('') : '')
          if (html) return [{ id: `p-${s.id}`, pageType: 'text', textHtml: html, dataUrl: null, sessionId: s.id, noteDate: nd }]
          return []
        })
        if (pages.length > 0) {
          setCanvasInitialData(JSON.stringify(pages))
        }
      } catch { /* backend indisponível — abre caderno vazio */ }
    }

    if (pat) {
      safeStorage.set('psicoai_active_session', JSON.stringify({
        sessionId: null, sessionType: 'canvas', patientId: pat.id,
        patient: { id: pat.id, name: pat.name }, startedAt: Date.now(),
      }))
    }
    setSession(null)  // caderno página-por-nota: anotações criadas sob demanda (sem sessão-fantasma)
    setCanvasOpen(true)
  }

  // Inicia anotação: se paciente já tem páginas → abre caderno existente;
  // senão → abre canvas com página de texto em branco (sem picker de tipo).
  const _startNewSession = (view, patient) => {
    if (view === 'sessao' || view === 'liveSession') {
      if (patient) {
        setCurrentPatient(patient)
        if (_hasAnnotations(patient.id)) {
          _openExistingAnnotation(patient)
        } else {
          _openTextSession(patient) // nova página de texto — sem perguntar o tipo
        }
      } else {
        setPickerMode('live')
        setPickerOpen(true)
      }
    }
  }

  const handleSetView = (view, patient = null) => {
    if (view === 'sessao' || view === 'liveSession') {
      // Gate: se já há sessões abertas, mostra o painel antes de iniciar nova
      if (totalOpenSessions > 0) {
        setPendingNewSessionAction(() => () => _startNewSession(view, patient))
        setSessionsPanelOpen(true)
        setSidebarOpen(false)
        return
      }
      _startNewSession(view, patient)
      setSidebarOpen(false)
      return
    }
    if (patient) setCurrentPatient(patient)
    setCurrentView(view)
    setSidebarOpen(false)
  }

  const handlePickerSelect = (patient) => {
    setCurrentPatient(patient)
    setPickerOpen(false)
    if (_hasAnnotations(patient.id)) {
      _openExistingAnnotation(patient)
    } else {
      _openTextSession(patient) // nova página de texto — sem picker de tipo
    }
  }

  const handleBriefingStart = ({ meetLink, type }) => {
    setBriefingOpen(false)
    activeSessionRef.current = null
    setActiveSessionType(type)
    // Persiste patient imediatamente — o sessionId chega async via createSession
    if (currentPatient) {
      safeStorage.set('psicoai_active_session', JSON.stringify({
        sessionId:   null,
        sessionType: type,
        patient:     { id: currentPatient.id, name: currentPatient.name },
        startedAt:   Date.now(),
      }))
    }

    // Define o tipo de página inicial: canvas livre → draw, texto → text
    setCanvasInitialPageType(type === 'canvas' ? 'draw' : 'text')

    // Caderno página-por-nota: abre direto, anotações criadas sob demanda no autosave.
    setSession(null)

    setCanvasOpen(true)
  }

  // ── Handlers de minimizar: move sessão foreground → background ──────────
  const handleMinimizeCanvas = () => {
    if (canvasViewOnly) {
      // Visualização histórica: só fecha, não entra no background nem gera badge
      setCanvasViewOnly(false)
      setViewOnlySessionId(null)
      setCanvasOpen(false)
      setCanvasInitialPageType(null)
      return
    }
    if (activeSessionId) {
      setBackgroundSessions(prev =>
        prev.find(s => s.id === activeSessionId) ? prev : [
          ...prev,
          { id: activeSessionId, type: 'canvas', patient: currentPatient, startedAt: Date.now() },
        ]
      )
      setSession(null)
      setActiveSessionType(null)
    }
    setCanvasOpen(false)
    setCanvasInitialPageType(null)
  }

  const handleMinimizeText = () => {
    // alias mantido — agora tudo usa canvas
    setCanvasOpen(false)
    setCanvasInitialPageType(null)
  }

  // ── Retomar sessão do background ─────────────────────────────────────────
  const handleResumeBackgroundSession = (bgSession) => {
    // Se há sessão no foreground, manda ela pro background também
    if (activeSessionId) {
      setBackgroundSessions(prev =>
        prev.find(s => s.id === activeSessionId) ? prev : [
          ...prev,
          { id: activeSessionId, type: activeSessionType, patient: currentPatient, startedAt: Date.now() },
        ]
      )
    }
    // Remove do array de background
    setBackgroundSessions(prev => prev.filter(s => s.id !== bgSession.id))
    // Coloca no foreground
    setCurrentPatient(bgSession.patient)
    setSession(bgSession.id)
    setActiveSessionType(bgSession.type)
    setCanvasInitialPageType(null)
    setCanvasOpen(true)
    setTextOpen(false)
  }

  // ── Encerrar sessão do background ────────────────────────────────────────
  const handleEndBackgroundById = async (bgSession) => {
    const ok = await confirm({
      title: 'Encerrar sessão?',
      message: `As anotações de ${bgSession.patient?.name || 'paciente'} serão encerradas. O conteúdo autosalvo fica no prontuário.`,
      confirmLabel: 'Encerrar',
      cancelLabel: 'Cancelar',
      danger: true,
    })
    if (!ok) return
    setBackgroundSessions(prev => prev.filter(s => s.id !== bgSession.id))
    if (bgSession.id === activeSessionId) {
      setSession(null); setActiveSessionType(null); setCanvasOpen(false); setTextOpen(false)
    }
    api.finishSession(bgSession.id, { durationSeconds: 0 }).catch(() => {})
    showToast('Anotação salva', 'info', { description: `${bgSession.patient?.name || 'Paciente'} — sem análise IA.`, duration: 4000 })
  }

  // Abre canvas histórico (sessão já encerrada) para visualização/edição
  // VIEW-ONLY: não chama setSession() → activeSessionId fica null → sem badge
  const handleOpenCanvasFromHistory = (session) => {
    const patient = { id: session.patientId, name: session.patientName }
    setCurrentPatient(patient)
    setCanvasInitialData(session.canvasDataJson || null)
    setViewOnlySessionId(session.id)
    setCanvasViewOnly(true)
    setCanvasInitialPageType(null)
    setActiveSessionType('canvas')
    setCanvasOpen(true)
  }

  // Chamado por AnnotationSession quando o usuário muda de página → pushState
  const handleAnnotationPageChange = (pageIdx) => {
    const params = new URLSearchParams(window.location.search)
    params.set('view', 'anotacao')
    if (currentPatient?.id) params.set('paciente', String(currentPatient.id))
    params.set('pg', String(pageIdx))
    window.history.pushState(
      { psicoai_canvas: true, page: pageIdx },
      '',
      `${window.location.pathname}?${params}`
    )
    setAnnotationTargetPage(null) // reset após navegar (evita loop)
  }

  // Volta para a sessão em background — reabre a view sem criar nova sessão
  const handleReturnToSession = () => {
    setCanvasOpen(true)
  }

  // Encerra sessão em background (sem IA, conteúdo já foi autosalvo)
  const handleEndBackgroundSession = async () => {
    const sid = activeSessionRef.current
    const name = currentPatient?.name || 'paciente'
    setSession(null)
    setActiveSessionType(null)
    setTextOpen(false)
    setCanvasOpen(false)
    if (sid) api.finishSession(sid, { durationSeconds: 0 }).catch(() => {})
    showToast('Anotação salva', 'info', {
      description: `Anotações de ${name} salvas no prontuário.`,
      duration: 4000,
    })
  }

  const handleSaveAnalysis = (result) => {
    if (!result || result.error) return
    const name = currentPatient?.name || 'paciente'
    showToast('Análise salva com sucesso', 'success', {
      description: `Prontuário de ${name} atualizado.`,
      action: { label: 'Ver prontuário →', onClick: () => setCurrentView('paciente') },
      duration: 6000,
    })
  }

  // Background analysis — runs without opening AiDrawer, shows a toast with action when done
  const _runAnalysisInBackground = async ({ imageBase64, textContent, htmlContent, duration, sessionId, canvasDataJson, canvasTextContent, sessionDate }) => {
    showToast('Análise iniciada em segundo plano…', 'info', { duration: 4000 })
    startProgress()
    try {
      // Conteúdo já autosalvo por página — análise sobre o caderno do paciente
      const data = await api.createAnalysis({ patientId: currentPatient?.id, noteIds: [], template: null, imageBase64 })
      setAnalysisResult(data)
      finishProgress()
      showToast('✓ Análise pronta!', 'success', {
        description: `Hipóteses identificadas para ${currentPatient?.name || 'o paciente'}.`,
        action: { label: 'Ver agora →', onClick: () => setAiDrawerOpen(true) },
        duration: 10000,
      })
    } catch (e) {
      const backendMsg = e?.message || 'Falha na análise em segundo plano.'
      failProgress()
      showToast('Falha na análise', 'error', {
        description: backendMsg,
        duration: 8000,
      })
    }
  }

  // Step 1 of the analyze flow: close the session view, then route based on destination.
  // destination === undefined → show AnalyzeSessionsModal (legacy flow / via "Salvar anotação" modal)
  // destination === 'here'     → run analysis immediately, AiDrawer opens over current view
  // destination === 'analyses' → navigate to 'anotacoes', run analysis, AiDrawer opens there
  // destination === 'later'    → run in background, toast when done
  const handleAnalyze = ({ imageBase64, textContent, htmlContent, duration, canvasDataJson, canvasTextContent, destination, sessionDate }) => {
    const sid = canvasViewOnly ? viewOnlySessionId : activeSessionRef.current
    setSession(null)
    setActiveSessionType(null)
    setCanvasOpen(false)
    setTextOpen(false)
    setCanvasViewOnly(false)
    setViewOnlySessionId(null)

    if (destination === 'here') {
      handleAnalysisConfirm({ imageBase64, textContent, htmlContent, duration, sessionId: sid, canvasDataJson, canvasTextContent, sessionDate })
    } else if (destination === 'analyses') {
      setCurrentView('cadernos')
      handleAnalysisConfirm({ imageBase64, textContent, htmlContent, duration, sessionId: sid, canvasDataJson, canvasTextContent, sessionDate })
    } else if (destination === 'later') {
      _runAnalysisInBackground({ imageBase64, textContent, htmlContent, duration, sessionId: sid, canvasDataJson, canvasTextContent, sessionDate })
    } else {
      setPendingAnalysis({ imageBase64, textContent, htmlContent, duration, sessionId: sid, canvasDataJson, canvasTextContent, sessionDate })
    }
  }

  // Step 2: called by AnalyzeSessionsModal after the psychologist selects sessions and clicks confirm.
  // patientIdOverride: usado quando chamado de Insights (currentPatient ainda não foi atualizado no state)
  const handleAnalysisConfirm = async ({ imageBase64, textContent, htmlContent, duration, sessionId, additionalSessionIds = [], template = null, canvasDataJson, canvasTextContent, sessionDate, patientIdOverride }) => {
    setPendingAnalysis(null)
    setAiDrawerOpen(true)
    setAnalysisResult(null)
    setAnalysisLoading(true)
    startProgress()

    const loadingId = showToast('Gerando análise clínica…', 'loading', { persistent: true })

    try {
      // Conteúdo já é autosalvo por página (modo caderno). Análise opera sobre
      // as anotações: noteIds selecionados ou [] = caderno inteiro (longitudinal).
      // imageBase64 = render do canvas gerado SOB DEMANDA (não persistido) p/ a visão da IA.
      const data = await api.createAnalysis({
        patientId: patientIdOverride || currentPatient?.id,
        noteIds: additionalSessionIds,
        template,
        imageBase64,
      })
      setAnalysisResult(data)
      finishProgress()
      dismissToast(loadingId)
      // Decremento local otimista — evita re-fetch; backend é a fonte de verdade
      setCurrentUser(u => {
        if (!u) return u
        const rem = u.analysesRemaining ?? 0
        if (rem >= UNLIMITED) return u   // ilimitado — não decrementar
        return { ...u, analysesRemaining: Math.max(0, rem - 1) }
      })
      showToast('Análise concluída', 'success', {
        description: `Hipóteses e padrões identificados para ${currentPatient?.name || 'o paciente'}.`,
        duration: 6000,
      })
    } catch (e) {
      // Extrair mensagem real do backend — realApi.js já faz throw new Error(json.message)
      const backendMsg = e?.message || 'Falha na análise.'
      // Erros de conteúdo/validação (422) não se resolve com retry — mostrar ação de retry só para erros de rede/servidor
      const isRetryable = backendMsg.includes('indisponível') || backendMsg.includes('conexão') || backendMsg.startsWith('Erro ')
      setAnalysisResult({ error: backendMsg })
      failProgress()
      dismissToast(loadingId)
      showToast('Falha na análise', 'error', {
        description: backendMsg,
        ...(isRetryable && {
          action: { label: 'Tentar novamente', onClick: () => handleAnalysisConfirm({ imageBase64, textContent, htmlContent, duration, sessionId, additionalSessionIds, template, canvasDataJson, canvasTextContent }) },
        }),
        duration: 10000,
      })
    } finally {
      setAnalysisLoading(false)
    }
  }

  // Re-análise com feedback — não consome crédito, usa Haiku
  const handleRefine = async (analysisId, feedback) => {
    setAnalysisLoading(true)
    setAnalysisResult(null)
    startProgress()
    const loadingId = showToast('Refinando análise…', 'loading', { persistent: true })
    try {
      const data = await api.refineAnalysis(analysisId, feedback)
      setAnalysisResult(data)
      finishProgress()
      dismissToast(loadingId)
      showToast('Análise refinada', 'success', { description: 'Resultado atualizado com seu feedback.' })
    } catch (e) {
      const backendMsg = e?.message || 'Falha no refinamento.'
      setAnalysisResult({ error: backendMsg })
      failProgress()
      dismissToast(loadingId)
      showToast('Falha no refinamento', 'error', { description: backendMsg, duration: 6000 })
    } finally {
      setAnalysisLoading(false)
    }
  }

  // Clique numa anotação → abre o caderno completo e scrolla até a página daquela sessão
  const handleReopenSession = (session) => {
    _openExistingAnnotation(currentPatient, session?.id || null)
  }

  // Called when the user closes the session without requesting AI analysis
  const handleSessionClose = async ({ textContent, htmlContent, duration, canvasDataJson, canvasTextContent, sessionDate } = {}) => {
    const sid = activeSessionRef.current
    const wasViewOnly = canvasViewOnly
    setSession(null)
    setActiveSessionType(null)
    setTextOpen(false)
    setCanvasOpen(false)
    setCanvasViewOnly(false)
    setViewOnlySessionId(null)
    setScrollToSessionId(null)
    setCurrentView('paciente')

    // Finish session in background — skip for view-only (sessão histórica já encerrada)
    if (sid && !wasViewOnly) {
      api.finishSession(sid, { textContent, htmlContent, canvasDataJson, canvasTextContent, durationSeconds: duration, sessionDate })
        .then(() => bumpSessions())  // atualiza lista de anotações
        .catch(() => {})
    }
    // Modo página-por-nota: criar/editar/apagar páginas altera as anotações no
    // backend mesmo sem "sessão" — sempre revalida a listagem ao voltar.
    if (!wasViewOnly) bumpSessions()
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':    return <Dashboard setCurrentView={handleSetView} currentUser={currentUser} />
      case 'pacientes':   return <Patients key={patientsRefreshKey} setCurrentView={handleSetView} onNovoCadastro={() => setCadastroOpen(true)} />
      case 'paciente':    return <Patient key={`${currentPatient?.id}-${sessionsRefreshKey}`} patient={currentPatient} setCurrentView={handleSetView} onSessao={() => handleSetView('sessao', currentPatient)} onReopenSession={handleReopenSession} onViewProntuario={() => setProntuarioOpen(true)} onSyncAgenda={_syncRecurringAgenda} />
      case 'agenda':      return <Agenda currentUser={currentUser} />
      case 'insights':    return <Insights
        onGoToPatient={(patient) => handleSetView('paciente', patient)}
        onOpenAnalysisHub={handleOpenAnalysisHub}
        currentUser={currentUser}
      />
      case 'analise-paciente': return <PatientAnalysisHub
        patient={currentPatient}
        currentUser={currentUser}
        onBack={() => setCurrentView('insights')}
        onOpenAnalysis={handleOpenAnalysis}
        onNewAnalysis={handleOpenAnalysisConfig}
      />
      case 'analise': return <AnalysisDetailView
        analysisId={currentAnalysisId}
        patient={currentPatient}
        currentUser={currentUser}
        onBack={() => setCurrentView('analise-paciente')}
        onNewAnalysis={handleOpenAnalysisConfig}
      />
      case 'financeiro':  return <Finance currentUser={currentUser} />
      case 'lembretes':   return <Reminders />
      case 'formularios': return <Forms />
      // Cadernos: cada paciente é um caderno. Clicar abre o canvas diretamente.
      // Paciente com páginas → recovery mode. Sem páginas → nova página de texto.
      case 'cadernos':    return <Notebooks
        onOpenCanvas={(patient) => {
          setCurrentPatient(patient)
          _openExistingAnnotation(patient) // backend é fonte de verdade — sempre carrega do servidor
        }}
        onOpenPatient={(patient) => {
          setCurrentPatient(patient)
          setCurrentView('paciente')
        }}
        openSessionPatientIds={new Set([
          ...(activeSessionId && currentPatient?.id ? [currentPatient.id] : []),
          ...backgroundSessions.map(s => s.patient?.id).filter(Boolean),
        ])}
      />
      case 'anotacoes':   return <Annotations key={sessionsRefreshKey} setCurrentView={handleSetView} onOpenCanvas={handleOpenCanvasFromHistory} />
      case 'teleatendimento': return <Telehealth onGoToPatient={(patient) => handleSetView('paciente', patient)} onNewSession={(patient) => handleSetView('paciente', patient)} />
      case 'configuracoes': return <Settings currentUser={currentUser} defaultTab={currentUser?.subscriptionStatus === 'trialing' ? 'plano' : 'perfil'} onProfileUpdate={(data) => setCurrentUser(u => ({ ...u, ...data }))} onOpenOnboarding={() => setOnboardingOpen(true)} onOpenTermos={() => setCurrentView('termos')} />
      case 'termos':      return <TermsOfUse onClose={() => setCurrentView('configuracoes')} />
      case 'privacidade': return <PrivacyPolicy onClose={() => setCurrentView('configuracoes')} />
      default:            return <Agenda currentUser={currentUser} />
    }
  }

  // ── Not authenticated ─────────────────────────────────────────────────────
  if (!currentUser) {
    // Rotas públicas acessíveis sem login
    if (currentView === 'termos') {
      return <Suspense fallback={null}><TermsOfUse onClose={() => { window.history.back() }} /></Suspense>
    }
    if (currentView === 'privacidade') {
      return <Suspense fallback={null}><PrivacyPolicy onClose={() => { window.history.back() }} /></Suspense>
    }
    return <Login onLogin={handleLogin} />
  }

  // ── Canvas full-screen — sem sidebar, sem topbar, sem shell ───────────────
  // O canvas ocupa 100vw × 100vh. Nada mais renderiza para não vazar
  // eventos de toque no tablet ou criar problemas de z-index.
  if (canvasOpen) {
    return (
      <>
        <Suspense fallback={
          <div style={{ position: 'fixed', inset: 0, background: '#1C1C1C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#8B8B8B' }}>
            <span style={{ width: 24, height: 24, border: '2px solid #333', borderTopColor: '#4A7C59', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            Carregando canvas...
          </div>
        }>
          <AnnotationSession
            patient={currentPatient}
            isOpen={canvasOpen}
            initialPageType={canvasInitialPageType}
            initialCanvasData={canvasInitialData}
            sessionId={canvasViewOnly ? viewOnlySessionId : activeSessionId}
            scrollToSessionId={scrollToSessionId}
            viewOnly={canvasViewOnly}
            onClose={handleSessionClose}
            onMinimize={handleMinimizeCanvas}
            onAnalyze={handleAnalyze}
            onAutosave={(id, data) => api.autosaveSession?.(id, data)}
            targetPage={annotationTargetPage}
            onPageChange={handleAnnotationPageChange}
            // ── Modo página-por-nota: cada página vira uma anotação própria ──
            onCreateNote={async ({ contentType, noteDate }) => {
              if (!currentPatient?.id) return null
              try { const n = await api.createNote(currentPatient.id, { contentType, noteDate }); return n?.id || null }
              catch { return null }
            }}
            onAutosaveNote={(noteId, data) => api.autosaveNote?.(noteId, data)}
            onDeleteNote={(noteId) => api.deleteNote?.(noteId)}
            onUpdateNote={async (noteId, data) => {
              try { await api.updateNote?.(noteId, data) }
              catch { showToast('Não foi possível atualizar a data da anotação', 'error'); return }
              if (data?.noteDate) showToast('Data da anotação atualizada', 'success', { duration: 2500 })
            }}
            onFetchSession={async (id) => {
              // Função auxiliar: converte sessão backend em página de texto
              const sessionToPage = (s) => {
                if (!s) return null
                const nd = s.sessionDate || null
                const cd = s.canvasData || s.canvasDataJson
                if (cd) {
                  try {
                    const parsed = JSON.parse(cd)
                    // Legado: caderno inteiro como array de páginas
                    if (Array.isArray(parsed) && parsed.length > 0)
                      return parsed.map(p => ({ ...p, sessionId: s.id, noteDate: p.noteDate || nd }))
                    // Página-por-nota: canvas vetorial { v, strokes }
                    if (parsed && Array.isArray(parsed.strokes))
                      return [{ id: `p-${s.id}`, pageType: 'draw', strokes: parsed.strokes, dataUrl: null, textHtml: null, sessionId: s.id, noteDate: nd }]
                    // Legado: canvas único como PNG { dataUrl }
                    if (parsed && parsed.dataUrl)
                      return [{ id: `p-${s.id}`, pageType: 'draw', dataUrl: parsed.dataUrl, textHtml: null, sessionId: s.id, noteDate: nd }]
                  } catch {}
                }
                const html = s.htmlContent ||
                  (s.textContent ? s.textContent.split('\n').map(l => `<p>${l || '<br>'}</p>`).join('') : '')
                if (html) return [{ id: `p-${s.id}`, pageType: 'text', textHtml: html, dataUrl: null, sessionId: s.id, noteDate: nd }]
                return null
              }
              try {
                // 1. Tenta a sessão específica
                if (id) {
                  const s = await api.getSession(id)
                  const pages = sessionToPage(s)
                  if (pages?.length) return JSON.stringify(pages)
                }
                // 2. Fallback: caderno completo (COM conteúdo) — reconstrói todas as páginas
                if (currentPatient?.id) {
                  const all = await api.getPatientNotebook(currentPatient.id)
                  const list = [...(all || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                  const pages = list.flatMap(s => sessionToPage(s) || [])
                  if (pages.length > 0) return JSON.stringify(pages)
                }
                return null
              } catch { return null }
            }}
          />
        </Suspense>
        {/* AnalyzeSessionsModal e AiDrawer aparecem após "Analisar com IA" no canvas */}
        {pendingAnalysis && (
          <AnalyzeSessionsModal
            pendingData={pendingAnalysis}
            patient={currentPatient}
            currentSessionId={pendingAnalysis.sessionId}
            onConfirm={handleAnalysisConfirm}
            onCancel={() => { setPendingAnalysis(null); setCurrentView('paciente') }}
          />
        )}
        <AiDrawer
          isOpen={aiDrawerOpen}
          onClose={() => setAiDrawerOpen(false)}
          onSave={handleSaveAnalysis}
          onRefine={handleRefine}
          onOpenFeedback={openFeedback}
          patient={currentPatient}
          result={analysisResult}
          loading={analysisLoading}
        />
        <FeedbackModal
          isOpen={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
          preset={feedbackPreset}
          currentView="sessao"
          api={api}
        />
        <ProgressBar />
        <ConfirmDialog />
        <ToastContainer />
        {paymentRequired && <PaymentModal onLogout={handleLogout} currentUser={currentUser} />}
      </>
    )
  }

  // ── App shell ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className={`sidebar-overlay${sidebarOpen ? ' visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      <Sidebar
        currentView={currentView}
        setCurrentView={handleSetView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      <div className="main">
        <Topbar
          currentView={currentView}
          patientName={currentPatient?.name}
          onHamburger={() => setSidebarOpen(o => !o)}
          onAiOpen={() => setAiDrawerOpen(true)}
          onNotifOpen={() => setNotifOpen(o => !o)}
          notifCount={notifItems.length}
          currentUser={currentUser}
          openSessionsCount={totalOpenSessions}
          onSessionsBadgeClick={() => setSessionsPanelOpen(o => !o)}
        />
        {/* Painel de notificações — eventos próximos 48h */}
        {notifOpen && (
          <div style={{ position: 'fixed', top: '64px', right: '16px', width: 'min(320px, calc(100vw - 32px))', background: 'var(--ow)', border: '1px solid var(--gr2)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)', zIndex: 4500, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gr2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--d)' }}>Próximos eventos (48h)</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--gr4)', lineHeight: 1 }} onClick={() => setNotifOpen(false)}>×</button>
            </div>
            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {notifItems.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--gr4)', fontSize: '13px' }}>Nenhum evento nas próximas 48h</div>
              ) : notifItems.map(ev => {
                const d = new Date(ev.startAt)
                const isToday = d.toDateString() === new Date().toDateString()
                const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                const dayStr = isToday ? 'Hoje' : d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })
                return (
                  <div key={ev.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--gr2)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: isToday ? 'var(--g50)' : 'var(--ow)', border: `1.5px solid ${isToday ? 'var(--g300)' : 'var(--gr2)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: '9px', color: isToday ? 'var(--g600)' : 'var(--gr4)', fontWeight: 700, lineHeight: 1 }}>{dayStr.split(' ')[0].toUpperCase()}</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: isToday ? 'var(--g600)' : 'var(--d)', lineHeight: 1 }}>{d.getDate()}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title || ev.patientName || 'Evento'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '2px' }}>{timeStr} · {ev.patientName || ev.type || ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--gr2)' }}>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--g600)', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", padding: 0 }}
                onClick={() => { setNotifOpen(false); handleSetView('agenda') }}>
                Ver agenda completa →
              </button>
            </div>
          </div>
        )}
        <div className="content"><Suspense fallback={null}>{renderView()}</Suspense></div>
      </div>

      {/* Bottom navigation — visível em ≤768px, substitui o hamburger no celular */}
      <BottomNav
        currentView={currentView}
        setCurrentView={handleSetView}
        onMorePress={() => setSidebarOpen(true)}
        openSessionsCount={totalOpenSessions}
        onSessionsBadgeClick={() => setSessionsPanelOpen(o => !o)}
      />

      {/* Sessions — apenas canvas agora, texto é um tipo de página dentro do canvas */}

      {/* Painel de sessões abertas */}
      {sessionsPanelOpen && (
        <OpenSessionsPanel
          sessions={[
            // Sessão no foreground (se houver)
            ...(activeSessionId ? [{ id: activeSessionId, type: activeSessionType, patient: currentPatient, startedAt: null }] : []),
            // Sessões em background
            ...backgroundSessions,
          ]}
          foregroundId={activeSessionId}
          onResume={handleResumeBackgroundSession}
          onEnd={handleEndBackgroundById}
          onStartNew={pendingNewSessionAction || null}
          onClose={() => { setSessionsPanelOpen(false); setPendingNewSessionAction(null) }}
        />
      )}

      {/* Pickers & modals */}
      <PatientPicker
        isOpen={pickerOpen}
        onSelect={handlePickerSelect}
        onCancel={() => setPickerOpen(false)}
      />

      <SessionTypePicker
        patient={typePickerPatient}
        onText={() => { const p = typePickerPatient; setTypePickerPatient(null); _openTextSession(p) }}
        onCanvas={() => { const p = typePickerPatient; setTypePickerPatient(null); _openCanvasSession(p) }}
        onCancel={() => setTypePickerPatient(null)}
      />

      <PreSessionBriefing
        patient={currentPatient}
        onStart={handleBriefingStart}
        onCancel={() => setBriefingOpen(false)}
        isOpen={briefingOpen}
      />

      <PatientFormModal
        isOpen={cadastroOpen}
        onClose={() => setCadastroOpen(false)}
        onSave={async (form) => {
          const patient = await api.createPatient(form)
          setCadastroOpen(false)
          bumpPatients()
          // Agenda automática: cria eventos recorrentes se horário definido
          if (form.recurringDayOfWeek && form.recurringTime) {
            _syncRecurringAgenda(patient.id, patient.name, form, false).catch(() => {})
            showToast(`${patient.name} adicionado · agenda sincronizada`, 'success')
          } else {
            showToast(`${patient.name} adicionado com sucesso`, 'success')
          }
          setCurrentView('pacientes')
        }}
      />

      {/* Multi-session selector — shown between session close and AI Drawer open */}
      {pendingAnalysis && (
        <AnalyzeSessionsModal
          pendingData={pendingAnalysis}
          patient={currentPatient}
          currentSessionId={pendingAnalysis.sessionId}
          onConfirm={handleAnalysisConfirm}
          onCancel={() => {
            setPendingAnalysis(null)
            // Navigate to patient view so notes aren't silently discarded
            setCurrentView('paciente')
          }}
        />
      )}

      {/* Modal de configuração de análise — disparado de Insights/Hub/DetailView */}
      {analysisConfigTarget && (
        <AnalysisConfigModal
          patient={analysisConfigTarget}
          currentUser={currentUser}
          onConfirm={({ noteIds, template }) => {
            const patient = analysisConfigTarget
            setAnalysisConfigTarget(null)
            setCurrentPatient(patient)
            handleAnalysisConfirm({
              patientIdOverride: patient.id,
              additionalSessionIds: noteIds,
              template,
              imageBase64: null,
            })
          }}
          onCancel={() => setAnalysisConfigTarget(null)}
        />
      )}

      {/* AI Drawer */}
      <AiDrawer
        isOpen={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        onSave={handleSaveAnalysis}
        onRefine={handleRefine}
        onOpenFeedback={openFeedback}
        patient={currentPatient}
        result={analysisResult}
        loading={analysisLoading}
      />

      {/* Onboarding */}
      <OnboardingTour isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

      {/* Prontuário A4 — overlay sobre o perfil do paciente */}
      {prontuarioOpen && currentView === 'paciente' && (
        <MedicalRecordView
          patient={currentPatient}
          onClose={() => setProntuarioOpen(false)}
          onNewAnnotation={() => { setProntuarioOpen(false); handleSetView('sessao', currentPatient) }}
          onOpenCanvas={handleOpenCanvasFromHistory}
          onReopenSession={handleReopenSession}
        />
      )}

      {/* Botão flutuante de feedback — sutil, sempre acessível */}
      <button
        onClick={() => openFeedback(null)}
        title="Feedback, sugestão ou problema?"
        style={{
          position: 'fixed',
          bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
          right: '16px',
          zIndex: 8500,
          background: 'var(--w)',
          border: '1px solid var(--gr2)',
          borderRadius: '20px',
          padding: '7px 12px 7px 10px',
          display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.10)',
          cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
          color: 'var(--gr5)',
          fontWeight: 500,
          transition: 'box-shadow 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.14)'
          e.currentTarget.style.borderColor = 'var(--gr3)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.10)'
          e.currentTarget.style.borderColor = 'var(--gr2)'
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span className="feedback-btn-label">Feedback</span>
      </button>

      {/* Modal de feedback/bug/sugestão */}
      <FeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        preset={feedbackPreset}
        currentView={currentView}
        api={api}
      />

      {/* Sistema de feedback global */}
      <ProgressBar />
      <ConfirmDialog />
      <ToastContainer />

      {/* Bloqueio por inadimplência — modal de planos com promoção de retomada */}
      {paymentRequired && <PaymentModal onLogout={handleLogout} currentUser={currentUser} />}

      {/* Banner LGPD — aparece uma vez, salvo em localStorage */}
      <LgpdBanner onShowTermos={() => setCurrentView('privacidade')} />

      {/* Banner de inadimplência em período de graça */}
      {currentUser?.graceDaysRemaining > 0 && !paymentRequired && (
        <div className="grace-banner" style={{
          background: '#7C4D00', color: '#FFF3E0',
          padding: '10px 20px', fontSize: '13px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.2)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>
            Pagamento pendente — você tem ainda <strong>{currentUser.graceDaysRemaining} dia{currentUser.graceDaysRemaining !== 1 ? 's' : ''}</strong> para regularizar antes do bloqueio.
          </span>
          <button
            onClick={() => setCurrentView('configuracoes')}
            style={{ padding: '5px 14px', background: '#FF8F00', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}>
            Regularizar agora →
          </button>
        </div>
      )}
    </>
  )
}
