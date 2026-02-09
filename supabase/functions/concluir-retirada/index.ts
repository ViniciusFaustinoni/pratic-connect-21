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
  // Novos campos
  integridade?: 'integro' | 'danificado' | 'violado' | 'molhado';
  obsIntegridade?: string;
  checklistRetirada?: Array<{ id: string; label: string; checked: boolean; checked_at: string | null }>;
  videoUrl?: string;
  fotosUrls?: string[];
  criarNovaInstalacao?: boolean;
  novoVeiculoId?: string;
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
    const { 
      servicoId, rastreadorId, veiculoId, profissionalId, 
      hodometro, assinaturaUrl, observacoes,
      integridade, obsIntegridade, checklistRetirada,
      videoUrl, fotosUrls, criarNovaInstalacao, novoVeiculoId
    } = body;

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

    // Buscar dados do serviço para pegar informações adicionais
    const { data: servicoData } = await supabase
      .from('servicos')
      .select('associado_id, motivo_retirada, sub_tipo_retirada, novo_veiculo_id')
      .eq('id', servicoId)
      .single();

    let associado = null;
    const associadoId = servicoData?.associado_id || veiculo?.associado_id;
    if (associadoId) {
      const { data: associadoData } = await supabase
        .from('associados')
        .select('id, cpf, nome')
        .eq('id', associadoId)
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
            atualizarBancoLocal: false,
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

    // 4. Determinar status de destino do rastreador baseado na integridade
    // Se íntegro: estoque | Se não íntegro: retorno_base (triagem)
    const novoStatusRastreador = integridade === 'integro' ? 'estoque' : 'retorno_base';
    console.log(`Integridade: ${integridade} → Novo status rastreador: ${novoStatusRastreador}`);

    // 5. Atualizar rastreador
    const { error: updateRastreadorError } = await supabase
      .from('rastreadores')
      .update({
        status: novoStatusRastreador,
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

    // 6. Limpar IDs de plataforma do veículo
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

    // 7. Registrar movimentação de estoque
    await supabase.from('estoque_movimentacoes').insert({
      tipo: 'desinstalacao',
      quantidade: 1,
      status_anterior: 'instalado',
      status_novo: novoStatusRastreador,
      rastreador_id: rastreadorId,
      observacoes: `Retirada de rastreador. Integridade: ${integridade || 'não informada'}. ${observacoes || ''}`.trim(),
    });

    // 8. Registrar movimentação no histórico de rastreadores
    await supabase.from('rastreadores_movimentacoes').insert({
      rastreador_id: rastreadorId,
      tipo: 'desinstalacao',
      origem_status: 'instalado',
      destino_status: novoStatusRastreador,
      veiculo_id: veiculoId,
      observacoes: `Retirada realizada. Integridade: ${integridade || 'não informada'}. ${obsIntegridade || ''} ${observacoes || ''}`.trim(),
    });

    // 9. Concluir serviço com campos adicionais
    const updateServicoData: Record<string, unknown> = {
      status: 'concluida',
      concluida_em: new Date().toISOString(),
      km_atual: hodometro || null,
      assinatura_cliente_url: assinaturaUrl || null,
      video_360_url: videoUrl || null,
      observacoes: observacoes || null,
      updated_at: new Date().toISOString(),
    };

    // Adicionar campos de checklist se existirem
    if (checklistRetirada) {
      updateServicoData.checklist_retirada = { items: checklistRetirada };
    }

    // Adicionar integridade
    if (integridade) {
      updateServicoData.integridade_aparelho = integridade;
      if (integridade !== 'integro') {
        updateServicoData.obs_integridade = obsIntegridade || null;
        // Sugerir multa (não aplicar automaticamente)
        updateServicoData.multa_sugerida = true;
        updateServicoData.multa_valor_sugerido = 400;
      }
    }

    const { error: updateServicoError } = await supabase
      .from('servicos')
      .update(updateServicoData)
      .eq('id', servicoId);

    if (updateServicoError) {
      console.error('Erro ao concluir serviço:', updateServicoError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao concluir serviço' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // 10. Desbloquear cancelamento do associado se estava bloqueado
    const { data: servicoAtualizado } = await supabase
      .from('servicos')
      .select('cancelamento_bloqueado_ate_devolucao, associado_id')
      .eq('id', servicoId)
      .single();

    if (servicoAtualizado?.cancelamento_bloqueado_ate_devolucao && servicoAtualizado.associado_id) {
      console.log('Desbloqueando cancelamento para associado:', servicoAtualizado.associado_id);
      
      const { error: updateAssociadoError } = await supabase
        .from('associados')
        .update({
          pendencia_rastreador: false,
          pendencia_rastreador_servico_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', servicoAtualizado.associado_id);

      if (updateAssociadoError) {
        console.error('Erro ao desbloquear cancelamento:', updateAssociadoError);
        // Não falhar a operação principal
      } else {
        console.log('Cancelamento desbloqueado com sucesso');
      }
    }

    // 11. Se é substituição com nova instalação, criar novo serviço de instalação
    let novoServicoInstalacaoId = null;
    const finalNovoVeiculoId = novoVeiculoId || servicoData?.novo_veiculo_id;
    
    if (criarNovaInstalacao && finalNovoVeiculoId) {
      console.log('Criando novo serviço de instalação para veículo:', finalNovoVeiculoId);
      
      const { data: novoServico, error: novoServicoError } = await supabase
        .from('servicos')
        .insert({
          tipo: 'instalacao',
          status: 'pendente',
          associado_id: associadoId,
          veiculo_id: finalNovoVeiculoId,
          rastreador_id: rastreadorId, // Mesmo rastreador será reinstalado
          observacoes: `Instalação decorrente de substituição de veículo. Serviço de retirada: ${servicoId}`,
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      
      if (novoServicoError) {
        console.error('Erro ao criar serviço de instalação:', novoServicoError);
        // Não falhar a operação por isso, apenas logar
      } else {
        novoServicoInstalacaoId = novoServico?.id;
        console.log('Novo serviço de instalação criado:', novoServicoInstalacaoId);
      }
    }

    const tempoTotal = Date.now() - startTime;
    console.log('=== RETIRADA CONCLUÍDA COM SUCESSO ===');
    console.log('Tempo total:', tempoTotal, 'ms');
    console.log('Plataforma desativada:', plataformaDesativada);
    console.log('Integridade:', integridade, '→ Status:', novoStatusRastreador);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Retirada concluída com sucesso',
        rastreadorId,
        veiculoId,
        servicoId,
        novoStatusRastreador,
        integridade,
        plataformaDesativada,
        plataformaErro,
        novoServicoInstalacaoId,
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
