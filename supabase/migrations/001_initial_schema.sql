-- ============================================================
-- PsicoAI — Schema inicial
-- Executar no SQL Editor do Supabase
-- ============================================================

-- ── Extensões ────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── PROFILES (psicólogos autenticados) ───────────────────────
-- Extends auth.users do Supabase. Criado automaticamente via trigger no signup.
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  crp           TEXT,                          -- ex: "06/89234"
  email         TEXT NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'trial', -- 'trial' | 'base' | 'clinico'
  analyses_remaining INT NOT NULL DEFAULT 5,   -- créditos de análise IA
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: cria profile automaticamente quando usuário se registra
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── PATIENTS (pacientes de cada psicólogo) ───────────────────
CREATE TABLE patients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Dados pessoais
  name             TEXT NOT NULL,
  email            TEXT,
  phone            TEXT,
  birth_date       DATE,
  cpf              TEXT,
  address          TEXT,
  insurance        TEXT,                        -- convênio

  -- Dados clínicos
  cid              TEXT,                        -- ex: "F43.1"
  cid_label        TEXT,                        -- ex: "TEPT"
  notes            TEXT,                        -- observações gerais

  -- Dados financeiros
  session_value    NUMERIC(10,2),
  session_day      TEXT,                        -- ex: "Terça-feira"
  session_time     TEXT,                        -- ex: "09:00"

  -- Status
  status           TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive' | 'archived'

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── APPOINTMENTS (agenda) ────────────────────────────────────
CREATE TABLE appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  date             DATE NOT NULL,
  time             TIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 50,

  type             TEXT NOT NULL DEFAULT 'presencial', -- 'presencial' | 'remoto'
  platform         TEXT,                        -- 'whereby' | 'meet' | 'zoom'
  meet_link        TEXT,

  status           TEXT NOT NULL DEFAULT 'scheduled',
  -- 'scheduled' | 'completed' | 'cancelled' | 'no_show'

  notes            TEXT,
  reminder_sent    BOOLEAN NOT NULL DEFAULT FALSE,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SESSIONS (atendimentos — texto ou canvas) ─────────────────
CREATE TABLE sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id   UUID REFERENCES appointments(id) ON DELETE SET NULL,

  type             TEXT NOT NULL DEFAULT 'text',  -- 'text' | 'canvas'
  note_type        TEXT,
  -- 'post_session' | 'pre_session' | 'observation'

  status           TEXT NOT NULL DEFAULT 'in_progress',
  -- 'in_progress' | 'completed' | 'abandoned'

  -- Conteúdo texto
  text_content     TEXT,
  html_content     TEXT,

  -- Conteúdo canvas
  canvas_data_json JSONB,                       -- elementos do Excalidraw
  canvas_text_content TEXT,                     -- texto extraído dos elementos
  canvas_image_url TEXT,                        -- URL do PNG no Storage

  duration_seconds INT,
  meet_link        TEXT,

  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ANALYSES (análises IA) ───────────────────────────────────
