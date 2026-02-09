import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  servico_id: string;
  associado_id: string;
  motivo_retirada: 'cancelamento_voluntario' | 'inadimplencia' | 'exclusao_diretoria' | 'substituicao_veiculo' | 'busca_apreensao';
  executado_por: string;
}

interface ResultadoProcessamento {
  success: boolean;
  acao: string;
  proximo_passo: string;
  servico_id?: string;
  erro?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: RequestBody = await req.json();
    const { servico_id, associado_id, motivo_retirada, executado_por } = body;

    console.log('=== PROCESSAR PÓS-RETIRADA ===');
    console.log('Payload:', JSON.stringify(body));

    // Validação de parâmetros obrigatórios
    if (!servico_id || !associado_id || !motivo_retirada || !executado_por) {
      return new Response(
        JSON.stringify({ success: false, error: 'Parâmetros obrigatórios: servico_id, associado_id, motivo_retirada, executado_por' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const motivosValidos = ['cancelamento_voluntario', 'inadimplencia', 'exclusao_diretoria', 'substituicao_veiculo', 'busca_apreensao'];
    if (!motivosValidos.includes(motivo_retirada)) {
      return new Response(
        JSON.stringify({ success: false, error: `motivo_retirada inválido. Valores aceitos: ${motivosValidos.join(', ')}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 1. Validar serviço — deve existir e estar concluído
    const { data: servico, error: servicoError } = await supabase
      .from('servicos')
      .select('id, status, associado_id')
      .eq('id', servico_id)
      .single();

    if (servicoError || !servico) {
      console.error('Serviço não encontrado:', servicoError);
      return new Response(
        JSON.stringify({ success: false, error: 'Serviço não encontrado ou não concluído' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (servico.status !== 'concluida') {
      return new Response(
        JSON.stringify({ success: false, error: `Serviço não está concluído. Status atual: ${servico.status}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // 2. Validar associado — deve existir e pendencia_rastreador deve ser false
    const { data: associado, error: associadoError } = await supabase
      .from('associados')
      .select('id, status, nome, pendencia_rastreador, bloqueado')
      .eq('id', associado_id)
      .single();

    if (associadoError || !associado) {
      console.error('Associado não encontrado:', associadoError);
      return new Response(
        JSON.stringify({ success: false, error: 'Associado não encontrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    if (associado.pendencia_rastreador === true) {
      return new Response(
        JSON.stringify({ success: false, error: 'Rastreador ainda não foi devolvido. pendencia_rastreador = true' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const statusAnterior = associado.status;
    let resultado: ResultadoProcessamento;

    // Resolver user_id para cancelado_por (FK aponta para auth.users)
    let canceladoPorUserId: string | null = null;
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id')
        .or(`id.eq.${executado_por},user_id.eq.${executado_por}`)
        .single();
      canceladoPorUserId = profileData?.user_id || executado_por;
    } catch {
      canceladoPorUserId = null; // Se não encontrar, não bloquear o cancelamento
    }

    // 3. SWITCH no motivo_retirada
    switch (motivo_retirada) {
      case 'cancelamento_voluntario': {
        await supabase
          .from('associados')
          .update({
            status: 'cancelado',
            tipo_saida: 'cancelamento_voluntario',
            data_efetiva_saida: new Date().toISOString(),
            data_cancelamento: new Date().toISOString(),
            motivo_cancelamento: 'Cancelamento voluntário',
            pode_reativar: true,
            cancelado_por: canceladoPorUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', associado_id);

        resultado = {
          success: true,
          acao: 'cancelamento_processado',
          proximo_passo: 'cancelar_asaas_e_notificar',
        };
        break;
      }

      case 'inadimplencia': {
        await supabase
          .from('associados')
          .update({
            status: 'cancelado',
            tipo_saida: 'inadimplencia',
            data_efetiva_saida: new Date().toISOString(),
            data_cancelamento: new Date().toISOString(),
            motivo_cancelamento: 'Inadimplência',
            pode_reativar: true,
            cancelado_por: canceladoPorUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', associado_id);

        resultado = {
          success: true,
          acao: 'exclusao_inadimplencia',
          proximo_passo: 'consolidar_debito_e_notificar',
        };
        break;
      }

      case 'exclusao_diretoria': {
        await supabase
          .from('associados')
          .update({
            status: 'cancelado',
            tipo_saida: 'exclusao_diretoria',
            data_efetiva_saida: new Date().toISOString(),
            data_cancelamento: new Date().toISOString(),
            motivo_cancelamento: 'Exclusão por decisão da diretoria',
            pode_reativar: false,
            cancelado_por: canceladoPorUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', associado_id);

        resultado = {
          success: true,
          acao: 'exclusao_diretoria',
          proximo_passo: 'notificar_formal',
        };
        break;
      }

      case 'substituicao_veiculo': {
        // NÃO muda status do associado — continua ativo
        // NÃO inativa veículo
        resultado = {
          success: true,
          acao: 'substituicao_iniciada',
          proximo_passo: 'fluxo_substituicao',
          servico_id,
        };
        break;
      }

      case 'busca_apreensao': {
        await supabase
          .from('associados')
          .update({
            status: 'bloqueado',
            tipo_saida: 'busca_apreensao',
            data_efetiva_saida: new Date().toISOString(),
            pode_reativar: false,
            bloqueado: true,
            motivo_bloqueio: 'Busca e apreensão',
            data_bloqueio: new Date().toISOString(),
            cancelado_por: canceladoPorUserId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', associado_id);

        resultado = {
          success: true,
          acao: 'busca_apreensao',
          proximo_passo: 'encaminhar_juridico',
        };
        break;
      }

      default: {
        return new Response(
          JSON.stringify({ success: false, error: `Motivo não reconhecido: ${motivo_retirada}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    }

    // 4. Inativar veículos — TODOS os casos EXCETO substituição
    if (motivo_retirada !== 'substituicao_veiculo') {
      const { error: veiculoError } = await supabase
        .from('veiculos')
        .update({
          ativo: false,
          status: 'cancelado',
          updated_at: new Date().toISOString(),
        })
        .eq('associado_id', associado_id)
        .eq('ativo', true);

      if (veiculoError) {
        console.error('Erro ao inativar veículos:', veiculoError);
        // Não falhar a operação principal — logar e continuar
      } else {
        console.log('Veículos do associado inativados');
      }
    }

    // 4.1 Cancelar contratos ativos do associado (EXCETO substituição)
    if (motivo_retirada !== 'substituicao_veiculo') {
      const { data: contratosAtivos, error: contratosError } = await supabase
        .from('contratos')
        .select('id, cotacao_id, status')
        .eq('associado_id', associado_id)
        .in('status', ['ativo', 'assinado', 'pendente', 'pendente_assinatura', 'enviado', 'rascunho']);

      if (contratosError) {
        console.error('Erro ao buscar contratos ativos:', contratosError);
      } else if (contratosAtivos && contratosAtivos.length > 0) {
        console.log(`Cancelando ${contratosAtivos.length} contrato(s) ativo(s)`);

        // Cancelar cada contrato
        const contratoIds = contratosAtivos.map(c => c.id);
        const { error: updateContratosError } = await supabase
          .from('contratos')
          .update({
            status: 'cancelado',
            data_cancelamento: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .in('id', contratoIds);

        if (updateContratosError) {
          console.error('Erro ao cancelar contratos:', updateContratosError);
        } else {
          console.log('Contratos cancelados com sucesso');
        }

        // Atualizar cotações vinculadas
        const cotacaoIds = contratosAtivos.map(c => c.cotacao_id).filter(Boolean) as string[];
        if (cotacaoIds.length > 0) {
          const { error: updateCotacoesError } = await supabase
            .from('cotacoes')
            .update({
              status_contratacao: 'cancelado',
              updated_at: new Date().toISOString(),
            })
            .in('id', cotacaoIds);

          if (updateCotacoesError) {
            console.error('Erro ao atualizar cotações:', updateCotacoesError);
          } else {
            console.log('Cotações atualizadas para cancelado');
          }
        }
      }
    }

    // 5. Registrar histórico em TODOS os casos
    const descricaoMap: Record<string, string> = {
      cancelamento_voluntario: 'Cancelamento voluntário após devolução de rastreador',
      inadimplencia: 'Cancelamento por inadimplência após devolução de rastreador',
      exclusao_diretoria: 'Exclusão por decisão da diretoria após devolução de rastreador',
      substituicao_veiculo: 'Substituição de veículo — retirada do veículo antigo concluída',
      busca_apreensao: 'Bloqueio por busca e apreensão após devolução de rastreador',
    };

    const acaoMap: Record<string, string> = {
      cancelamento_voluntario: 'cancelamento',
      inadimplencia: 'cancelamento',
      exclusao_diretoria: 'exclusao',
      substituicao_veiculo: 'substituicao',
      busca_apreensao: 'cancelamento',
    };

    const statusNovoMap: Record<string, string> = {
      cancelamento_voluntario: 'cancelado',
      inadimplencia: 'cancelado',
      exclusao_diretoria: 'cancelado',
      substituicao_veiculo: statusAnterior, // mantém o status atual
      busca_apreensao: 'bloqueado',
    };

    const { error: historicoError } = await supabase
      .from('associados_historico')
      .insert({
        associado_id,
        tipo: 'status_alterado',
        descricao: descricaoMap[motivo_retirada],
        dados_anteriores: { status: statusAnterior },
        dados_novos: { status: statusNovoMap[motivo_retirada], tipo_saida: motivo_retirada },
        acao: acaoMap[motivo_retirada],
        status_anterior: statusAnterior,
        status_novo: statusNovoMap[motivo_retirada],
        motivo: descricaoMap[motivo_retirada],
        executado_por: canceladoPorUserId,
        metadata: { servico_id, motivo_retirada, processado_em: new Date().toISOString() },
      });

    if (historicoError) {
      console.error('Erro ao registrar histórico:', historicoError);
      // Não falhar — a operação principal já foi concluída
    } else {
      console.log('Histórico registrado com sucesso');
    }

    console.log('=== PÓS-RETIRADA CONCLUÍDA ===');
    console.log('Motivo:', motivo_retirada);
    console.log('Ação:', resultado.acao);
    console.log('Próximo passo:', resultado.proximo_passo);

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro geral no processamento pós-retirada:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
