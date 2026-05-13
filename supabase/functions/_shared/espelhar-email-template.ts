// Espelha um disparo de template Meta WhatsApp como e-mail (Resend, via send-email).
// Chamado de forma fire-and-forget por whatsapp-send-text após o envio bem-sucedido.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { resolverEmailsDestinatario } from './resolver-emails-destinatario.ts';
import { renderEmailFromMeta } from './render-email-from-meta.ts';

export interface EspelharEmailParams {
  supabase: SupabaseClient;
  telefone: string;
  template_name: string;
  template_params: string[];
  template_button_params?: string[];
  referencia_tipo?: string;
  referencia_id?: string;
}

export async function espelharEmailDoTemplate(p: EspelharEmailParams): Promise<void> {
  const tag = `[espelho-email:${p.template_name}]`;
  try {
    if ((Deno.env.get('EMAIL_MIRROR_ENABLED') || 'true').toLowerCase() === 'false') {
      return;
    }

    const rendered = await renderEmailFromMeta({
      supabase: p.supabase,
      template_name: p.template_name,
      template_params: p.template_params || [],
      template_button_params: p.template_button_params,
    });
    if (!rendered || !rendered.enabled) {
      console.log(`${tag} pulado (template sem espelho ou inexistente)`);
      return;
    }

    const emails = await resolverEmailsDestinatario({
      supabase: p.supabase,
      telefone: p.telefone,
      template_name: p.template_name,
      referencia_tipo: p.referencia_tipo,
      referencia_id: p.referencia_id,
    });
    if (emails.length === 0) {
      console.log(`${tag} sem destinatário de e-mail resolvido`);
      return;
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    for (const email of emails) {
      // Idempotência: se já enviado, pula.
      const { data: existing } = await p.supabase
        .from('notificacoes_email_log')
        .select('id')
        .eq('template_name', p.template_name)
        .eq('recipient_email', email)
        .eq('status', 'enviado')
        .eq('referencia_tipo', p.referencia_tipo || '')
        .eq('referencia_id', p.referencia_id || '')
        .maybeSingle();
      if (existing) {
        console.log(`${tag} já enviado para ${email} (idempotência)`);
        continue;
      }

      // Insere log "pendente"
      const { data: logRow } = await p.supabase
        .from('notificacoes_email_log')
        .insert({
          template_name: p.template_name,
          recipient_email: email,
          referencia_tipo: p.referencia_tipo || null,
          referencia_id: p.referencia_id || null,
          params: { template_params: p.template_params, button: p.template_button_params },
          status: 'pendente',
        })
        .select('id')
        .single();

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey': SERVICE_KEY,
            'x-internal-mirror': '1',
          },
          body: JSON.stringify({
            template: rendered.template,
            to: email,
            data: { ...rendered.data, assunto: rendered.subject },
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || body?.error) {
          throw new Error(body?.error || `HTTP ${res.status}`);
        }
        if (logRow?.id) {
          await p.supabase
            .from('notificacoes_email_log')
            .update({ status: 'enviado', resend_id: body?.id || null })
            .eq('id', logRow.id);
        }
        console.log(`${tag} ✓ enviado para ${email}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${tag} ✗ falha para ${email}:`, msg);
        if (logRow?.id) {
          await p.supabase
            .from('notificacoes_email_log')
            .update({ status: 'falhou', error: msg })
            .eq('id', logRow.id);
        }
      }
    }
  } catch (e) {
    console.error(`${tag} erro inesperado:`, (e as Error).message);
  }
}
