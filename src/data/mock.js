export const patients = [
  { id: 1, initials: 'LM', name: 'Lucas Martins', age: 34, gender: 'Masculino', sessions: 14, months: 8, cid: 'F43.1', status: 'danger', statusLabel: 'Alerta IA', avatarBg: 'var(--g50)', avatarColor: 'var(--g600)' },
  { id: 2, initials: 'CS', name: 'Carla Silva', age: 28, gender: 'Feminino', sessions: 6, months: 3, cid: 'F40.1', status: 'green', statusLabel: 'Evolução positiva', avatarBg: 'var(--g100)', avatarColor: 'var(--g700)' },
  { id: 3, initials: 'RF', name: 'Rafael Fonseca', age: 41, gender: 'Masculino', sessions: 22, months: 12, cid: 'F33.1', status: 'warn', statusLabel: 'Monitorar', avatarBg: 'var(--warn-l)', avatarColor: 'var(--warn)' },
  { id: 4, initials: 'MC', name: 'Marina Costa', age: 25, gender: 'Feminino', sessions: 9, months: 4, cid: 'F41.1', status: 'green', statusLabel: 'Estável', avatarBg: 'var(--g50)', avatarColor: 'var(--g500)' },
  { id: 5, initials: 'JO', name: 'João Oliveira', age: 29, gender: 'Masculino', sessions: 3, months: 1, cid: null, status: 'gray', statusLabel: 'Início', avatarBg: 'var(--gr1)', avatarColor: 'var(--gr5)' },
];

export const todaySessions = [
  { initials: 'LM', name: 'Lucas Martins', session: 14, approach: 'TCC', note: 'Alerta IA', noteColor: 'var(--danger)', time: '09:00', duration: '50 min', urgency: 'red', avatarBg: 'var(--g50)', avatarColor: 'var(--g600)' },
  { initials: 'CS', name: 'Carla Silva', session: 6, approach: 'Psicanálise', note: '', time: '10:30', duration: '50 min', urgency: 'green', avatarBg: 'var(--g100)', avatarColor: 'var(--g700)' },
  { initials: 'RF', name: 'Rafael Fonseca', session: 22, approach: 'TCC', note: 'Padrão identificado', time: '14:00', duration: '50 min', urgency: 'yellow', avatarBg: 'var(--warn-l)', avatarColor: 'var(--warn)' },
];

export const recentActivity = [
  { initials: 'LM', name: 'Lucas Martins', session: 13, summary: 'Evitação ao discutir relação paterna — tema recorrente por 3 sessões consecutivas.', hasAI: true, aiLabel: 'Análise IA · 17 mai, 15:30', date: '17 mai', avatarBg: 'var(--g50)', avatarColor: 'var(--g600)' },
  { initials: 'RF', name: 'Rafael Fonseca', session: 22, summary: 'Padrão de ruminação nos seus registros. Ansiedade (8x), culpa (5x) nas últimas sessões.', hasAI: true, aiLabel: 'Análise IA · 17 mai, 10:45', date: '17 mai', avatarBg: 'var(--warn-l)', avatarColor: 'var(--warn)' },
  { initials: 'CS', name: 'Carla Silva', session: 5, summary: 'Anotação registrada.', hasAI: false, date: '16 mai', avatarBg: 'var(--g100)', avatarColor: 'var(--g700)' },
  { initials: 'MC', name: 'Marina Costa', session: 9, summary: 'Anotação registrada.', hasAI: false, date: '15 mai', avatarBg: 'var(--g50)', avatarColor: 'var(--g500)' },
  { initials: 'JO', name: 'João Oliveira', session: 3, summary: 'Anotação registrada.', hasAI: false, date: '14 mai', avatarBg: 'var(--gr1)', avatarColor: 'var(--gr5)' },
];

export const agendaEvents = [
  { day: 0, hour: 9, name: 'Lucas Martins', meta: 'S14 · TCC', color: 'red' },
  { day: 0, hour: 10, name: 'Carla Silva', meta: 'S6 · Psicanálise', color: 'green' },
  { day: 0, hour: 14, name: 'Rafael Fonseca', meta: 'S22 · TCC', color: 'yellow' },
  { day: 1, hour: 11, name: 'Marina Costa', meta: 'S9 · TCC', color: 'green' },
  { day: 1, hour: 14, name: 'Rafael Ferreira', meta: 'S7 · Psicanálise', color: 'green' },
  { day: 2, hour: 9, name: 'Beatriz Lima', meta: 'S5 · TCC', color: 'green' },
  { day: 2, hour: 11, name: 'João Oliveira', meta: 'S3 · Avaliação', color: 'green' },
  { day: 2, hour: 15, name: 'Sofia Andrade', meta: 'S11 · TCC', color: 'red' },
  { day: 4, hour: 9, name: 'Pedro Alves', meta: 'S18 · TCC', color: 'green' },
];

