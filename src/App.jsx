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
import PatientPicker from './components/PatientPicker'
import CadastroModal from './components/CadastroModal'
import AnalyzeSessionsModal from './components/AnalyzeSessionsModal'
import QuickNoteModal from './components/QuickNoteModal'

import Login from './views/Login'
import Dashboard from './views/Dashboard'
import Pacientes from './views/Pacientes'
import Paciente from './views/Paciente'
// Lazy: excalidraw é ~1.8MB — só carrega quando o canvas é aberto
const CanvasSession = lazy(() => import('./views/CanvasSession'))
import TextSession from './views/TextSession'
import Agenda from './views/Agenda'
import Insights from './views/Insights'
import Financeiro from './views/Financeiro'
import Lembretes from './views/Lembretes'
import Formularios from './views/Formularios'
import Anotacoes from './views/Anotacoes'
import Teleatendimento from './views/Teleatendimento'
import Configuracoes from './views/Configuracoes'

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

  // ── Navigation ───────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Patient context ──────────────────────────────────────────────────────
  // Inicializa do localStorage — prioridade: sessão ativa (canvas/text) > quicknote
  const [currentPatient, setCurrentPatient] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('psicoai_active_session') || 'null')
      if (s?.patient) return s.patient
      // Fallback: quicknote aberto antes do refresh
      const qn = JSON.parse(localStorage.getItem('psicoai_quicknote_state') || 'null')
      if (qn?.open && qn?.patientId) return { id: qn.patientId, name: qn.patientName }
      return null
    } catch { return null }
  })

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
      localStorage.setItem('psicoai_active_session', JSON.stringify({
        sessionId:   activeSessionId,
        sessionType: activeSessionType,
        patient:     currentPatient ? { id: currentPatient.id, name: currentPatient.name } : (current?.patient || null),
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
  const [textOpen, setTextOpen] = useState(false)
  // Inicializa do localStorage — sobrevive refresh, deploy do Vercel, fechar aba
  const [canvasOpen, setCanvasOpen] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('psicoai_active_session') || 'null')
      if (!s?.sessionId || s.sessionType !== 'canvas') return false
      return (Date.now() - (s.startedAt || 0)) < 8 * 3600 * 1000
    } catch { return false }
  })
  const [cadastroOpen, setCadastroOpen] = useState(false)
  // Pre-loaded content for reopening a session
  const [textInitialHtml, setTextInitialHtml] = useState('')
  const [canvasInitialData, setCanvasInitialData] = useState(null)

  // ── AI Drawer ─────────────────────────────────────────────────────────────
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // ── Analyze Sessions Modal ────────────────────────────────────────────────
  // Holds { imageBase64, textContent, htmlContent, duration, sessionId } while user picks sessions
  const [pendingAnalysis, setPendingAnalysis] = useState(null)

  // Sessão está "em background" quando existe mas a view está fechada (usuário navegou para outra tela)
  // ── Handlers ──────────────────────────────────────────────────────────────

  // Inicia nova sessão (quicknote ou live) — chamado diretamente ou após gate
  const _startNewSession = (view, patient) => {
    if (view === 'sessao') {
      if (patient) { setCurrentPatient(patient); setQuickNoteOpen(true) }
      else { setPickerMode('quicknote'); setPickerOpen(true) }
    } else if (view === 'liveSession') {
      if (patient) { setCurrentPatient(patient); setBriefingOpen(true) }
      else { setPickerMode('live'); setPickerOpen(true) }
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
    if (pickerMode === 'quicknote') {
      setQuickNoteOpen(true)
    } else {
      setBriefingOpen(true)
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
      .catch(e => console.warn('[PsicoAI] createSession (canvas) failed:', e))
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

    // Open the session view immediately (no wait) and create the backend record in background.
    // autosaveSession only fires after 30s, so the ID will be ready well before it's needed.
    api.createSession({ patientId: currentPatient?.id, type, meetLink })
      .then(session => setSession(session.id))
      .catch(e => console.warn('[PsicoAI] createSession failed, session will not be persisted:', e))

    if (type === 'text') setTextOpen(true)
    else setCanvasOpen(true)
  }

  // ── Handlers de minimizar: move sessão foreground → background ──────────
  const handleMinimizeCanvas = () => {
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
  }

  const handleMinimizeText = () => {
    if (activeSessionId) {
      setBackgroundSessions(prev =>
        prev.find(s => s.id === activeSessionId) ? prev : [
          ...prev,
          { id: activeSessionId, type: 'text', patient: currentPatient, startedAt: Date.now() },
        ]
      )
      setSession(null)
      setActiveSessionType(null)
    }
    setTextOpen(false)
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
    if (bgSession.type === 'canvas') { setCanvasOpen(true); setTextOpen(false) }
    else { setTextOpen(true); setCanvasOpen(false) }
  }

  // ── Encerrar sessão do background ────────────────────────────────────────
  const handleEndBackgroundById = async (bgSession) => {
    const ok = await confirm({
      title: 'Encerrar sessão?',
      message: `A sessão de ${bgSession.patient?.name || 'paciente'} será encerrada. As anotações autosalvas ficam no prontuário.`,
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
    showToast('Sessão encerrada', 'info', { description: `${bgSession.patient?.name || 'Paciente'} — sem análise IA.`, duration: 4000 })
  }

  // Abre canvas histórico (sessão já encerrada) para visualização/edição
  const handleOpenCanvasFromHistory = (session) => {
    const patient = { id: session.patientId, name: session.patientName }
    setCurrentPatient(patient)
    setCanvasInitialData(session.canvasDataJson || null)
    // Abre canvas com ID da sessão histórica — sem novo timer de sessão ativa
    setSession(session.id)
    setActiveSessionType('canvas')
    setCanvasOpen(true)
  }

  // Volta para a sessão em background — reabre a view sem criar nova sessão
  const handleReturnToSession = () => {
    if (activeSessionType === 'canvas') setCanvasOpen(true)
    else setTextOpen(true)
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
    showToast('Sessão encerrada', 'info', {
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

  // Step 1 of the analyze flow: close the session view and open the session-picker modal.
  // The actual API calls happen only after the psychologist confirms in the modal.
  const handleAnalyze = ({ imageBase64, textContent, htmlContent, duration, canvasDataJson, canvasTextContent }) => {
    const sid = activeSessionRef.current
    setSession(null)
    setActiveSessionType(null)
    setCanvasOpen(false)
    setTextOpen(false)
    // Store pending data — AnalyzeSessionsModal will collect additionalSessionIds, then call handleAnalysisConfirm
    setPendingAnalysis({ imageBase64, textContent, htmlContent, duration, sessionId: sid, canvasDataJson, canvasTextContent })
  }

  // Step 2: called by AnalyzeSessionsModal after the psychologist selects sessions and clicks confirm.
  const handleAnalysisConfirm = async ({ imageBase64, textContent, htmlContent, duration, sessionId, additionalSessionIds = [], template = null, canvasDataJson, canvasTextContent }) => {
    setPendingAnalysis(null)
    setAiDrawerOpen(true)
    setAnalysisResult(null)
    setAnalysisLoading(true)
    startProgress()

    const loadingId = showToast('Gerando análise clínica…', 'loading', { persistent: true })

    try {
      if (sessionId) {
        await api.finishSession(sessionId, { textContent, htmlContent, imageBase64, canvasDataJson, canvasTextContent, durationSeconds: duration })
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

    if (session.type === 'canvas') {
      setCanvasInitialData(null) // canvas loads from localStorage by patient/sessionId
      setCanvasOpen(true)
    } else {
      setTextInitialHtml(html)
      setTextOpen(true)
    }
  }

  // Called when the user closes the session without requesting AI analysis
  const handleSessionClose = async ({ textContent, htmlContent, duration, canvasDataJson, canvasTextContent } = {}) => {
    const sid = activeSessionRef.current
    setSession(null)
    setActiveSessionType(null)
    setTextOpen(false)
    setCanvasOpen(false)
    setCurrentView('paciente')

    // Finish session in background so notes are not lost (fire-and-forget)
    if (sid) {
      api.finishSession(sid, { textContent, htmlContent, canvasDataJson, canvasTextContent, durationSeconds: duration }).catch(() => {})
    }
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':    return <Dashboard setCurrentView={handleSetView} currentUser={currentUser} />
      case 'pacientes':   return <Pacientes setCurrentView={handleSetView} onNovoCadastro={() => setCadastroOpen(true)} />
      case 'paciente':    return <Paciente patient={currentPatient} setCurrentView={handleSetView} onSessao={() => setBriefingOpen(true)} onQuickNote={() => setQuickNoteOpen(true)} onReopenSession={handleReopenSession} />
      case 'agenda':      return <Agenda currentUser={currentUser} />
      case 'insights':    return <Insights onGoToPatient={(patient) => handleSetView('paciente', patient)} />
      case 'financeiro':  return <Financeiro />
      case 'lembretes':   return <Lembretes />
      case 'formularios': return <Formularios />
      case 'anotacoes':   return <Anotacoes setCurrentView={handleSetView} onOpenCanvas={handleOpenCanvasFromHistory} />
      case 'teleatendimento': return <Teleatendimento />
      case 'configuracoes': return <Configuracoes currentUser={currentUser} onProfileUpdate={(data) => setCurrentUser(u => ({ ...u, ...data }))} onOpenOnboarding={() => setOnboardingOpen(true)} />
      default:            return <Dashboard setCurrentView={handleSetView} currentUser={currentUser} />
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
          <div style={{ position: 'fixed', inset: 0, background: '#F7F4EF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#8B8B8B' }}>
            <span style={{ width: 24, height: 24, border: '2px solid #E8E5E0', borderTopColor: '#4A7C59', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
            Carregando canvas...
          </div>
        }>
          <CanvasSession
            patient={currentPatient}
            isOpen={canvasOpen}
            sessionId={activeSessionId}
            onClose={handleSessionClose}
            onMinimize={() => setCanvasOpen(false)}
            onAnalyze={handleAnalyze}
            onAutosave={(id, data) => api.autosaveSession?.(id, data)}
            initialCanvasData={canvasInitialData}
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

      {/* Sessions */}
      <TextSession
        patient={currentPatient}
        isOpen={textOpen}
        sessionId={activeSessionId}
        onAutosave={(id, data) => api.autosaveSession?.(id, data)}
        onClose={handleSessionClose}
        onMinimize={handleMinimizeText}
        onAnalyze={handleAnalyze}
        initialHtml={textInitialHtml}
      />

      <Suspense fallback={null}>
        <CanvasSession
          patient={currentPatient}
          isOpen={canvasOpen}
          sessionId={activeSessionId}
          onClose={handleSessionClose}
          onMinimize={handleMinimizeCanvas}
          onAnalyze={handleAnalyze}
          onAutosave={(id, data) => api.autosaveSession?.(id, data)}
          initialCanvasData={canvasInitialData}
        />
      </Suspense>

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

      {/* Sistema de feedback global */}
      <ProgressBar />
      <ConfirmDialog />
      <ToastContainer />

      {/* Bloqueio por inadimplência — modal de planos com promoção de retomada */}
      {paymentRequired && <PaymentModal onLogout={handleLogout} />}

      {/* Banner LGPD — aparece uma vez, salvo em localStorage */}
      <LgpdBanner />
    </>
  )
}