CREATE TABLE analyses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  session_ids      UUID[] NOT NULL DEFAULT '{}',  -- sessões incluídas

  status           TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'processing' | 'ready' | 'failed'

  template         TEXT DEFAULT 'standard',     -- 'standard' | 'risk' | 'progress'

  -- Resultado estruturado
  summary          TEXT,
  hypotheses       JSONB,  -- [{cid, label, probability, evidence[]}]
  alerts           JSONB,  -- [{type, severity, description}]
  patterns         JSONB,  -- [{name, description, sessions_count}]
  recommendations  JSONB,  -- [string]
  full_result      JSONB,  -- resposta completa do Claude

  error_message    TEXT,   -- se status = 'failed'

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── FORMS (formulários — anamnese, TCLE, escalas) ────────────
CREATE TABLE forms (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id       UUID REFERENCES patients(id) ON DELETE CASCADE,

  type             TEXT NOT NULL,
  -- 'anamnese' | 'tcle' | 'scale_bdi' | 'scale_bai' | 'custom'
  title            TEXT NOT NULL,

  status           TEXT NOT NULL DEFAULT 'draft',
  -- 'draft' | 'sent' | 'completed'

  data             JSONB,                        -- respostas do formulário
  sent_at          TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── FINANCIAL_RECORDS (financeiro) ───────────────────────────
CREATE TABLE financial_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id       UUID REFERENCES patients(id) ON DELETE SET NULL,
  session_id       UUID REFERENCES sessions(id) ON DELETE SET NULL,

  type             TEXT NOT NULL,               -- 'income' | 'expense'
  amount           NUMERIC(10,2) NOT NULL,
  description      TEXT,
  category         TEXT,                        -- 'sessao' | 'supervisao' | 'material'

  status           TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'paid' | 'overdue'

  due_date         DATE,
  paid_date        DATE,
  payment_method   TEXT,                        -- 'pix' | 'cartao' | 'dinheiro'
  receipt_url      TEXT,                        -- URL no Storage

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── REMINDERS (lembretes) ────────────────────────────────────
CREATE TABLE reminders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  psychologist_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id   UUID REFERENCES appointments(id) ON DELETE CASCADE,

  channel          TEXT NOT NULL,               -- 'email' | 'whatsapp' | 'sms'
  hours_before     INT NOT NULL DEFAULT 24,
  status           TEXT NOT NULL DEFAULT 'pending',
  -- 'pending' | 'sent' | 'failed'

  sent_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — cada psicólogo só vê seus dados
-- CRÍTICO: sem isso, qualquer usuário autenticado acessa
-- os dados de qualquer outro psicólogo (IDOR)
-- ════════════════════════════════════════════════════════════

ALTER TABLE profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients          ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE forms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders         ENABLE ROW LEVEL SECURITY;

-- profiles: psicólogo só vê e edita o próprio perfil
CREATE POLICY "own_profile" ON profiles
  FOR ALL USING (id = auth.uid());

-- patients
CREATE POLICY "own_patients" ON patients
  FOR ALL USING (psychologist_id = auth.uid());

-- appointments
CREATE POLICY "own_appointments" ON appointments
  FOR ALL USING (psychologist_id = auth.uid());

-- sessions
CREATE POLICY "own_sessions" ON sessions
  FOR ALL USING (psychologist_id = auth.uid());

-- analyses
CREATE POLICY "own_analyses" ON analyses
  FOR ALL USING (psychologist_id = auth.uid());

-- forms
CREATE POLICY "own_forms" ON forms
  FOR ALL USING (psychologist_id = auth.uid());

-- financial_records
CREATE POLICY "own_financial" ON financial_records
  FOR ALL USING (psychologist_id = auth.uid());

-- reminders
CREATE POLICY "own_reminders" ON reminders
  FOR ALL USING (psychologist_id = auth.uid());

-- ════════════════════════════════════════════════════════════
-- INDEXES — queries críticas
-- ════════════════════════════════════════════════════════════

-- Pacientes por psicólogo (listagem principal)
CREATE INDEX idx_patients_psychologist    ON patients(psychologist_id);
CREATE INDEX idx_patients_status          ON patients(psychologist_id, status);

-- Agenda: buscar por data
CREATE INDEX idx_appointments_date        ON appointments(psychologist_id, date);
CREATE INDEX idx_appointments_patient     ON appointments(patient_id);

-- Sessões por paciente (prontuário)
CREATE INDEX idx_sessions_patient         ON sessions(patient_id);
CREATE INDEX idx_sessions_psychologist    ON sessions(psychologist_id);
CREATE INDEX idx_sessions_status          ON sessions(psychologist_id, status);

-- Análises pendentes (polling do frontend)
CREATE INDEX idx_analyses_status          ON analyses(psychologist_id, status);
CREATE INDEX idx_analyses_patient         ON analyses(patient_id);

-- Financeiro por mês
CREATE INDEX idx_financial_date           ON financial_records(psychologist_id, due_date);

-- ════════════════════════════════════════════════════════════
-- STORAGE BUCKETS
-- ════════════════════════════════════════════════════════════

-- Canvas PNGs (imagens exportadas do Excalidraw para análise IA)
INSERT INTO storage.buckets (id, name, public)
VALUES ('canvas-images', 'canvas-images', FALSE);

-- Documentos (recibos, PDFs de formulários)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', FALSE);

-- Storage RLS: psicólogo só acessa seus arquivos (path: {psychologist_id}/*)
CREATE POLICY "canvas_owner" ON storage.objects
  FOR ALL USING (
    bucket_id = 'canvas-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "documents_owner" ON storage.objects
  FOR ALL USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ════════════════════════════════════════════════════════════
-- FUNÇÃO: updated_at automático em todas as tabelas
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON patients          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON appointments      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON sessions          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON analyses          FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON forms             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON financial_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