export const financeiro = [
  { patient: 'Lucas Martins', date: '18 mai', session: 14, value: 'R$200', hasAI: true, status: 'pago' },
  { patient: 'Carla Silva', date: '18 mai', session: 6, value: 'R$200', hasAI: false, status: 'pago' },
  { patient: 'Rafael Fonseca', date: '17 mai', session: 22, value: 'R$200', hasAI: true, status: 'pago' },
  { patient: 'Sofia Andrade', date: '15 mai', session: 11, value: 'R$200', hasAI: false, status: 'pendente' },
  { patient: 'Pedro Alves', date: '14 mai', session: 18, value: 'R$200', hasAI: false, status: 'atrasado' },
  { patient: 'Marina Costa', date: '14 mai', session: 9, value: 'R$200', hasAI: false, status: 'pago' },
  { patient: 'Beatriz Lima', date: '12 mai', session: 5, value: 'R$200', hasAI: false, status: 'pago' },
  { patient: 'João Oliveira', date: '10 mai', session: 3, value: 'R$200', hasAI: false, status: 'pago' },
];

export const evolutionData = [
  { month: 'Dez', value: 58 },
  { month: 'Jan', value: 61 },
  { month: 'Fev', value: 63 },
  { month: 'Mar', value: 65 },
  { month: 'Abr', value: 64 },
  { month: 'Mai', value: 67 },
];

export const patientSessions = [
  { id: 14, num: 'S14', date: 'Hoje, 09:00', duration: '—', evolution: null, hasAI: false, statusLabel: 'Agendada', summary: 'Sessão ainda não realizada.' },
  { id: 13, num: 'S13', date: '17 mai 2026', duration: '52 min', evolution: 'red', hasAI: true, statusLabel: 'Alerta IA', summary: 'Evitação ao tema familiar detectada 4x. Flashback verbal na marca 23min. Padrão TEPT reforçado.' },
  { id: 12, num: 'S12', date: '03 mai 2026', duration: '50 min', evolution: 'yellow', hasAI: true, statusLabel: 'Neutro', summary: 'Processamento de memória traumática. Paciente mais receptivo. Sem crises.' },
  { id: 11, num: 'S11', date: '19 abr 2026', duration: '48 min', evolution: 'yellow', hasAI: false, statusLabel: 'Neutro', summary: 'Estabilização após crise. Técnicas de regulação emocional trabalhadas.' },
  { id: 10, num: 'S10', date: '05 abr 2026', duration: '55 min', evolution: 'red', hasAI: true, statusLabel: 'Regressão', summary: 'Evitação marcante. Humor deprimido. Sem abertura para aprofundamento.' },
  { id: 9, num: 'S9', date: '22 mar 2026', duration: '60 min', evolution: 'red', hasAI: true, statusLabel: 'Crise', summary: 'Crise de ansiedade durante sessão. Grounding aplicado. Encaminhado ao psiquiatra.' },
  { id: 8, num: 'S8', date: '08 mar 2026', duration: '50 min', evolution: 'yellow', hasAI: false, statusLabel: 'Neutro', summary: 'Retorno ao tema familiar. Resistência moderada. Exposição gradual iniciada.' },
  { id: 7, num: 'S7', date: '22 fev 2026', duration: '50 min', evolution: 'green', hasAI: false, statusLabel: 'Evolução', summary: 'Técnicas TCC consolidadas. Paciente relata melhora significativa no sono.' },
  { id: 6, num: 'S6', date: '08 fev 2026', duration: '50 min', evolution: 'green', hasAI: false, statusLabel: 'Evolução', summary: 'Melhora relatada. Redução de pesadelos. Vínculo terapêutico fortalecido.' },
  { id: 5, num: 'S5', date: '25 jan 2026', duration: '52 min', evolution: 'green', hasAI: true, statusLabel: 'Evolução', summary: 'Insight sobre padrão de evitação. Paciente nomeou o comportamento pela primeira vez.' },
  { id: 4, num: 'S4', date: '11 jan 2026', duration: '50 min', evolution: 'yellow', hasAI: false, statusLabel: 'Neutro', summary: 'Técnica de exposição gradual iniciada. Resistência presente mas manejável.' },
  { id: 3, num: 'S3', date: '14 dez 2025', duration: '50 min', evolution: 'yellow', hasAI: false, statusLabel: 'Neutro', summary: 'Resistência ao aprofundamento. Aliança terapêutica em construção.' },
  { id: 2, num: 'S2', date: '30 nov 2025', duration: '50 min', evolution: 'green', hasAI: false, statusLabel: 'Evolução', summary: 'Rapport estabelecido. Paciente compartilhou histórico de trauma infantil.' },
  { id: 1, num: 'S1', date: '16 nov 2025', duration: '60 min', evolution: 'green', hasAI: false, statusLabel: 'Evolução', summary: 'Anamnese inicial. Queixa: ansiedade crônica, pesadelos, dificuldade relacional.' },
]

