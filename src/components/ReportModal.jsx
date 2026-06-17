import { useState } from 'react'
import DOMPurify from 'dompurify'
import { api } from '../services'
import { showToast } from './Toast'

// FE-001: config de sanitização para impressão — permite formatação básica, bloqueia scripts
const PRINT_SANITIZE = {
  ALLOWED_TAGS: ['p', 'br', 'b', 'strong', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h3', 'h4', 'span'],
  ALLOWED_ATTR: [],  // zero atributos — sem style, href, on*
}

const sanitizeText = (text) => DOMPurify.sanitize(String(text ?? ''), PRINT_SANITIZE)

// ── Report type definitions ──────────────────────────────────────────────────
const REPORT_TYPES = [
  {
    id: 'psychiatrist',
    label: 'Encaminhamento Psiquiátrico',
    desc: 'Carta formal estruturada para avaliação psiquiátrica',
    audience: 'Para: Psiquiatra',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    color: '#2D4A38',
    bg: '#EBF4EE',
  },
  {
    id: 'evolution',
    label: 'Relatório de Evolução',
    desc: 'Síntese clínica do progresso terapêutico por período',
    audience: 'Para: Arquivo / Supervisão',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    color: '#3D6B4A',
    bg: '#D4E8DA',
  },
  {
    id: 'summary',
    label: 'Resumo para o Paciente',
    desc: 'Resumo em linguagem acessível sobre o acompanhamento',
    audience: 'Para: Paciente',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    color: '#4A7C59',
    bg: '#EBF4EE',
  },
  {
    id: 'full',
    label: 'Prontuário Completo',
    desc: 'Registro clínico completo para arquivo ou transferência',
    audience: 'Para: Arquivo / Transferência',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="3" y1="9" x2="21" y2="9"/>
        <line x1="9" y1="21" x2="9" y2="9"/>
      </svg>
    ),
    color: '#1E3328',
    bg: '#D4E8DA',
  },
]

const SECTION_DEFS = [
  { id: 'clinical',    label: 'Dados clínicos',               desc: 'Queixa, histórico, abordagem, frequência' },
  { id: 'sessions',    label: 'Histórico de sessões',         desc: 'Resumos das últimas sessões concluídas' },
  { id: 'hypotheses',  label: 'Hipóteses diagnósticas',       desc: 'DSM-5 e CID-11 com probabilidade' },
  { id: 'patterns',    label: 'Padrões comportamentais',      desc: 'Evitação, ruminação, hipervigilância etc.' },
  { id: 'alerts',      label: 'Alertas clínicos ativos',      desc: 'Inclui alertas de risco detectados pela IA', sensitive: true },
  { id: 'notes',       label: 'Notas livres do prontuário',   desc: 'Anotações privadas do psicólogo', sensitive: true },
]

