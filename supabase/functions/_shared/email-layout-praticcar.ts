// @ts-nocheck
// Layout institucional Praticcar — wrapper visual aplicado a TODO e-mail transacional
// disparado pelo helper enviarEmailSuspensao. Espelha a identidade do Termo de Filiação
// (azul #1e40af, header centralizado, footer com CNPJ) mas em HTML email-safe
// (tabelas + inline styles, 600px, Arial) compatível com Gmail/Outlook.

export interface EnvelopeEmailArgs {
  assunto: string;
  /** HTML já renderizado do miolo (variáveis substituídas). NÃO escapado. */
  corpoHtml: string;
  /** Subtítulo/descrição opcional no header (ex.: "Aviso de suspensão"). */
  preHeader?: string;
}

const COR_PRIMARIA = '#1e40af';
const COR_TEXTO = '#1f2937';
const COR_TEXTO_SUAVE = '#6b7280';
const COR_BORDA = '#e5e7eb';
const COR_FUNDO_PAGINA = '#f3f4f6';

const EMPRESA = {
  nome: 'Praticcar Proteção Veicular',
  cnpj: '50.349.476/0001-08',
  endereco: 'Rua Visconde de Pirajá, 550 — Ipanema, Rio de Janeiro/RJ',
  whatsapp: 'https://wa.me/552140405151',
  site: 'https://app.praticcar.org',
};

function escapeAttr(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function envelopeEmailPraticcar({ assunto, corpoHtml, preHeader }: EnvelopeEmailArgs): string {
  const preview = (preHeader ?? assunto ?? '').toString().slice(0, 140);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeAttr(assunto)}</title>
</head>
<body style="margin:0;padding:0;background-color:${COR_FUNDO_PAGINA};font-family:Arial,Helvetica,sans-serif;color:${COR_TEXTO};">
  <!-- preheader oculto: aparece como prévia na caixa de entrada -->
  <div style="display:none;font-size:1px;color:${COR_FUNDO_PAGINA};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ${escapeAttr(preview)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COR_FUNDO_PAGINA};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid ${COR_BORDA};border-radius:8px;overflow:hidden;">
          <!-- CABEÇALHO -->
          <tr>
            <td style="background-color:${COR_PRIMARIA};padding:24px 32px;text-align:center;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">
                ${escapeAttr(EMPRESA.nome)}
              </div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#dbeafe;margin-top:4px;">
                Comunicado oficial
              </div>
            </td>
          </tr>

          <!-- CORPO -->
          <tr>
            <td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${COR_TEXTO};">
              ${corpoHtml}
            </td>
          </tr>

          <!-- DIVISOR -->
          <tr>
            <td style="padding:0 32px;">
              <div style="border-top:1px solid ${COR_BORDA};"></div>
            </td>
          </tr>

          <!-- RODAPÉ -->
          <tr>
            <td style="padding:20px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:${COR_TEXTO_SUAVE};text-align:center;">
              <div style="margin-bottom:6px;">
                <strong style="color:${COR_TEXTO};">${escapeAttr(EMPRESA.nome)}</strong> · CNPJ ${escapeAttr(EMPRESA.cnpj)}
              </div>
              <div style="margin-bottom:10px;">${escapeAttr(EMPRESA.endereco)}</div>
              <div style="margin-bottom:14px;">
                <a href="${escapeAttr(EMPRESA.whatsapp)}" style="color:${COR_PRIMARIA};text-decoration:none;font-weight:bold;">Falar no WhatsApp</a>
                &nbsp;·&nbsp;
                <a href="${escapeAttr(EMPRESA.site)}" style="color:${COR_PRIMARIA};text-decoration:none;font-weight:bold;">Área do associado</a>
              </div>
              <div style="color:${COR_TEXTO_SUAVE};font-size:11px;">
                Este é um e-mail automático — por favor, não responda a esta mensagem.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
