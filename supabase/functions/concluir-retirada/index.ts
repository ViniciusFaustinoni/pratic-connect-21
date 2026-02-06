import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  servicoId: string;
  rastreadorId: string;
  veiculoId: string;
  profissionalId: string;
  hodometro?: number;
  assinaturaUrl?: string;
  observacoes?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: RequestBody = await req.json();
    const { servicoId, rastreadorId, veiculoId, profissionalId, hodometro, assinaturaUrl, observacoes } = body;

    console.log('=== CONCLUIR RETIRADA DE RASTREADOR ===');
    console.log('Payload:', JSON.stringify(body));

    if (!servicoId || !rastreadorId || !veiculoId || !profissionalId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parâmetros obrigatórios não informados' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 1. Buscar dados do rastreador
    const { data: rastreador, error: rastreadorError } = await supabase
      .from('rastreadores')
      .select('id, imei, codigo, plataforma, veiculo_id, id_plataforma, status')
      .eq('id', rastreadorId)
      .single();

    if (rastreadorError || !rastreador) {
      console.error('Rastreador não encontrado:', rastreadorError);
      return new Response(
        JSON.stringify({ success: false, error: 'Rastreador não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('Rastreador encontrado:', rastreador.codigo, 'Plataforma:', rastreador.plataforma);

    // 2. Buscar dados do veículo e associado
    const { data: veiculo } = await supabase
      .from('veiculos')
      .select('id, placa, associado_id, rede_veiculos_cliente_id, rede_veiculos_veiculo_id')
      .eq('id', veiculoId)
      .single();

    let associado = null;
    if (veiculo?.associado_id) {
      const { data: associadoData } = await supabase
        .from('associados')
        .select('id, cpf, nome')
        .eq('id', veiculo.associado_id)
        .single();
      associado = associadoData;
    }

    // 3. Desativar na plataforma externa (se aplicável)
    let plataformaDesativada = false;
    let plataformaErro = null;

    if (rastreador.plataforma === 'rede_veiculos' && rastreador.imei) {
      console.log('Desvinculando da plataforma Rede Veículos...');
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/rede-veiculos-desvincular-cliente`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            rastreadorId: rastreador.id,
            motivo: 'retirada_rastreador',
            atualizarBancoLocal: false, // Faremos isso manualmente
          }),
        });

        const result = await response.json();
        console.log('Resposta Rede Veículos:', result);
        plataformaDesativada = result.success || result.apiSuccess;
        if (!plataformaDesativada) {
          plataformaErro = result.error || 'Erro desconhecido';
        }
      } catch (err) {
        console.error('Erro ao chamar rede-veiculos-desvincular-cliente:', err);
        plataformaErro = String(err);
      }
    } else if (rastreador.plataforma === 'softruck') {
      console.log('Desativando na plataforma Softruck...');
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/softruck-api`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            operation: 'deactivate_device',
            deviceId: rastreador.id_plataforma || rastreador.imei,
          }),
        });

        const result = await response.json();
        console.log('Resposta Softruck:', result);
        plataformaDesativada = result.success;
        if (!plataformaDesativada) {
          plataformaErro = result.error || 'Erro desconhecido';
        }
      } catch (err) {
        console.error('Erro ao chamar softruck-api:', err);
        plataformaErro = String(err);
      }
    } else {
      console.log('Rastreador não possui plataforma externa para desativar');
      plataformaDesativada = true;
    }

    // 4. Atualizar rastreador: status = estoque, veiculo_id = null, portador_id = profissional
    const { error: updateRastreadorError } = await supabase
      .from('rastreadores')
      .update({
        status: 'estoque',
        veiculo_id: null,
        portador_id: profissionalId,
        id_plataforma: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rastreadorId);

    if (updateRastreadorError) {
      console.error('Erro ao atualizar rastreador:', updateRastreadorError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao atualizar rastreador' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 5. Limpar IDs de plataforma do veículo
    if (veiculo) {
      await supabase
        .from('veiculos')
        .update({
          rede_veiculos_cliente_id: null,
          rede_veiculos_veiculo_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', veiculoId);
    }

    // 6. Registrar movimentação de estoque
    await supabase.from('estoque_movimentacoes').insert({
      tipo: 'desinstalacao',
      quantidade: 1,
      status_anterior: 'instalado',
      status_novo: 'estoque',
      rastreador_id: rastreadorId,
      observacoes: `Retirada de rastreador. ${observacoes || ''}`.trim(),
    });

    // 7. Registrar movimentação no histórico de rastreadores
    await supabase.from('rastreadores_movimentacoes').insert({
      rastreador_id: rastreadorId,
      tipo: 'desinstalacao',
      origem_status: 'instalado',
      destino_status: 'estoque',
      veiculo_id: veiculoId,
      observacoes: `Retirada realizada. Rastreador atribuído ao portador. ${observacoes || ''}`.trim(),
    });

    // 8. Concluir serviço
    const { error: updateServicoError } = await supabase
      .from('servicos')
      .update({
        status: 'concluida',
        concluida_em: new Date().toISOString(),
        km_atual: hodometro || null,
        assinatura_cliente_url: assinaturaUrl || null,
        observacoes: observacoes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', servicoId);

    if (updateServicoError) {
      console.error('Erro ao concluir serviço:', updateServicoError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao concluir serviço' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const tempoTotal = Date.now() - startTime;
    console.log('=== RETIRADA CONCLUÍDA COM SUCESSO ===');
    console.log('Tempo total:', tempoTotal, 'ms');
    console.log('Plataforma desativada:', plataformaDesativada);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Retirada concluída com sucesso',
        rastreadorId,
        veiculoId,
        servicoId,
        plataformaDesativada,
        plataformaErro,
        tempoTotal,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro geral na retirada:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
