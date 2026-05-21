# PsicoAI — Frontend

> **O primeiro assistente de raciocínio clínico para psicólogos.**  
> SPA React 19 + Vite 8. Prontuário eletrônico, sessões, análise IA (Claude), agenda, financeiro e conformidade CFP 09/2024.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | React 19 |
| Build | Vite 8 |
| Estilo | CSS puro (design system próprio, sem Tailwind) |
| Canvas de sessão | tldraw |
| PWA | vite-plugin-pwa |
| Deploy demo | Vercel (SPA com `vercel.json`) |

---

## Quickstart

```bash
npm install

# Modo demo (dados mockados, sem backend)
npm run dev

# Modo com backend real
cp .env.example .env.local
# edite VITE_API_BASE_URL=http://localhost:8080
npm run dev
```

Acesse `http://localhost:5173`.

**Demo:** `demo@psicoai.com.br` / `demo123`

---

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `VITE_API_BASE_URL` | `""` (vazio) | URL base do backend. **Se vazio, usa dados mockados.** |

Crie `.env.local` para sobrescrever localmente (ignorado pelo git).

```dotenv
# Dev local com backend rodando
VITE_API_BASE_URL=http://localhost:8080

# Produção (configure no painel Vercel)
# VITE_API_BASE_URL=https://api.psicoai.com.br
```

---

## Arquitetura de Serviços

```
src/services/
├── index.js     ← ponto de entrada; roteia para mock ou real
├── mockApi.js   ← dados em memória; demo Vercel sempre funciona
└── realApi.js   ← cliente HTTP fetch; auto-refresh de token; fallback mock para features futuras
```

### Como o roteamento funciona

```js
// src/services/index.js
const USE_REAL = Boolean(import.meta.env.VITE_API_BASE_URL)
export const auth = USE_REAL ? realAuth : mockAuth
export const api  = USE_REAL ? realApi  : mockApi
```

Todos os views importam de `'../services'` — nunca diretamente de `mockApi` ou `realApi`.

### Auto-refresh de token (realApi)

- Access token expira em 15 min (configurável no backend)
- Em qualquer resposta `401`, o cliente tenta renovar com o refresh token (30 dias)
- Lock singleton evita race conditions quando múltiplas requests expiram simultaneamente
- Se o refresh falhar: limpa storage + dispara `window.dispatchEvent(new CustomEvent('psicoai:session-expired'))`

---

## Estrutura do Projeto

```
src/
├── App.jsx                    # Shell: auth, navegação, modais globais
├── services/
│   ├── index.js               # Router mock/real
│   ├── mockApi.js             # 30+ funções, dados em memória
│   └── realApi.js             # Cliente HTTP fetch com auto-refresh
├── views/
│   ├── Login.jsx              # Login + RegisterFlow
│   ├── Dashboard.jsx          # Resumo do dia, alertas, agenda
│   ├── Pacientes.jsx          # Lista de pacientes
│   ├── Paciente.jsx           # Prontuário completo do paciente
│   ├── CanvasSession.jsx      # Sessão com canvas tldraw
│   ├── TextSession.jsx        # Sessão com editor de texto
│   ├── Agenda.jsx             # Calendário + agendamento
│   ├── Insights.jsx           # Visão IA agregada (hipóteses, padrões)
│   ├── Financeiro.jsx         # Lançamentos, recebimentos, inadimplência
│   ├── Lembretes.jsx          # Configuração de lembretes automáticos
│   ├── Formularios.jsx        # Envio e rastreio de formulários para pacientes
│   ├── Teleatendimento.jsx    # Sessões remotas (Whereby, Meet, Zoom)
│   └── Configuracoes.jsx      # Perfil, preferências, plano
├── components/
│   ├── AiDrawer.jsx           # Drawer de análise IA (hipóteses, padrões, alertas)
│   ├── ReportModal.jsx        # Geração e envio de relatórios clínicos
│   ├── CadastroModal.jsx      # Modal de cadastro de paciente
│   ├── PreSessionBriefing.jsx # Briefing pré-sessão
│   ├── PatientPicker.jsx      # Seletor de paciente
│   ├── OnboardingTour.jsx     # Tour de boas-vindas
│   ├── RegisterFlow.jsx       # Fluxo de cadastro (3 passos)
│   ├── Sidebar.jsx
│   ├── Topbar.jsx
│   └── Toast.jsx
└── styles/
    └── globals.css            # Design system: variáveis CSS, utilidades, componentes
```

