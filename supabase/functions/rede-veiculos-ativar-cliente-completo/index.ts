import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  associadoId: string;
  motivo?: string;
  revincular?: boolean; // Se true, tenta revincular veículos desvinculados
}

interface VeiculoComRastreador {
  id: string;
  placa: string;
  ativo: boolean;
  rede_veiculos_veiculo_id: number | null;
  rastreadores: Array<{
    id: string;
    imei: string | null;
    plataforma: string | null;
    status: string | null;
  }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json() as RequestBody;
    const { associadoId, motivo = 'reativacao_manual', revincular = true } = body;

    console.log('[RedeVeiculos AtivarClienteCompleto] Iniciando:', { associadoId, motivo, revincular });

    if (!associadoId) {
      throw new Error('associadoId é obrigatório');
    }

    // ===== 1. Buscar associado =====
    const { data: associado, error: associadoError } = await supabase
      .from('associados')
      .select('id, nome, cpf, status')
      .eq('id', associadoId)
      .single();

    if (associadoError || !associado) {
      throw new Error(`Associado não encontrado: ${associadoError?.message || 'ID inválido'}`);
    }

    console.log('[RedeVeiculos AtivarClienteCompleto] Associado:', associado.nome);

    // ===== 2. Buscar todos veículos com rastreador Rede Veículos =====
    const { data: veiculos, error: veiculosError } = await supabase
      .from('veiculos')
      .select(`
        id, 
        placa,
        ativo,
        rede_veiculos_veiculo_id,
        rastreadores!inner (
          id,
          imei,
          plataforma,
          status
        )
      `)
      .eq('associado_id', associadoId)
      .eq('rastreadores.plataforma', 'rede_veiculos');

    if (veiculosError) {
      throw new Error(`Erro ao buscar veículos: ${veiculosError.message}`);
    }

    if (!veiculos || veiculos.length === 0) {
      console.log('[RedeVeiculos AtivarClienteCompleto] Nenhum veículo Rede Veículos encontrado');
      
      // Apenas notificar adimplência geral
      try {
        await fetch(
          `${supabaseUrl}/functions/v1/rede-veiculos-informar-adimplente`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ associadoId, motivo }),
          }
        );
      } catch (err) {
        console.warn('[RedeVeiculos AtivarClienteCompleto] Erro ao notificar adimplência:', err);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Adimplência notificada, sem veículos Rede Veículos para ativar',
          veiculos_processados: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[RedeVeiculos AtivarClienteCompleto] Encontrados ${veiculos.length} veículos`);

    // ===== 3. Para cada veículo: revincular (se necessário) + ativar + adimplência =====
    const resultados: Array<{
      veiculoId: string;
      placa: string;
      vinculado: boolean;
      ativado: boolean;
      adimplente: boolean;
      erros: string[];
    }> = [];

    for (const veiculo of veiculos as unknown as VeiculoComRastreador[]) {
      const resultado = {
        veiculoId: veiculo.id,
        placa: veiculo.placa,
        vinculado: false,
        ativado: false,
        adimplente: false,
        erros: [] as string[],
      };

      const rastreador = Array.isArray(veiculo.rastreadores) 
        ? veiculo.rastreadores[0] 
        : veiculo.rastreadores;

      try {
        // 3.1 - Revincular se necessário (veículo sem rede_veiculos_veiculo_id)
        if (revincular && !veiculo.rede_veiculos_veiculo_id && rastreador?.imei) {
          console.log(`[RedeVeiculos AtivarClienteCompleto] Revinculando veículo ${veiculo.placa}...`);
          const vincularResponse = await fetch(
            `${supabaseUrl}/functions/v1/rede-veiculos-vincular-cliente`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                imei: rastreador.imei,
                veiculoId: veiculo.id,
                associadoId,
              }),
            }
          );

          const vincularResult = await vincularResponse.json();
          resultado.vinculado = vincularResult.success === true;
          if (!resultado.vinculado && vincularResult.error) {
            resultado.erros.push(`Vincular: ${vincularResult.error}`);
          }
        } else if (veiculo.rede_veiculos_veiculo_id) {
          resultado.vinculado = true; // Já estava vinculado
        }
      } catch (err) {
        console.error(`[RedeVeiculos AtivarClienteCompleto] Erro ao vincular ${veiculo.placa}:`, err);
        resultado.erros.push(`Vincular: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }

      try {
        // 3.2 - Ativar veículo na plataforma
        console.log(`[RedeVeiculos AtivarClienteCompleto] Ativando veículo ${veiculo.placa}...`);
        const ativarResponse = await fetch(
          `${supabaseUrl}/functions/v1/rede-veiculos-ativar-veiculo`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              veiculoId: veiculo.id,
              motivo,
              atualizarBancoLocal: true,
            }),
          }
        );

        const ativarResult = await ativarResponse.json();
        resultado.ativado = ativarResult.success === true;
        if (!resultado.ativado && ativarResult.error) {
          resultado.erros.push(`Ativar: ${ativarResult.error}`);
        }
      } catch (err) {
        console.error(`[RedeVeiculos AtivarClienteCompleto] Erro ao ativar ${veiculo.placa}:`, err);
        resultado.erros.push(`Ativar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }

      try {
        // 3.3 - Informar adimplência
        console.log(`[RedeVeiculos AtivarClienteCompleto] Informando adimplência para ${veiculo.placa}...`);
        const adimplenteResponse = await fetch(
          `${supabaseUrl}/functions/v1/rede-veiculos-informar-adimplente`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              associadoId,
              veiculoId: veiculo.id,
              motivo,
            }),
          }
        );

        const adimplenteResult = await adimplenteResponse.json();
        resultado.adimplente = adimplenteResult.success === true;
        if (!resultado.adimplente && adimplenteResult.error) {
          resultado.erros.push(`Adimplente: ${adimplenteResult.error}`);
        }
      } catch (err) {
        console.error(`[RedeVeiculos AtivarClienteCompleto] Erro ao informar adimplência ${veiculo.placa}:`, err);
        resultado.erros.push(`Adimplente: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }

      resultados.push(resultado);
    }

    // ===== 4. Registrar histórico do associado =====
    const veiculosComSucesso = resultados.filter(r => r.ativado || r.adimplente);
    const veiculosComErro = resultados.filter(r => r.erros.length > 0);

    await supabase.from('associados_historico').insert({
      associado_id: associadoId,
      tipo: 'cliente_ativado',
      descricao: `Cliente ativado na Rede Veículos. ${veiculosComSucesso.length}/${resultados.length} veículos processados.`,
      dados_novos: {
        motivo,
        revincular,
        resultados,
      },
    });

    const totalAtivados = resultados.filter(r => r.ativado).length;
    const totalVinculados = resultados.filter(r => r.vinculado).length;

    console.log(`[RedeVeiculos AtivarClienteCompleto] Concluído: ${totalAtivados} ativados, ${totalVinculados} vinculados`);

    return new Response(
      JSON.stringify({
        success: veiculosComErro.length === 0,
        veiculos_processados: resultados.length,
        veiculos_ativados: totalAtivados,
        veiculos_vinculados: totalVinculados,
        veiculos_com_erro: veiculosComErro.length,
        resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[RedeVeiculos AtivarClienteCompleto] Erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
