/**
 * PaymentModal.jsx
 * Modal de bloqueio por inadimplência — mostra planos, promoção de retomada
 * e dispara o fluxo Stripe Checkout diretamente.
 */

import { useState } from 'react'
import { api, assertSafeRedirectUrl } from '../services'

const PLANS_BRL = [
  {
    id: 'base',
    name: 'Consultório',
    price: 'R$49',
    period: '/mês',
    tagline: 'Gestão completa · 15 análises IA/mês',
    features: [
      'Prontuário eletrônico ilimitado',
      'Canvas de anotações (único no segmento)',
      'Agenda com lembretes automáticos',
      'Controle financeiro + recibos',
      'Formulários clínicos (PHQ-9, Beck, TCLE)',
      '15 análises IA incluídas por mês',
      'Conformidade CFP 09/2024',
      'Análises extras: R$4,90/análise',
    ],
    highlight: false,
  },
  {
    id: 'clinico',
    name: 'Especialista',
    price: 'R$97',
    period: '/mês',
    tagline: 'IA clínica avançada · 40 análises IA/mês',
    features: [
      'Tudo do Consultório incluído',
      '40 análises IA incluídas por mês',
      'Hipóteses DSM-5/CID-11 com grau de evidência',
      '5 templates: reflexão, risco, longitudinal, supervisão, psicodinâmica',
      'Alertas de padrão (evitação, ruminação, hipervigilância)',
      'Re-análise com feedback até 3x por análise',
      'Insights agregados da sua carteira',
      'Acesso antecipado a novas features',
    ],
    badge: 'Recomendado',
    highlight: true,
  },
]

const PLANS_EUR = [
  {
    id: 'base',
    name: 'Consultório',
    price: '€9,90',
    period: '/mês',
    tagline: 'Gestão completa · 15 análises IA/mês',
    features: [
      'Prontuário eletrónico ilimitado',
      'Canvas de anotações (único no segmento)',
      'Agenda com lembretes automáticos',
      'Controlo financeiro + recibos',
      'Formulários clínicos (PHQ-9, Beck, TCLE)',
      '15 análises IA incluídas por mês',
      'Conformidade OPP / RGPD',
      'Análises extras: €0,90/análise',
    ],
    highlight: false,
  },
  {
    id: 'clinico',
    name: 'Especialista',
    price: '€19,90',
    period: '/mês',
    tagline: 'IA clínica avançada · 40 análises IA/mês',
    features: [
      'Tudo do Consultório incluído',
      '40 análises IA incluídas por mês',
      'Hipóteses DSM-5/CID-11 com grau de evidência',
      '5 templates: reflexão, risco, longitudinal, supervisão, psicodinâmica',
      'Alertas de padrão (evitação, ruminação, hipervigilância)',
      'Re-análise com feedback até 3x por análise',
      'Insights agregados da sua carteira',
      'Acesso antecipado a novas features',
    ],
    badge: 'Recomendado',
    highlight: true,
  },
]

const EUR_COUNTRIES = ['PT', 'ES', 'FR', 'DE', 'IT', 'NL', 'BE', 'AT', 'IE', 'FI', 'GR', 'LU', 'MT', 'CY', 'SI', 'SK', 'EE', 'LV', 'LT', 'HR']

