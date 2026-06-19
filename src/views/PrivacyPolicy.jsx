import { useEffect } from 'react'

export default function PrivacyPolicy({ onClose }) {
  useEffect(() => { document.title = 'Política de Privacidade — Psic Notes' }, [])
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
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
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--d)' }}>Política de Privacidade — Psic Notes</span>
        </div>
      )}
      <div style={{maxWidth:720,margin:'0 auto',padding:'48px 24px',color:'var(--text-primary, #1a1a1a)',fontFamily:'var(--font-sans)',lineHeight:1.7}}>
        <h1 style={{fontSize:28,fontWeight:500,marginBottom:8}}>Política de Privacidade</h1>
        <p style={{color:'#888',fontSize:13,marginBottom:32}}>Versão 1.0 — Vigência a partir de junho de 2026</p>

        <p style={{marginBottom:24}}>
          Esta Política descreve como o Psic Notes coleta, usa e protege os dados dos usuários,
          em conformidade com a LGPD (Lei nº 13.709/2018) e o RGPD (Regulamento UE 2016/679).
        </p>

        <h2 style={{fontSize:18,fontWeight:500,margin:'32px 0 12px'}}>1. Dados coletados</h2>
        <p style={{marginBottom:8}}>Coletamos apenas os dados necessários para o funcionamento do serviço:</p>
        <ul style={{paddingLeft:20,marginBottom:16}}>
          <li style={{marginBottom:6}}><strong>Conta:</strong> nome, email, senha (armazenada com hash bcrypt), número de CRP</li>
          <li style={{marginBottom:6}}><strong>Pacientes:</strong> dados inseridos pelo próprio psicólogo (nome, queixa, anotações de sessão)</li>
          <li style={{marginBottom:6}}><strong>Pagamento:</strong> processado integralmente pelo Stripe — não armazenamos dados de cartão</li>
          <li style={{marginBottom:6}}><strong>Uso:</strong> logs de acesso para segurança e análise de erros</li>
        </ul>

        <h2 style={{fontSize:18,fontWeight:500,margin:'32px 0 12px'}}>2. Como os dados são usados</h2>
        <ul style={{paddingLeft:20,marginBottom:16}}>
          <li style={{marginBottom:6}}>Prestação do serviço de prontuário e análise clínica</li>
          <li style={{marginBottom:6}}>Processamento de pagamentos via Stripe</li>
          <li style={{marginBottom:6}}>Envio de notificações transacionais por email (Resend)</li>
          <li style={{marginBottom:6}}>Geração de análises clínicas pelo assistente clínico do Psic Notes (processamento em tempo real durante a sessão, sem retenção posterior do conteúdo clínico)</li>
        </ul>

        <h2 style={{fontSize:18,fontWeight:500,margin:'32px 0 12px'}}>3. Compartilhamento de dados</h2>
        <p style={{marginBottom:8}}>Dados são compartilhados apenas com subprocessadores necessários:</p>
        <ul style={{paddingLeft:20,marginBottom:16}}>
          <li style={{marginBottom:6}}><strong>Assistente clínico Psic Notes</strong> — processamento das anotações de sessão para geração de raciocínio clínico (sem retenção do conteúdo após a análise)</li>
          <li style={{marginBottom:6}}><strong>Stripe</strong> — processamento de pagamentos</li>
          <li style={{marginBottom:6}}><strong>Resend</strong> — envio de emails transacionais</li>
          <li style={{marginBottom:6}}><strong>Railway</strong> — hospedagem do servidor e banco de dados (PostgreSQL criptografado em repouso)</li>
        </ul>
        <p style={{marginBottom:16}}>Não vendemos, alugamos ou compartilhamos dados com terceiros para fins comerciais.</p>

        <h2 style={{fontSize:18,fontWeight:500,margin:'32px 0 12px'}}>4. Segurança</h2>
        <p style={{marginBottom:16}}>
          Dados em trânsito protegidos por TLS 1.2+. Dados sensíveis em repouso criptografados com AES-256.
          Acesso ao banco de dados restrito ao servidor de aplicação. Senhas armazenadas com bcrypt.
          Tokens de autenticação com expiração de 15 minutos.
        </p>

        <h2 style={{fontSize:18,fontWeight:500,margin:'32px 0 12px'}}>5. Retenção de dados</h2>
        <p style={{marginBottom:16}}>
          Dados são mantidos enquanto a conta estiver ativa. Após cancelamento, os dados são retidos por 30 dias
          para possibilidade de reativação, após o que são excluídos permanentemente.
          O usuário pode solicitar exclusão imediata a qualquer momento.
        </p>

        <h2 style={{fontSize:18,fontWeight:500,margin:'32px 0 12px'}}>6. Direitos do titular (LGPD Art. 18)</h2>
        <p style={{marginBottom:8}}>Você tem direito a:</p>
        <ul style={{paddingLeft:20,marginBottom:16}}>
          <li style={{marginBottom:4}}>Confirmação de existência e acesso aos dados tratados</li>
          <li style={{marginBottom:4}}>Correção de dados incompletos ou inexatos</li>
          <li style={{marginBottom:4}}>Anonimização ou exclusão de dados desnecessários</li>
          <li style={{marginBottom:4}}>Portabilidade dos dados para outro serviço</li>
          <li style={{marginBottom:4}}>Revogação do consentimento a qualquer momento</li>
        </ul>
        <p style={{marginBottom:16}}>
          Para exercer esses direitos, envie email para: <a href="mailto:contato@psicnotes.com" style={{color:'inherit'}}>contato@psicnotes.com</a>
        </p>

        <h2 style={{fontSize:18,fontWeight:500,margin:'32px 0 12px'}}>7. Cookies</h2>
        <p style={{marginBottom:16}}>
          Utilizamos apenas cookies essenciais para autenticação e preferências de sessão.
          Não utilizamos cookies de rastreamento ou publicidade.
        </p>

        <h2 style={{fontSize:18,fontWeight:500,margin:'32px 0 12px'}}>8. Contato e encarregado de dados (DPO)</h2>
        <p style={{marginBottom:32}}>
          Responsável pelo tratamento: Jhonatan Araujo, desenvolvedor independente, Lisboa, Portugal.<br/>
          Email de contato: <a href="mailto:contato@psicnotes.com" style={{color:'inherit'}}>contato@psicnotes.com</a>
        </p>

        <p style={{color:'#888',fontSize:13}}>Última atualização: junho de 2026</p>
      </div>
    </div>
  )
}
