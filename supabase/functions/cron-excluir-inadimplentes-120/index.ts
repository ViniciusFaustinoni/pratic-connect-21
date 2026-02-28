import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[Cron Excluir 120 dias] Iniciando execução...');

  try {
    // Data limite: 120 dias atrás
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 120);
    const dataLimiteStr = dataLimite.toISOString();

    // Buscar associados suspensos há 120+ dias
    const { data: associados, error } = await supabase
      .from('associados')
      .select('id, nome, data_bloqueio, user_id')
      .eq('status', 'suspenso')
      .lte('data_bloqueio', dataLimiteStr);

    if (error) throw new Error(`Erro ao buscar associados: ${error.message}`);

    console.log(`[Cron 120] Encontrados ${associados?.length || 0} associados para exclusão`);

    const resultados: Array<{ id: string; nome: string; excluido: boolean; error?: string }> = [];

    for (const assoc of (associados || [])) {
      try {
        // Calcular dias de atraso
        const diasAtraso = Math.floor(
          (new Date().getTime() - new Date(assoc.data_bloqueio!).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Excluir (cancelar) o associado
        const { error: updateError } = await supabase
          .from('associados')
          .update({
            status: 'cancelado',
            tipo_saida: 'inadimplencia',
            pode_reativar: true,
            data_cancelamento: new Date().toISOString(),
            motivo_cancelamento: `Exclusão automática por inadimplência (${diasAtraso} dias suspenso)`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', assoc.id)
          .eq('status', 'suspenso');

        if (updateError) throw updateError;

        // Registrar histórico
        await supabase.from('associados_historico').insert({
          associado_id: assoc.id,
          tipo: 'status_alterado',
          descricao: `Excluído automaticamente por inadimplência (${diasAtraso} dias suspenso). Pode reativar como cliente novo.`,
          dados_anteriores: { status: 'suspenso' },
          dados_novos: { status: 'cancelado', tipo_saida: 'inadimplencia', pode_reativar: true },
        });

        // Cancelar recorrência no Asaas
        try {
          await supabase.functions.invoke('asaas-cancelar-recorrencia', {
            body: { associadoId: assoc.id, motivo: 'exclusao_inadimplencia_120_dias' },
          });
        } catch (asaasErr) {
          console.warn(`[Cron 120] Erro ao cancelar recorrência Asaas para ${assoc.nome}:`, asaasErr);
        }

        // Notificar associado
        if (assoc.user_id) {
          await supabase.from('notificacoes').insert({
            user_id: assoc.id,
            titulo: 'Exclusão por Inadimplência',
            mensagem: `Sua associação foi cancelada após ${diasAtraso} dias de inadimplência. Para retornar, será necessário realizar novo processo de adesão.`,
            tipo: 'alerta',
          });

          try {
            await supabase.functions.invoke('disparar-notificacao', {
              body: {
                user_id: assoc.user_id,
                associado_id: assoc.id,
                tipo: 'cobranca',
                subtipo: 'exclusao_inadimplencia',
                dados: { dias_atraso: diasAtraso },
                forcar_envio: true,
              },
            });
          } catch (notifErr) {
            console.warn(`[Cron 120] Erro ao enviar notificação:`, notifErr);
          }
        }

        resultados.push({ id: assoc.id, nome: assoc.nome, excluido: true });
      } catch (err) {
        console.error(`[Cron 120] Erro ao excluir ${assoc.nome}:`, err);
        resultados.push({
          id: assoc.id,
          nome: assoc.nome,
          excluido: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    const excluidos = resultados.filter(r => r.excluido).length;
    console.log(`[Cron Excluir 120 dias] Concluído: ${excluidos} excluídos`);

    return new Response(
      JSON.stringify({ success: true, total: resultados.length, excluidos, resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[Cron Excluir 120 dias] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
