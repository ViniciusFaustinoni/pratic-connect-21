import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  associadoId: string;
  forcarAtualizacao?: boolean;
}

interface SincronizacaoResult {
  success: boolean;
  associadoId: string;
  diferencasEncontradas: {
    tipo: 'associado' | 'veiculo';
    id: string;
    statusLocal: string;
    statusPlataforma: string;
    atualizado: boolean;
  }[];
  veiculosSincronizados: number;
  erros: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const result: SincronizacaoResult = {
    success: true,
    associadoId: '',
    diferencasEncontradas: [],
    veiculosSincronizados: 0,
    erros: [],
  };

  try {
    const body = await req.json() as RequestBody;
    const { associadoId, forcarAtualizacao = false } = body;

    console.log('[RedeVeiculos Sincronizar] Iniciando:', { associadoId, forcarAtualizacao });

    if (!associadoId) {
      throw new Error('associadoId é obrigatório');
    }

    result.associadoId = associadoId;

    // 1. Buscar associado
    const { data: associado, error: associadoError } = await supabase
      .from('associados')
      .select(`
        id,
        nome,
        status
      `)
      .eq('id', associadoId)
      .single();

    if (associadoError || !associado) {
      throw new Error(`Associado não encontrado: ${associadoError?.message || 'ID inválido'}`);
    }

    // 2. Buscar veículos com rastreador Rede Veículos
    const { data: veiculos, error: veiculosError } = await supabase
      .from('veiculos')
      .select(`
        id,
        placa,
        ativo,
        status,
        rede_veiculos_veiculo_id,
        rede_veiculos_cliente_id
      `)
      .eq('associado_id', associadoId)
      .not('rede_veiculos_veiculo_id', 'is', null);

    if (!veiculos || veiculos.length === 0) {
      console.log('[RedeVeiculos Sincronizar] Nenhum veículo vinculado à plataforma');
      return new Response(
        JSON.stringify({
          ...result,
          success: true,
          veiculosSincronizados: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // 3. Buscar configuração da plataforma
    const { data: plataforma, error: plataformaError } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*')
      .eq('plataforma', 'rede_veiculos')
      .single();

    if (!plataforma) {
      throw new Error('Configuração da plataforma Rede Veículos não encontrada');
    }

    // 4. Obter token de autenticação
    const authResponse = await fetch(
      `${supabaseUrl}/functions/v1/rastreador-auth`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ plataforma_codigo: 'rede_veiculos' })
      }
    );

    const authData = await authResponse.json();
    if (!authData.success) {
      throw new Error('Falha na autenticação com Rede Veículos: ' + authData.error);
    }

    const token = authData.token;
    const baseUrl = plataforma.ambiente_atual === 'producao'
      ? plataforma.api_url_producao
      : plataforma.api_url_sandbox;

    console.log('[RedeVeiculos Sincronizar] Autenticado, verificando', veiculos.length, 'veículos');

    // 5. Consultar e sincronizar cada veículo
    for (const veiculo of veiculos) {
      try {
        // Consultar status na API
        const veiculoResponse = await fetch(
          `${baseUrl}/veiculos/${veiculo.rede_veiculos_veiculo_id}/posicao/`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (veiculoResponse.ok) {
          const veiculoData = await veiculoResponse.json();
          
          // Determinar status na plataforma
          let statusPlataforma = 'desconhecido';
          if (veiculoData.status) {
            statusPlataforma = veiculoData.status;
          } else if (veiculoData.ativo !== undefined) {
            statusPlataforma = veiculoData.ativo ? 'ativo' : 'inativo';
          } else if (veiculoData.latitude && veiculoData.longitude) {
            statusPlataforma = 'ativo'; // Se tem posição, está ativo
          }

          const statusLocal = veiculo.status || (veiculo.ativo ? 'ativo' : 'inativo');
          const statusLocalNorm = statusLocal === 'ativo' ? 'ativo' : 'inativo';
          const statusPlataformaNorm = statusPlataforma === 'ativo' ? 'ativo' : 'inativo';

          // Verificar se há diferença
          if (statusLocalNorm !== statusPlataformaNorm) {
            result.diferencasEncontradas.push({
              tipo: 'veiculo',
              id: veiculo.id,
              statusLocal,
              statusPlataforma,
              atualizado: forcarAtualizacao,
            });

            // Se forçar atualização, atualizar o banco local
            if (forcarAtualizacao) {
              const novoStatus = statusPlataformaNorm === 'ativo' ? 'ativo' : 'suspenso';
              
              await supabase
                .from('veiculos')
                .update({
                  status: novoStatus,
                  ativo: statusPlataformaNorm === 'ativo',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', veiculo.id);

              // Registrar histórico
              await supabase.from('associados_historico').insert({
                associado_id: associadoId,
                tipo: 'sincronizacao_plataforma',
                descricao: `Veículo ${veiculo.placa} sincronizado. Status alterado de ${statusLocal} para ${novoStatus} (plataforma: ${statusPlataforma})`,
                veiculo_id: veiculo.id,
                dados_anteriores: { status: statusLocal },
                dados_novos: { status: novoStatus, statusPlataforma },
              });
            }
          }

          result.veiculosSincronizados++;

          // Atualizar posição do rastreador se disponível
          if (veiculoData.latitude && veiculoData.longitude) {
            await supabase
              .from('rastreadores')
              .update({
                ultima_posicao_lat: parseFloat(veiculoData.latitude),
                ultima_posicao_lng: parseFloat(veiculoData.longitude),
                ultima_comunicacao: veiculoData.dataHora || new Date().toISOString(),
                ultima_velocidade: veiculoData.velocidade || null,
                ultima_ignicao: veiculoData.ignicao ?? veiculoData.ignicaoLigada ?? null,
              })
              .eq('veiculo_id', veiculo.id)
              .eq('plataforma', 'rede_veiculos');
          }
        } else {
          result.erros.push(`Erro ao consultar veículo ${veiculo.placa}: HTTP ${veiculoResponse.status}`);
        }
      } catch (err) {
        result.erros.push(`Erro ao processar veículo ${veiculo.placa}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      }
    }

    // 6. Verificar status geral do associado
    // Se todos os veículos estão inativos na plataforma, considerar associado como suspenso
    if (result.veiculosSincronizados > 0 && forcarAtualizacao) {
      const veiculosAtivosPlataforma = result.diferencasEncontradas.filter(
        d => d.tipo === 'veiculo' && d.statusPlataforma === 'ativo'
      ).length;

      const veiculosSemDiferenca = result.veiculosSincronizados - result.diferencasEncontradas.filter(d => d.tipo === 'veiculo').length;
      const todosInativos = veiculosAtivosPlataforma === 0 && veiculosSemDiferenca === 0;

      if (todosInativos && associado.status === 'ativo') {
        result.diferencasEncontradas.push({
          tipo: 'associado',
          id: associadoId,
          statusLocal: associado.status,
          statusPlataforma: 'inativo',
          atualizado: forcarAtualizacao,
        });

        // Suspender associado localmente
        await supabase
          .from('associados')
          .update({
            status: 'suspenso',
            updated_at: new Date().toISOString(),
          })
          .eq('id', associadoId);

        // Registrar histórico
        await supabase.from('associados_historico').insert({
          associado_id: associadoId,
          tipo: 'sincronizacao_plataforma',
          descricao: 'Associado suspenso automaticamente: todos os veículos inativos na plataforma Rede Veículos',
          dados_anteriores: { status: associado.status },
          dados_novos: { status: 'suspenso' },
        });
      }
    }

    // 7. Registrar log da sincronização
    await supabase.from('rastreadores_api_logs').insert({
      plataforma: 'rede_veiculos',
      operacao: 'sincronizarStatus',
      request: { associadoId, forcarAtualizacao },
      response: result,
      status: result.erros.length === 0 ? 'sucesso' : 'parcial',
      erro_mensagem: result.erros.length > 0 ? result.erros.join('; ') : null,
    });

    console.log('[RedeVeiculos Sincronizar] Concluído:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[RedeVeiculos Sincronizar] Erro:', error);

    return new Response(
      JSON.stringify({
        ...result,
        success: false,
        erros: [...result.erros, error instanceof Error ? error.message : 'Erro desconhecido'],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
