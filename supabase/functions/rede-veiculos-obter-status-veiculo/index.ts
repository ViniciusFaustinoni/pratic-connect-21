import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  veiculoId: string;
  placa?: string;
}

interface StatusVeiculoResponse {
  success: boolean;
  sincronizado: boolean;
  statusLocal: string;
  statusPlataforma?: string | null;
  dados: {
    idVeiculo?: number | null;
    statusPlataforma: string | null;
    adimplente: boolean | null;
    ultimaPosicao?: {
      latitude: number;
      longitude: number;
      dataHora: string;
    } | null;
    rastreadorAtivo: boolean;
    ultimaComunicacao?: string | null;
    ignicao?: boolean | null;
    velocidade?: number | null;
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
    const { veiculoId, placa } = body;

    console.log('[RedeVeiculos ObterStatusVeiculo] Iniciando:', { veiculoId, placa });

    if (!veiculoId && !placa) {
      throw new Error('veiculoId ou placa é obrigatório');
    }

    // 1. Buscar veículo
    let query = supabase
      .from('veiculos')
      .select(`
        id,
        placa,
        marca,
        modelo,
        ativo,
        status,
        rede_veiculos_veiculo_id,
        rede_veiculos_cliente_id,
        associado_id,
        associados (id, nome, status)
      `);

    if (veiculoId) {
      query = query.eq('id', veiculoId);
    } else if (placa) {
      query = query.eq('placa', placa.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    }

    const { data: veiculo, error: veiculoError } = await query.single();

    if (veiculoError || !veiculo) {
      throw new Error(`Veículo não encontrado: ${veiculoError?.message || 'ID/placa inválido'}`);
    }

    // 2. Buscar rastreador do veículo
    const { data: rastreador, error: rastreadorError } = await supabase
      .from('rastreadores')
      .select(`
        id,
        codigo,
        plataforma,
        status,
        ultima_posicao_lat,
        ultima_posicao_lng,
        ultima_comunicacao,
        ultima_velocidade,
        ultima_ignicao
      `)
      .eq('veiculo_id', veiculo.id)
      .eq('plataforma', 'rede_veiculos')
      .maybeSingle();

    let statusPlataforma: string | null = null;
    let adimplente: boolean | null = null;
    let ultimaPosicao: StatusVeiculoResponse['dados']['ultimaPosicao'] = null;
    let rastreadorAtivo = false;
    let ultimaComunicacao: string | null = null;
    let ignicao: boolean | null = null;
    let velocidade: number | null = null;

    // Se não tem rastreador Rede Veículos, retornar dados locais apenas
    if (!rastreador || !veiculo.rede_veiculos_veiculo_id) {
      const response: StatusVeiculoResponse = {
        success: true,
        sincronizado: true, // Não vinculado = consideramos sincronizado
        statusLocal: veiculo.status || (veiculo.ativo ? 'ativo' : 'inativo'),
        statusPlataforma: null,
        dados: {
          idVeiculo: null,
          statusPlataforma: null,
          adimplente: null,
          ultimaPosicao: null,
          rastreadorAtivo: false,
          ultimaComunicacao: null,
          ignicao: null,
          velocidade: null,
        },
      };

      return new Response(
        JSON.stringify(response),
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

    if (plataforma) {
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

          // 4. Consultar status/posição do veículo na API
          const veiculoResponse = await fetch(
            `${baseUrl}/veiculos/${veiculo.rede_veiculos_veiculo_id}/posicao/`,
            {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${authData.token}`,
              },
            }
          );

          if (veiculoResponse.ok) {
            const veiculoData = await veiculoResponse.json();
            
            console.log('[RedeVeiculos ObterStatusVeiculo] Resposta API:', veiculoData);

            // Interpretar resposta
            if (veiculoData.latitude && veiculoData.longitude) {
              ultimaPosicao = {
                latitude: parseFloat(veiculoData.latitude),
                longitude: parseFloat(veiculoData.longitude),
                dataHora: veiculoData.dataHora || veiculoData.data_posicao || new Date().toISOString(),
              };
              rastreadorAtivo = true;
            }

            // Status do veículo
            if (veiculoData.status) {
              statusPlataforma = veiculoData.status;
            } else if (veiculoData.ativo !== undefined) {
              statusPlataforma = veiculoData.ativo ? 'ativo' : 'inativo';
            } else {
              // Se conseguimos posição, consideramos ativo
              statusPlataforma = ultimaPosicao ? 'ativo' : 'desconhecido';
            }

            // Adimplência
            if (veiculoData.inadimplente !== undefined) {
              adimplente = !veiculoData.inadimplente;
            } else if (veiculoData.adimplente !== undefined) {
              adimplente = veiculoData.adimplente;
            }

            // Outros campos
            ignicao = veiculoData.ignicao ?? veiculoData.ignicaoLigada ?? null;
            velocidade = veiculoData.velocidade ?? null;
            ultimaComunicacao = veiculoData.dataHora || veiculoData.data_posicao || null;

            // Atualizar dados locais do rastreador
            await supabase
              .from('rastreadores')
              .update({
                ultima_posicao_lat: ultimaPosicao?.latitude,
                ultima_posicao_lng: ultimaPosicao?.longitude,
                ultima_comunicacao: ultimaComunicacao,
                ultima_velocidade: velocidade,
                ultima_ignicao: ignicao,
              })
              .eq('id', rastreador.id);
          } else {
            console.warn('[RedeVeiculos ObterStatusVeiculo] API retornou erro:', veiculoResponse.status);
            // Usar dados do cache
            if (rastreador.ultima_posicao_lat && rastreador.ultima_posicao_lng) {
              ultimaPosicao = {
                latitude: rastreador.ultima_posicao_lat,
                longitude: rastreador.ultima_posicao_lng,
                dataHora: rastreador.ultima_comunicacao || '',
              };
            }
            ultimaComunicacao = rastreador.ultima_comunicacao;
            velocidade = rastreador.ultima_velocidade;
            ignicao = rastreador.ultima_ignicao;
            rastreadorAtivo = rastreador.status === 'instalado';
          }
        }
      } catch (apiError) {
        console.error('[RedeVeiculos ObterStatusVeiculo] Erro ao consultar API:', apiError);
        // Usar dados do cache
        if (rastreador?.ultima_posicao_lat && rastreador?.ultima_posicao_lng) {
          ultimaPosicao = {
            latitude: rastreador.ultima_posicao_lat,
            longitude: rastreador.ultima_posicao_lng,
            dataHora: rastreador.ultima_comunicacao || '',
          };
        }
        ultimaComunicacao = rastreador?.ultima_comunicacao || null;
        velocidade = rastreador?.ultima_velocidade || null;
        ignicao = rastreador?.ultima_ignicao || null;
        rastreadorAtivo = rastreador?.status === 'instalado';
      }
    }

    // 5. Registrar log da consulta
    await supabase.from('rastreadores_api_logs').insert({
      plataforma: 'rede_veiculos',
      operacao: 'obterStatusVeiculo',
      request: { veiculoId, placa, idPlataforma: veiculo.rede_veiculos_veiculo_id },
      response: { statusPlataforma, adimplente, temPosicao: !!ultimaPosicao },
      status: 'sucesso',
    });

    // 6. Comparar status local com plataforma
    const statusLocal = veiculo.status || (veiculo.ativo ? 'ativo' : 'inativo');
    
    // Normalizar para comparação
    const statusLocalNormalizado = statusLocal === 'ativo' ? 'ativo' : 'inativo';
    const statusPlataformaNormalizado = statusPlataforma === 'ativo' ? 'ativo' 
      : statusPlataforma === 'inativo' ? 'inativo' 
      : 'desconhecido';

    const sincronizado = statusPlataforma === null || 
      statusPlataformaNormalizado === 'desconhecido' ||
      statusLocalNormalizado === statusPlataformaNormalizado;

    const response: StatusVeiculoResponse = {
      success: true,
      sincronizado,
      statusLocal,
      statusPlataforma,
      dados: {
        idVeiculo: veiculo.rede_veiculos_veiculo_id ? parseInt(veiculo.rede_veiculos_veiculo_id, 10) : null,
        statusPlataforma,
        adimplente,
        ultimaPosicao,
        rastreadorAtivo,
        ultimaComunicacao,
        ignicao,
        velocidade,
      },
    };

    console.log('[RedeVeiculos ObterStatusVeiculo] Resposta:', response);

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[RedeVeiculos ObterStatusVeiculo] Erro:', error);

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
