import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

interface LogParams {
  functionName: string;
  plataforma: 'autentique' | 'fipe' | 'plate_lookup';
  operacao: string;
  status: 'sucesso' | 'erro';
  erroMensagem?: string;
  tempoMs?: number;
  metadata?: Record<string, unknown>;
  userId?: string;
}

/**
 * Fire-and-forget logger para Edge Functions.
 * Insere na tabela edge_functions_logs usando service_role.
 */
export function logEdgeFunction(params: LogParams): void {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) return;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Fire-and-forget — não bloqueia a resposta
    supabase.from('edge_functions_logs').insert({
      function_name: params.functionName,
      plataforma: params.plataforma,
      operacao: params.operacao,
      status: params.status,
      erro_mensagem: params.erroMensagem || null,
      tempo_resposta_ms: params.tempoMs || null,
      metadata: params.metadata || {},
      user_id: params.userId || null,
    }).then(({ error }) => {
      if (error) console.error('[log-edge-function] Erro ao salvar log:', error.message);
    });
  } catch (e) {
    // Silently fail — logging should never break the function
    console.error('[log-edge-function] Erro inesperado:', e);
  }
}
