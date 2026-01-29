import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  imei?: string;
  rastreadorId?: string;
  motivo?: string;
  atualizarBancoLocal?: boolean;
}

interface DesvincularPayload {
  imei: string;
  cpfCnpj: string;
  placa: string;
  chassi?: string;
  motivo: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const redeVeiculosToken = Deno.env.get('REDE_VEICULOS_TOKEN');

    if (!redeVeiculosToken) {
      console.error('REDE_VEICULOS_TOKEN não configurado');
      return new Response(
        JSON.stringify({ success: false, error: 'Token Rede Veículos não configurado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body: RequestBody = await req.json();
    const { imei, rastreadorId, motivo = 'desvinculacao_manual', atualizarBancoLocal = true } = body;

    console.log('=== REDE VEÍCULOS: DESVINCULAR CLIENTE ===');
    console.log('Payload recebido:', JSON.stringify(body));

    if (!imei && !rastreadorId) {
      return new Response(
        JSON.stringify({ success: false, error: 'IMEI ou rastreadorId é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Buscar rastreador por IMEI ou ID
    let rastreadorQuery = supabase
      .from('rastreadores')
      .select('id, imei, codigo, plataforma, veiculo_id, id_plataforma');

    if (imei) {
      rastreadorQuery = rastreadorQuery.eq('imei', imei);
    } else if (rastreadorId) {
      rastreadorQuery = rastreadorQuery.eq('id', rastreadorId);
    }

    const { data: rastreador, error: rastreadorError } = await rastreadorQuery.maybeSingle();

    if (rastreadorError || !rastreador) {
      console.error('Rastreador não encontrado:', rastreadorError);
      return new Response(
        JSON.stringify({ success: false, error: 'Rastreador não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('Rastreador encontrado:', rastreador.codigo, 'Plataforma:', rastreador.plataforma);

    // Validar que é plataforma rede_veiculos
    if (rastreador.plataforma !== 'rede_veiculos') {
      console.log('Rastreador não é da plataforma Rede Veículos, pulando desvinculação na API');
      
      // Ainda atualiza o banco local se solicitado
      if (atualizarBancoLocal) {
        await supabase
          .from('rastreadores')
          .update({
            veiculo_id: null,
            status: 'estoque',
            updated_at: new Date().toISOString(),
          })
          .eq('id', rastreador.id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Rastreador não é Rede Veículos, atualizado apenas localmente',
          plataforma: rastreador.plataforma 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar veículo vinculado
    let veiculo = null;
    let associado = null;

    if (rastreador.veiculo_id) {
      const { data: veiculoData } = await supabase
        .from('veiculos')
        .select('id, placa, chassi, marca, modelo, rede_veiculos_cliente_id, rede_veiculos_veiculo_id, associado_id')
        .eq('id', rastreador.veiculo_id)
        .maybeSingle();
      
      veiculo = veiculoData;

      if (veiculoData?.associado_id) {
        const { data: associadoData } = await supabase
          .from('associados')
          .select('id, cpf, nome, email, telefone')
          .eq('id', veiculoData.associado_id)
          .maybeSingle();
        
        associado = associadoData;
      }
    }

    if (!veiculo || !associado) {
      console.log('Rastreador não está vinculado a veículo/associado');
      
      if (atualizarBancoLocal) {
        await supabase
          .from('rastreadores')
          .update({
            veiculo_id: null,
            status: 'estoque',
            id_plataforma: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', rastreador.id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Rastreador não estava vinculado, atualizado localmente' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração da plataforma
    const { data: configPlataforma } = await supabase
      .from('rastreadores_config_plataformas')
      .select('*')
      .eq('plataforma', 'rede_veiculos')
      .eq('ativa', true)
      .maybeSingle();

    if (!configPlataforma) {
      console.error('Configuração da plataforma Rede Veículos não encontrada');
      return new Response(
        JSON.stringify({ success: false, error: 'Plataforma Rede Veículos não configurada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Determinar URL base (sandbox ou produção)
    const apiUrl = configPlataforma.ambiente_atual === 'producao'
      ? configPlataforma.api_url_producao
      : configPlataforma.api_url_sandbox;

    // Preparar payload para API Rede Veículos
    const desvincularPayload: DesvincularPayload = {
      imei: rastreador.imei!,
      cpfCnpj: associado.cpf.replace(/\D/g, ''),
      placa: veiculo.placa.replace(/\D/g, '').toUpperCase(),
      motivo: motivo,
    };

    if (veiculo.chassi) {
      desvincularPayload.chassi = veiculo.chassi.toUpperCase();
    }

    console.log('Payload para API Rede Veículos:', JSON.stringify(desvincularPayload));

    // Chamar API Rede Veículos - POST /desvincularClienteVeiculo
    const formData = new FormData();
    formData.append('imei', desvincularPayload.imei);
    formData.append('cpfCnpj', desvincularPayload.cpfCnpj);
    formData.append('placa', desvincularPayload.placa);
    if (desvincularPayload.chassi) {
      formData.append('chassi', desvincularPayload.chassi);
    }
    formData.append('motivo', desvincularPayload.motivo);

    let apiResponse;
    let apiResponseBody;
    let apiSuccess = false;

    try {
      console.log(`Chamando API: ${apiUrl}/desvincularClienteVeiculo`);
      
      apiResponse = await fetch(`${apiUrl}/desvincularClienteVeiculo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${redeVeiculosToken}`,
        },
        body: formData,
      });

      apiResponseBody = await apiResponse.text();
      console.log('Resposta da API:', apiResponse.status, apiResponseBody);

      // Tentar parsear como JSON
      try {
        apiResponseBody = JSON.parse(apiResponseBody);
      } catch {
        // Se não for JSON, manter como string
      }

      apiSuccess = apiResponse.ok;
    } catch (apiError) {
      console.error('Erro ao chamar API Rede Veículos:', apiError);
      apiResponseBody = { error: String(apiError) };
    }

    // Registrar log da operação
    const tempoResposta = Date.now() - startTime;
    await supabase.from('rastreadores_api_logs').insert({
      rastreador_id: rastreador.id,
      plataforma: 'rede_veiculos',
      operacao: 'desvincular_cliente_veiculo',
      request: desvincularPayload,
      response: apiResponseBody,
      status: apiSuccess ? 'sucesso' : 'erro',
      tempo_resposta_ms: tempoResposta,
      erro_mensagem: !apiSuccess ? (typeof apiResponseBody === 'string' ? apiResponseBody : apiResponseBody?.error) : null,
    });

    // Atualizar banco local mesmo se API falhar (para manter consistência local)
    if (atualizarBancoLocal) {
      console.log('Atualizando banco local...');
      
      // Atualizar rastreador
      const { error: updateRastreadorError } = await supabase
        .from('rastreadores')
        .update({
          veiculo_id: null,
          status: 'estoque',
          id_plataforma: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rastreador.id);

      if (updateRastreadorError) {
        console.error('Erro ao atualizar rastreador:', updateRastreadorError);
      }

      // Limpar IDs da plataforma no veículo
      const { error: updateVeiculoError } = await supabase
        .from('veiculos')
        .update({
          rede_veiculos_cliente_id: null,
          rede_veiculos_veiculo_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', veiculo.id);

      if (updateVeiculoError) {
        console.error('Erro ao limpar IDs do veículo:', updateVeiculoError);
      }

      // Registrar movimentação
      await supabase.from('rastreadores_movimentacoes').insert({
        rastreador_id: rastreador.id,
        tipo: 'desinstalacao',
        origem_status: 'instalado',
        destino_status: 'estoque',
        veiculo_id: veiculo.id,
        observacoes: `Desvinculado da plataforma Rede Veículos. Motivo: ${motivo}`,
      });
    }

    console.log('=== DESVINCULAÇÃO CONCLUÍDA ===');
    console.log('API Success:', apiSuccess);
    console.log('Banco local atualizado:', atualizarBancoLocal);

    return new Response(
      JSON.stringify({
        success: true,
        apiSuccess,
        message: apiSuccess 
          ? 'Equipamento desvinculado com sucesso na plataforma e localmente'
          : 'Equipamento desvinculado localmente (API pode ter falhado)',
        rastreadorId: rastreador.id,
        codigo: rastreador.codigo,
        veiculoPlaca: veiculo.placa,
        associadoNome: associado.nome,
        tempoResposta: tempoResposta,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro geral na desvinculação:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
