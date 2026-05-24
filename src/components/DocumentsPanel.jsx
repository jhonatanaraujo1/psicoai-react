import { useState, useRef, useEffect } from 'react'
import { api } from '../services'

const CATEGORIES = [
  { value: 'tcle',      label: 'TCLE' },
  { value: 'anamnese',  label: 'Anamnese' },
  { value: 'laudo',     label: 'Laudo' },
  { value: 'receita',   label: 'Receita' },
  { value: 'outros',    label: 'Outros' },
]

const CAT_COLORS = {
  tcle:     { bg: 'var(--g50)',      color: 'var(--g600)' },
  anamnese: { bg: '#EBF3FD',         color: '#2980B9' },
  laudo:    { bg: 'var(--warn-l)',   color: 'var(--warn)' },
  receita:  { bg: '#F0EBF8',         color: '#7D3C98' },
  outros:   { bg: 'var(--gr1)',      color: 'var(--gr5)' },
}

function fmtSize(bytes) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fileIcon(mimeType) {
  if (mimeType?.includes('pdf'))   return '📄'
  if (mimeType?.includes('image')) return '🖼️'
  if (mimeType?.includes('word') || mimeType?.includes('document')) return '📝'
  return '📎'
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function DocumentsPanel({ patientId, patientName }) {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [downloading, setDownloading] = useState(null)

  const [uploadCategory, setUploadCategory] = useState('outros')
  const [uploadName, setUploadName] = useState('')
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)

  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    api.getPatientDocuments(patientId)
      .then(setDocs)
      .catch(() => setDocs([]))
      .finally(() => setLoading(false))
  }, [patientId])

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setSelectedFile(f)
    setUploadName(f.name.replace(/\.[^.]+$/, ''))
    setShowUploadForm(true)
    e.target.value = ''
  }

  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true)
    setUploadError(null)
    try {
      const doc = await api.uploadDocument(patientId, selectedFile, uploadCategory, uploadName || null)
      setDocs(prev => [doc, ...prev])
      setShowUploadForm(false)
      setSelectedFile(null)
      setUploadName('')
      setUploadCategory('outros')
    } catch (e) {
      setUploadError(e.message || 'Erro ao enviar arquivo.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(doc) {
    setDownloading(doc.id)
    try {
      const blob = await api.downloadDocument(patientId, doc.id)
      downloadBlob(blob, doc.originalName)
    } catch (e) {
      alert('Erro ao baixar arquivo: ' + e.message)
    } finally {
      setDownloading(null)
    }
  }

  async function handleDelete(docId) {
    try {
      await api.deleteDocument(patientId, docId)
      setDocs(prev => prev.filter(d => d.id !== docId))
    } catch (e) {
      alert('Erro ao excluir: ' + e.message)
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Pasta de Documentos</div>
          <div className="card-sub">
            {loading ? '…' : `${docs.length} arquivo${docs.length !== 1 ? 's' : ''} · TCLE, anamnese, laudos, receitas`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            ref={fileInputRef}
            type="file"
            style={{ display: 'none' }}
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt"
            onChange={handleFileChange}
          />
          <button
            className="btn-primary"
            style={{ fontSize: '12px', padding: '7px 14px' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Enviar arquivo
          </button>
        </div>
      </div>

      {/* Upload form */}
      {showUploadForm && selectedFile && (
        <div style={{ background: 'var(--ow)', borderBottom: '1px solid var(--gr2)', padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--d)', marginBottom: '12px' }}>
            Arquivo: <span style={{ fontWeight: 400, color: 'var(--gr5)' }}>{selectedFile.name}</span>
            <span style={{ marginLeft: '8px', color: 'var(--gr4)' }}>({fmtSize(selectedFile.size)})</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', display: 'block', marginBottom: '4px' }}>Nome do documento</label>
              <input
                value={uploadName}
                onChange={e => setUploadName(e.target.value)}
                placeholder={selectedFile.name}
                style={{ width: '100%', boxSizing: 'border-box', height: '34px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', padding: '0 10px', fontSize: '12px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--gr5)', display: 'block', marginBottom: '4px' }}>Categoria</label>
              <select
                value={uploadCategory}
                onChange={e => setUploadCategory(e.target.value)}
                style={{ height: '34px', padding: '0 10px', border: '1px solid var(--gr2)', borderRadius: 'var(--r)', fontSize: '12px', fontFamily: "'DM Sans', sans-serif", outline: 'none', background: 'var(--w)', cursor: 'pointer' }}
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <button
              className="btn-primary"
              style={{ fontSize: '12px', padding: '0 16px', height: '34px' }}
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? 'Enviando…' : 'Confirmar upload'}
            </button>
            <button
              className="btn-outline"
              style={{ fontSize: '12px', padding: '0 14px', height: '34px' }}
              onClick={() => { setShowUploadForm(false); setSelectedFile(null) }}
              disabled={uploading}
            >
              Cancelar
            </button>
          </div>
          {uploadError && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--danger)' }}>{uploadError}</div>
          )}
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div style={{ padding: '20px' }}>
          {[1,2].map(i => (
            <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
              <div className="skel-pulse" style={{ width: 36, height: 36, borderRadius: 8 }} />
              <div style={{ flex: 1 }}>
                <div className="skel-pulse" style={{ height: 13, width: '50%', borderRadius: 4, marginBottom: 6 }} />
                <div className="skel-pulse" style={{ height: 11, width: '30%', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div style={{ padding: '36px 20px', textAlign: 'center' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="1.2" style={{ margin: '0 auto 12px', display: 'block' }}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <div style={{ fontSize: '13px', color: 'var(--gr4)', marginBottom: '4px' }}>Nenhum documento enviado</div>
          <div style={{ fontSize: '12px', color: 'var(--gr3)' }}>Envie TCLE, anamnese, laudos ou receitas</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 64px', borderBottom: '2px solid var(--gr2)', padding: '8px 20px', background: 'var(--ow)' }}>
            {['Documento', 'Categoria', 'Tamanho', 'Data', ''].map((h, i) => (
              <div key={i} style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--gr4)' }}>{h}</div>
            ))}
          </div>
          {docs.map((doc, i) => {
            const cat = CAT_COLORS[doc.category] || CAT_COLORS.outros
            const catLabel = CATEGORIES.find(c => c.value === doc.category)?.label || doc.category
            const isDeleting = deleteId === doc.id
            return (
              <div key={doc.id} style={{ borderBottom: i < docs.length - 1 ? '1px solid var(--gr1)' : 'none' }}>
                <div
                  style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px 64px', padding: '12px 20px', alignItems: 'center', transition: 'background 0.12s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--ow)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px', lineHeight: 1 }}>{fileIcon(doc.mimeType)}</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--d)', lineHeight: 1.3 }}>{doc.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--gr4)' }}>{doc.originalName}</div>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '20px', background: cat.bg, color: cat.color }}>
                      {catLabel}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--gr5)' }}>{fmtSize(doc.fileSize)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--gr5)' }}>{fmtDate(doc.createdAt)}</div>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => handleDownload(doc)}
                      disabled={downloading === doc.id}
                      title="Baixar"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: downloading === doc.id ? 'var(--gr3)' : 'var(--g500)', display: 'flex', alignItems: 'center' }}
                    >
                      {downloading === doc.id
                        ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid var(--gr3)', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      }
                    </button>
                    <button
                      onClick={() => setDeleteId(isDeleting ? null : doc.id)}
                      title="Excluir"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--gr3)', display: 'flex', alignItems: 'center' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </div>
                </div>
                {isDeleting && (
                  <div style={{ background: 'var(--danger-l)', border: '1px solid #E8B4B0', margin: '0 20px 8px', borderRadius: 'var(--r)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--danger)', flex: 1 }}>Excluir "{doc.name}"? Esta ação não pode ser desfeita.</span>
                    <button onClick={() => setDeleteId(null)} style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid var(--danger)', borderRadius: 'var(--r)', background: 'none', color: 'var(--danger)', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={() => handleDelete(doc.id)} style={{ padding: '4px 10px', fontSize: '11px', background: 'var(--danger)', border: 'none', borderRadius: 'var(--r)', color: '#fff', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>Excluir</button>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
