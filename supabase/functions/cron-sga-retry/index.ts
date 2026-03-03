import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('[Cron SGA Retry] Iniciando processamento da fila de reenvio...');

  try {
    // Buscar registros pendentes prontos para reenvio
    const { data: pendentes, error: fetchError } = await supabase
      .from('sga_sync_queue')
      .select('*')
      .eq('status', 'pendente')
      .lte('proximo_reenvio_em', new Date().toISOString())
      .lt('tentativas', 10)
      .order('proximo_reenvio_em', { ascending: true })
      .limit(10); // Processar no máximo 10 por vez

    if (fetchError) {
      console.error('[Cron SGA Retry] Erro ao buscar fila:', fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!pendentes || pendentes.length === 0) {
      console.log('[Cron SGA Retry] Nenhum registro pendente na fila.');
      return new Response(JSON.stringify({ success: true, processados: 0 }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Cron SGA Retry] ${pendentes.length} registros para processar`);

    let processados = 0;
    let sucesso = 0;
    let falha = 0;

    for (const item of pendentes) {
      processados++;
      console.log(`[Cron SGA Retry] Processando ${processados}/${pendentes.length}: veiculo=${item.veiculo_id}, etapa=${item.etapa_parou}, tentativa=${item.tentativas + 1}`);

      // Marcar como processando
      await supabase
        .from('sga_sync_queue')
        .update({ status: 'processando', ultima_tentativa_em: new Date().toISOString() })
        .eq('id', item.id);

      try {
        // Chamar a função sga-hinova-sync que já tem toda a lógica
        // Ela vai: buscar por CPF primeiro (backup), cadastrar se necessário, etc.
        const { data, error } = await supabase.functions.invoke('sga-hinova-sync', {
          body: {
            veiculo_id: item.veiculo_id,
            associado_id: item.associado_id,
          },
        });

        if (error) {
          throw new Error(error.message || 'Erro ao invocar sga-hinova-sync');
        }

        if (data?.success) {
          console.log(`[Cron SGA Retry] ✅ Sucesso: veiculo=${item.veiculo_id}`);
          // A própria função sga-hinova-sync já marca como concluído na fila
          sucesso++;
        } else {
          console.log(`[Cron SGA Retry] ❌ Falha: ${data?.error || 'Erro desconhecido'}`);
          // A própria função sga-hinova-sync já atualiza a fila com o erro
          falha++;
        }
      } catch (err) {
        console.error(`[Cron SGA Retry] Erro ao processar item ${item.id}:`, err);
        
        const tentativas = item.tentativas + 1;
        const proximoReenvio = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        
        await supabase
          .from('sga_sync_queue')
          .update({
            status: tentativas >= 10 ? 'falha_permanente' : 'pendente',
            tentativas,
            ultima_tentativa_em: new Date().toISOString(),
            proximo_reenvio_em: proximoReenvio,
            erro_ultimo: err instanceof Error ? err.message : 'Erro desconhecido',
          })
          .eq('id', item.id);
        
        falha++;
      }
    }

    console.log(`[Cron SGA Retry] Concluído: ${processados} processados, ${sucesso} sucesso, ${falha} falha`);

    return new Response(
      JSON.stringify({ success: true, processados, sucesso, falha }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Cron SGA Retry] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
