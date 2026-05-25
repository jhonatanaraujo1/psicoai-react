# PsicoAI — Handoff Completo para Nova Sessão

> Leia este arquivo inteiro antes de qualquer ação. Ele contém o contexto completo do projeto, estado atual, bugs conhecidos e próximos passos priorizados.

**Última atualização:** 2026-05-22  
**App ao vivo:** https://psicoai-react.vercel.app  
**Login mock:** qualquer email + senha ≥6 chars (ou demo@psicoai.com.br / demo123)

---

## 1. O QUE É O PSICOAI

**Produto:** O primeiro assistente de raciocínio clínico com IA para psicólogos do Brasil.

**Diferenciação real (verificada por pesquisa competitiva):** nenhum competidor brasileiro ou internacional oferece hipóteses diagnósticas DSM-5/CID-11 com probabilidade ponderada para psicólogos autônomos. O mercado inteiro convergiu para documentação (notas de sessão). PsicoAI vai além.

**Público-alvo:** Psicólogos autônomos brasileiros com 15–30 pacientes ativos, CRP ativo, faturamento R$8–15k/mês.

**Posicionamento:** "Não é prontuário. É o primeiro assistente de raciocínio clínico para psicólogos."

**Preço:**
- Plano Base: R$199/mês (prontuário + canvas + agenda + timeline, sem análises inclusas)
- Plano Clínico: R$299/mês (tudo + 20 análises IA/mês + relatórios PDF)
- Análise avulsa: R$4,90/análise (qualquer plano, sob demanda)

---

## 2. STACK TÉCNICA

### Frontend
- **Repo:** https://github.com/jhonatanaraujo1/psicoai-react
- **Deploy:** https://psicoai-react.vercel.app (modo mock — sem backend)
- React 19 + Vite 8
- CSS puro (design system próprio, sem Tailwind)
- PWA (vite-plugin-pwa)
- Canvas de sessão: **Excalidraw** (MIT — tldraw foi substituído por conflito de licença)
- Demo: `demo@psicoai.com.br` / `demo123`

### Backend
- **Repo:** https://github.com/jhonatanaraujo1/psicoai-backend
- **Deploy:** ❌ AINDA NÃO DEPLOYADO (roda só local em `localhost:8080`)
- Spring Boot 3.3 + Kotlin 1.9 + Java 21
- PostgreSQL 16 + Flyway
- JWT (access 15min + refresh 30 dias)
- Anthropic Claude 3.5 Sonnet (análise clínica)
- Stripe (checkout + webhooks + portal)
- Resend (emails transacionais)
- Bucket4j (rate limiting)

---

## 3. ARQUITETURA DE SERVIÇOS (FRONTEND)

```
src/services/
├── index.js      ← router: se VITE_API_BASE_URL existir → realApi, senão → mockApi
├── mockApi.js    ← dados em memória, demo Vercel sempre funciona
└── realApi.js    ← cliente HTTP com auto-refresh JWT e handler de 402
```

**Variável de ambiente:**
```
VITE_API_BASE_URL=http://localhost:8080   ← ativa backend real
VITE_API_BASE_URL=                        ← modo mock (Vercel demo)
```

**Estado atual do `.env.local`:** `VITE_API_BASE_URL` está **comentado** — local roda em mock.  
Vercel não tem a var configurada → mock automático em produção também.

**Eventos globais do frontend:**
- `psicoai:session-expired` → logout automático (401 sem refresh)
- `psicoai:payment-required` → abre PaymentModal (402 do backend)

---

## 4. O QUE FOI IMPLEMENTADO E ESTÁ FUNCIONANDO

