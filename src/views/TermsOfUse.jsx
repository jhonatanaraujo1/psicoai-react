/**
 * TermosDeUso.jsx — Termos de Uso e Contrato de Serviço do PsicNotes
 *
 * Versão: 1.0 — vigente a partir de 01/06/2026
 * Redigido em conformidade com:
 *   • LGPD — Lei 13.709/2018
 *   • CDC — Lei 8.078/1990
 *   • Marco Civil da Internet — Lei 12.965/2014
 *   • CFP — Resolução 11/2018 (prontuário eletrônico)
 */

const VERSAO = '1.0'
const VIGENCIA = '01 de junho de 2026'
const CONTATO = 'suporte@psicnotes.com'
const RETENCAO_ATIVA = '2 (dois) anos'
const AVISO_ENCERRAMENTO = '60 (sessenta) dias'

const s = {
  page: {
    maxWidth: 860,
    margin: '0 auto',
    padding: '40px 24px 80px',
    fontFamily: "'DM Sans', sans-serif",
    color: 'var(--d)',
    lineHeight: 1.7,
  },
  header: {
    borderBottom: '2px solid var(--g500)',
    paddingBottom: 24,
    marginBottom: 40,
  },
  logo: {
    fontFamily: "'Fraunces', serif",
    fontSize: 28,
    color: 'var(--g600)',
    fontWeight: 400,
    marginBottom: 8,
  },
  meta: {
    fontSize: 13,
    color: 'var(--gr4)',
  },
  h2: {
    fontFamily: "'Fraunces', serif",
    fontSize: 20,
    fontWeight: 500,
    color: 'var(--g700)',
    marginTop: 40,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: '1px solid var(--gr1)',
  },
  h3: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--d)',
    marginTop: 20,
    marginBottom: 6,
  },
  p: {
    marginBottom: 12,
    fontSize: 14,
  },
  alert: {
    background: 'var(--warn-l)',
    border: '1px solid #F0D08A',
    borderRadius: 8,
    padding: '14px 18px',
    fontSize: 13,
    color: 'var(--gr6)',
    marginBottom: 16,
  },
  box: {
    background: 'var(--g50)',
    border: '1px solid var(--g200)',
    borderRadius: 8,
    padding: '16px 20px',
    fontSize: 13,
    marginBottom: 16,
  },
  ol: {
    paddingLeft: 24,
    fontSize: 14,
    lineHeight: 1.9,
  },
  ul: {
    paddingLeft: 24,
    fontSize: 14,
    lineHeight: 1.9,
  },
}

