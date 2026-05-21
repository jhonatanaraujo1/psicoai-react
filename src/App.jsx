import { useState, useEffect } from 'react'
import './styles/globals.css'

import { auth, api } from './services'
import { showToast, ToastContainer } from './components/Toast'
import OnboardingTour from './components/OnboardingTour'

import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import AiDrawer from './components/AiDrawer'
import PreSessionBriefing from './components/PreSessionBriefing'
import PatientPicker from './components/PatientPicker'
import CadastroModal from './components/CadastroModal'

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

  // ── Navigation ───────────────────────────────────────────────────────────
  const [currentView, setCurrentView] = useState('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Patient context ──────────────────────────────────────────────────────
  const [currentPatient, setCurrentPatient] = useState(null)

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
    if (type === 'text') setTextOpen(true)
    else setCanvasOpen(true)
  }

  const handleSaveAnalysis = (result) => {
    if (!result || result.error) return
    const name = currentPatient?.name || 'paciente'
    showToast(`Análise salva no prontuário de ${name}`, 'success')
  }

  const handleAnalyze = async ({ imageBase64, textContent, htmlContent, duration }) => {
    setCanvasOpen(false)
    setTextOpen(false)
    setAiDrawerOpen(true)
    setAnalysisResult(null)
    setAnalysisLoading(true)

    try {
      const data = await api.createAnalysis({ sessionId: 's-mock-' + Date.now(), patientId: currentPatient?.id })
      setAnalysisResult(data)
    } catch (e) {
      setAnalysisResult({ error: 'Falha na análise. Tente novamente.' })
    } finally {
      setAnalysisLoading(false)
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
        onClose={() => { setTextOpen(false); setCurrentView('paciente') }}
        onAnalyze={(data) => { setTextOpen(false); handleAnalyze(data) }}
      />

      <CanvasSession
        patient={currentPatient}
        isOpen={canvasOpen}
        onClose={() => { setCanvasOpen(false); setCurrentView('paciente') }}
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

      {/* AI Drawer */}
      <AiDrawer
        isOpen={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        onSave={handleSaveAnalysis}
        patient={currentPatient}
        result={analysisResult}
        loading={analysisLoading}
      />

      {/* Onboarding */}
      <OnboardingTour isOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />

      {/* Toast notifications */}
      <ToastContainer />

      {/* Bloqueio por inadimplência */}
      {paymentRequired && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(28,28,28,0.85)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{
            background: 'var(--w)', borderRadius: 'var(--r2)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
            padding: '40px 36px', maxWidth: '420px', width: '100%', textAlign: 'center'
          }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔒</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--d)', marginBottom: '10px' }}>
              Conta bloqueada
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--gr5)', lineHeight: 1.6, marginBottom: '28px' }}>
              Houve uma falha no pagamento da sua assinatura. Regularize para continuar acessando o PsicoAI.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn-primary"
                onClick={() => { setPaymentRequired(false); setCurrentView('configuracoes') }}
              >
                Regularizar pagamento
              </button>
              <button
                className="btn-ghost"
                onClick={handleLogout}
                style={{ fontSize: '13px', color: 'var(--gr5)' }}
              >
                Sair da conta
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
