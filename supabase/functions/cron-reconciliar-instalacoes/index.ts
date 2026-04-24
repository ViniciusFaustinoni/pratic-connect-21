import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CRON JOB: Reconciliação de Instalações
 * 
 * Este job verifica periodicamente:
 * 1. Contratos com adesao_paga=true que não têm instalação criada
 * 2. Registros na tabela instalacoes_pendentes_criacao não resolvidos
 * 
 * E tenta criar as instalações faltantes.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const resultados = {
    contratosSemInstalacao: 0,
    instalacoesCriadas: 0,
    pendentesTentados: 0,
    pendentesResolvidos: 0,
    erros: [] as string[],
  };

  try {
    console.log('[cron-reconciliar-instalacoes] Iniciando reconciliação...');

    // 1. Buscar contratos pagos sem instalação
    // Usando LEFT JOIN para encontrar contratos que têm adesao_paga mas não têm instalação
    const { data: contratos, error: contratosError } = await supabase
      .from('contratos')
      .select(`
        id,
        cotacao_id,
        adesao_paga_em,
        cotacoes:cotacao_id (
          id,
          nome_solicitante,
          tipo_vistoria
        )
      `)
      .eq('adesao_paga', true)
      .not('cotacao_id', 'is', null)
      .order('adesao_paga_em', { ascending: true })
      .limit(50); // Limitar para evitar timeout

    if (contratosError) {
      console.error('[cron-reconciliar-instalacoes] Erro ao buscar contratos:', contratosError);
      resultados.erros.push(`Erro ao buscar contratos: ${contratosError.message}`);
    } else {
      console.log(`[cron-reconciliar-instalacoes] Encontrados ${contratos?.length || 0} contratos pagos`);

      // Verificar quais não têm instalação
      for (const contrato of contratos || []) {
        const { data: instalacao } = await supabase
          .from('instalacoes')
          .select('id')
          .eq('cotacao_id', contrato.cotacao_id)
          .maybeSingle();

        if (!instalacao) {
          resultados.contratosSemInstalacao++;
          console.log(`[cron-reconciliar-instalacoes] Contrato ${contrato.id} sem instalação, cotação: ${contrato.cotacao_id}`);

          // Tentar criar instalação
          try {
            const response = await fetch(
              `${supabaseUrl}/functions/v1/criar-instalacao-pos-pagamento`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ cotacaoId: contrato.cotacao_id })
              }
            );

            const result = await response.json();

            if (result.success) {
              resultados.instalacoesCriadas++;
              console.log(`[cron-reconciliar-instalacoes] ✓ Instalação criada para cotação ${contrato.cotacao_id}: ${result.instalacaoId}`);
            } else {
              console.warn(`[cron-reconciliar-instalacoes] ⚠️ Não foi possível criar instalação: ${result.error || result.message}`);
              resultados.erros.push(`Cotação ${contrato.cotacao_id}: ${result.error || result.message}`);
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            console.error(`[cron-reconciliar-instalacoes] Erro ao criar instalação:`, err);
            resultados.erros.push(`Cotação ${contrato.cotacao_id}: ${errorMsg}`);
          }
        }
      }
    }

    // 2. Processar registros pendentes na tabela de rastreamento
    const { data: pendentes, error: pendentesError } = await supabase
      .from('instalacoes_pendentes_criacao')
      .select('id, cotacao_id, contrato_id, tentativas')
      .eq('resolvido', false)
      .lt('tentativas', 10) // Máximo de 10 tentativas totais
      .order('created_at', { ascending: true })
      .limit(20);

    if (pendentesError) {
      console.error('[cron-reconciliar-instalacoes] Erro ao buscar pendentes:', pendentesError);
    } else {
      console.log(`[cron-reconciliar-instalacoes] Encontrados ${pendentes?.length || 0} registros pendentes`);

      for (const pendente of pendentes || []) {
        resultados.pendentesTentados++;

        try {
          const response = await fetch(
            `${supabaseUrl}/functions/v1/criar-instalacao-pos-pagamento`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ cotacaoId: pendente.cotacao_id })
            }
          );

          const result = await response.json();

          if (result.success || result.message === 'Instalação já existente') {
            // Marcar como resolvido
            await supabase
              .from('instalacoes_pendentes_criacao')
              .update({
                resolvido: true,
                resolvido_em: new Date().toISOString(),
              })
              .eq('id', pendente.id);

            resultados.pendentesResolvidos++;
            console.log(`[cron-reconciliar-instalacoes] ✓ Pendente ${pendente.id} resolvido`);
          } else {
            // Atualizar tentativas
            await supabase
              .from('instalacoes_pendentes_criacao')
              .update({
                tentativas: (pendente.tentativas || 0) + 1,
                ultima_tentativa: new Date().toISOString(),
                erro_detalhes: result.error || result.message,
              })
              .eq('id', pendente.id);

            console.warn(`[cron-reconciliar-instalacoes] Pendente ${pendente.id} ainda não resolvido: ${result.error || result.message}`);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.error(`[cron-reconciliar-instalacoes] Erro ao processar pendente ${pendente.id}:`, err);
          
          await supabase
            .from('instalacoes_pendentes_criacao')
            .update({
              tentativas: (pendente.tentativas || 0) + 1,
              ultima_tentativa: new Date().toISOString(),
              erro_detalhes: errorMsg,
            })
            .eq('id', pendente.id);
        }
      }
    }

    console.log('[cron-reconciliar-instalacoes] Reconciliação concluída:', resultados);

    return new Response(JSON.stringify({
      success: true,
      resultados,
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[cron-reconciliar-instalacoes] Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
      resultados,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
