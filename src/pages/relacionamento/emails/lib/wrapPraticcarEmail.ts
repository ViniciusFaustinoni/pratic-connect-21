/**
 * Replica no front-end o wrapper visual usado pela edge function
 * `supabase/functions/_shared/email-layout-praticcar.ts` para alimentar
 * a aba "Preview" do editor com EXATAMENTE o que o cliente recebe.
 *
 * Qualquer mudança visual no wrapper precisa ser refletida nos dois lugares.
 */

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

function escapeHtml(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function wrapPraticcarEmail(opts: {
  assunto: string;
  corpoHtml: string;
  formato?: 'html' | 'texto';
}): string {
  const formato = opts.formato ?? 'html';
  const miolo =
    formato === 'html'
      ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.6;">${opts.corpoHtml}</div>`
      : `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.6;white-space:pre-wrap;">${escapeHtml(opts.corpoHtml)}</div>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeAttr(opts.assunto)}</title></head>
<body style="margin:0;padding:0;background-color:${COR_FUNDO_PAGINA};font-family:Arial,Helvetica,sans-serif;color:${COR_TEXTO};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COR_FUNDO_PAGINA};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid ${COR_BORDA};border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:${COR_PRIMARIA};padding:24px 32px;text-align:center;">
          <div style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">${escapeAttr(EMPRESA.nome)}</div>
          <div style="font-size:12px;color:#dbeafe;margin-top:4px;">Comunicado oficial</div>
        </td></tr>
        <tr><td style="padding:32px;font-size:15px;line-height:1.6;color:${COR_TEXTO};">${miolo}</td></tr>
        <tr><td style="padding:0 32px;"><div style="border-top:1px solid ${COR_BORDA};"></div></td></tr>
        <tr><td style="padding:20px 32px 28px;font-size:12px;line-height:1.6;color:${COR_TEXTO_SUAVE};text-align:center;">
          <div style="margin-bottom:6px;"><strong style="color:${COR_TEXTO};">${escapeAttr(EMPRESA.nome)}</strong> · CNPJ ${escapeAttr(EMPRESA.cnpj)}</div>
          <div style="margin-bottom:10px;">${escapeAttr(EMPRESA.endereco)}</div>
          <div style="margin-bottom:14px;">
            <a href="${escapeAttr(EMPRESA.whatsapp)}" style="color:${COR_PRIMARIA};text-decoration:none;font-weight:bold;">Falar no WhatsApp</a>
            &nbsp;·&nbsp;
            <a href="${escapeAttr(EMPRESA.site)}" style="color:${COR_PRIMARIA};text-decoration:none;font-weight:bold;">Área do associado</a>
          </div>
          <div style="font-size:11px;">Este é um e-mail automático — por favor, não responda a esta mensagem.</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