### Frontend (todas as views existem e funcionam em mock)
- ✅ Login + RegisterFlow (3 passos)
- ✅ Dashboard (stats, agenda do dia, alertas, snapshot financeiro)
- ✅ Pacientes (lista, busca, cadastro)
- ✅ Prontuário do paciente (linha do tempo, histórico de sessões, análises)
- ✅ Canvas de sessão (Excalidraw MIT — tldraw substituído por licença) + Sessão em texto
- ✅ Agenda (calendário mensal/semanal)
- ✅ Insights IA (padrões, hipóteses, cobertura)
- ✅ Financeiro (lançamentos, controle)
- ✅ Lembretes, Formulários, Teleatendimento
- ✅ Configurações (perfil, plano, preferências, atalhos, FAQ)
- ✅ OnboardingTour
- ✅ AiDrawer (resultado da análise IA)
- ✅ PaymentModal (bloqueio por inadimplência com planos + promo)
- ✅ Responsivo para mobile e tablet (breakpoints: 1024px, 900px, 768px)
- ✅ Sidebar collapse no tablet (hamburger)
- ✅ Anti-zoom iOS (viewport maximum-scale=1 + font-size 16px em inputs)

### Backend (implementado, não deployado)
- ✅ Auth completo (register, login, refresh, logout)
- ✅ CRUD pacientes com soft delete
- ✅ Sessões (criar, autosave, encerrar, hoje, abertas)
- ✅ Pipeline IA completo: sessão → Claude 3.5 Sonnet → hipóteses + padrões + alertas + sugestões → salva no banco
- ✅ Dashboard composite
- ✅ Insights agregados
- ✅ Agenda CRUD
- ✅ Financeiro CRUD + summary
- ✅ Formulários (psicólogo cria, paciente responde via link público)
- ✅ Billing Stripe (checkout, portal, webhooks com idempotência)
- ✅ Trial scheduler (avisa D-4 e D-1, bloqueia expirados de hora em hora)
- ✅ AccessGuardFilter (bloqueia blocked/canceled/past_due com 402)
- ✅ RateLimitFilter (100 req/min global, 10 análises/hora por usuário)
- ✅ CooldownService (30s entre análises)
- ✅ AuditService (log de todas as ações)
- ✅ 6 templates de email (welcome, trial ending D-4/D-1, expired, payment failed, blocked, payment confirmed)
- ✅ Testes unitários (AuthService, PatientService, AnalysisService)

---

## 5. BUGS CRÍTICOS CONHECIDOS

### ✅ Bug 1 — Webhook Stripe não ativa assinaturas — CORRIGIDO
**Arquivo:** `psicoai-backend/src/main/kotlin/com/psicoai/billing/BillingService.kt`

`handleSubscriptionActive()` e `handleSubscriptionCanceled()` agora buscam o usuário via `userRepository.findByStripeCustomerId(subscription.customer)` em vez de `subscription.metadata["userId"]` (que o Stripe não copia da checkout session).

---

### ✅ Bug 2 — Links dos emails são strings literais — CORRIGIDO
**Arquivos:** `EmailTemplates.kt`, `EmailService.kt`, `AppProperties.kt`, `application.yml`

Todas as funções de template agora recebem `frontendUrl: String` como parâmetro e usam interpolação Kotlin normal. O valor vem de `app.resend.frontend-url` no `application.yml` (env var `FRONTEND_URL`).

---

### ✅ Bug 3 — Frontend cria análise com sessionId falso — CORRIGIDO
**Arquivos:** `App.jsx`, `TextSession.jsx`, `CanvasSession.jsx`, `mockApi.js`

Fluxo completo conectado:
1. `handleBriefingStart` chama `api.createSession()` em background (não-bloqueante)
2. `TextSession` faz autosave via `onAutosave(sessionId, { textContent })` a cada 30s
3. Ao encerrar sem IA → `handleSessionClose` chama `api.finishSession()` fire-and-forget
4. Ao encerrar com IA → `handleAnalyze` chama `finishSession` + `createAnalysis({ sessionId })` com ID real

---

### 🟠 Bug 4 — `hasAnalysis` sempre false
**Arquivo:** `psicoai-backend/src/main/kotlin/com/psicoai/session/SessionService.kt` linha 134

```kotlin
hasAnalysis = false, // enriched by AnalysisService when needed
```
"when needed" nunca acontece. O prontuário nunca mostra quais sessões têm análise.

