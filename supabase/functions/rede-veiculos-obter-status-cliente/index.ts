import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  associadoId: string;
  cpfCnpj?: string;
}

interface StatusClienteResponse {
  success: boolean;
  sincronizado: boolean;
  statusLocal: string;
  statusPlataforma?: string | null;
  dados: {
    idCliente?: number | null;
    statusPlataforma: string | null;
    dataUltimaAtualizacao?: string | null;
    veiculosVinculados: number;
    veiculosAtivos: number;
    veiculosInativos: number;
    adimplente: boolean | null;
  };
  erro?: string;
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
    const { associadoId, cpfCnpj } = body;

    console.log('[RedeVeiculos ObterStatusCliente] Iniciando:', { associadoId });

    if (!associadoId) {
      throw new Error('associadoId é obrigatório');
    }

    // 1. Buscar associado e seu ID na Rede Veículos
    const { data: associado, error: associadoError } = await supabase
      .from('associados')
      .select(`
        id,
        nome,
        cpf,
        status,
        updated_at
      `)
      .eq('id', associadoId)
      .single();

    if (associadoError || !associado) {
      throw new Error(`Associado não encontrado: ${associadoError?.message || 'ID inválido'}`);
    }

    // 2. Buscar veículos do associado vinculados à Rede Veículos
    const { data: veiculos, error: veiculosError } = await supabase
      .from('veiculos')
      .select(`
        id,
        placa,
        ativo,
        status,
        rede_veiculos_veiculo_id,
        rede_veiculos_cliente_id,
        rastreadores!inner (
          id,
          plataforma,
          status,
          ultima_comunicacao
        )
      `)
      .eq('associado_id', associadoId);

    // Filtrar apenas veículos com rastreador Rede Veículos
    const veiculosRedeVeiculos = (veiculos || []).filter((v: any) => 
      v.rastreadores?.some((r: any) => r.plataforma === 'rede_veiculos')
    );

    const veiculosAtivos = veiculosRedeVeiculos.filter((v: any) => 
      v.ativo && v.status === 'ativo'
    ).length;

    const veiculosInativos = veiculosRedeVeiculos.filter((v: any) => 
      !v.ativo || v.status !== 'ativo'
    ).length;

    // 3. Verificar se há algum ID na plataforma Rede Veículos
    const veiculoComIdPlataforma = veiculosRedeVeiculos.find((v: any) => 
      v.rede_veiculos_cliente_id
    );

    const idClientePlataforma = veiculoComIdPlataforma?.rede_veiculos_cliente_id 
      ? parseInt(veiculoComIdPlataforma.rede_veiculos_cliente_id, 10) 
      : null;

    // 4. Buscar configuração da plataforma
    const { data: plataforma, error: plataformaError } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*')
      .eq('plataforma', 'rede_veiculos')
      .single();

    let statusPlataforma: string | null = null;
    let dataUltimaAtualizacao: string | null = null;
    let adimplente: boolean | null = null;

    // 5. Se temos ID na plataforma, consultar status em tempo real
    if (idClientePlataforma && plataforma) {
      try {
        // Obter token de autenticação
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
        
        if (authData.success && authData.token) {
          const baseUrl = plataforma.ambiente_atual === 'producao'
            ? plataforma.api_url_producao
            : plataforma.api_url_sandbox;

          // Tentar buscar status de cada veículo para determinar status geral
          // A API Rede Veículos não tem endpoint /obterStatusCliente
          // Precisamos inferir pelo status dos veículos
          
          let todosVeiculosAtivos = true;
          let algumVeiculoAtivo = false;
          let algumInadimplente = false;

          for (const veiculo of veiculosRedeVeiculos) {
            if (veiculo.rede_veiculos_veiculo_id) {
              try {
                // Buscar posição/status do veículo
                const veiculoResponse = await fetch(
                  `${baseUrl}/veiculos/${veiculo.rede_veiculos_veiculo_id}/`,
                  {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${authData.token}`,
                    },
                  }
                );

                if (veiculoResponse.ok) {
                  const veiculoData = await veiculoResponse.json();
                  
                  // Determinar status do veículo
                  if (veiculoData.ativo === true || veiculoData.status === 'ativo') {
                    algumVeiculoAtivo = true;
                  } else {
                    todosVeiculosAtivos = false;
                  }

                  if (veiculoData.inadimplente === true) {
                    algumInadimplente = true;
                  }

                  // Atualizar data de última verificação
                  if (!dataUltimaAtualizacao) {
                    dataUltimaAtualizacao = new Date().toISOString();
                  }
                }
              } catch (err) {
                console.warn('[RedeVeiculos ObterStatusCliente] Erro ao consultar veículo:', veiculo.id, err);
              }
            }
          }

          // Determinar status geral
          if (veiculosRedeVeiculos.length === 0) {
            statusPlataforma = 'sem_veiculos';
          } else if (algumInadimplente) {
            statusPlataforma = 'inadimplente';
            adimplente = false;
          } else if (!algumVeiculoAtivo) {
            statusPlataforma = 'inativo';
            adimplente = null;
          } else if (todosVeiculosAtivos) {
            statusPlataforma = 'ativo';
            adimplente = true;
          } else {
            statusPlataforma = 'parcial'; // Alguns ativos, alguns inativos
            adimplente = true;
          }
        }
      } catch (apiError) {
        console.error('[RedeVeiculos ObterStatusCliente] Erro ao consultar API:', apiError);
        // Não falhar, apenas usar status local
      }
    }

    // 6. Registrar log da consulta
    await supabase.from('rastreadores_api_logs').insert({
      plataforma: 'rede_veiculos',
      operacao: 'obterStatusCliente',
      request: { associadoId, idClientePlataforma },
      response: { statusPlataforma, veiculosAtivos, veiculosInativos },
      status: 'sucesso',
    });

    // 7. Comparar status local com plataforma
    const statusLocal = associado.status;
    
    // Mapear status local para comparação
    const statusLocalNormalizado = ['ativo'].includes(statusLocal) ? 'ativo' 
      : ['suspenso', 'bloqueado'].includes(statusLocal) ? 'inativo'
      : ['inadimplente'].includes(statusLocal) ? 'inadimplente'
      : 'outro';

    const statusPlataformaNormalizado = statusPlataforma === 'ativo' || statusPlataforma === 'parcial' ? 'ativo'
      : statusPlataforma === 'inativo' ? 'inativo'
      : statusPlataforma === 'inadimplente' ? 'inadimplente'
      : 'desconhecido';

    // Cliente está sincronizado se não tem veículos na plataforma OU status é compatível
    const sincronizado = veiculosRedeVeiculos.length === 0 || 
      statusPlataforma === null || 
      statusLocalNormalizado === statusPlataformaNormalizado;

    const response: StatusClienteResponse = {
      success: true,
      sincronizado,
      statusLocal,
      statusPlataforma,
      dados: {
        idCliente: idClientePlataforma,
        statusPlataforma,
        dataUltimaAtualizacao,
        veiculosVinculados: veiculosRedeVeiculos.length,
        veiculosAtivos,
        veiculosInativos,
        adimplente,
      },
    };

    console.log('[RedeVeiculos ObterStatusCliente] Resposta:', response);

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[RedeVeiculos ObterStatusCliente] Erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        sincronizado: false,
        erro: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