---

## Deploy

### Vercel (demo / produção sem backend)

1. Push para o repositório GitHub
2. Conecte ao Vercel — ele detecta Vite automaticamente
3. **Não configure `VITE_API_BASE_URL`** → app roda em modo mock
4. O `vercel.json` garante que o SPA funcione em qualquer rota

### Vercel (produção com backend)

1. No painel Vercel → Settings → Environment Variables
2. Adicione `VITE_API_BASE_URL=https://api.psicoai.com.br`
3. Redeploy

### Build manual

```bash
npm run build
# Artefato gerado em dist/
```

---

## Integração com Backend

O backend (Spring Boot + Kotlin) expõe a API em `http://localhost:8080` por padrão.

### Pré-requisitos para rodar localmente com backend

```bash
# 1. Backend rodando (na pasta psicoai-backend)
docker compose up -d postgres
./gradlew bootRun

# 2. Frontend apontando para o backend
echo "VITE_API_BASE_URL=http://localhost:8080" > .env.local
npm run dev
```

O Vite proxeia `/api` → `localhost:8080` em dev, então não há problema de CORS.

### Mapeamento de features: frontend × backend

| Feature | Backend endpoint | Status |
|---------|-----------------|--------|
| Auth (login/registro/refresh) | `POST /api/v1/auth/*` | ✅ Integrado |
| Pacientes (CRUD) | `GET/POST/PATCH/DELETE /api/v1/patients` | ✅ Integrado |
| Sessões | `POST /api/v1/sessions`, `/finish`, `/autosave` | ✅ Integrado |
| Análise IA | `POST /api/v1/analyses` | ✅ Integrado |
| Dashboard | `GET /api/v1/dashboard` | ✅ Integrado |
| Insights | `GET /api/v1/insights` | ✅ Integrado |
| Agenda | `GET/POST/PATCH/DELETE /api/v1/agenda` | ✅ Integrado |
| Financeiro | `GET/POST/PATCH /api/v1/financial` | ✅ Integrado |
| Formulários | `POST /api/v1/forms` | ✅ Integrado |
| Perfil | `GET/PATCH /api/v1/me` | ✅ Integrado |
| Billing (Stripe) | `POST /api/v1/billing/checkout` | ✅ Integrado |
| Lembretes | — | 🔜 Backend v2 |
| Teleatendimento | — | 🔜 Backend v2 |
| Relatórios PDF | — | 🔜 Backend v2 |

---

## Features principais

- **Hipóteses diagnósticas** — DSM-5 e CID-11 com probabilidade ponderada (acionado pelo psicólogo)
- **Alertas de padrão** — evitação, ruminação, risco detectados pela IA
- **Canvas de anotações** — tldraw com caneta, marca-texto e zoom
- **Linha do tempo clínica** — evolução sessão a sessão (verde / amarelo / vermelho)
- **Relatórios clínicos** — encaminhamento psiquiátrico, evolução, resumo, prontuário completo
- **Agenda** — calendário mensal/semanal, link de sala remota
- **Financeiro** — lançamentos, controle de inadimplência, recibos
- **Lembretes** — confirmação 24h, lembrete no dia, cobrança pós-sessão
- **Teleatendimento** — agendamento, Whereby / Google Meet / Zoom
- **Conformidade CFP 09/2024** — prontuário eletrônico dentro da resolução vigente

---

## Segurança (frontend)

- Tokens armazenados em `localStorage` (não cookies, para evitar CSRF em SPA)
- Auto-refresh transparente sem logout desnecessário
- Evento `psicoai:session-expired` capturado pelo App para redirecionar ao login
- **Nenhuma chave secreta no frontend** — toda lógica sensível fica no backend

---

## Conformidade CFP 09/2024

A plataforma não faz diagnósticos. As hipóteses são ferramentas de apoio ao raciocínio clínico. O diagnóstico é responsabilidade exclusiva do psicólogo registrado no CFP.

---

## Licença

Proprietária — todos os direitos reservados. Contato: contato@psicoai.com.br
