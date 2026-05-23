// Vigia universal de logs_auditoria.
// Padrão obrigatório: nunca deixar INSERT em logs_auditoria falhar silenciosamente.
// Se o CHECK constraint (ou qualquer outro erro) barrar o registro original,
// grava uma entrada de fallback com acao='criar' (sempre na whitelist) e
// descrição prefixada [FALHA_LOG_AUDITORIA] + payload do erro em dados_novos.
// Sempre não-bloqueante.

export interface LogAuditoriaPayload {
  usuario_id?: string | null;
  usuario_nome?: string | null;
  acao: string;
  modulo?: string | null;
  descricao?: string | null;
  tabela?: string | null;
  registro_id?: string | null;
  dados_anteriores?: unknown;
  dados_novos?: unknown;
  [key: string]: unknown;
}

// Aceita o cliente Supabase de forma loose (admin/anon/etc) para evitar
// dependência cruzada de tipos entre edges.
type AnySupabase = {
  from: (table: string) => {
    insert: (row: unknown) => Promise<{ error: unknown }>;
  };
};

export async function insertAuditLog(
  supabase: AnySupabase,
  payload: LogAuditoriaPayload,
): Promise<void> {
  try {
    const { error } = await supabase.from('logs_auditoria').insert(payload);
    if (!error) return;

    console.error('[FALHA_LOG_AUDITORIA]', error, payload);

    const fallback = {
      usuario_id: payload.usuario_id ?? null,
      usuario_nome: payload.usuario_nome ?? 'sistema',
      acao: 'criar',
      modulo: payload.modulo ?? 'configuracoes',
      descricao: `[FALHA_LOG_AUDITORIA] ${payload.acao}: ${
        (error as { message?: string })?.message ?? String(error)
      }`,
      tabela: payload.tabela ?? null,
      registro_id: payload.registro_id ?? null,
      dados_novos: { erro: error, payload_original: payload },
    };

    const { error: fbErr } = await supabase
      .from('logs_auditoria')
      .insert(fallback);
    if (fbErr) console.error('[FALHA_LOG_AUDITORIA_FALLBACK]', fbErr);
  } catch (e) {
    console.error('[FALHA_LOG_AUDITORIA_EXCEPTION]', e, payload);
  }
}
