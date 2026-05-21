/**
 * services/index.js — Smart router: mock vs real API.
 *
 * Quando VITE_API_BASE_URL está definido → usa realApi (backend real).
 * Quando não está definido (Vercel demo, dev sem backend) → usa mockApi.
 *
 * Para ativar o backend real, crie .env.local com:
 *   VITE_API_BASE_URL=http://localhost:8080
 */

import * as mockModule from './mockApi.js'
import * as realModule from './realApi.js'

const USE_REAL = Boolean(import.meta.env.VITE_API_BASE_URL)

export const auth = USE_REAL ? realModule.auth : mockModule.auth
export const api  = USE_REAL ? realModule.api  : mockModule.api

export default api
