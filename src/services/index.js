/**
 * services/index.js — Smart router: mock → supabase → real (Kotlin).
 *
 * Prioridade de modo (primeira var definida ganha):
 *
 *   1. VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY → Supabase direto
 *      Auth e CRUD via Supabase. IA pipeline via Railway se VITE_API_BASE_URL também definido.
 *
 *   2. VITE_API_BASE_URL (sem Supabase)            → realApi (Kotlin backend completo)
 *
 *   3. Nenhuma var definida                        → mockApi (demo offline)
 *
 * Setup:
 *   Modo Supabase  → .env.local:  VITE_SUPABASE_URL=https://xxx.supabase.co
 *                                  VITE_SUPABASE_ANON_KEY=eyJxxx
 *   Modo Railway   → .env.local:  VITE_API_BASE_URL=http://localhost:8080
 *   Modo Demo      → não precisa de .env.local
 */

import * as mockModule      from './mockApi.js'
import * as realModule      from './realApi.js'
import * as supabaseAuthMod from './supabaseAuth.js'
import * as supabaseApiMod  from './supabaseApi.js'

const HAS_SUPABASE = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
const HAS_RAILWAY  = Boolean(import.meta.env.VITE_API_BASE_URL)

// Escolhe o módulo certo
const selectedAuth = HAS_SUPABASE ? supabaseAuthMod.auth
                   : HAS_RAILWAY  ? realModule.auth
                   :                mockModule.auth

const selectedApi  = HAS_SUPABASE ? supabaseApiMod.api
                   : HAS_RAILWAY  ? realModule.api
                   :                mockModule.api

export const auth = selectedAuth
export const api  = selectedApi

// Expõe o modo ativo para debug/logging
export const API_MODE = HAS_SUPABASE ? 'supabase'
                      : HAS_RAILWAY  ? 'railway'
                      :                'mock'

if (import.meta.env.DEV) {
  console.info(`[PsicoAI] API mode: ${API_MODE}`)
}

export default api
