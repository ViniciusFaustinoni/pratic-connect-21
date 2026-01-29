import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  veiculoId: string;
  motivo?: string;
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
    const { veiculoId, motivo } = body;

    console.log('[RedeVeiculos Ativar] Iniciando ativação:', { veiculoId, motivo });

    if (!veiculoId) {
      throw new Error('veiculoId é obrigatório');
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
      throw new Error(`Veículo ${veiculo.placa} não possui ID na Rede Veículos. Vincule primeiro.`);
    }

    console.log('[RedeVeiculos Ativar] Veículo encontrado:', veiculo.placa);

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

    console.log('[RedeVeiculos Ativar] Autenticado, ambiente:', plataforma.ambiente_atual);

    // 4. Montar payload para API Rede Veículos
    const payload = {
      idVeiculo: parseInt(veiculo.rede_veiculos_veiculo_id, 10),
    };

    console.log('[RedeVeiculos Ativar] Payload:', JSON.stringify(payload));

    // 5. Chamar API Rede Veículos - POST /ativarVeiculo
    const formData = new URLSearchParams();
    formData.append('json', JSON.stringify(payload));

    const apiResponse = await fetch(`${baseUrl}/ativarVeiculo/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    const responseText = await apiResponse.text();
    console.log('[RedeVeiculos Ativar] Resposta API:', responseText);

    let apiResult: { codigo: number; msg: string };
    try {
      apiResult = JSON.parse(responseText);
    } catch {
      throw new Error(`Resposta inválida da API: ${responseText}`);
    }

    // Registrar log da operação
    await supabase.from('rastreadores_api_logs').insert({
      plataforma: 'rede_veiculos',
      operacao: 'ativarVeiculo',
      request: payload,
      response: apiResult,
      status: apiResult.codigo === 1 ? 'sucesso' : 'erro',
      erro_mensagem: apiResult.codigo !== 1 ? apiResult.msg : null,
    });

    // Verificar código de resposta
    if (apiResult.codigo !== 1) {
      throw new Error(`Erro na API Rede Veículos: ${apiResult.msg} (código: ${apiResult.codigo})`);
    }

    console.log('[RedeVeiculos Ativar] Ativação bem sucedida');

    // 6. Atualizar veículo local
    await supabase
      .from('veiculos')
      .update({
        ativo: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', veiculoId);

    // 7. Registrar histórico
    if (veiculo.associado_id) {
      await supabase.from('associados_historico').insert({
        associado_id: veiculo.associado_id,
        tipo: 'veiculo_ativado',
        descricao: `Veículo ${veiculo.placa} ativado na plataforma Rede Veículos. Motivo: ${motivo || 'Não especificado'}`,
        veiculo_id: veiculoId,
        dados_novos: { ativo: true, motivo },
      });
    }

    console.log('[RedeVeiculos Ativar] Processo concluído com sucesso');

    return new Response(
      JSON.stringify({
        success: true,
        veiculoId,
        placa: veiculo.placa,
        mensagem: 'Veículo ativado com sucesso na Rede Veículos',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[RedeVeiculos Ativar] Erro:', error);

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