export const formTemplates = [
  { id: 'anamnese', type: 'anamnese', icon: '📋', name: 'Anamnese inicial', desc: 'Histórico de vida, queixa principal, histórico familiar, medicamentos em uso e tratamentos anteriores.', meta: '14 campos · ~8 min', badge: 'Padrão', badgeClass: 'badge-green' },
  { id: 'tcle', type: 'tcle', icon: '📜', name: 'TCLE — Consentimento', desc: 'Termo de Consentimento Livre e Esclarecido conforme Res. CFP 09/2024. Com assinatura digital.', meta: 'Assinatura digital · CFP', badge: 'Legal', badgeClass: '', badgeStyle: 'background:#EBF3FD;color:#2980B9' },
  { id: 'beck', type: 'beck', icon: '📊', name: 'Inventário Beck (BDI-II)', desc: '21 itens de autorrelato para rastreio de sintomas depressivos. Pontuação automática com classificação de severidade.', meta: '21 itens · ~5 min', badge: 'Escala validada', badgeClass: 'badge-warn' },
  { id: 'phq', type: 'phq', icon: '🧠', name: 'PHQ-9 — Depressão', desc: 'Patient Health Questionnaire. 9 itens. Pontuação automática com interpretação de severidade.', meta: '9 itens · ~3 min', badge: 'Escala validada', badgeClass: '', badgeStyle: 'background:#F5EEF8;color:#8E44AD' },
  { id: 'srs', type: 'srs', icon: '⭐', name: 'SRS — Aliança terapêutica', desc: 'Session Rating Scale. 4 perguntas pós-sessão sobre vínculo, metas, abordagem e adequação geral.', meta: '4 itens · ~1 min', badge: 'Pós-sessão', badgeClass: 'badge-green' },
  { id: 'ers', type: 'ers', icon: '📈', name: 'GAD-7 — Ansiedade', desc: 'Generalized Anxiety Disorder Scale. 7 itens de rastreio de transtorno de ansiedade generalizada.', meta: '7 itens · ~3 min', badge: 'Escala validada', badgeClass: 'badge-danger' },
];

export const formStatus = [
  { patient: 'Lucas Martins', form: 'Anamnese inicial', sent: '02 mai 2026', answered: '02 mai 2026', status: 'preenchido', statusLabel: '✓ Preenchido', action: 'Ver resposta' },
  { patient: 'Lucas Martins', form: 'TCLE', sent: '02 mai 2026', answered: '02 mai 2026', status: 'preenchido', statusLabel: '✓ Preenchido', action: 'Download PDF' },
  { patient: 'Carla Silva', form: 'Anamnese inicial', sent: '10 abr 2026', answered: '11 abr 2026', status: 'preenchido', statusLabel: '✓ Preenchido', action: 'Ver resposta' },
  { patient: 'Sofia Andrade', form: 'Inventário Beck', sent: '15 mai 2026', answered: '—', status: 'enviado', statusLabel: '⏳ Aguardando', action: 'Reenviar link' },
  { patient: 'Rafael Fonseca', form: 'TCLE', sent: '—', answered: '—', status: 'pendente', statusLabel: 'Não enviado', action: 'Enviar agora', actionHighlight: true },
  { patient: 'João Oliveira', form: 'PHQ-9', sent: '01 mai 2026', answered: '01 mai 2026', status: 'preenchido', statusLabel: '✓ Preenchido', action: 'Ver resultado' },
  { patient: 'Pedro Alves', form: 'Anamnese inicial', sent: '—', answered: '—', status: 'novo', statusLabel: 'Novo paciente', action: 'Enviar agora', actionHighlight: true },
];
