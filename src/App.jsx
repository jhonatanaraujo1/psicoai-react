import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import './styles/globals.css'

import { auth, api } from './services'
import { showToast, dismissToast, ToastContainer } from './components/Toast'
import ProgressBar, { startProgress, finishProgress, failProgress } from './components/ProgressBar'
import ConfirmDialog, { confirm } from './components/ConfirmDialog'
import OnboardingTour from './components/OnboardingTour'
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
import CadastroModal from './components/CadastroModal'
import AnalyzeSessionsModal from './components/AnalyzeSessionsModal'
import QuickNoteModal from './components/QuickNoteModal'

import Login from './views/Login'
import Dashboard from './views/Dashboard'
import Pacientes from './views/Pacientes'
import Paciente from './views/Paciente'
import ProntuarioView from './views/ProntuarioView'
// Lazy: carrega apenas quando uma sessão é aberta
const AnnotationSession = lazy(() => import('./views/AnnotationSession'))
import Agenda from './views/Agenda'
import Insights from './views/Insights'
import Financeiro from './views/Financeiro'
import Lembretes from './views/Lembretes'
import Formularios from './views/Formularios'
import Anotacoes from './views/Anotacoes'
import Cadernos from './views/Cadernos'
import Teleatendimento from './views/Teleatendimento'
import Configuracoes from './views/Configuracoes'
import TermosDeUso from './views/TermosDeUso'

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState(() => auth.getStoredUser())

  // ── Onboarding (declarado antes de handleLogin para evitar TDZ) ───────────
  const [onboardingOpen, setOnboardingOpen] = useState(false)

  const handleLogin = (user) => {
    setCurrentUser(user)
    if (!localStorage.getItem('psicoai_onboarding_seen')) {
      setOnboardingOpen(true)
    }
  }
  const handleLogout = () => { auth.logout(); setCurrentUser(null) }

  // ── Prontuário overlay (A4 view) — abre sobre o perfil do paciente ──────
  const [prontuarioOpen, setProntuarioOpen] = useState(false)

  // ── Payment required (conta bloqueada) ───────────────────────────────────
  const [paymentRequired, setPaymentRequired] = useState(false)

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

    if (google === 'connected') {
      window.history.replaceState({}, '', window.location.pathname)
      showToast('✓ Google conectado com sucesso!', 'success')
      setCurrentView('configuracoes')
    }
    if (google === 'error') {
      window.history.replaceState({}, '', window.location.pathname)
      showToast('Erro ao conectar com o Google. Tente novamente.', 'error')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sincroniza sessões abertas do backend ao iniciar ──────────────────────
  // Garante que sessões abertas em outra aba ou antes de um reload apareçam no painel
  useEffect(() => {
    if (!currentUser) return
    api.getOpenSessions().then(sessions => {
      if (!sessions || sessions.length === 0) return
      setBackgroundSessions(prev => {
        const existingIds = new Set(prev.map(s => s.id))
        const toAdd = sessions
          .filter(s => s.status === 'open' && !existingIds.has(s.id))
          .map(s => ({
            id: s.id,
            type: s.type,
            patient: { id: s.patientId, name: s.patientName },
            startedAt: new Date(s.createdAt).getTime(),
          }))
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev
      })
    }).catch(e => console.warn('[PsicoAI] getOpenSessions failed:', e))
  }, [currentUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation — persiste em sessionStorage (por aba, não cross-tab) ────────
  // sessionStorage sobrevive reload mas não fechar aba — comportamento correto
  const [currentView, setCurrentViewRaw] = useState(() => {
    try {
      const saved = sessionStorage.getItem('psicoai_nav_view')
      // Vistas que requerem contexto de paciente — só restaura se houver paciente salvo
      const needsPatient = ['paciente']
      if (saved && needsPatient.includes(saved)) {
        const hasPat = !!sessionStorage.getItem('psicoai_nav_patient') ||
                       !!JSON.parse(localStorage.getItem('psicoai_active_session') || 'null')?.patient
        return hasPat ? saved : 'agenda'
      }
      return saved || 'agenda'
    } catch { return 'agenda' }
  })

  const setCurrentView = (view) => {
    setCurrentViewRaw(view)
    try { sessionStorage.setItem('psicoai_nav_view', view) } catch {}
  }

  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Patient context ──────────────────────────────────────────────────────
  // Inicializa do localStorage — prioridade: sessão ativa (canvas/text) > quicknote > nav context
  const [currentPatient, setCurrentPatientRaw] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('psicoai_active_session') || 'null')
      if (s?.patient) return s.patient
      // Fallback: quicknote
      const qn = JSON.parse(localStorage.getItem('psicoai_quicknote_state') || 'null')
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
      const s = JSON.parse(localStorage.getItem('psicoai_active_session') || 'null')
      if (!s?.sessionId) return null
      // Ignora sessões com mais de 8 horas (provável abandono)
      const age = Date.now() - (s.startedAt || 0)
      if (age > 8 * 60 * 60 * 1000) { localStorage.removeItem('psicoai_active_session'); return null }
      activeSessionRef.current = s.sessionId
      return s.sessionId
    } catch { return null }
  })

  const [activeSessionType, setActiveSessionType] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('psicoai_active_session') || 'null')
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
      const current = (() => { try { return JSON.parse(localStorage.getItem('psicoai_active_session') || 'null') } catch { return null } })()
      const pat = currentPatient || current?.patient || null
      localStorage.setItem('psicoai_active_session', JSON.stringify({
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
      localStorage.removeItem('psicoai_active_session')
      const params = new URLSearchParams(window.location.search)
      if (params.has('sessao')) {
        params.delete('sessao')
        params.delete('tipo')
        const q = params.toString()
        window.history.replaceState({}, '', q ? `${window.location.pathname}?${q}` : window.location.pathname)
      }
    }
  }, [activeSessionId, activeSessionType]) // eslint-disable-line react-hooks/exhaustive-deps


  // ── QuickNote persistence — localStorage + URL ?nota=<patientId> ─────────
  // DECLARADO ANTES do useEffect para evitar TDZ na dependency array [quickNoteOpen]
  // Inicializa do localStorage/URL — sobrevive refresh igual ao canvas
  const [quickNoteOpen, setQuickNoteOpen] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.has('nota')) return true
      const qn = JSON.parse(localStorage.getItem('psicoai_quicknote_state') || 'null')
      return qn?.open === true && !!qn?.patientId
    } catch { return false }
  })

  // Mesmo padrão do canvas: sobrevive refresh, fechar aba e redeploy do Vercel.
  // O rascunho do texto já é persistido por psicoai_quicknote_<id> no próprio modal.
  useEffect(() => {
    if (quickNoteOpen && currentPatient?.id) {
      localStorage.setItem('psicoai_quicknote_state', JSON.stringify({
        open: true,
        patientId:   currentPatient.id,
        patientName: currentPatient.name,
        savedAt:     Date.now(),
      }))
      const params = new URLSearchParams(window.location.search)
      params.set('nota', currentPatient.id)
      window.history.replaceState({}, '', `${window.location.pathname}?${params}`)
    } else {
      localStorage.removeItem('psicoai_quicknote_state')
      const params = new URLSearchParams(window.location.search)
      if (params.has('nota')) {
        params.delete('nota')
        const q = params.toString()
        window.history.replaceState({}, '', q ? `${window.location.pathname}?${q}` : window.location.pathname)
      }
    }
  }, [quickNoteOpen, currentPatient?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session modals ────────────────────────────────────────────────────────
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  // quickNoteOpen foi movido para antes do useEffect de persistência (evitar TDZ)
  const [pickerMode, setPickerMode] = useState('live') // 'live' | 'quicknote'
  // textOpen mantido como alias para não quebrar referências internas — sempre false
  const [textOpen, setTextOpen] = useState(false)
  const [canvasInitialPageType, setCanvasInitialPageType] = useState(null)
  // Inicializa do localStorage — sobrevive refresh, deploy do Vercel, fechar aba
  const [canvasOpen, setCanvasOpen] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('psicoai_active_session') || 'null')
      if (!s?.patientId) return false
      return (Date.now() - (s.startedAt || 0)) < 8 * 3600 * 1000
    } catch { return false }
  })
  const [cadastroOpen, setCadastroOpen] = useState(false)
  // Pre-loaded content for reopening a session
  const [textInitialHtml, setTextInitialHtml] = useState('')
  const [canvasInitialData, setCanvasInitialData] = useState(null)
  // Modo visualização de sessão histórica — não cria sessão ativa, sem badge
  const [canvasViewOnly, setCanvasViewOnly] = useState(false)
  const [viewOnlySessionId, setViewOnlySessionId] = useState(null)

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
      localStorage.setItem('psicoai_active_session', JSON.stringify({
        sessionId:   null,
        sessionType: 'canvas',
        patientId:   pat.id,
        patient:     { id: pat.id, name: pat.name },
        startedAt:   Date.now(),
      }))
    }
    api.createSession({ patientId: pat?.id, type: 'text' })
      .then(session => setSession(session.id))
      .catch(e => console.warn('[PsicoAI] createSession failed:', e))
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
      localStorage.setItem('psicoai_active_session', JSON.stringify({
        sessionId:   null,
        sessionType: 'canvas',
        patientId:   pat.id,
        patient:     { id: pat.id, name: pat.name },
        startedAt:   Date.now(),
      }))
    }
    api.createSession({ patientId: pat?.id, type: 'canvas' })
      .then(session => setSession(session.id))
      .catch(e => console.warn('[PsicoAI] createSession (canvas) failed:', e))
    setCanvasOpen(true)
  }

  // Verifica se paciente já tem anotações salvas no localStorage
  const _hasAnnotations = (patientId) => {
    try {
      const raw = localStorage.getItem(`psicoai_canvas2_p${patientId}`)
      if (!raw) return false
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) && parsed.length > 0
    } catch { return false }
  }

  // Abre o prontuário existente de um paciente direto (sem picker de tipo)
  const _openExistingAnnotation = (patient) => {
    const pat = patient || currentPatient
    activeSessionRef.current = null
    setCanvasViewOnly(false)
    setViewOnlySessionId(null)
    setCurrentPatient(pat)
    setActiveSessionType('canvas')
    setCanvasInitialPageType(null) // recovery — não adiciona nova página
    if (pat) {
      localStorage.setItem('psicoai_active_session', JSON.stringify({
        sessionId: null, sessionType: 'canvas', patientId: pat.id,
        patient: { id: pat.id, name: pat.name }, startedAt: Date.now(),
      }))
    }
    api.createSession({ patientId: pat?.id, type: 'canvas' })
      .then(s => setSession(s.id))
      .catch(e => console.warn('[PsicoAI] createSession failed:', e))
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

  // ── QuickNote handlers ────────────────────────────────────────────────────

  const handleQuickNoteSave = async ({ textContent, htmlContent, noteType }) => {
    try {
      const session = await api.createSession({ patientId: currentPatient?.id, type: 'text', noteType })
      await api.finishSession(session.id, { textContent, htmlContent, durationSeconds: 0 })
      setQuickNoteOpen(false)
      const name = currentPatient?.name || 'paciente'
      showToast('Anotação salva', 'success', {
        description: `Prontuário de ${name} atualizado.`,
        action: { label: 'Ver prontuário →', onClick: () => { setCurrentView('paciente') } },
        duration: 5000,
      })
    } catch (e) {
      showToast('Erro ao salvar anotação', 'error', { description: e.message, duration: 5000 })
    }
  }

  const handleQuickNoteAnalyze = async ({ textContent, htmlContent, noteType }) => {
    try {
      const session = await api.createSession({ patientId: currentPatient?.id, type: 'text', noteType })
      setQuickNoteOpen(false)
      // Reutiliza o fluxo de análise existente — AnalyzeSessionsModal + AiDrawer
      setPendingAnalysis({ textContent, htmlContent, imageBase64: null, duration: 0, sessionId: session.id })
    } catch (e) {
      showToast('Erro ao iniciar análise', 'error', { description: e.message, duration: 5000 })
    }
  }

  // QuickNote → canvas: pula o briefing, abre canvas direto (sem timer)
  const handleQuickNoteCanvas = () => {
    setQuickNoteOpen(false)
    activeSessionRef.current = null
    setActiveSessionType('canvas')
    if (currentPatient) {
      localStorage.setItem('psicoai_active_session', JSON.stringify({
        sessionId: null, sessionType: 'canvas',
        patient: { id: currentPatient.id, name: currentPatient.name },
        startedAt: Date.now(),
      }))
    }
    api.createSession({ patientId: currentPatient?.id, type: 'canvas' })
      .then(s => setSession(s.id))
      .catch(e => {
        const isOpenSession = e.message?.includes('sessão aberta')
        if (isOpenSession) {
          showToast('Anotação em andamento', 'warning', {
            description: `${currentPatient?.name || 'Este paciente'} já tem uma anotação em aberto. As novas anotações serão salvas localmente.`,
            action: { label: 'Ver em aberto →', onClick: () => setSessionsPanelOpen(true) },
            duration: 8000,
          })
        } else {
          console.warn('[PsicoAI] createSession (canvas) failed:', e)
        }
      })
    setCanvasOpen(true)
  }

  const handleBriefingStart = ({ meetLink, type }) => {
    setBriefingOpen(false)
    activeSessionRef.current = null
    setActiveSessionType(type)
    // Persiste patient imediatamente — o sessionId chega async via createSession
    if (currentPatient) {
      localStorage.setItem('psicoai_active_session', JSON.stringify({
        sessionId:   null,
        sessionType: type,
        patient:     { id: currentPatient.id, name: currentPatient.name },
        startedAt:   Date.now(),
      }))
    }

    // Define o tipo de página inicial: canvas livre → draw, texto → text
    setCanvasInitialPageType(type === 'canvas' ? 'draw' : 'text')

    // Open the session view immediately (no wait) and create the backend record in background.
    // autosaveSession only fires after 30s, so the ID will be ready well before it's needed.
    api.createSession({ patientId: currentPatient?.id, type, meetLink })
      .then(session => setSession(session.id))
      .catch(e => {
        const isOpenSession = e.message?.includes('sessão aberta')
        if (isOpenSession) {
          showToast('Anotação em andamento', 'warning', {
            description: `${currentPatient?.name || 'Este paciente'} já tem uma anotação em aberto. As novas anotações serão salvas localmente.`,
            action: { label: 'Ver em aberto →', onClick: () => setSessionsPanelOpen(true) },
            duration: 8000,
          })
        } else {
          console.warn('[PsicoAI] createSession failed, session will not be persisted:', e)
        }
      })

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
      if (sessionId) {
        await api.finishSession(sessionId, { textContent, htmlContent, imageBase64, canvasDataJson, canvasTextContent, durationSeconds: duration, sessionDate })
      }
      const effectiveId = sessionId || ('s-mock-' + Date.now())
      const data = await api.createAnalysis({ sessionId: effectiveId, additionalSessionIds: [], template: null, patientId: currentPatient?.id })
      setAnalysisResult(data)
      finishProgress()
      showToast('✓ Análise pronta!', 'success', {
        description: `Hipóteses identificadas para ${currentPatient?.name || 'o paciente'}.`,
        action: { label: 'Ver agora →', onClick: () => setAiDrawerOpen(true) },
        duration: 10000,
      })
    } catch (e) {
      failProgress()
      showToast('Falha na análise em segundo plano', 'error', {
        description: 'Verifique sua conexão e tente novamente.',
        duration: 6000,
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
  const handleAnalysisConfirm = async ({ imageBase64, textContent, htmlContent, duration, sessionId, additionalSessionIds = [], template = null, canvasDataJson, canvasTextContent, sessionDate }) => {
    setPendingAnalysis(null)
    setAiDrawerOpen(true)
    setAnalysisResult(null)
    setAnalysisLoading(true)
    startProgress()

    const loadingId = showToast('Gerando análise clínica…', 'loading', { persistent: true })

    try {
      if (sessionId) {
        await api.finishSession(sessionId, { textContent, htmlContent, imageBase64, canvasDataJson, canvasTextContent, durationSeconds: duration, sessionDate })
      }
      const effectiveSessionId = sessionId || ('s-mock-' + Date.now())
      const data = await api.createAnalysis({ sessionId: effectiveSessionId, additionalSessionIds, template, patientId: currentPatient?.id })
      setAnalysisResult(data)
      finishProgress()
      dismissToast(loadingId)
      showToast('Análise concluída', 'success', {
        description: `Hipóteses e padrões identificados para ${currentPatient?.name || 'o paciente'}.`,
        duration: 6000,
      })
    } catch (e) {
      setAnalysisResult({ error: 'Falha na análise. Tente novamente.' })
      failProgress()
      dismissToast(loadingId)
      showToast('Falha na análise', 'error', {
        description: 'Verifique sua conexão e tente novamente.',
        action: { label: 'Tentar novamente', onClick: () => handleAnalysisConfirm({ imageBase64, textContent, htmlContent, duration, sessionId, additionalSessionIds, template, canvasDataJson, canvasTextContent }) },
        duration: 8000,
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
      setAnalysisResult({ error: 'Falha no refinamento. Tente novamente.' })
      failProgress()
      dismissToast(loadingId)
      showToast('Falha no refinamento', 'error', { duration: 6000 })
    } finally {
      setAnalysisLoading(false)
    }
  }

  // Reopen a finished session for continued annotation (creates a new session record)
  const handleReopenSession = (session) => {
    activeSessionRef.current = null // will be set once new session is created
    // Prepare initial content
    const html = session.htmlContent ||
      (session.textContent ? session.textContent.split('\n').map(l => `<p>${l}</p>`).join('') : '')
    // Create new session record in background
    api.createSession({ patientId: currentPatient?.id, type: session.type || 'text' })
      .then(s => setSession(s.id))
      .catch(e => console.warn('[PsicoAI] createSession (reopen) failed:', e))

    setCanvasInitialPageType(null) // recovery mode: não adiciona nova página
    setCanvasOpen(true)
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
    setCurrentView('paciente')

    // Finish session in background — skip for view-only (sessão histórica já encerrada)
    if (sid && !wasViewOnly) {
      api.finishSession(sid, { textContent, htmlContent, canvasDataJson, canvasTextContent, durationSeconds: duration, sessionDate }).catch(() => {})
    }
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':    return <Dashboard setCurrentView={handleSetView} currentUser={currentUser} />
      case 'pacientes':   return <Pacientes setCurrentView={handleSetView} onNovoCadastro={() => setCadastroOpen(true)} />
      case 'paciente':    return <Paciente patient={currentPatient} setCurrentView={handleSetView} onSessao={() => handleSetView('sessao', currentPatient)} onQuickNote={() => setQuickNoteOpen(true)} onReopenSession={handleReopenSession} onViewProntuario={() => setProntuarioOpen(true)} />
      case 'agenda':      return <Agenda currentUser={currentUser} />
      case 'insights':    return <Insights onGoToPatient={(patient) => handleSetView('paciente', patient)} />
      case 'financeiro':  return <Financeiro />
      case 'lembretes':   return <Lembretes />
      case 'formularios': return <Formularios />
      // Cadernos: cada paciente é um caderno. Clicar abre o canvas diretamente.
      // Paciente com páginas → recovery mode. Sem páginas → nova página de texto.
      case 'cadernos':    return <Cadernos
        onOpenCanvas={(patient) => {
          setCurrentPatient(patient)
          if (_hasAnnotations(patient.id)) { _openExistingAnnotation(patient) }
          else { _openTextSession(patient) }
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
      case 'anotacoes':   return <Anotacoes setCurrentView={handleSetView} onOpenCanvas={handleOpenCanvasFromHistory} />
      case 'teleatendimento': return <Teleatendimento />
      case 'configuracoes': return <Configuracoes currentUser={currentUser} onProfileUpdate={(data) => setCurrentUser(u => ({ ...u, ...data }))} onOpenOnboarding={() => setOnboardingOpen(true)} onOpenTermos={() => setCurrentView('termos')} />
      case 'termos':      return <TermosDeUso onClose={() => setCurrentView('configuracoes')} />
      default:            return <Agenda currentUser={currentUser} />
    }
  }

  // ── Not authenticated ─────────────────────────────────────────────────────
  if (!currentUser) {
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
            sessionId={canvasViewOnly ? viewOnlySessionId : activeSessionId}
            viewOnly={canvasViewOnly}
            onClose={handleSessionClose}
            onMinimize={handleMinimizeCanvas}
            onAnalyze={handleAnalyze}
            onAutosave={(id, data) => api.autosaveSession?.(id, data)}
            onFetchSession={async (id) => { try { const s = await api.getSession(id); return s?.canvasData ?? null } catch { return null } }}
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
          patient={currentPatient}
          result={analysisResult}
          loading={analysisLoading}
        />
        <ProgressBar />
        <ConfirmDialog />
        <ToastContainer />
        {paymentRequired && <PaymentModal onLogout={handleLogout} />}
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
          currentUser={currentUser}
          openSessionsCount={totalOpenSessions}
          onSessionsBadgeClick={() => setSessionsPanelOpen(o => !o)}
        />
        <div className="content">{renderView()}</div>
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

      <CadastroModal
        isOpen={cadastroOpen}
        onClose={() => setCadastroOpen(false)}
        onSave={async (form) => {
          const patient = await api.createPatient(form)
          setCadastroOpen(false)
          showToast(`${patient.name} adicionado com sucesso`, 'success')
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

      {/* AI Drawer */}
      <AiDrawer
        isOpen={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        onSave={handleSaveAnalysis}
        onRefine={handleRefine}
        patient={currentPatient}
        result={analysisResult}
        loading={analysisLoading}
      />

      {/* QuickNote — anotação rápida sem timer */}
      <QuickNoteModal
        isOpen={quickNoteOpen}
        patient={currentPatient}
        onClose={() => setQuickNoteOpen(false)}
        onSave={handleQuickNoteSave}
        onAnalyze={handleQuickNoteAnalyze}
        onOpenCanvas={handleQuickNoteCanvas}
      />

      {/* Onboarding */}
      <OnboardingTour isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

      {/* Prontuário A4 — overlay sobre o perfil do paciente */}
      {prontuarioOpen && currentView === 'paciente' && (
        <ProntuarioView
          patient={currentPatient}
          onClose={() => setProntuarioOpen(false)}
          onNewAnnotation={() => { setProntuarioOpen(false); handleSetView('sessao', currentPatient) }}
          onOpenCanvas={handleOpenCanvasFromHistory}
          onReopenSession={handleReopenSession}
        />
      )}

      {/* Sistema de feedback global */}
      <ProgressBar />
      <ConfirmDialog />
      <ToastContainer />

      {/* Bloqueio por inadimplência — modal de planos com promoção de retomada */}
      {paymentRequired && <PaymentModal onLogout={handleLogout} />}

      {/* Banner LGPD — aparece uma vez, salvo em localStorage */}
      <LgpdBanner onShowTermos={() => setCurrentView('termos')} />

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
