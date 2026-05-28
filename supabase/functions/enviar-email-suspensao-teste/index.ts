// Edge function: enviar-email-suspensao-teste
// Fase 2.5 — agora aceita `template_key` (default 'nao_instalacao') e usa a tabela multi-templates.
// NÃO é chamada por nenhum fluxo automático; apenas pelo botão "Enviar e-mail de teste".

import { createClient } from 'npm:@supabase/supabase-js@2';
import { envelopeEmailPraticcar } from '../_shared/email-layout-praticcar.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const FROM_ADDRESS = 'Praticcar <nao-responder@praticcar.org>';
const ROLES_PERMITIDOS = new Set(['admin_master', 'diretor', 'desenvolvedor']);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function render(text: string, vars: Record<string, string>): string {
  let out = text ?? '';
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v ?? '');
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function corpoParaMiolo(corpo: string, formato: 'html' | 'texto'): string {
  if (formato === 'html') {
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.6;">${corpo}</div>`;
  }
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2937;line-height:1.6;white-space:pre-wrap;">${escapeHtml(corpo)}</div>`;
}

function corpoParaTexto(corpo: string, formato: 'html' | 'texto'): string {
  if (formato === 'texto') return corpo;
  return corpo.replace(/<br\s*\/?>(?:\s*\n?)/gi, '\n').replace(/<\/(p|div|li|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
    if (!RESEND_API_KEY) return jsonResponse({ error: 'resend_api_key_missing' }, 500);

    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return jsonResponse({ error: 'unauthorized' }, 401);

    const supabaseAuth = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await supabaseAuth.auth.getUser(jwt);
    if (userErr || !userRes?.user) return jsonResponse({ error: 'unauthorized' }, 401);
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: roles, error: rolesErr } = await admin
      .from('user_roles').select('role').eq('user_id', userId);
    if (rolesErr) return jsonResponse({ error: 'roles_lookup_failed', detail: rolesErr.message }, 500);
    const podeAcessar = (roles ?? []).some((r: any) => ROLES_PERMITIDOS.has(String(r.role)));
    if (!podeAcessar) return jsonResponse({ error: 'forbidden' }, 403);

    let payload: any;
    try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

    const destinatario = String(payload?.destinatario ?? '').trim().toLowerCase();
    if (!isEmailValido(destinatario)) return jsonResponse({ error: 'destinatario_invalido' }, 400);

    const templateKey = String(payload?.template_key ?? 'nao_instalacao').trim();
    const variaveisIn = payload?.variaveis ?? {};

    // ---- Template ----
    const { data: tpl, error: tplErr } = await admin
      .from('email_suspensao_templates')
      .select('id, fluxo_key, assunto, corpo, variaveis_disponiveis')
      .eq('fluxo_key', templateKey)
      .maybeSingle();
    if (tplErr || !tpl) {
      return jsonResponse({ error: 'template_nao_encontrado', detail: tplErr?.message }, 404);
    }

    // Monta vars usando o que veio + defaults amigáveis
    const hoje = new Date().toLocaleDateString('pt-BR');
    const defaults: Record<string, string> = {
      nome_cliente: 'Maria Souza',
      motivo_suspensao: 'Inadimplência da mensalidade de maio',
      data: hoje,
      placa: 'ABC1D23',
      prazo_horas: '48',
    };
    const vars: Record<string, string> = { ...defaults };
    for (const [k, v] of Object.entries(variaveisIn || {})) {
      const s = String(v ?? '').trim();
      if (s) vars[k] = s;
    }

    const assuntoRender = render(tpl.assunto ?? '', vars).trim() || 'Aviso Praticcar';
    const corpoRender = render(tpl.corpo ?? '', vars);

    // ---- Log pendente ----
    const { data: envioRow, error: insertErr } = await admin
      .from('email_suspensao_envios')
      .insert({
        cliente_nome: vars.nome_cliente,
        destinatario,
        fluxo_origem: 'teste_manual',
        template_id: tpl.id,
        template_key: tpl.fluxo_key,
        assunto_enviado: assuntoRender,
        corpo_renderizado: corpoRender,
        status: 'pendente',
        provider: 'resend',
      })
      .select('id')
      .single();
    if (insertErr || !envioRow) {
      return jsonResponse({ error: 'log_insert_failed', detail: insertErr?.message }, 500);
    }
    const envioId = envioRow.id;

    // ---- Resend ----
    let resendStatus = 0;
    let resendBody: any = null;
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: [destinatario],
          subject: assuntoRender,
          html: corpoParaHtml(corpoRender),
          text: corpoRender,
        }),
      });
      resendStatus = r.status;
      const raw = await r.text();
      try { resendBody = raw ? JSON.parse(raw) : null; } catch { resendBody = { raw }; }
    } catch (e: any) {
      await admin
        .from('email_suspensao_envios')
        .update({ status: 'falhou', erro_mensagem: `Falha de rede ao chamar Resend: ${e?.message ?? String(e)}` })
        .eq('id', envioId);
      return jsonResponse({ ok: false, status: 'falhou', erro: 'network_error' }, 200);
    }

    if (resendStatus >= 200 && resendStatus < 300 && resendBody?.id) {
      await admin
        .from('email_suspensao_envios')
        .update({ status: 'entregue', provider_message_id: String(resendBody.id) })
        .eq('id', envioId);
      return jsonResponse({ ok: true, status: 'entregue', id: resendBody.id }, 200);
    }

    const erroMsg =
      resendBody?.message || resendBody?.error || resendBody?.name ||
      `Resend retornou status ${resendStatus}`;
    await admin
      .from('email_suspensao_envios')
      .update({
        status: 'falhou',
        erro_mensagem: typeof erroMsg === 'string' ? erroMsg : JSON.stringify(erroMsg),
      })
      .eq('id', envioId);

    return jsonResponse(
      { ok: false, status: 'falhou', erro: erroMsg, http_status: resendStatus },
      200,
    );
  } catch (e: any) {
    return jsonResponse({ error: 'internal_error', detail: e?.message ?? String(e) }, 500);
  }
});
