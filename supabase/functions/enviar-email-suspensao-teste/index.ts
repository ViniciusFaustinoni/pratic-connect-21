// Edge function: enviar-email-suspensao-teste
// Fase 2 — Envio real via Resend, isolado pela aba Relacionamento › E-mails.
// NÃO é chamada por nenhum fluxo de suspensão; apenas pelo botão "Enviar e-mail de teste".

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

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

function renderTemplate(
  texto: string,
  vars: { nome_cliente: string; motivo_suspensao: string; data: string },
): string {
  return texto
    .replace(/\{\{\s*nome_cliente\s*\}\}/g, vars.nome_cliente)
    .replace(/\{\{\s*motivo_suspensao\s*\}\}/g, vars.motivo_suspensao)
    .replace(/\{\{\s*data\s*\}\}/g, vars.data);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function corpoParaHtml(corpo: string): string {
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.6;white-space:pre-wrap">${escapeHtml(corpo)}</div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'method_not_allowed' }, 405);
    }

    if (!RESEND_API_KEY) {
      return jsonResponse({ error: 'resend_api_key_missing' }, 500);
    }

    // ---- Auth ----
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }

    const supabaseAuth = createClient(SUPABASE_URL, SERVICE_ROLE, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await supabaseAuth.auth.getUser(jwt);
    if (userErr || !userRes?.user) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Checagem de role: precisa ter pelo menos um role permitido
    const { data: roles, error: rolesErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (rolesErr) {
      return jsonResponse({ error: 'roles_lookup_failed', detail: rolesErr.message }, 500);
    }
    const podeAcessar = (roles ?? []).some((r: any) => ROLES_PERMITIDOS.has(String(r.role)));
    if (!podeAcessar) {
      return jsonResponse({ error: 'forbidden' }, 403);
    }

    // ---- Payload ----
    let payload: any;
    try {
      payload = await req.json();
    } catch {
      return jsonResponse({ error: 'invalid_json' }, 400);
    }

    const destinatario = String(payload?.destinatario ?? '').trim().toLowerCase();
    if (!isEmailValido(destinatario)) {
      return jsonResponse({ error: 'destinatario_invalido' }, 400);
    }

    const variaveisIn = payload?.variaveis ?? {};
    const hoje = new Date().toLocaleDateString('pt-BR');
    const vars = {
      nome_cliente: String(variaveisIn.nome_cliente || '').trim() || 'Maria Souza',
      motivo_suspensao:
        String(variaveisIn.motivo_suspensao || '').trim() ||
        'Inadimplência da mensalidade de maio',
      data: String(variaveisIn.data || '').trim() || hoje,
    };

    // ---- Template atual ----
    const { data: template, error: tplErr } = await admin
      .from('email_suspensao_template')
      .select('assunto, corpo')
      .maybeSingle();
    if (tplErr || !template) {
      return jsonResponse({ error: 'template_nao_encontrado', detail: tplErr?.message }, 500);
    }

    const assuntoRenderizado = renderTemplate(template.assunto ?? '', vars).trim() ||
      'Aviso de suspensão de proteção';
    const corpoRenderizado = renderTemplate(template.corpo ?? '', vars);

    // ---- Log pendente ----
    const { data: envioRow, error: insertErr } = await admin
      .from('email_suspensao_envios')
      .insert({
        cliente_nome: vars.nome_cliente,
        destinatario,
        fluxo_origem: 'teste_manual',
        assunto_enviado: assuntoRenderizado,
        corpo_renderizado: corpoRenderizado,
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
          subject: assuntoRenderizado,
          html: corpoParaHtml(corpoRenderizado),
          text: corpoRenderizado,
        }),
      });
      resendStatus = r.status;
      const raw = await r.text();
      try {
        resendBody = raw ? JSON.parse(raw) : null;
      } catch {
        resendBody = { raw };
      }
    } catch (e: any) {
      await admin
        .from('email_suspensao_envios')
        .update({
          status: 'falhou',
          erro_mensagem: `Falha de rede ao chamar Resend: ${e?.message ?? String(e)}`,
        })
        .eq('id', envioId);
      return jsonResponse({ ok: false, status: 'falhou', erro: 'network_error' }, 200);
    }

    if (resendStatus >= 200 && resendStatus < 300 && resendBody?.id) {
      await admin
        .from('email_suspensao_envios')
        .update({
          status: 'entregue',
          provider_message_id: String(resendBody.id),
        })
        .eq('id', envioId);
      return jsonResponse({ ok: true, status: 'entregue', id: resendBody.id }, 200);
    }

    const erroMsg =
      resendBody?.message ||
      resendBody?.error ||
      resendBody?.name ||
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