export default function TermsOfUse({ onClose }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      {/* Header fixo */}
      {onClose && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 10,
          background: 'var(--w)', borderBottom: '1px solid var(--gr2)',
          padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gr4)', padding: 8, borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
            </svg>
            Voltar
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--d)' }}>Termos de Uso — PsicNotes v{VERSAO}</span>
        </div>
      )}

      <div style={s.page}>

        {/* Cabeçalho */}
        <div style={s.header}>
          <div style={s.logo}>Ψ PsicNotes</div>
          <div style={s.meta}>
            <strong>Termos de Uso e Contrato de Prestação de Serviço</strong><br />
            Versão {VERSAO} — vigente a partir de {VIGENCIA}<br />
            PsicNotes Tecnologia Ltda. (CNPJ a ser inserido) — {CONTATO}
          </div>
        </div>

        <div style={s.alert}>
          <strong>⚠️ Leia com atenção antes de usar.</strong> Ao criar uma conta ou utilizar o PsicNotes,
          você concorda integralmente com estes Termos. Se não concordar, não utilize o serviço.
        </div>

        {/* 1 */}
        <div style={s.h2}>1. Definições</div>
        <p style={s.p}>Para fins destes Termos, aplicam-se as seguintes definições:</p>
        <ul style={s.ul}>
          <li><strong>PsicNotes</strong>: plataforma SaaS de suporte ao raciocínio clínico destinada a profissionais de saúde mental.</li>
          <li><strong>Usuário</strong>: psicólogo(a) ou profissional de saúde mental devidamente habilitado que contrata o serviço.</li>
          <li><strong>Dados Clínicos</strong>: prontuários, anotações, análises, formulários e arquivos associados aos pacientes do Usuário.</li>
          <li><strong>Dados Pessoais</strong>: conforme definido pelo art. 5º, I da LGPD (Lei 13.709/2018).</li>
          <li><strong>Plataforma</strong>: conjunto de serviços acessíveis via app.psicnotes.com e seus subdomínios.</li>
        </ul>

        {/* 2 */}
        <div style={s.h2}>2. Objeto do contrato</div>
        <p style={s.p}>
          O PsicNotes disponibiliza ao Usuário, mediante assinatura mensal ou acesso trial, ferramentas de
          suporte ao registro clínico, análise assistida por inteligência artificial, gestão de agenda e financeiro.
        </p>
        <p style={s.p}>
          <strong>O PsicNotes é uma ferramenta de apoio.</strong> Nenhuma análise, sugestão ou output gerado pela plataforma
          substitui o julgamento clínico do profissional. O Usuário é integralmente responsável por todas as
          decisões terapêuticas, diagnósticos e condutas clínicas.
        </p>

        {/* 3 */}
        <div style={s.h2}>3. Habilitação e responsabilidade profissional</div>
        <p style={s.p}>
          O serviço é restrito a profissionais devidamente habilitados pelo Conselho Federal de Psicologia (CFP)
          ou órgão equivalente reconhecido no país de uso. O Usuário declara, sob sua inteira responsabilidade,
          que possui habilitação legal para exercer a atividade clínica e para manter prontuários eletrônicos,
          nos termos da Resolução CFP nº 11/2018.
        </p>

        {/* 4 */}
        <div style={s.h2}>4. Planos, assinatura e inadimplência</div>
        <div style={s.h3}>4.1 Trial</div>
        <p style={s.p}>
          Novos usuários têm acesso gratuito por 14 (quatorze) dias. Ao término do trial sem assinatura ativa,
          o acesso é suspenso automaticamente e os dados ficam retidos por até 30 dias para eventual regularização.
        </p>
        <div style={s.h3}>4.2 Cobrança e renovação</div>
        <p style={s.p}>
          A assinatura é cobrada mensalmente de forma antecipada. A renovação é automática. O cancelamento deve
          ser solicitado com pelo menos 24 horas de antecedência ao próximo ciclo, via portal de faturamento ou
          email para {CONTATO}.
        </p>
        <div style={s.h3}>4.3 Inadimplência e período de graça</div>
        <p style={s.p}>
          Em caso de falha no pagamento, o Usuário recebe notificação por email e tem <strong>7 (sete) dias corridos</strong> de
          período de graça com acesso mantido, durante os quais pode regularizar o pagamento sem perda de dados.
          Após o período de graça sem regularização, o acesso é bloqueado e os dados passam ao período de
          retenção inativa ({RETENCAO_ATIVA}).
        </p>
        <div style={s.h3}>4.4 Reativação</div>
        <p style={s.p}>
          O Usuário pode reativar a conta a qualquer momento dentro do período de retenção inativa mediante
          assinatura de um plano. Os dados clínicos são integralmente restaurados.
        </p>

        {/* 5 */}
        <div style={s.h2}>5. Dados clínicos e responsabilidade do Usuário</div>
        <p style={s.p}>
          O Usuário é o <strong>controlador dos dados clínicos</strong> (nos termos do art. 5º, VI da LGPD) e o PsicNotes
          atua como <strong>operador</strong> (art. 5º, VII). O Usuário é responsável por:
        </p>
        <ul style={s.ul}>
          <li>Obter o consentimento informado dos pacientes para uso de prontuário eletrônico assistido por IA.</li>
          <li>Garantir que o uso da plataforma está em conformidade com as normas do CFP e da LGPD.</li>
          <li>Manter cópia de segurança dos dados clinicamente relevantes de forma independente.</li>
          <li>Informar aos pacientes sobre o uso de ferramentas de IA no suporte clínico, quando exigido.</li>
        </ul>

        {/* 6 */}
        <div style={s.h2}>6. Retenção e exclusão de dados</div>
        <div style={s.box}>
          <strong>Política de retenção:</strong>
          <ul style={{ ...s.ul, marginTop: 8, marginBottom: 0 }}>
            <li><strong>Conta ativa:</strong> dados mantidos durante toda a vigência da assinatura.</li>
            <li><strong>Conta inativa/inadimplente:</strong> dados retidos por {RETENCAO_ATIVA} após o último acesso ou bloqueio, durante os quais o Usuário pode exportar seus dados.</li>
            <li><strong>Cancelamento voluntário:</strong> dados retidos por 90 (noventa) dias após o cancelamento para eventual reconsideração.</li>
            <li><strong>Após o prazo de retenção:</strong> os dados são irreversivelmente anonimizados ou excluídos.</li>
          </ul>
        </div>
        <p style={s.p}>
          O Usuário pode solicitar a exclusão imediata dos seus dados a qualquer momento, exercendo seu direito
          nos termos do art. 18, IV da LGPD, pelo email {CONTATO}. A exclusão imediata é irreversível e encerra
          o contrato.
        </p>

        {/* 7 — CLÁUSULA CRÍTICA: encerramento da plataforma */}
        <div style={s.h2}>7. Encerramento da plataforma e continuidade dos dados</div>
        <div style={{ ...s.alert, borderColor: '#F5C6C6', background: '#FFF5F5' }}>
          <strong>⚠️ Cláusula de encerramento — leia com atenção.</strong>
        </div>
        <div style={s.h3}>7.1 Direito de encerramento</div>
        <p style={s.p}>
          O PsicNotes reserva-se o direito de encerrar integralmente a plataforma, de forma definitiva, a qualquer
          momento, por qualquer motivo, incluindo mas não se limitando a: descontinuação do modelo de negócio,
          insolvência, decisão estratégica ou determinação judicial. O exercício deste direito não constitui
          inadimplemento contratual desde que observado o prazo de aviso abaixo.
        </p>
        <div style={s.h3}>7.2 Prazo de aviso prévio obrigatório</div>
        <p style={s.p}>
          Em caso de encerramento definitivo da plataforma, o PsicNotes notificará <strong>todos os Usuários ativos e
          inativos com dados armazenados</strong> com antecedência mínima de <strong>{AVISO_ENCERRAMENTO}</strong>, por email cadastrado,
          antes da data de desligamento dos servidores.
        </p>
        <div style={s.h3}>7.3 Exportação de dados no período de aviso</div>
        <p style={s.p}>
          Durante os {AVISO_ENCERRAMENTO} de aviso prévio, o PsicNotes garantirá:
        </p>
        <ol style={s.ol}>
          <li>Manutenção do acesso à plataforma para exportação de dados mesmo para contas inadimplentes.</li>
          <li>Ferramenta de exportação em formato aberto (PDF e/ou JSON) disponível para todos os Usuários sem custo adicional.</li>
          <li>Suporte por email prioritário para auxiliar a exportação.</li>
          <li>Devolução proporcional dos valores pagos referentes ao período não usufruído após a data de desligamento.</li>
        </ol>
        <div style={s.h3}>7.4 Após o desligamento</div>
        <p style={s.p}>
          Decorridos os {AVISO_ENCERRAMENTO} de aviso e após a data de desligamento, todos os dados armazenados
          nos servidores do PsicNotes serão permanentemente excluídos. O PsicNotes não manterá nenhuma cópia dos
          dados após o encerramento definitivo da plataforma.
        </p>
        <div style={s.h3}>7.5 Limitação de responsabilidade no encerramento</div>
        <p style={s.p}>
          Respeitado o aviso prévio de {AVISO_ENCERRAMENTO} e a disponibilização das ferramentas de exportação,
          o PsicNotes não será responsável por danos decorrentes do encerramento da plataforma, incluindo perda
          de dados não exportados dentro do prazo pelo próprio Usuário.
        </p>

        {/* 8 */}
        <div style={s.h2}>8. Propriedade intelectual e uso da IA</div>
        <p style={s.p}>
          Os modelos de linguagem, algoritmos, interfaces e código-fonte do PsicNotes são propriedade exclusiva
          da empresa e estão protegidos por direitos autorais. O Usuário recebe licença limitada, não exclusiva
          e intransferível para uso da plataforma durante a vigência da assinatura.
        </p>
        <p style={s.p}>
          Os dados clínicos inseridos pelo Usuário <strong>nunca são utilizados para treinar modelos de IA</strong> próprios
          ou de terceiros, sem consentimento expresso e específico do Usuário. As análises geradas pela IA são
          processadas por provedores especializados de infraestrutura, sob contratos de confidencialidade e
          proteção de dados compatíveis com a LGPD e as diretrizes do CFP.
        </p>

        {/* 9 */}
        <div style={s.h2}>9. Privacidade e LGPD</div>
        <p style={s.p}>
          O tratamento de dados pessoais pelo PsicNotes observa integralmente a LGPD (Lei 13.709/2018). As bases
          legais utilizadas são: execução de contrato (art. 7º, V), legítimo interesse (art. 7º, IX) e
          cumprimento de obrigação legal (art. 7º, II).
        </p>
        <p style={s.p}><strong>Direitos do titular dos dados (LGPD art. 18):</strong></p>
        <ul style={s.ul}>
          <li>Confirmação e acesso aos dados tratados</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
          <li>Portabilidade dos dados a outro prestador de serviço</li>
          <li>Eliminação dos dados tratados com base em consentimento</li>
          <li>Informação sobre compartilhamento com terceiros</li>
          <li>Revogação do consentimento</li>
        </ul>
        <p style={s.p}>
          Para exercer qualquer desses direitos: {CONTATO}. O PsicNotes responderá em até 15 dias úteis.
        </p>

        {/* 10 */}
        <div style={s.h2}>10. Segurança dos dados</div>
        <p style={s.p}>
          O PsicNotes adota medidas técnicas e organizacionais compatíveis com o estado da arte para proteção
          dos dados, incluindo: criptografia em trânsito (TLS 1.3), autenticação por JWT com expiração curta,
          isolamento de dados por conta, e logs de auditoria. Em caso de incidente de segurança com potencial
          de risco aos titulares, o PsicNotes notificará a ANPD e os Usuários afetados em até <strong>72 horas</strong> do
          conhecimento do incidente, conforme art. 48 da LGPD.
        </p>

        {/* 11 */}
        <div style={s.h2}>11. Limitação de responsabilidade</div>
        <p style={s.p}>
          O PsicNotes não se responsabiliza por:
        </p>
        <ul style={s.ul}>
          <li>Decisões clínicas tomadas com base nos outputs da plataforma.</li>
          <li>Danos indiretos, lucros cessantes ou danos morais decorrentes do uso da plataforma, salvo quando expressamente vedado pelo CDC.</li>
          <li>Indisponibilidade temporária por manutenção, falha de infraestrutura de terceiros ou eventos de força maior.</li>
          <li>Perda de dados não exportados após o encerramento da plataforma, desde que respeitado o prazo de aviso.</li>
        </ul>
        <p style={s.p}>
          A responsabilidade total do PsicNotes por qualquer reclamação fica limitada ao valor pago pelo Usuário
          nos últimos 3 (três) meses de assinatura, salvo disposição legal em contrário.
        </p>

        {/* 12 */}
        <div style={s.h2}>12. Alterações nestes Termos</div>
        <p style={s.p}>
          O PsicNotes pode alterar estes Termos a qualquer momento. Alterações materiais serão comunicadas por
          email com antecedência mínima de <strong>30 (trinta) dias</strong>. O uso continuado da plataforma após o prazo
          implica aceitação dos novos Termos. Caso o Usuário não concorde, poderá cancelar a conta sem ônus
          durante o período de aviso.
        </p>

        {/* 13 */}
        <div style={s.h2}>13. Disposições gerais</div>
        <div style={s.h3}>13.1 Legislação aplicável</div>
        <p style={s.p}>
          Estes Termos são regidos pelas leis da República Federativa do Brasil.
        </p>
        <div style={s.h3}>13.2 Foro</div>
        <p style={s.p}>
          Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer litígios decorrentes destes
          Termos, com renúncia de qualquer outro, por mais privilegiado que seja, salvo nos casos em que o
          Usuário for considerado consumidor hipossuficiente, hipótese em que se aplica o foro do domicílio
          do consumidor, nos termos do art. 101, I do CDC.
        </p>
        <div style={s.h3}>13.3 Integralidade</div>
        <p style={s.p}>
          Estes Termos constituem o acordo integral entre as partes relativamente ao seu objeto, substituindo
          todos os acordos e entendimentos anteriores.
        </p>

        {/* Rodapé */}
        <div style={{ marginTop: 48, padding: '20px 24px', background: 'var(--g50)', borderRadius: 10, fontSize: 12, color: 'var(--gr4)', lineHeight: 1.7 }}>
          <strong>PsicNotes Tecnologia Ltda.</strong><br />
          Versão {VERSAO} — vigente a partir de {VIGENCIA}<br />
          Contato DPO: {CONTATO}<br />
          Última atualização: maio de 2026<br /><br />
          Este documento foi redigido em conformidade com a LGPD (Lei 13.709/2018), CDC (Lei 8.078/1990),
          Marco Civil da Internet (Lei 12.965/2014) e Resolução CFP nº 11/2018.
        </div>

      </div>
    </div>
  )
}
