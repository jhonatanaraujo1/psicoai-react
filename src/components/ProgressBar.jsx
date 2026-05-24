/**
 * ProgressBar.jsx — Barra de progresso global no topo (estilo GitHub/YouTube)
 *
 * API:
 *   import { startProgress, finishProgress, failProgress } from './ProgressBar'
 *   startProgress()   → inicia animação indeterminada
 *   finishProgress()  → completa e desaparece
 *   failProgress()    → vermelho e desaparece
 */
import { useState, useEffect } from 'react'

const _listeners = new Set()
let _state = 'idle' // 'idle' | 'running' | 'done' | 'fail'

export function startProgress() { _state = 'running'; _listeners.forEach(fn => fn('running')) }
export function finishProgress() { _state = 'done';    _listeners.forEach(fn => fn('done')) }
export function failProgress()   { _state = 'fail';    _listeners.forEach(fn => fn('fail')) }

export default function ProgressBar() {
  const [status, setStatus] = useState('idle')
  const [width, setWidth]   = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handler = (s) => setStatus(s)
    _listeners.add(handler)
    return () => _listeners.delete(handler)
  }, [])

  useEffect(() => {
    if (status === 'running') {
      setVisible(true)
      setWidth(0)
      // Simula progresso incremental até 85% (o resto vem no finish)
      let w = 0
      const intervals = [
        setTimeout(() => { w = 30; setWidth(30) }, 80),
        setTimeout(() => { w = 55; setWidth(55) }, 400),
        setTimeout(() => { w = 72; setWidth(72) }, 900),
        setTimeout(() => { w = 85; setWidth(85) }, 1800),
      ]
      return () => intervals.forEach(clearTimeout)
    }
    if (status === 'done') {
      setWidth(100)
      const t = setTimeout(() => { setVisible(false); setWidth(0) }, 500)
      return () => clearTimeout(t)
    }
    if (status === 'fail') {
      setWidth(100)
      const t = setTimeout(() => { setVisible(false); setWidth(0) }, 600)
      return () => clearTimeout(t)
    }
  }, [status])

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0,
      height: '3px', zIndex: 99998, pointerEvents: 'none',
    }}>
      <div style={{
        height: '100%',
        width: `${width}%`,
        background: status === 'fail' ? '#f87171' : 'var(--g400)',
        transition: width === 100 ? 'width 0.25s ease, opacity 0.3s ease' : 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: status === 'fail'
          ? '0 0 8px rgba(248,113,113,0.6)'
          : '0 0 8px rgba(74,180,100,0.6)',
        borderRadius: '0 2px 2px 0',
      }} />
    </div>
  )
}
