// Renderiza um e-mail a partir de um template Meta WhatsApp.
// Lê `whatsapp_meta_templates` (corpo, header_texto, email_assunto, email_template_alias),
// substitui {{1}}..{{N}} pelos params e retorna { template, data } para invocar `send-email`.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export interface RenderInput {
  supabase: SupabaseClient;
  template_name: string;
  template_params: string[];
  template_button_params?: string[];
}

export interface RenderOutput {
  enabled: boolean;
  template: string;
  data: Record<string, unknown>;
  subject: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function applyVars(text: string, params: string[]): string {
  return text.replace(/\{\{(\d+)\}\}/g, (_m, n) => {
    const idx = parseInt(n, 10) - 1;
    return params[idx] ?? '';
  });
}

function textToHtml(text: string): string {
  // Aplica negrito *texto* → <strong>, depois converte quebras de linha.
  // Escapa antes os caracteres restantes para evitar HTML injection (mas marcação WhatsApp usa caracteres simples).
  // Estratégia: escapar tudo, depois reverter os marcadores conhecidos.
  let html = escapeHtml(text);
  // *negrito* → <strong>
  html = html.replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');
  // _itálico_
  html = html.replace(/(?:^|\s)_([^_\n]+)_(?=\s|$)/g, ' <em>$1</em>');
  // URLs → <a>
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#2563eb;text-decoration:underline;">$1</a>');
  // Quebras de linha
  html = html.replace(/\n/g, '<br>');
  return html;
}

function deriveSubject(corpo: string, header?: string | null): string {
  if (header && header.trim()) return header.trim();
  // Primeira linha não vazia, sem emojis, truncada
  const firstLine = (corpo || '').split('\n').map((l) => l.trim()).find(Boolean) || 'PRATIC';
  // Remove emojis e marcadores
  const clean = firstLine
    .replace(/[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F2FF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\*|_|~/g, '')
    .trim();
  return clean.length > 90 ? clean.slice(0, 87) + '...' : (clean || 'PRATIC');
}

export async function renderEmailFromMeta(input: RenderInput): Promise<RenderOutput | null> {
  const { data: tpl, error } = await input.supabase
    .from('whatsapp_meta_templates')
    .select('corpo, header_texto, enviar_por_email, email_assunto, email_template_alias')
    .eq('nome', input.template_name)
    .maybeSingle();

  if (error) {
    console.warn('[renderEmailFromMeta] erro buscando template:', error.message);
    return null;
  }
  if (!tpl) {
    console.warn(`[renderEmailFromMeta] template "${input.template_name}" não encontrado`);
    return null;
  }
  if (tpl.enviar_por_email === false) {
    return { enabled: false, template: '', data: {}, subject: '' };
  }

  const corpoFinal = applyVars(String(tpl.corpo || ''), input.template_params || []);
  const subject = (tpl.email_assunto && tpl.email_assunto.trim())
    ? applyVars(tpl.email_assunto, input.template_params || [])
    : deriveSubject(corpoFinal, tpl.header_texto);

  const buttonParam = input.template_button_params?.[0];
  const linkUrl = buttonParam && /^https?:\/\//i.test(buttonParam)
    ? buttonParam
    : (buttonParam ? `https://app.praticcar.org/r/${buttonParam}` : undefined);

  const alias = (tpl.email_template_alias || '').trim();
  if (alias) {
    // Caller pode mapear params nomeados conforme template curado de send-email.
    // Mantemos um pass-through simples: os params ficam disponíveis como p1..pN.
    const data: Record<string, unknown> = {};
    (input.template_params || []).forEach((v, i) => { data[`p${i + 1}`] = v; });
    if (linkUrl) data.linkUrl = linkUrl;
    return { enabled: true, template: alias, data, subject };
  }

  return {
    enabled: true,
    template: 'generico',
    subject,
    data: {
      titulo: subject,
      assunto: subject,
      conteudo: textToHtml(corpoFinal),
      ...(linkUrl ? { linkUrl, linkTexto: 'Acessar' } : {}),
    },
  };
}
