import { useState, useEffect, useRef } from 'react'
import './styles/globals.css'

import { auth, api } from './services'
import { showToast, ToastContainer } from './components/Toast'
import OnboardingTour from './components/OnboardingTour'
import PaymentModal from './components/PaymentModal'

import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import AiDrawer from './components/AiDrawer'
import PreSessionBriefing from './components/PreSessionBriefing'
import PatientPicker from './components/PatientPicker'
import CadastroModal from './components/CadastroModal'
import AnalyzeSessionsModal from './components/AnalyzeSessionsModal'

import Login from './views/Login'
import Dashboard from './views/Dashboard'
import Pacientes from './views/Pacientes'
import Paciente from './views/Paciente'
import CanvasSession from './views/CanvasSession'
import TextSession from './views/TextSession'
import Agenda from './views/Agenda'
import Insights from './views/Insights'
import Financeiro from './views/Financeiro'
import Lembretes from './views/Lembretes'
import Formularios from './views/Formularios'
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

  // ── Stripe return handler (?payment=success) ─────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    if (payment === 'success') {
      // Clean the URL without a full reload
      window.history.replaceState({}, '', window.location.pathname)
      setPaymentRequired(false)
      showToast('✓ Pagamento confirmado! Sua conta está ativa.', 'success')
      // Refresh user profile so subscription status updates in the UI
      api.getUserProfile().then(updated => {
        if (updated) setCurrentUser(prev => ({ ...prev, ...updated }))
      }).catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Navigation ───────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Patient context ──────────────────────────────────────────────────────
  const [currentPatient, setCurrentPatient] = useState(null)

  // ── Active session tracking ────────────────────────────────────────────────
  // Ref avoids stale closure issues in async handlers; state propagates the ID as a prop
  const activeSessionRef = useRef(null)
  const [activeSessionId, setActiveSessionId] = useState(null)
  const setSession = (id) => { activeSessionRef.current = id; setActiveSessionId(id) }

  // ── Session modals ────────────────────────────────────────────────────────
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [textOpen, setTextOpen] = useState(false)
  const [canvasOpen, setCanvasOpen] = useState(false)
  const [cadastroOpen, setCadastroOpen] = useState(false)

  // ── AI Drawer ─────────────────────────────────────────────────────────────
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // ── Analyze Sessions Modal ────────────────────────────────────────────────
  // Holds { imageBase64, textContent, htmlContent, duration, sessionId } while user picks sessions
  const [pendingAnalysis, setPendingAnalysis] = useState(null)

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSetView = (view, patient = null) => {
    if (view === 'sessao') {
      if (patient) {
        setCurrentPatient(patient)
        setBriefingOpen(true)
      } else {
        setPickerOpen(true)
      }
      return
    }
    if (patient) setCurrentPatient(patient)
    setCurrentView(view)
    setSidebarOpen(false)
  }

  const handlePickerSelect = (patient) => {
    setCurrentPatient(patient)
    setPickerOpen(false)
    setBriefingOpen(true)
  }

  const handleBriefingStart = ({ meetLink, type }) => {
    setBriefingOpen(false)
    activeSessionRef.current = null // clear any stale session from a previous flow

    // Open the session view immediately (no wait) and create the backend record in background.
    // autosaveSession only fires after 30s, so the ID will be ready well before it's needed.
    api.createSession({ patientId: currentPatient?.id, type, meetLink })
      .then(session => setSession(session.id))
      .catch(e => console.warn('[PsicoAI] createSession failed, session will not be persisted:', e))

    if (type === 'text') setTextOpen(true)
    else setCanvasOpen(true)
  }

  const handleSaveAnalysis = (result) => {
    if (!result || result.error) return
    const name = currentPatient?.name || 'paciente'
    showToast(`Análise salva no prontuário de ${name}`, 'success')
  }

  // Step 1 of the analyze flow: close the session view and open the session-picker modal.
  // The actual API calls happen only after the psychologist confirms in the modal.
  const handleAnalyze = ({ imageBase64, textContent, htmlContent, duration }) => {
    const sid = activeSessionRef.current
    setSession(null)
    setCanvasOpen(false)
    setTextOpen(false)
    // Store pending data — AnalyzeSessionsModal will collect additionalSessionIds, then call handleAnalysisConfirm
    setPendingAnalysis({ imageBase64, textContent, htmlContent, duration, sessionId: sid })
  }

  // Step 2: called by AnalyzeSessionsModal after the psychologist selects sessions and clicks confirm.
  const handleAnalysisConfirm = async ({ imageBase64, textContent, htmlContent, duration, sessionId, additionalSessionIds = [], template = null }) => {
    setPendingAnalysis(null)
    setAiDrawerOpen(true)
    setAnalysisResult(null)
    setAnalysisLoading(true)

    try {
      // Finish the session (saves notes + duration to DB)
      if (sessionId) {
        await api.finishSession(sessionId, {
          textContent,
          htmlContent,
          imageBase64,
          durationSeconds: duration,
        })
      }

      // Trigger AI analysis (with optional extra sessions for longitudinal analysis)
      const effectiveSessionId = sessionId || ('s-mock-' + Date.now())
      const data = await api.createAnalysis({
        sessionId: effectiveSessionId,
        additionalSessionIds,
        template,
        patientId: currentPatient?.id,
      })
      setAnalysisResult(data)
    } catch (e) {
      setAnalysisResult({ error: 'Falha na análise. Tente novamente.' })
    } finally {
      setAnalysisLoading(false)
    }
  }

  // Re-análise com feedback — não consome crédito, usa Haiku
  const handleRefine = async (analysisId, feedback) => {
    setAnalysisLoading(true)
    setAnalysisResult(null)
    try {
      const data = await api.refineAnalysis(analysisId, feedback)
      setAnalysisResult(data)
    } catch (e) {
      setAnalysisResult({ error: 'Falha no refinamento. Tente novamente.' })
    } finally {
      setAnalysisLoading(false)
    }
  }

  // Called when the user closes the session without requesting AI analysis
  const handleSessionClose = async ({ textContent, htmlContent, duration } = {}) => {
    const sid = activeSessionRef.current
    setSession(null)

    setTextOpen(false)
    setCanvasOpen(false)
    setCurrentView('paciente')

    // Finish session in background so notes are not lost (fire-and-forget)
    if (sid) {
      api.finishSession(sid, { textContent, htmlContent, durationSeconds: duration }).catch(() => {})
    }
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':    return <Dashboard setCurrentView={handleSetView} currentUser={currentUser} />
      case 'pacientes':   return <Pacientes setCurrentView={handleSetView} onNovoCadastro={() => setCadastroOpen(true)} />
      case 'paciente':    return <Paciente patient={currentPatient} setCurrentView={handleSetView} onSessao={() => setBriefingOpen(true)} />
      case 'agenda':      return <Agenda currentUser={currentUser} />
      case 'insights':    return <Insights />
      case 'financeiro':  return <Financeiro />
      case 'lembretes':   return <Lembretes />
      case 'formularios': return <Formularios />
      case 'teleatendimento': return <Teleatendimento />
      case 'configuracoes': return <Configuracoes currentUser={currentUser} onProfileUpdate={(data) => setCurrentUser(u => ({ ...u, ...data }))} onOpenOnboarding={() => setOnboardingOpen(true)} />
      default:            return <Dashboard setCurrentView={handleSetView} currentUser={currentUser} />
    }
  }

  // ── Not authenticated ─────────────────────────────────────────────────────
  if (!currentUser) {
    return <Login onLogin={handleLogin} />
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
        />
        <div className="content">{renderView()}</div>
      </div>

      {/* Sessions */}
      <TextSession
        patient={currentPatient}
        isOpen={textOpen}
        sessionId={activeSessionId}
        onAutosave={(id, data) => api.autosaveSession?.(id, data)}
        onClose={handleSessionClose}
        onAnalyze={handleAnalyze}
      />

      <CanvasSession
        patient={currentPatient}
        isOpen={canvasOpen}
        sessionId={activeSessionId}
        onClose={handleSessionClose}
        onAnalyze={handleAnalyze}
      />

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

      {/* Onboarding */}
      <OnboardingTour isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

      {/* Toast notifications */}
      <ToastContainer />

      {/* Bloqueio por inadimplência — modal de planos com promoção de retomada */}
      {paymentRequired && <PaymentModal onLogout={handleLogout} />}
    </>
  )
}
