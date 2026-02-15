import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const hoje = new Date().toISOString().split('T')[0];
    const diasTolerancia = 10;
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - diasTolerancia);
    const dataLimiteStr = dataLimite.toISOString().split('T')[0];

    // Buscar parcelas vencidas há mais de 10 dias de acordos ativos
    const { data: parcelasVencidas, error: errParcelas } = await supabase
      .from('acordo_parcelas')
      .select(`
        id, acordo_id, numero_parcela, valor, data_vencimento, status,
        acordo:acordos!acordo_parcelas_acordo_id_fkey(id, associado_id, valor_acordo, valor_original, status, cobrancas_ids)
      `)
      .eq('status', 'pendente')
      .lt('data_vencimento', dataLimiteStr);

    if (errParcelas) {
      console.error('Erro ao buscar parcelas vencidas:', errParcelas);
      throw errParcelas;
    }

    // Filtrar apenas parcelas de acordos ativos
    const parcelasDeAcordosAtivos = (parcelasVencidas || []).filter(
      (p: any) => p.acordo?.status === 'ativo'
    );

    // Agrupar por acordo_id (pegar o acordo com parcela mais antiga vencida)
    const acordosQuebrados = new Map<string, any>();
    for (const parcela of parcelasDeAcordosAtivos) {
      if (!acordosQuebrados.has(parcela.acordo_id)) {
        acordosQuebrados.set(parcela.acordo_id, parcela.acordo);
      }
    }

    const resultados: any[] = [];

    for (const [acordoId, acordo] of acordosQuebrados.entries()) {
      // Calcular valor já pago nas parcelas
      const { data: todasParcelas } = await supabase
        .from('acordo_parcelas')
        .select('valor_pago, status')
        .eq('acordo_id', acordoId);

      const valorJaPago = (todasParcelas || [])
        .filter((p: any) => p.status === 'pago')
        .reduce((acc: number, p: any) => acc + (Number(p.valor_pago) || 0), 0);

      // 1. Marcar acordo como quebrado
      const { error: errQuebra } = await supabase
        .from('acordos')
        .update({
          status: 'quebrado',
          motivo_quebra: `Parcela vencida há mais de ${diasTolerancia} dias sem pagamento. Detectado automaticamente.`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', acordoId);

      if (errQuebra) {
        console.error(`Erro ao quebrar acordo ${acordoId}:`, errQuebra);
        continue;
      }

      // 2. Cancelar parcelas pendentes
      await supabase
        .from('acordo_parcelas')
        .update({ status: 'cancelado' })
        .eq('acordo_id', acordoId)
        .eq('status', 'pendente');

      // 3. Registrar na fila de cobrança
      await supabase
        .from('cobranca_fila')
        .insert({
          associado_id: acordo.associado_id,
          tipo: 'acordo_quebrado',
          prioridade: 'urgente',
          titulo: 'Acordo quebrado — retomar cobrança',
          descricao: `Acordo quebrado automaticamente. Valor original: R$ ${Number(acordo.valor_original).toFixed(2)}, já pago: R$ ${valorJaPago.toFixed(2)}.`,
          status: 'pendente',
        });

      resultados.push({
        acordo_id: acordoId,
        associado_id: acordo.associado_id,
        valor_original: acordo.valor_original,
        valor_pago: valorJaPago,
      });

      console.log(`[verificar-acordos-quebrados] Acordo ${acordoId} marcado como quebrado`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        acordos_quebrados: resultados.length,
        detalhes: resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro na verificação de acordos:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
