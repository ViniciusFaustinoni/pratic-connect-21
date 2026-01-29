import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  associadoId: string;
  motivo: 'cancelamento' | 'fraude' | 'inadimplencia' | 'exclusao';
  observacoes?: string;
  atualizarBancoLocal?: boolean;
  desvincular?: boolean; // Se true, desvincula após inativar
}

interface VeiculoComRastreador {
  id: string;
  placa: string;
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
    const { 
      associadoId, 
      motivo, 
      observacoes, 
      atualizarBancoLocal = true, 
      desvincular = false 
    } = body;

    console.log('[RedeVeiculos InativarClienteCompleto] Iniciando:', { associadoId, motivo, desvincular });

    if (!associadoId || !motivo) {
      throw new Error('associadoId e motivo são obrigatórios');
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

    console.log('[RedeVeiculos InativarClienteCompleto] Associado:', associado.nome);

    // ===== 2. Buscar todos veículos com rastreador Rede Veículos =====
    const { data: veiculos, error: veiculosError } = await supabase
      .from('veiculos')
      .select(`
        id, 
        placa, 
        rede_veiculos_veiculo_id,
        rastreadores!inner (
          id,
          imei,
          plataforma,
          status
        )
      `)
      .eq('associado_id', associadoId)
      .eq('rastreadores.plataforma', 'rede_veiculos')
      .eq('rastreadores.status', 'instalado');

    if (veiculosError) {
      throw new Error(`Erro ao buscar veículos: ${veiculosError.message}`);
    }

    if (!veiculos || veiculos.length === 0) {
      console.log('[RedeVeiculos InativarClienteCompleto] Nenhum veículo Rede Veículos encontrado');
      
      // Registrar histórico mesmo sem veículos
      await supabase.from('associados_historico').insert({
        associado_id: associadoId,
        tipo: 'cliente_inativado',
        descricao: `Cliente inativado por ${motivo}. Nenhum veículo Rede Veículos para processar.`,
        dados_novos: { motivo, observacoes },
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Nenhum veículo Rede Veículos para inativar',
          veiculos_processados: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`[RedeVeiculos InativarClienteCompleto] Encontrados ${veiculos.length} veículos`);

    // ===== 3. Para cada veículo: inativar + inadimplência + (opcionalmente) desvincular =====
    const resultados: Array<{
      veiculoId: string;
      placa: string;
      inativado: boolean;
      inadimplente: boolean;
      desvinculado: boolean;
      erros: string[];
    }> = [];

    for (const veiculo of veiculos as unknown as VeiculoComRastreador[]) {
      const resultado = {
        veiculoId: veiculo.id,
        placa: veiculo.placa,
        inativado: false,
        inadimplente: false,
        desvinculado: false,
        erros: [] as string[],
      };

      const rastreador = Array.isArray(veiculo.rastreadores) 
        ? veiculo.rastreadores[0] 
        : veiculo.rastreadores;

      try {
        // 3.1 - Inativar veículo na plataforma
        console.log(`[RedeVeiculos InativarClienteCompleto] Inativando veículo ${veiculo.placa}...`);
        const inativarResponse = await fetch(
          `${supabaseUrl}/functions/v1/rede-veiculos-inativar-veiculo`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              veiculoId: veiculo.id,
              motivo,
              observacoes,
              atualizarBancoLocal,
            }),
          }
        );

        const inativarResult = await inativarResponse.json();
        resultado.inativado = inativarResult.success === true;
        if (!resultado.inativado && inativarResult.error) {
          resultado.erros.push(`Inativar: ${inativarResult.error}`);
        }
      } catch (err) {
        console.error(`[RedeVeiculos InativarClienteCompleto] Erro ao inativar ${veiculo.placa}:`, err);
        resultado.erros.push(`Inativar: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }

      try {
        // 3.2 - Informar inadimplência (se motivo for inadimplência, fraude ou cancelamento)
        if (['inadimplencia', 'fraude', 'cancelamento', 'exclusao'].includes(motivo)) {
          console.log(`[RedeVeiculos InativarClienteCompleto] Informando inadimplência para ${veiculo.placa}...`);
          const inadimplenteResponse = await fetch(
            `${supabaseUrl}/functions/v1/rede-veiculos-informar-inadimplente`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                associadoId,
                veiculoId: veiculo.id,
                motivo: motivo === 'fraude' ? 'fraude_comprovada' : motivo,
              }),
            }
          );

          const inadimplenteResult = await inadimplenteResponse.json();
          resultado.inadimplente = inadimplenteResult.success === true;
          if (!resultado.inadimplente && inadimplenteResult.error) {
            resultado.erros.push(`Inadimplente: ${inadimplenteResult.error}`);
          }
        }
      } catch (err) {
        console.error(`[RedeVeiculos InativarClienteCompleto] Erro ao informar inadimplência ${veiculo.placa}:`, err);
        resultado.erros.push(`Inadimplente: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }

      try {
        // 3.3 - Desvincular (se solicitado - cancelamento definitivo ou exclusão)
        if (desvincular) {
          console.log(`[RedeVeiculos InativarClienteCompleto] Desvinculando veículo ${veiculo.placa}...`);
          const desvincularResponse = await fetch(
            `${supabaseUrl}/functions/v1/rede-veiculos-desvincular-cliente`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                rastreadorId: rastreador?.id,
                motivo: `${motivo}_via_orquestrador`,
                atualizarBancoLocal,
              }),
            }
          );

          const desvincularResult = await desvincularResponse.json();
          resultado.desvinculado = desvincularResult.success === true;
          if (!resultado.desvinculado && desvincularResult.error) {
            resultado.erros.push(`Desvincular: ${desvincularResult.error}`);
          }
        }
      } catch (err) {
        console.error(`[RedeVeiculos InativarClienteCompleto] Erro ao desvincular ${veiculo.placa}:`, err);
        resultado.erros.push(`Desvincular: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }

      resultados.push(resultado);
    }

    // ===== 4. Registrar histórico do associado =====
    const veiculosComSucesso = resultados.filter(r => r.inativado || r.desvinculado);
    const veiculosComErro = resultados.filter(r => r.erros.length > 0);

    await supabase.from('associados_historico').insert({
      associado_id: associadoId,
      tipo: 'cliente_inativado',
      descricao: `Cliente inativado na Rede Veículos por ${motivo}. ${veiculosComSucesso.length}/${resultados.length} veículos processados.`,
      dados_novos: {
        motivo,
        observacoes,
        desvincular,
        resultados,
      },
    });

    const totalInativados = resultados.filter(r => r.inativado).length;
    const totalDesvinculados = resultados.filter(r => r.desvinculado).length;

    console.log(`[RedeVeiculos InativarClienteCompleto] Concluído: ${totalInativados} inativados, ${totalDesvinculados} desvinculados`);

    return new Response(
      JSON.stringify({
        success: veiculosComErro.length === 0,
        veiculos_processados: resultados.length,
        veiculos_inativados: totalInativados,
        veiculos_desvinculados: totalDesvinculados,
        veiculos_com_erro: veiculosComErro.length,
        resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('[RedeVeiculos InativarClienteCompleto] Erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
