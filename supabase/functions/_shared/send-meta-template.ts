// Helper compartilhado para envio idempotente de templates WhatsApp Meta.
// Encapsula formatação de telefone, tratamento de erros (best-effort)
// e logs padronizados — para não duplicar boilerplate em cada edge function.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export interface SendMetaTemplateParams {
  supabase: SupabaseClient;
  telefone: string;
  templateName: string;
  templateParams: string[];
  /** Param dinâmico de botão URL (curto Autentique 4–16 chars OU token público) */
  buttonParam?: string;
  referenciaTipo?: string;
  referenciaId?: string;
  /** Tag de log p/ rastrear origem da chamada */
  tag?: string;
}

export interface SendMetaTemplateResult {
  ok: boolean;
  message_id?: string;
  error?: string;
  skipped?: boolean;
}

function normalizePhone(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length < 10) return null;
  return digits.startsWith('55') ? digits : `55${digits}`;
}

export async function sendMetaTemplate(
  p: SendMetaTemplateParams,
): Promise<SendMetaTemplateResult> {
  const tag = p.tag || `[meta-template:${p.templateName}]`;
  const tel = normalizePhone(p.telefone);
  if (!tel) {
    console.warn(`${tag} skip — telefone inválido: "${p.telefone}"`);
    return { ok: false, skipped: true, error: 'telefone inválido' };
  }
  try {
    const body: Record<string, unknown> = {
      telefone: tel,
      mensagem: '',
      template_name: p.templateName,
      template_params: p.templateParams,
    };
    if (p.buttonParam) body.template_button_params = [p.buttonParam];
    if (p.referenciaTipo) body.referencia_tipo = p.referenciaTipo;
    if (p.referenciaId) body.referencia_id = p.referenciaId;

    const { data, error } = await p.supabase.functions.invoke('whatsapp-send-text', { body });
    if (error) {
      console.error(`${tag} invoke erro:`, error.message || error);
      return { ok: false, error: error.message || String(error) };
    }
    if (data && (data as any).success === false) {
      console.error(`${tag} falha:`, (data as any).error);
      return { ok: false, error: (data as any).error };
    }
    console.log(`${tag} enviado para ${tel}`);
    return { ok: true, message_id: (data as any)?.message_id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`${tag} exceção:`, msg);
    return { ok: false, error: msg };
  }
}
