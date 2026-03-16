import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Helper centralizado para operações de pontuação de consultores.
 * Lê parâmetros de comissoes_parametros e registra eventos em pontuacao_eventos.
 */

export async function getParametroPontuacao(
  supabase: SupabaseClient,
  chave: string,
  fallback: number
): Promise<number> {
  const { data } = await supabase
    .from('comissoes_parametros')
    .select('valor')
    .eq('chave', chave)
    .eq('ativo', true)
    .maybeSingle();

  return data ? parseFloat(data.valor) : fallback;
}

export interface EventoPontuacaoParams {
  vendedor_id: string;
  tipo_operacao: string;
  pontos: number;
  contrato_id?: string | null;
  referencia_tipo?: string | null;
  referencia_id?: string | null;
  conta_ranking?: boolean;
}

export async function registrarEventoPontuacao(
  supabase: SupabaseClient,
  params: EventoPontuacaoParams
): Promise<void> {
  const { error } = await supabase.from('pontuacao_eventos').insert({
    vendedor_id: params.vendedor_id,
    tipo_operacao: params.tipo_operacao,
    pontos: params.pontos,
    contrato_id: params.contrato_id || null,
    referencia_tipo: params.referencia_tipo || null,
    referencia_id: params.referencia_id || null,
    conta_ranking: params.conta_ranking ?? true,
  });

  if (error) {
    console.error(`[pontuacao-helper] Erro ao registrar evento ${params.tipo_operacao}:`, error);
  } else {
    console.log(`[pontuacao-helper] Evento ${params.tipo_operacao} registrado: ${params.pontos} pontos para ${params.vendedor_id}`);
  }
}

export async function estornarEventoPontuacao(
  supabase: SupabaseClient,
  eventoId: string,
  vendedorId: string,
  contratoId: string | null
): Promise<void> {
  // Buscar evento original
  const { data: eventoOriginal } = await supabase
    .from('pontuacao_eventos')
    .select('id, pontos, tipo_operacao')
    .eq('id', eventoId)
    .eq('estornado', false)
    .maybeSingle();

  if (!eventoOriginal) {
    console.log(`[pontuacao-helper] Evento ${eventoId} não encontrado ou já estornado`);
    return;
  }

  // Criar evento de estorno
  await supabase.from('pontuacao_eventos').insert({
    vendedor_id: vendedorId,
    tipo_operacao: 'estorno_cancelamento',
    pontos: eventoOriginal.pontos * -1,
    contrato_id: contratoId,
    referencia_tipo: 'estorno',
    referencia_id: eventoOriginal.id,
    estorno_id: eventoOriginal.id,
  });

  // Marcar original como estornado
  await supabase
    .from('pontuacao_eventos')
    .update({ estornado: true })
    .eq('id', eventoOriginal.id);

  console.log(`[pontuacao-helper] Estorno de ${eventoOriginal.pontos} pontos (evento ${eventoId})`);
}
