import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  veiculoId: string;
  motivo: 'perda_total' | 'cancelamento' | 'suspensao_temporaria' | 'venda' | 'outro';
  observacoes?: string;
  atualizarBancoLocal?: boolean;
}

const motivoDescricao: Record<string, string> = {
  perda_total: 'Perda total do veículo (sinistro)',
  cancelamento: 'Cancelamento do contrato',
  suspensao_temporaria: 'Suspensão temporária por solicitação',
  venda: 'Venda do veículo',
  outro: 'Outro motivo',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json() as RequestBody;
    const { veiculoId, motivo, observacoes, atualizarBancoLocal = true } = body;

    console.log('[RedeVeiculos Inativar] Iniciando inativação:', { veiculoId, motivo });

    if (!veiculoId) {
      throw new Error('veiculoId é obrigatório');
    }

    if (!motivo) {
      throw new Error('motivo é obrigatório');
    }

    // 1. Buscar veículo com ID da Rede Veículos
    const { data: veiculo, error: veiculoError } = await supabase
      .from('veiculos')
      .select(`
        id, 
        placa, 
        marca, 
        modelo,
        rede_veiculos_veiculo_id,
        rede_veiculos_cliente_id,
        associado_id,
        associados (id, nome, cpf)
      `)
      .eq('id', veiculoId)
      .single();

    if (veiculoError || !veiculo) {
      throw new Error(`Veículo não encontrado: ${veiculoError?.message || 'ID inválido'}`);
    }

    if (!veiculo.rede_veiculos_veiculo_id) {
      // Se não tem ID na Rede Veículos, apenas atualizar localmente
      console.log('[RedeVeiculos Inativar] Veículo não vinculado à Rede Veículos, atualizando apenas localmente');
      
      if (atualizarBancoLocal) {
        await supabase
          .from('veiculos')
          .update({
            ativo: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', veiculoId);
      }
      
      return new Response(
        JSON.stringify({
          success: true,
          veiculoId,
          placa: veiculo.placa,
          apiSuccess: false,
          mensagem: 'Veículo inativado localmente (não vinculado à plataforma)',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('[RedeVeiculos Inativar] Veículo encontrado:', veiculo.placa);

    // 2. Buscar configuração da plataforma
    const { data: plataforma, error: plataformaError } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*')
      .eq('plataforma', 'rede_veiculos')
      .single();

    if (plataformaError || !plataforma) {
      throw new Error('Configuração da plataforma Rede Veículos não encontrada');
    }

    // 3. Obter token de autenticação
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

    console.log('[RedeVeiculos Inativar] Autenticado, ambiente:', plataforma.ambiente_atual);

    // 4. Montar payload para API Rede Veículos
    const payload = {
      idVeiculo: parseInt(veiculo.rede_veiculos_veiculo_id, 10),
      motivo: motivoDescricao[motivo] || motivo,
      observacoes: observacoes || undefined,
    };

    console.log('[RedeVeiculos Inativar] Payload:', JSON.stringify(payload));

    // 5. Chamar API Rede Veículos - POST /inativarVeiculo
    const formData = new URLSearchParams();
    formData.append('json', JSON.stringify(payload));

    const apiResponse = await fetch(`${baseUrl}/inativarVeiculo/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseText = await apiResponse.text();
    console.log('[RedeVeiculos Inativar] Resposta API:', responseText);

    let apiResult: { codigo: number; msg: string };
    try {
      apiResult = JSON.parse(responseText);
    } catch {
      throw new Error(`Resposta inválida da API: ${responseText}`);
    }

    // Registrar log da operação
    await supabase.from('rastreadores_api_logs').insert({
      plataforma: 'rede_veiculos',
      operacao: 'inativarVeiculo',
      request: payload,
      response: apiResult,
      status: apiResult.codigo === 1 ? 'sucesso' : 'erro',
      erro_mensagem: apiResult.codigo !== 1 ? apiResult.msg : null,
    });

    const apiSuccess = apiResult.codigo === 1;

    // Mesmo se API falhar, atualizar localmente se solicitado
    if (atualizarBancoLocal) {
      // 6. Atualizar veículo local
      await supabase
        .from('veiculos')
        .update({
          ativo: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', veiculoId);

      // 7. Registrar histórico
      if (veiculo.associado_id) {
        await supabase.from('associados_historico').insert({
          associado_id: veiculo.associado_id,
          tipo: 'veiculo_inativado',
          descricao: `Veículo ${veiculo.placa} inativado. Motivo: ${motivoDescricao[motivo] || motivo}${observacoes ? `. ${observacoes}` : ''}`,
          veiculo_id: veiculoId,
          dados_anteriores: { ativo: true },
          dados_novos: { ativo: false, motivo, observacoes },
        });
      }
    }

    console.log('[RedeVeiculos Inativar] Processo concluído');

    if (!apiSuccess) {
      return new Response(
        JSON.stringify({
          success: true,
          veiculoId,
          placa: veiculo.placa,
          apiSuccess: false,
          mensagem: `Veículo inativado localmente. Erro na API: ${apiResult.msg}`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        veiculoId,
        placa: veiculo.placa,
        apiSuccess: true,
        mensagem: 'Veículo inativado com sucesso na Rede Veículos',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[RedeVeiculos Inativar] Erro:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
