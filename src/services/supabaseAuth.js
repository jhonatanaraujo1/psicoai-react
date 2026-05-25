/**
 * supabaseAuth.js — Camada de autenticação via Supabase Auth.
 *
 * Interface idêntica à mockApi.auth — troca transparente via services/index.js.
 *
 * Fluxo:
 *   login()    → supabase.auth.signInWithPassword
 *   register() → supabase.auth.signUp (trigger cria profiles row automaticamente)
 *   logout()   → supabase.auth.signOut + limpa dados clínicos do localStorage
 *
 * O `profiles` row é criado pelo trigger `on_auth_user_created` no Supabase.
 * Após login, buscamos o perfil em `profiles` para popular o `currentUser`.
 */

import { supabase } from './supabase.js'

// ── localStorage cleanup — dados clínicos não podem vazar entre usuários ────────
function clearClinicalStorage() {
  const keysToRemove = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && (k.startsWith('psicoai_') || k.startsWith('supabase.'))) {
      keysToRemove.push(k)
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k))
}

// ── Normalize profile row → frontend user shape ──────────────────────────────
function normalizeProfile(authUser, profile) {
  return {
    id:                   authUser.id,
    email:                authUser.email,
    name:                 profile?.name  || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Psicólogo',
    crp:                  profile?.crp   || null,
    specialty:            profile?.specialty || null,
    phone:                profile?.phone || null,
    clinicName:           profile?.clinic_name || null,
    address:              profile?.address || null,
    bio:                  profile?.bio    || null,
    avatarUrl:            profile?.avatar_url || null,
    plan:                 profile?.plan   || 'trial',
    analysesRemaining:    profile?.analyses_remaining ?? 5,
    analysesUsedThisMonth: 0,
    subscriptionStatus:   profile?.subscription_status || 'trial',
    trialDaysRemaining:   null,
    preferences: profile?.preferences || {
      defaultApproach: 'TCC',
      defaultSessionDuration: 50,
      defaultSessionValue: 200,
      workingHours: { start: 8, end: 18 },
      notifyOnAlert: true,
      notifyByEmail: true,
      notifyByWhatsApp: false,
      theme: 'light',
    },
  }
}

// ── Fetch profile from DB ────────────────────────────────────────────────────
async function fetchProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) {
    // Profile pode não existir ainda (trigger ainda processando)
    console.warn('[PsicoAI] profile fetch error:', error.message)
    return null
  }
  return data
}

// ── Auth interface ───────────────────────────────────────────────────────────
export const auth = {
  async login({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // Traduz mensagens comuns do Supabase para PT-BR
      const msg = error.message.includes('Invalid login credentials')
        ? 'E-mail ou senha incorretos.'
        : error.message.includes('Email not confirmed')
          ? 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'
          : error.message
      throw new Error(msg)
    }
    const profile = await fetchProfile(data.user.id)
    const user = normalizeProfile(data.user, profile)
    localStorage.setItem('psicoai_user', JSON.stringify(user))
    return { user }
  },

  async logout() {
    try { await supabase.auth.signOut() } catch { /* ignore */ }
    clearClinicalStorage()
  },

  getStoredUser() {
    // Prioriza sessão do Supabase via getSession (sync via localStorage do SDK)
    // Fallback para psicoai_user (shape normalizado guardado no login)
    try {
      const raw = localStorage.getItem('psicoai_user')
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  },

  isAuthenticated() {
    return !!localStorage.getItem('psicoai_user')
  },

  async register({ name, email, password, crp }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, crp: crp || null },
        // emailRedirectTo: window.location.origin  (usar quando email confirm está ativo)
      },
    })
    if (error) {
      const msg = error.message.includes('already registered') || error.message.includes('already been registered')
        ? 'Este e-mail já possui uma conta. Tente fazer login.'
        : error.message.includes('Password should be at least')
          ? 'A senha deve ter pelo menos 8 caracteres.'
          : error.message
      throw new Error(msg)
    }

    // Supabase pode retornar user sem session se email confirm está ativo
    if (!data.session) {
      throw new Error('Cadastro realizado! Verifique seu e-mail para confirmar a conta antes de entrar.')
    }

    // Profile criado pelo trigger — pode demorar um instante
    await new Promise(r => setTimeout(r, 800))
    const profile = await fetchProfile(data.user.id)
    const user = normalizeProfile(data.user, profile)
    localStorage.setItem('psicoai_user', JSON.stringify(user))
    return { user }
  },

  // Usado para re-hidratar o user após refresh de página com sessão Supabase ativa
  async refreshUser() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { clearClinicalStorage(); return null }
    const profile = await fetchProfile(session.user.id)
    const user = normalizeProfile(session.user, profile)
    localStorage.setItem('psicoai_user', JSON.stringify(user))
    return user
  },
}

export default auth