// ── Preview renderer ──────────────────────────────────────────────────────────
function ReportPreview({ report }) {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div style={{ fontFamily: 'Georgia, serif', fontSize: '13px', color: '#1a1a1a', lineHeight: 1.75 }}>
      {/* Letterhead */}
      <div style={{ borderBottom: '2px solid #2D4A38', paddingBottom: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '16px', fontWeight: 400, color: '#1E3328', marginBottom: '3px' }}>PsicNotes · Prontuário Clínico</div>
            <div style={{ fontSize: '11px', color: '#666', fontFamily: "'DM Sans', sans-serif" }}>Documento gerado em {today}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '11px', fontWeight: 700, color: '#2D4A38', padding: '3px 10px', background: '#EBF4EE', borderRadius: '20px', border: '1px solid #D4E8DA' }}>{report.typeLabel}</div>
            <div style={{ fontSize: '11px', color: '#999', marginTop: '4px', fontFamily: "'DM Sans', sans-serif" }}>{report.audience}</div>
          </div>
        </div>
      </div>

      {/* Sections */}
      {report.sections.map((sec, i) => (
        <div key={sec.id} style={{ marginBottom: i < report.sections.length - 1 ? '20px' : '8px' }}>
          {sec.label && (
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#2D4A38', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ height: '1px', width: '20px', background: '#2D4A38', opacity: 0.4 }} />
              {sec.label}
              <div style={{ flex: 1, height: '1px', background: '#2D4A38', opacity: 0.15 }} />
            </div>
          )}
          {sec.isSignature ? (
            <div style={{ borderTop: '1px solid #ddd', paddingTop: '20px', marginTop: '24px' }}>
              <div style={{ fontSize: '12px', color: '#888', fontFamily: "'DM Sans', sans-serif", marginBottom: '28px' }}>Atenciosamente,</div>
              <div style={{ borderBottom: '1px solid #888', width: '180px', marginBottom: '6px' }} />
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: '#333', whiteSpace: 'pre-line' }}>{sec.text}</div>
            </div>
          ) : (
            <div style={{ whiteSpace: 'pre-line', fontSize: '13px', color: sec.label ? '#222' : '#555' }}>
              {sec.text}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Section toggle ────────────────────────────────────────────────────────────
function SectionToggle({ def, value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid var(--gr1)' }}>
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)}
        style={{ marginTop: '2px', accentColor: 'var(--g600)', flexShrink: 0, width: '14px', height: '14px' }} />
      <div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--d)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {def.label}
          {def.sensitive && <span style={{ fontSize: '10px', background: 'var(--warn-l)', color: 'var(--warn)', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>sensível</span>}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--gr4)', marginTop: '1px', lineHeight: 1.4 }}>{def.desc}</div>
      </div>
    </label>
  )
}

// ── Send channel row ─────────────────────────────────────────────────────────
function SendRow({ icon, label, placeholder, value, onChange, sent, sending }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gr5)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {icon} {label}
        {sent && <span style={{ fontSize: '10px', color: 'var(--g600)', background: 'var(--g50)', border: '1px solid var(--g100)', borderRadius: '10px', padding: '1px 7px', fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>✓ Enviado</span>}
      </div>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={sent}
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', fontSize: '12px', fontFamily: "'DM Sans', sans-serif", outline: 'none', color: 'var(--d)', background: sent ? 'var(--gr1)' : 'var(--w)', transition: 'border-color 0.15s' }}
        onFocus={e => e.target.style.borderColor = 'var(--g300)'}
        onBlur={e => e.target.style.borderColor = 'var(--gr2)'}
      />
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function ReportModal({ isOpen, onClose, patient }) {
  const [reportType, setReportType] = useState('psychiatrist')
  const [sections, setSections] = useState({
    clinical: true, sessions: true, hypotheses: true,
    patterns: true, alerts: false, notes: false,
  })
  const [sendEmail, setSendEmail] = useState(patient?.email || '')
  const [sendPhone, setSendPhone] = useState(patient?.phone || '')
  const [report, setReport] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)
  const [sending, setSending] = useState(null) // 'email' | 'whatsapp' | 'copy' | null
  const [sent, setSent] = useState({ email: false, whatsapp: false })
  const [copied, setCopied] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const downloadOfficialPdf = async () => {
    if (!patient?.id) return
    setDownloadingPdf(true)
    try {
      const blob = await api.exportRelatorioPdf(patient.id, reportType)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-${reportType}-${(patient.name || 'paciente').replace(/\s+/g,'_')}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (e) {
      showToast('Erro ao gerar PDF: ' + e.message, 'error')
    } finally {
      setDownloadingPdf(false)
    }
  }

  if (!isOpen || !patient) return null

  const setSection = (id, v) => setSections(s => ({ ...s, [id]: v }))

  const generate = async () => {
    setGenerating(true)
    setGenError(null)
    setReport(null)
    setSent({ email: false, whatsapp: false })
    try {
      const result = await api.generateReport({ patientId: patient.id, type: reportType, sections })
      setReport(result)
    } catch (e) {
      setGenError(e.message || 'Erro ao gerar relatório.')
    } finally {
      setGenerating(false)
    }
  }

  const sendVia = async (channel) => {
    if (!report) return
    setSending(channel)
    try {
      await api.sendReport({
        reportId: report.id,
        patientId: patient.id,
        channels: [channel],
        email: sendEmail,
        phone: sendPhone,
      })
      setSent(s => ({ ...s, [channel]: true }))
      showToast(channel === 'email'
        ? `Relatório enviado para ${sendEmail || patient.email || 'e-mail do paciente'}`
        : `Link de download enviado via WhatsApp para ${sendPhone || patient.phone || 'o paciente'}`,
        'success')
    } catch {
      showToast('Erro ao enviar. Tente novamente.', 'error')
    } finally {
      setSending(null)
    }
  }

  const copyText = () => {
    if (!report) return
    const text = report.sections
      .map(s => (s.label ? `\n── ${s.label.toUpperCase()} ──\n` : '\n') + s.text)
      .join('\n')
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const print = () => {
    // FE-001 FIX: abrir sem window.opener (FE-006) + sanitizar TODOS os dados do backend
    const printWindow = window.open('', '_blank', 'noopener,noreferrer')
    if (!printWindow) return

    // Sanitizar todos os campos antes de interpolar no HTML da janela
    const safeTitle    = sanitizeText(report.typeLabel)
    const safeName     = sanitizeText(patient.name)
    const safeAudience = sanitizeText(report.audience)

    const html = report.sections.map(s => {
      const safeLabel = s.label ? `<h3>${sanitizeText(s.label)}</h3>` : ''
      const safeText  = `<p class="${s.isSignature ? 'sig' : ''}">${sanitizeText(s.text)}</p>`
      return safeLabel + safeText
    }).join('')

    printWindow.document.write(`
      <!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8">
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
      <title>${safeTitle} — ${safeName}</title>
      <style>
        body{font-family:Georgia,serif;color:#1a1a1a;max-width:680px;margin:32px auto;padding:0 24px}
        h2{font-family:serif;color:#1E3328;border-bottom:2px solid #2D4A38;padding-bottom:12px}
        h3{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#2D4A38;margin:20px 0 8px;border-bottom:1px solid #D4E8DA;padding-bottom:4px}
        p{white-space:pre-line;margin:0 0 12px;font-size:13px;line-height:1.7}
        .sig{margin-top:32px;border-top:1px solid #ddd;padding-top:20px}
        @media print{body{margin:0}}
      </style>
      </head><body>
      <h2>${safeTitle}</h2>
      <p style="font-size:11px;color:#666;font-family:sans-serif">
        Paciente: ${safeName} · ${safeAudience} · Gerado em ${new Date().toLocaleDateString('pt-BR')}
      </p>
      ${html}
      </body></html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => printWindow.print(), 300)
  }

  const selectedType = REPORT_TYPES.find(t => t.id === reportType)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: "'DM Sans', sans-serif", touchAction: 'none', overscrollBehavior: 'none' }}>
      <div style={{ width: '100%', maxWidth: '900px', maxHeight: 'min(92dvh, 92svh, 92vh)', background: 'var(--w)', borderRadius: '16px', boxShadow: '0 24px 72px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--gr2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, background: 'var(--g700)' }}>
          <div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', color: '#fff', fontWeight: 400 }}>
              Gerar relatório clínico
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>
              {patient.name} · escolha o tipo e as seções antes de gerar
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'rgba(255,255,255,0.7)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', transition: 'background 0.15s' }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}>✕</button>
        </div>

        {/* Body — two panels */}
        <div className="report-modal-body">

          {/* ── Left panel: Config ───────────────────────────────────────── */}
          <div className="report-modal-left">
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', scrollbarWidth: 'thin', scrollbarColor: 'var(--gr2) transparent' }}>

              {/* Type selector */}
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '10px' }}>Tipo de documento</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                {REPORT_TYPES.map(t => (
                  <button key={t.id} onClick={() => { setReportType(t.id); setReport(null) }}
                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px', borderRadius: 'var(--r)', border: `1.5px solid ${reportType === t.id ? 'var(--g400)' : 'var(--gr2)'}`, background: reportType === t.id ? 'var(--g50)' : 'var(--w)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%', fontFamily: "'DM Sans', sans-serif" }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: t.bg, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {t.icon}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: reportType === t.id ? 'var(--g700)' : 'var(--d)', marginBottom: '2px' }}>{t.label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--gr5)', lineHeight: 1.3 }}>{t.desc}</div>
                      <div style={{ fontSize: '10px', color: reportType === t.id ? 'var(--g600)' : 'var(--gr4)', marginTop: '3px', fontWeight: reportType === t.id ? 600 : 400 }}>{t.audience}</div>
                    </div>
                    {reportType === t.id && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g600)" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: '2px' }}><polyline points="20 6 9 17 4 12"/></svg>
                    )}
                  </button>
                ))}
              </div>

              {/* Sections */}
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gr4)', marginBottom: '10px' }}>Seções do documento</div>
              <div style={{ marginBottom: '20px' }}>
                {SECTION_DEFS.map(def => (
                  <SectionToggle key={def.id} def={def} value={sections[def.id]} onChange={v => setSection(def.id, v)} />
                ))}
              </div>

              {/* Send — em breve */}
              <div style={{ padding: '10px 12px', background: 'var(--gr1)', borderRadius: 'var(--r)', border: '1px solid var(--gr2)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', marginBottom: '3px' }}>Envio por e-mail e WhatsApp</div>
                <div style={{ fontSize: '11px', color: 'var(--gr4)', lineHeight: 1.5 }}>Em breve. Por enquanto, use o PDF ou a impressão para compartilhar com o paciente.</div>
              </div>

            </div>

            {/* Generate button */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--gr2)', background: 'var(--w)', flexShrink: 0 }}>
              <button onClick={generate} disabled={generating}
                style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 'var(--r)', background: generating ? 'var(--g400)' : 'var(--g600)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: generating ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s' }}
                onMouseOver={e => !generating && (e.currentTarget.style.background = 'var(--g700)')}
                onMouseOut={e => !generating && (e.currentTarget.style.background = 'var(--g600)')}>
                {generating
                  ? <><span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Gerando relatório…</>
                  : <>{report ? 'Gerar novamente' : `Gerar ${selectedType?.label || 'relatório'}`}</>
                }
              </button>
            </div>
          </div>

          {/* ── Right panel: Preview ─────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* Preview toolbar */}
            {report && (
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--gr2)', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, background: 'var(--ow)', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, fontSize: '12px', color: 'var(--gr5)' }}>
                  <span style={{ fontWeight: 600, color: 'var(--g700)' }}>{selectedType?.label}</span>
                  {' · '}Gerado agora · {selectedType?.audience}
                </div>
                {/* Actions */}
                <button onClick={copyText}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: copied ? 'var(--g600)' : 'var(--gr5)', transition: 'all 0.15s' }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--g300)'; e.currentTarget.style.color = 'var(--g600)' }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--gr2)'; e.currentTarget.style.color = copied ? 'var(--g600)' : 'var(--gr5)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
                <button onClick={print}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', background: 'var(--w)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", color: 'var(--gr5)', transition: 'all 0.15s' }}
                  onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--g300)'; e.currentTarget.style.color = 'var(--g600)' }}
                  onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--gr2)'; e.currentTarget.style.color = 'var(--gr5)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Imprimir
                </button>
                <button onClick={downloadOfficialPdf} disabled={downloadingPdf}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', border: 'none', borderRadius: 'var(--r)', background: 'var(--g600)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: downloadingPdf ? 'default' : 'pointer', fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s', opacity: downloadingPdf ? 0.7 : 1 }}
                  onMouseOver={e => !downloadingPdf && (e.currentTarget.style.background = 'var(--g700)')}
                  onMouseOut={e => !downloadingPdf && (e.currentTarget.style.background = 'var(--g600)')}>
                  {downloadingPdf
                    ? <><span style={{ width: '11px', height: '11px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Gerando PDF…</>
                    : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Baixar PDF</>
                  }
                </button>
              </div>
            )}

            {/* Preview area */}
            <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'var(--gr2) transparent' }}>
              {/* Empty state */}
              {!report && !generating && !genError && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '14px', padding: '40px', textAlign: 'center' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: selectedType?.bg || 'var(--g50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedType?.color || 'var(--g600)' }}>
                    {selectedType?.icon}
                  </div>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', color: 'var(--d)', fontWeight: 400 }}>{selectedType?.label}</div>
                  <div style={{ fontSize: '13px', color: 'var(--gr5)', maxWidth: '280px', lineHeight: 1.6 }}>{selectedType?.desc}</div>
                  <div style={{ fontSize: '12px', color: 'var(--gr4)', marginTop: '4px' }}>Configure as opções ao lado e clique em <strong>Gerar {selectedType?.label || 'relatório'}</strong></div>
                </div>
              )}

              {/* Loading state */}
              {generating && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px', padding: '40px' }}>
                  <div style={{ width: '48px', height: '48px', border: '3px solid var(--g100)', borderTopColor: 'var(--g500)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', color: 'var(--d)' }}>Gerando {selectedType?.label || 'relatório'}…</div>
                  <div style={{ fontSize: '13px', color: 'var(--gr5)', textAlign: 'center', maxWidth: '260px', lineHeight: 1.6 }}>
                    Compilando dados clínicos e análises para estruturar o documento.
                  </div>
                </div>
              )}

              {/* Error state */}
              {genError && !generating && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', padding: '40px', textAlign: 'center' }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="1.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div style={{ fontSize: '14px', color: 'var(--d)', fontWeight: 500 }}>Não foi possível gerar o relatório</div>
                  <div style={{ fontSize: '13px', color: 'var(--gr5)', maxWidth: '260px', lineHeight: 1.5 }}>{genError}</div>
                  <button onClick={generate} style={{ padding: '10px 20px', border: 'none', borderRadius: 'var(--r)', background: 'var(--g600)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>Tentar novamente</button>
                </div>
              )}

              {/* Report preview */}
              {report && !generating && (
                <div style={{ padding: '28px 32px', maxWidth: '680px', margin: '0 auto' }}>
                  <ReportPreview report={report} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
