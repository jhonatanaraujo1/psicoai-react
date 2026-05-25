/**
 * services/index.js — Smart router: mock (demo) → realApi (Railway/Kotlin).
 *
 * Prioridade de modo (primeira var definida ganha):
 *
 *   1. VITE_API_BASE_URL definida → realApi (backend Kotlin no Railway)
 *
 *   2. Nenhuma var definida      → mockApi (demo offline, sem backend)
 *
 * Setup:
 *   Modo Railway → .env.local: VITE_API_BASE_URL=https://api.psicoai.com.br
 *   Modo Demo    → não precisa de .env.local
 */

import * as mockModule from './mockApi.js'
import * as realModule from './realApi.js'

const HAS_RAILWAY = Boolean(import.meta.env.VITE_API_BASE_URL)

export const auth = HAS_RAILWAY ? realModule.auth : mockModule.auth
export const api  = HAS_RAILWAY ? realModule.api  : mockModule.api

export const API_MODE = HAS_RAILWAY ? 'railway' : 'mock'

if (import.meta.env.DEV) {
  console.info(`[PsicoAI] API mode: ${API_MODE}`)
}

export default api
