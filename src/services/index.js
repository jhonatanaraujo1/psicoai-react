/**
 * services/index.js — Aponta sempre para o backend real (Railway/Kotlin).
 * Mock removido — app roda 100% contra realApi.
 *
 * Variável de ambiente obrigatória:
 *   VITE_API_BASE_URL=https://<seu-app>.up.railway.app
 *
 * Dev local:
 *   VITE_API_BASE_URL=http://localhost:8080  (via .env.local)
 */

import * as realModule from './realApi.js'

export const auth = realModule.auth
export const api  = realModule.api

export { assertSafeRedirectUrl } from './realApi.js'

export const API_MODE = 'railway'

if (import.meta.env.DEV) {
  const base = import.meta.env.VITE_API_BASE_URL
  if (!base) {
    console.warn('[PsicoNotes] ⚠ VITE_API_BASE_URL não definida — todas as chamadas API vão falhar. Configure .env.local.')
  } else {
    console.info(`[PsicoNotes] API → ${base}`)
  }
}

export default api
