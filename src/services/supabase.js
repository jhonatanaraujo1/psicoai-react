/**
 * supabase.js — Singleton do cliente Supabase.
 *
 * URL e anon key vêm das variáveis de ambiente:
 *   VITE_SUPABASE_URL      → Project URL (ex: https://hfylqsntvsozjshwprwn.supabase.co)
 *   VITE_SUPABASE_ANON_KEY → anon public key (safe expor no frontend)
 *
 * O anon key é seguro porque toda a segurança é feita via RLS no banco.
 * Sem RLS correto, qualquer usuário autenticado veria dados de outro — RLS é o bloqueio.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Avisa em dev — em produção silencia (o modo mock assume)
  if (import.meta.env.DEV) {
    console.warn('[PsicoAI] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos — usando mock.')
  }
}

// Exporta null quando as vars não estão presentes (modo mock)
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'psicoai_supabase_auth',
      },
    })
  : null

export default supabase
