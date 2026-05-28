// @ts-nocheck
// Helper compartilhado para envio de e-mail de suspensão a partir dos fluxos.
// - Respeita toggle global (email_suspensao_config.enabled) E toggle individual
//   (email_suspensao_templates.ativo) do template referente ao fluxo.
// - Renderiza variáveis dinâmicas (substituição simples {{var}}).
// - Registra resultado em email_suspensao_envios (status: pendente → entregue / falhou / sem_email).
// - NUNCA lança — falhas são silenciadas (logadas em console.error) para não derrubar o fluxo principal.

import { envelopeEmailPraticcar } from './email-layout-praticcar.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_ADDRESS = 'Praticcar <nao-responder@praticcar.org>';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Converte o miolo (texto puro OU HTML) no HTML interno a ser injetado no wrapper. */
function corpoParaMiolo(corpo: string, formato: 'html' | 'texto'): string {
  if (formato === 'html') {
    // Template já é HTML — confiamos no editor visual. Apenas garantimos cor/tamanho coerente.
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.6;">${corpo}</div>`;
  }
  // Compat retro: templates antigos em texto puro mantêm pre-wrap + escape.
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.6;white-space:pre-wrap;">${escapeHtml(corpo)}</div>`;
}

/** Texto puro de fallback para clientes de e-mail sem HTML. */
function corpoParaTexto(corpo: string, formato: 'html' | 'texto'): string {
  if (formato === 'texto') return corpo;
  // Strip básico de tags
  return corpo.replace(/<br\s*\/?>(?:\s*\n?)/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function render(text: string, vars: Record<string, string>): string {
  let out = text ?? '';
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v ?? '');
  }
  return out;
}