const CHECK = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default function PaymentModal({ onLogout, onClose, currentUser }) {
  const isEUR = EUR_COUNTRIES.includes(currentUser?.country)
  const PLANS = isEUR ? PLANS_EUR : PLANS_BRL
  const [loading, setLoading] = useState(null) // 'base' | 'clinico' | 'portal'
  const [coupon, setCoupon] = useState('')
  const [couponState, setCouponState] = useState(null) // null | { valid, message, discountType, discountValue }
  const [couponChecking, setCouponChecking] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Trial expirado = nunca teve assinatura ativa (sem stripeSubscriptionId no contexto)
  // Heurística: status blocked + plan base/consultorio + sem graceDaysRemaining
  const isTrialExpired = currentUser?.subscriptionStatus === 'blocked'
    && !currentUser?.graceDaysRemaining

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return }
    setDeleteLoading(true)
    try {
      await api.deleteAccount()
      onLogout()
    } catch {
      setDeleteLoading(false)
      setDeleteConfirm(false)
    }
  }

  const checkCoupon = async () => {
    const code = coupon.trim()
    if (!code) return
    setCouponChecking(true)
    try {
      const res = await api.validateCoupon(code, 'base')
      setCouponState(res)
    } catch {
      setCouponState({ valid: false, message: 'Erro ao validar cupom.' })
    } finally {
      setCouponChecking(false)
    }
  }

  const handleCheckout = async (planId) => {
    setLoading(planId)
    try {
      const origin = window.location.origin
      const appliedCoupon = couponState?.valid ? coupon.trim() : null
      const { url } = await api.createCheckoutSession({
        planId,
        successUrl: `${origin}/?payment=success`,
        cancelUrl:  `${origin}/?payment=canceled`,
        couponCode: appliedCoupon,
      })
      assertSafeRedirectUrl(url)  // FE-004 FIX
      window.location.href = url
    } catch (e) {
      console.error('Checkout error:', e)
      setLoading(null)
    }
  }

  const handlePortal = async () => {
    setLoading('portal')
    try {
      const { url } = await api.createBillingPortalSession({
        returnUrl: window.location.origin,
      })
      assertSafeRedirectUrl(url)  // FE-004 FIX
      window.location.href = url
    } catch (e) {
      console.error('Portal error:', e)
      setLoading(null)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      // backdrop-filter removido: causa artefato de composição GPU no Android Chrome.
      // O overlay escuro (0.88 opacity) já cria a separação visual necessária.
      background: 'rgba(18,24,20,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', overflowY: 'auto',
      touchAction: 'none',
      overscrollBehavior: 'none',
    }}>
      <div style={{
        background: 'var(--ow)', borderRadius: '20px',
        boxShadow: '0 32px 100px rgba(0,0,0,0.4)',
        width: '100%', maxWidth: '740px',
        maxHeight: 'min(92dvh,92svh,92vh)', overflowY: 'auto',
        padding: '0 0 32px 0',
      }}>

        {/* Header */}
        <div style={{
          background: 'var(--g700)', padding: '28px 32px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', flexShrink: 0,
            }}>🔒</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontFamily: "'Fraunces', serif", fontSize: '22px',
                color: '#fff', fontWeight: 300, marginBottom: '5px',
              }}>
                {isTrialExpired ? 'Seu período gratuito encerrou' : 'Sua assinatura expirou'}
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                {isTrialExpired
                  ? 'Seus dados estão seguros. Assine um plano para continuar usando o Psic Notes.'
                  : 'Seus prontuários e anotações estão intactos — renove abaixo para retomar o acesso completo em segundos.'
                }
              </div>
            </div>
            {onClose && (
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,0.4)', fontSize: '20px', lineHeight: 1,
                padding: '4px', flexShrink: 0, marginTop: '-4px',
                transition: 'color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                aria-label="Fechar"
              >✕</button>
            )}
          </div>

          {/* Promo banner — só para inadimplentes, não para trial expirado */}
          {!isTrialExpired && (
            <div style={{
              marginTop: '18px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '10px', padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <span style={{ fontSize: '18px' }}>🎁</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>
                  Oferta de retomada: 1ª renovação com 15% de desconto
                </div>
                <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.5)' }}>
                  Aplicado automaticamente no checkout · Válido por 48h
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Plans */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: '16px', padding: '24px 28px 20px',
        }} className="payment-modal-grid">
          {PLANS.map(plan => (
            <div key={plan.id} style={{
              background: plan.highlight ? 'var(--g700)' : 'var(--w)',
              border: plan.highlight
                ? '2px solid var(--g500)'
                : '1.5px solid var(--gr2)',
              borderRadius: '14px', padding: '22px',
              position: 'relative',
              boxShadow: plan.highlight ? '0 8px 32px rgba(74,124,89,0.25)' : 'var(--sh)',
            }}>
              {plan.badge && (
                <div style={{
                  position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                  background: 'var(--g500)', color: '#fff',
                  fontSize: '10px', fontWeight: 700, letterSpacing: '0.8px',
                  textTransform: 'uppercase', padding: '3px 12px', borderRadius: '20px',
                  whiteSpace: 'nowrap',
                }}>
                  {plan.badge}
                </div>
              )}

              {/* Plan header */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '12px', fontWeight: 600, letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  color: plan.highlight ? 'var(--g300)' : 'var(--gr4)',
                  marginBottom: '4px',
                }}>
                  {plan.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', marginBottom: '4px' }}>
                  <span style={{
                    fontFamily: "'Fraunces', serif", fontSize: '32px', fontWeight: 300,
                    color: plan.highlight ? '#fff' : 'var(--d)',
                  }}>{plan.price}</span>
                  <span style={{
                    fontSize: '13px',
                    color: plan.highlight ? 'rgba(255,255,255,0.5)' : 'var(--gr4)',
                  }}>{plan.period}</span>
                </div>
                <div style={{
                  fontSize: '12px', lineHeight: 1.5,
                  color: plan.highlight ? 'rgba(255,255,255,0.5)' : 'var(--gr5)',
                }}>
                  {plan.tagline}
                </div>
              </div>

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {plan.features.map(f => (
                  <li key={f} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px',
                    fontSize: '12.5px',
                    color: plan.highlight ? 'rgba(255,255,255,0.75)' : 'var(--gr5)',
                  }}>
                    <span style={{
                      color: plan.highlight ? 'var(--g300)' : 'var(--g600)',
                      flexShrink: 0, marginTop: '1px',
                    }}>
                      <CHECK />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => handleCheckout(plan.id)}
                disabled={!!loading}
                style={{
                  width: '100%', padding: '11px',
                  background: plan.highlight ? 'rgba(255,255,255,0.15)' : 'var(--g600)',
                  color: '#fff',
                  border: plan.highlight ? '1px solid rgba(255,255,255,0.2)' : 'none',
                  borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading && loading !== plan.id ? 0.5 : 1,
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'opacity 0.15s',
                }}
              >
                {loading === plan.id
                  ? 'Redirecionando...'
                  : isTrialExpired ? `Assinar ${plan.name}` : `Retomar com ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Coupon input */}
        <div style={{ padding: '0 28px 20px' }}>
          <div style={{
            background: 'var(--ow)', border: '1px solid var(--gr2)',
            borderRadius: '10px', padding: '14px 16px',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gr5)', marginBottom: '8px' }}>
              Tem um cupom de desconto?
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={coupon}
                onChange={e => { setCoupon(e.target.value.toUpperCase()); setCouponState(null) }}
                onKeyDown={e => e.key === 'Enter' && checkCoupon()}
                placeholder="EX: YOUTUBE30"
                style={{
                  flex: 1, border: `1px solid ${couponState ? (couponState.valid ? '#27AE60' : '#E74C3C') : 'var(--gr2)'}`,
                  borderRadius: '7px', padding: '8px 12px', fontSize: '13px',
                  fontFamily: "'DM Sans', sans-serif", outline: 'none',
                  background: 'var(--w)', color: 'var(--d)',
                  letterSpacing: '0.5px', fontWeight: 600,
                }}
              />
              <button
                onClick={checkCoupon}
                disabled={!coupon.trim() || couponChecking}
                style={{
                  padding: '8px 14px', background: 'var(--g600)', color: '#fff',
                  border: 'none', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600,
                  cursor: (!coupon.trim() || couponChecking) ? 'not-allowed' : 'pointer',
                  opacity: (!coupon.trim() || couponChecking) ? 0.5 : 1,
                  fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
                }}
              >
                {couponChecking ? 'Verificando…' : 'Aplicar cupom'}
              </button>
            </div>
            {couponState && (
              <div style={{
                marginTop: '8px', fontSize: '12px', fontWeight: 500,
                color: couponState.valid ? '#27AE60' : '#E74C3C',
                display: 'flex', alignItems: 'center', gap: '5px',
              }}>
                {couponState.valid ? '✓' : '✕'} {couponState.message}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          padding: '0 28px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {/* Update card only */}
          <div style={{
            background: 'var(--w)', border: '1px solid var(--gr2)',
            borderRadius: '10px', padding: '14px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '12px', flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--d)' }}>
                Precisa só trocar o cartão?
              </div>
              <div style={{ fontSize: '12px', color: 'var(--gr5)', marginTop: '2px' }}>
                Acesse o portal de cobrança para atualizar o método de pagamento sem mudar o plano.
              </div>
            </div>
            <button
              onClick={handlePortal}
              disabled={!!loading}
              style={{
                padding: '8px 16px', background: 'none',
                border: '1.5px solid var(--gr2)', borderRadius: '8px',
                fontSize: '12.5px', fontWeight: 600, color: 'var(--gr5)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading && loading !== 'portal' ? 0.5 : 1,
                fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap',
              }}
            >
              {loading === 'portal' ? 'Abrindo portal…' : 'Atualizar dados de cobrança'}
            </button>
          </div>

          {/* Excluir conta */}
          <div style={{ textAlign: 'center' }}>
            {deleteConfirm ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <div style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 500 }}>
                  Isso excluirá permanentemente todos os seus dados. Confirma?
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setDeleteConfirm(false)} disabled={deleteLoading} style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--gr2)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                    Cancelar
                  </button>
                  <button onClick={handleDeleteAccount} disabled={deleteLoading} style={{ padding: '6px 14px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: deleteLoading ? 'not-allowed' : 'pointer', opacity: deleteLoading ? 0.7 : 1, fontFamily: "'DM Sans', sans-serif" }}>
                    {deleteLoading ? 'Excluindo…' : 'Sim, excluir tudo'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={handleDeleteAccount} style={{ background: 'none', border: 'none', padding: '6px', fontSize: '12px', color: 'var(--danger)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                Excluir minha conta e dados
              </button>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={onLogout}
            style={{
              background: 'none', border: 'none', padding: '8px',
              fontSize: '12px', color: 'var(--gr4)', cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif", textAlign: 'center',
            }}
          >
            Sair da conta
          </button>
        </div>
      </div>
    </div>
  )
}