**Fix necessário:** Dentro de `getSessions()`, após buscar as sessões, chamar `analysisRepository.findSessionIdsWithAnalysis(userId)` (ou similar) e marcar `hasAnalysis = true` para os IDs que retornarem.

---

### ✅ Bug 5 — Botões de billing em Configurações usam alert() — CORRIGIDO
**Arquivo:** `psicoai-react/src/views/Configuracoes.jsx`

Botões "Fazer upgrade" e "Cancelar assinatura" agora chamam `api.createCheckoutSession()` e `api.createBillingPortalSession()` com redirect real para Stripe.

---

### ✅ Bug 6 — Sem handler do retorno do Stripe — CORRIGIDO
**Arquivo:** `psicoai-react/src/App.jsx`

`useEffect` detecta `?payment=success` na URL ao carregar, mostra toast de confirmação, limpa o parâmetro e recarrega o perfil do usuário via `api.getUserProfile()`.

---

## 5B. MUDANÇAS DESTA SESSÃO (2026-05-22)

### Preços removidos de toda UI do app
**Filosofia adotada:** mostrar preços dentro do app faz o sistema parecer caro para psicólogos com poucos pacientes. Solução: mostrar apenas volume de conteúdo (indicador visual) + CTA "Ver planos" sem valores.

**Arquivos alterados:**
- `src/components/AnalyzeSessionsModal.jsx` — volume bar com 4 tiers, sem R$ visíveis ao usuário
- `src/views/Configuracoes.jsx` — referências de preço substituídas por descrição de plano
- `src/components/PaymentModal.jsx` — "R$4,90 cada" removido da feature list

### Sistema de tiers de volume (AnalyzeSessionsModal)
Implementado para proteger margem em análises de alto volume:
```js
const CHARS_PER_PAGE = 1500
// Tiers internos (não exibidos ao usuário):
// ≤30 págs  → base      (custo API ~R$0.20)
// 31-60     → médio     
// 61-100    → alto      
// 100+      → extenso   (custo pode superar receita — alerta + "Ver planos")
```
- Volume bar visual (verde → vermelho) com label de tier
- Quando tier ≠ base: alerta colorido + link "Ver planos →" (sem mostrar valor extra)
- Estimativa de páginas por sessão: `~X pág` como badge em cada checkbox
- Últimas 10 sessões mostradas (era 5)

### Reabertura de sessões (implementada em sessão anterior)
Clicar numa sessão do histórico reabre TextSession ou CanvasSession com conteúdo precarregado. Landing page Step 1 atualizado para refletir isso.

### Landing page atualizada (psicoai-landing.html)
- 4º depoimento adicionado (Dra. Ana Kessler — formulários por link antes da 1ª sessão)
- Grid de depoimentos: 3→4 colunas
- Hero subheadline reescrito (menciona formulários, Google Meet, histórico de sessões)
- 2 cards "Kit Completo" novos: Anotações rápidas + Reabrir sessões anteriores

---

## 6. PRÓXIMOS PASSOS PRIORIZADOS

### 🔴 Único blocker restante: Deploy do backend

Todos os bugs de código foram corrigidos. O único item que bloqueia ir para produção é fazer o deploy do backend.

| # | Tarefa | Arquivo | Critério de conclusão |
|---|--------|---------|----------------------|
| 1 | **Deploy do backend** | infra | URL pública acessível pelo frontend Vercel |
| 2 | Configurar `VITE_API_BASE_URL` no Vercel | Vercel dashboard | Frontend aponta para backend em produção |
| 3 | Registrar webhook do Stripe apontando para URL pública | Stripe dashboard | `STRIPE_WEBHOOK_SECRET` atualizado no server |

### Semana 2 — Fechar gaps de produto