function emailValido(e: string | null | undefined): boolean {
  if (!e) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

export interface EnviarEmailSuspensaoArgs {
  supabase: any; // admin client (service role)
  templateKey: string; // e.g. 'nao_instalacao'
  fluxoOrigem: string; // identificador do fluxo (cron_suspensao_nao_instalacao etc.)
  destinatario: string | null | undefined;
  variaveis: Record<string, string | number | null | undefined>;
  clienteNome?: string | null;
  clienteId?: string | null;
}

export interface EnviarEmailSuspensaoResult {
  status: 'entregue' | 'falhou' | 'sem_email' | 'desativado' | 'template_inativo' | 'template_ausente';
  envioId?: string;
  erro?: string;
}

export async function enviarEmailSuspensao(
  args: EnviarEmailSuspensaoArgs,
): Promise<EnviarEmailSuspensaoResult> {
  const {
    supabase,
    templateKey,
    fluxoOrigem,
    destinatario,
    variaveis,
    clienteNome = null,
    clienteId = null,
  } = args;

  // Helper interno: registra uma tentativa que parou antes do disparo (sem template, template inativo, ou desativado globalmente).
  const logEarlyReturn = async (
    status: 'desativado' | 'sem_template' | 'template_inativo',
    erroMsg: string,
    tplRef: { id?: string | null; fluxo_key?: string | null } = {},
  ): Promise<string | undefined> => {
    try {
      const { data: row } = await supabase
        .from('email_suspensao_envios')
        .insert({
          cliente_nome: clienteNome,
          cliente_id: clienteId,
          destinatario: (destinatario ?? '').trim().toLowerCase() || '(sem email)',
          fluxo_origem: fluxoOrigem,
          template_id: tplRef.id ?? null,
          template_key: tplRef.fluxo_key ?? templateKey,
          assunto_enviado: '',
          corpo_renderizado: '',
          status,
          provider: 'resend',
          erro_mensagem: erroMsg,
        })
        .select('id')
        .single();
      return row?.id;
    } catch (e) {
      console.error('[enviarEmailSuspensao] falha ao logar early-return', status, e);
      return undefined;
    }
  };

  try {
    // 1) Toggle global
    const { data: cfg } = await supabase
      .from('email_suspensao_config')
      .select('enabled')
      .maybeSingle();
    if (!cfg?.enabled) {
      const envioId = await logEarlyReturn('desativado', 'Toggle global de e-mails de suspensão está desligado');
      return { status: 'desativado', envioId };
    }

    // 2) Template + toggle individual
    const { data: tpl } = await supabase
      .from('email_suspensao_templates')
      .select('id, fluxo_key, assunto, corpo, ativo, formato')
      .eq('fluxo_key', templateKey)
      .maybeSingle();
    if (!tpl) {
      const envioId = await logEarlyReturn(
        'sem_template',
        `Template '${templateKey}' não cadastrado em email_suspensao_templates`,
      );
      return { status: 'template_ausente', envioId };
    }
    if (!tpl.ativo) {
      const envioId = await logEarlyReturn(
        'template_inativo',
        `Template '${templateKey}' existe mas está desativado`,
        { id: tpl.id, fluxo_key: tpl.fluxo_key },
      );
      return { status: 'template_inativo', envioId };
    }


    // 3) Renderização
    const varsStr: Record<string, string> = {};
    for (const [k, v] of Object.entries(variaveis ?? {})) {
      varsStr[k] = v == null ? '' : String(v);
    }
    const assuntoRender = render(tpl.assunto ?? '', varsStr).trim() || 'Aviso Praticcar';
    const corpoRender = render(tpl.corpo ?? '', varsStr);

    // 4) Sem e-mail → registra e devolve
    const destNorm = (destinatario ?? '').trim().toLowerCase();
    if (!emailValido(destNorm)) {
      const { data: row } = await supabase
        .from('email_suspensao_envios')
        .insert({
          cliente_nome: clienteNome,
          cliente_id: clienteId,
          destinatario: destNorm || '(sem email)',
          fluxo_origem: fluxoOrigem,
          template_id: tpl.id,
          template_key: tpl.fluxo_key,
          assunto_enviado: assuntoRender,
          corpo_renderizado: corpoRender,
          status: 'sem_email',
          provider: 'resend',
          erro_mensagem: 'Cliente sem e-mail cadastrado',
        })
        .select('id')
        .single();
      return { status: 'sem_email', envioId: row?.id };
    }

    // 5) Log pendente
    const { data: pend, error: pendErr } = await supabase
      .from('email_suspensao_envios')
      .insert({
        cliente_nome: clienteNome,
        cliente_id: clienteId,
        destinatario: destNorm,
        fluxo_origem: fluxoOrigem,
        template_id: tpl.id,
        template_key: tpl.fluxo_key,
        assunto_enviado: assuntoRender,
        corpo_renderizado: corpoRender,
        status: 'pendente',
        provider: 'resend',
      })
      .select('id')
      .single();
    if (pendErr || !pend) {
      console.error('[enviarEmailSuspensao] falha ao inserir log pendente', pendErr);
      return { status: 'falhou', erro: pendErr?.message };
    }

    if (!RESEND_API_KEY) {
      await supabase
        .from('email_suspensao_envios')
        .update({ status: 'falhou', erro_mensagem: 'RESEND_API_KEY ausente' })
        .eq('id', pend.id);
      return { status: 'falhou', envioId: pend.id, erro: 'resend_api_key_missing' };
    }

    // 6) Resend
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [destNorm],
          subject: assuntoRender,
          html: envelopeEmailPraticcar({
            assunto: assuntoRender,
            corpoHtml: corpoParaMiolo(corpoRender, (tpl.formato ?? 'html') as 'html' | 'texto'),
            preHeader: assuntoRender,
          }),
          text: corpoParaTexto(corpoRender, (tpl.formato ?? 'html') as 'html' | 'texto'),
        }),
      });
      const raw = await r.text();
      let body: any = null;
      try { body = raw ? JSON.parse(raw) : null; } catch { body = { raw }; }

      if (r.status >= 200 && r.status < 300 && body?.id) {
        await supabase
          .from('email_suspensao_envios')
          .update({ status: 'entregue', provider_message_id: String(body.id) })
          .eq('id', pend.id);
        return { status: 'entregue', envioId: pend.id };
      }
      const erroMsg =
        body?.message || body?.error || body?.name ||
        `Resend retornou status ${r.status}`;
      await supabase
        .from('email_suspensao_envios')
        .update({
          status: 'falhou',
          erro_mensagem: typeof erroMsg === 'string' ? erroMsg : JSON.stringify(erroMsg),
        })
        .eq('id', pend.id);
      return { status: 'falhou', envioId: pend.id, erro: String(erroMsg) };
    } catch (e: any) {
      await supabase
        .from('email_suspensao_envios')
        .update({
          status: 'falhou',
          erro_mensagem: `Falha de rede ao chamar Resend: ${e?.message ?? String(e)}`,
        })
        .eq('id', pend.id);
      return { status: 'falhou', envioId: pend.id, erro: e?.message ?? String(e) };
    }
  } catch (e: any) {
    console.error('[enviarEmailSuspensao] erro inesperado', e);
    return { status: 'falhou', erro: e?.message ?? String(e) };
  }
}
