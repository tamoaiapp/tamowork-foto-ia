export const metadata = {
  title: "Política de Privacidade — TamoWork",
  description: "Política de Privacidade do aplicativo TamoWork.",
};

export default function PrivacidadePage() {
  return (
    <main style={{ background: "#07080b", minHeight: "100vh", color: "#eef2f9", fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "60px 24px" }}>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Política de Privacidade</h1>
        <p style={{ color: "#8394b0", marginBottom: 48 }}>Última atualização: 31 de março de 2026</p>

        <section style={s.section}>
          <h2 style={s.h2}>1. Quem somos</h2>
          <p style={s.p}>
            O TamoWork é um aplicativo de geração de fotos e vídeos de produtos com inteligência artificial,
            disponível em <strong>tamowork.com</strong>. Somos responsáveis pelo tratamento dos seus dados
            pessoais conforme descrito nesta política.
          </p>
        </section>

        <section style={s.section}>
          <h2 style={s.h2}>2. Dados que coletamos</h2>
          <p style={s.p}>Coletamos apenas os dados necessários para o funcionamento do serviço:</p>
          <ul style={s.ul}>
            <li style={s.li}><strong>E-mail e senha:</strong> usados para criar e acessar sua conta.</li>
            <li style={s.li}><strong>Imagens de produtos:</strong> fotos que você envia para gerar versões profissionais com IA. As imagens são armazenadas temporariamente para processamento e salvas em sua conta.</li>
            <li style={s.li}><strong>Dados de pagamento:</strong> processados pelo Mercado Pago. Não armazenamos dados de cartão de crédito.</li>
            <li style={s.li}><strong>Dados de uso:</strong> informações sobre como você utiliza o app (páginas visitadas, ações realizadas), usados para melhorar o serviço.</li>
          </ul>
        </section>

        <section style={s.section}>
          <h2 style={s.h2}>3. Como usamos seus dados</h2>
          <ul style={s.ul}>
            <li style={s.li}>Criar e gerenciar sua conta</li>
            <li style={s.li}>Processar pagamentos e ativar seu plano</li>
            <li style={s.li}>Gerar fotos e vídeos profissionais de produtos com IA</li>
            <li style={s.li}>Melhorar a qualidade do serviço</li>
            <li style={s.li}>Enviar notificações importantes sobre sua conta (sem spam)</li>
          </ul>
        </section>

        <section style={s.section}>
          <h2 style={s.h2}>4. Compartilhamento de dados</h2>
          <p style={s.p}>
            Não vendemos seus dados. Compartilhamos informações apenas com:
          </p>
          <ul style={s.ul}>
            <li style={s.li}><strong>Supabase:</strong> banco de dados e autenticação (servidores na nuvem)</li>
            <li style={s.li}><strong>Mercado Pago:</strong> processamento de pagamentos</li>
            <li style={s.li}><strong>Servidores de IA:</strong> processamento das imagens para geração de fotos/vídeos profissionais</li>
          </ul>
          <p style={s.p}>Todos os parceiros seguem políticas de privacidade compatíveis com a LGPD.</p>
        </section>

        <section style={s.section}>
          <h2 style={s.h2}>5. Armazenamento e segurança</h2>
          <p style={s.p}>
            Seus dados são armazenados em servidores seguros com criptografia. As imagens enviadas
            são mantidas enquanto sua conta estiver ativa. Utilizamos HTTPS em todas as comunicações.
          </p>
        </section>

        <section style={s.section}>
          <h2 style={s.h2}>6. Seus direitos (LGPD)</h2>
          <p style={s.p}>De acordo com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você tem direito a:</p>
          <ul style={s.ul}>
            <li style={s.li}>Acessar seus dados pessoais</li>
            <li style={s.li}>Corrigir dados incompletos ou incorretos</li>
            <li style={s.li}>Solicitar a exclusão dos seus dados</li>
            <li style={s.li}>Revogar consentimento a qualquer momento</li>
            <li style={s.li}>Portabilidade dos dados</li>
          </ul>
          <p style={s.p}>
            Para exercer seus direitos, entre em contato: <strong>contato@tamowork.com</strong>
          </p>
        </section>

        <section style={s.section}>
          <h2 style={s.h2}>7. Cookies</h2>
          <p style={s.p}>
            Utilizamos cookies essenciais para manter sua sessão ativa. Não utilizamos cookies de
            rastreamento para publicidade de terceiros.
          </p>
        </section>

        <section style={s.section}>
          <h2 style={s.h2}>8. Menores de idade</h2>
          <p style={s.p}>
            O TamoWork é destinado a maiores de 18 anos. Não coletamos intencionalmente dados
            de menores de idade.
          </p>
        </section>

        <section style={s.section}>
          <h2 style={s.h2}>9. Alterações nesta política</h2>
          <p style={s.p}>
            Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças
            significativas por e-mail ou via aviso no app.
          </p>
        </section>

        <section style={s.section}>
          <h2 style={s.h2}>10. Contato</h2>
          <p style={s.p}>
            Dúvidas sobre privacidade? Entre em contato:<br />
            <strong>E-mail:</strong> contato@tamowork.com<br />
            <strong>Site:</strong> tamowork.com
          </p>
        </section>

      </div>
    </main>
  );
}

const s = {
  section: {
    marginBottom: 40,
    paddingBottom: 40,
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  } as React.CSSProperties,
  h2: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 12,
    color: "#eef2f9",
  } as React.CSSProperties,
  p: {
    color: "#8394b0",
    lineHeight: 1.7,
    marginBottom: 12,
  } as React.CSSProperties,
  ul: {
    paddingLeft: 20,
    margin: "8px 0",
  } as React.CSSProperties,
  li: {
    color: "#8394b0",
    lineHeight: 1.7,
    marginBottom: 6,
  } as React.CSSProperties,
};