| # | Tarefa | Arquivo |
|---|--------|---------|
| 4 | `hasAnalysis` real nas sessões (Bug 4) | `SessionService.kt` |
| 5 | Atualizar copy da landing page (feedback de psicólogos) | `psicoai-landing.html` |
| 6 | **Compressão de contexto longitudinal** — usar campo `summary` das análises antigas (sessões além das últimas 3) em vez de `textContent` completo. Evita prejuízo em análises de 24+ meses. Discutido, não implementado ainda. | `AnalyzeSessionsModal.jsx` + `mockApi.js` |
| 7 | **Decisão pendente:** modelo de preços final. Landing page ainda mostra R$4,90/análise — manter como marketing ou remover também? Quantas análises por plano? | `psicoai-landing.html`, `PaymentModal.jsx` |

### Deploy do backend — opções recomendadas

**Railway** (mais simples):
1. Conectar repo `psicoai-backend` no Railway
2. Adicionar PostgreSQL como plugin
3. Configurar variáveis de ambiente
4. Deploy automático

**Variáveis obrigatórias no servidor:**
```
DATABASE_URL=jdbc:postgresql://...
DB_USER=...
DB_PASSWORD=...
JWT_SECRET=<openssl rand -hex 32>
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASE=price_...
STRIPE_PRICE_CLINICO=price_...
RESEND_API_KEY=re_...
FRONTEND_URL=https://psicoai-react.vercel.app
```

---

## 7. CONTEXTO DE MERCADO

**Pesquisa feita com 4 agentes paralelos (maio/2026):**

- 547.000 psicólogos registrados no Brasil (CFP)
- TAM endereçável: ~80.000–120.000 autônomos com carteira viável
- Maior competidor (PsicoManager): 20.000 usuários, zero IA, Reclame Aqui 6,24/10
- Competidor mais próximo em IA: PsiNota AI (R$119/mês, foco em documentação, sem hipótese diagnóstica)
- Nenhum competidor nacional ou internacional tem DSM-5/CID-11 com probabilidade para psicólogos individuais
- WTP: R$150–250/mês para o segmento-alvo
- CFP publicou posicionamento favorável ao uso de IA como ferramenta auxiliar (dez/2025)

**Feedback recente de psicólogos sobre a copy:**
- Resistência: "só quem tem pouca experiência precisa disso"
- Causa: copy fala em "hipóteses diagnósticas" o que ativa medo de ser substituído
- Fix de copy: mudar ângulo para "organiza o que você já percebeu" e "para psicólogos experientes, não iniciantes"
- Relatório completo: `C:\Users\Minas\psicoai_market_research.md`

---

## 8. ARQUIVOS IMPORTANTES

| Arquivo | Localização | O que tem |
|---------|-------------|-----------|
| Landing page | `C:\Users\Minas\psicoai-landing.html` | HTML completo autocontido |
| Relatório de mercado | `C:\Users\Minas\psicoai_market_research.md` | Pesquisa competitiva completa |
| Frontend | `C:\Users\Minas\psicoai-react\` | Repo completo React |
| Backend | `C:\Users\Minas\psicoai-backend\` | Repo completo Spring Boot |
| Env local frontend | `C:\Users\Minas\psicoai-react\.env.local` | Aponta para localhost:8080 |
| Env exemplo backend | `C:\Users\Minas\psicoai-backend\.env.example` | Template de variáveis |

---

## 9. REGRAS DE TRABALHO

- **Nunca fazer deploy sem confirmar com o usuário primeiro**
- Vercel CLI disponível: `vercel deploy --prod` (na pasta `psicoai-react`)
- gh CLI instalado em `C:\Program Files\GitHub CLI\gh.exe`
- Backend roda com `./gradlew bootRun` na pasta `psicoai-backend`
- PostgreSQL sobe com `docker compose up -d postgres`
- Toda decisão técnica tem impacto direto em receita ou eficiência — se não tem, questione

---

## 10. ESTADO DOS REPOSITÓRIOS GIT

**Frontend (`psicoai-react`):**
```
branch: master
último commit: fix: prevent iOS auto-zoom on input focus
remote: https://github.com/jhonatanaraujo1/psicoai-react (privado)
```

**Backend (`psicoai-backend`):**
```
branch: main
último commit: fix: remove garbled line from README
remote: https://github.com/jhonatanaraujo1/psicoai-backend (privado)
```
