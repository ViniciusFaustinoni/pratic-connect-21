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

  console.log('[Cron SPC 30 dias] Iniciando execução...');

  try {
    // Data limite: 30 dias atrás
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);
    const dataLimiteStr = dataLimite.toISOString();

    // Buscar associados suspensos há 30+ dias
    const { data: associados, error } = await supabase
      .from('associados')
      .select('id, nome, cpf, data_bloqueio')
      .eq('status', 'suspenso')
      .lte('data_bloqueio', dataLimiteStr);

    if (error) throw new Error(`Erro ao buscar associados: ${error.message}`);

    console.log(`[Cron SPC] Encontrados ${associados?.length || 0} candidatos`);

    const resultados: Array<{ id: string; nome: string; marcado: boolean; ja_existia: boolean; error?: string }> = [];

    for (const assoc of (associados || [])) {
      try {
        // Verificar se já tem negativação ativa
        const { data: negExistente } = await supabase
          .from('negativacoes')
          .select('id')
          .eq('associado_id', assoc.id)
          .is('data_baixa', null)
          .maybeSingle();

        if (negExistente) {
          resultados.push({ id: assoc.id, nome: assoc.nome, marcado: false, ja_existia: true });
          continue;
        }

        // Buscar valor total pendente
        const { data: cobrancasVencidas } = await supabase
          .from('asaas_cobrancas')
          .select('valor, data_vencimento')
          .eq('associado_id', assoc.id)
          .eq('status', 'OVERDUE');

        const valorTotal = (cobrancasVencidas || []).reduce((sum, c) => sum + (c.valor || 0), 0);
        const dataVencimentoMaisAntiga = (cobrancasVencidas || [])
          .map(c => c.data_vencimento)
          .sort()[0] || assoc.data_bloqueio || new Date().toISOString().split('T')[0];

        // Criar registro de negativação
        const { error: insertError } = await supabase.from('negativacoes').insert({
          associado_id: assoc.id,
          orgao: 'SPC',
          valor: valorTotal,
          data_divida: dataVencimentoMaisAntiga,
          status: 'elegivel',
        });

        if (insertError) throw insertError;

        // Notificar setor de cobrança (criar notificação para admin)
        await supabase.from('notificacoes').insert({
          user_id: assoc.id,
          titulo: 'Candidato SPC',
          mensagem: `Associado ${assoc.nome} (CPF: ${assoc.cpf}) atingiu 30+ dias de inadimplência. Valor: R$ ${valorTotal.toFixed(2)}. Elegível para negativação SPC.`,
          tipo: 'alerta',
        });

        resultados.push({ id: assoc.id, nome: assoc.nome, marcado: true, ja_existia: false });
      } catch (err) {
        console.error(`[Cron SPC] Erro ao processar ${assoc.nome}:`, err);
        resultados.push({
          id: assoc.id,
          nome: assoc.nome,
          marcado: false,
          ja_existia: false,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    const marcados = resultados.filter(r => r.marcado).length;
    const jaExistiam = resultados.filter(r => r.ja_existia).length;
    console.log(`[Cron SPC 30 dias] Concluído: ${marcados} novos, ${jaExistiam} já existiam`);

    return new Response(
      JSON.stringify({ success: true, total: resultados.length, marcados, ja_existiam: jaExistiam, resultados }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('[Cron SPC 30 dias] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
