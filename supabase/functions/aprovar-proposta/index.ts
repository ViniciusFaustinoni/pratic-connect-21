import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIPE_MINIMO_RASTREADOR_PADRAO = 30000;
const FIPE_MINIMO_RASTREADOR_MOTO_PADRAO = 9000;

function precisaRastreador(
  valorFipe: number | null | undefined,
  fipeMinimo: number,
  _tipoVeiculo: string = 'automovel',
  fipeMinimoMoto?: number
): boolean {
  const limite = _tipoVeiculo === 'moto' ? (fipeMinimoMoto ?? FIPE_MINIMO_RASTREADOR_MOTO_PADRAO) : fipeMinimo;
  if (valorFipe === null || valorFipe === undefined || valorFipe <= 0) return true;
  return valorFipe >= limite;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { contrato_id, aprovado_por, veiculo_renavam, veiculo_chassi } = await req.json();

    if (!contrato_id || !aprovado_por) {
      throw new Error('contrato_id e aprovado_por são obrigatórios');
    }

    const agora = new Date().toISOString();
    console.log('[aprovar-proposta] Iniciando aprovação:', contrato_id);

    // 1. Buscar contrato
    const { data: contrato, error: fetchError } = await supabase
      .from('contratos')
      .select(`
        id, status, associado_id, veiculo_id, plano_id, valor_mensal, dia_vencimento, cotacao_id,
        associado:associados!fk_contratos_associado (
          id, nome, dia_vencimento, logradouro, numero, bairro, cidade, uf, cep
        )
      `)
      .eq('id', contrato_id)
      .single();

    if (fetchError) throw fetchError;
    if (!contrato?.associado_id) throw new Error('Associado não encontrado');

    // IDEMPOTÊNCIA
    if (contrato.status === 'ativo') {
      console.log('[aprovar-proposta] Já aprovado:', contrato_id);
      return jsonResponse({ success: true, jaAprovado: true, mensagem: 'Este contrato já foi aprovado anteriormente.', contratoId: contrato_id, associadoId: contrato.associado_id });
    }

    if (contrato.status !== 'assinado') {
      throw new Error(`Este contrato não pode ser aprovado. Status atual: ${contrato.status}`);
    }

    const associadoId = contrato.associado_id;
    const diaVencimento = contrato.dia_vencimento || (contrato.associado as any)?.dia_vencimento || 15;

    // 2. Atualizar contrato para ativo (atomicamente)
    const { data: contratoAtualizado, error: contratoError } = await supabase
      .from('contratos')
      .update({ status: 'ativo', data_ativacao: agora, aprovado_por, aprovado_em: agora })
      .eq('id', contrato_id)
      .eq('status', 'assinado')
      .select('id, status')
      .maybeSingle();

    if (contratoError) throw new Error(`Falha ao atualizar contrato: ${contratoError.message}`);

    if (!contratoAtualizado) {
      const { data: refetch } = await supabase.from('contratos').select('status').eq('id', contrato_id).single();
      if (refetch?.status === 'ativo') {
        return jsonResponse({ success: true, jaAprovado: true, mensagem: 'Este contrato já foi aprovado por outro usuário.', contratoId: contrato_id, associadoId });
      }
      throw new Error(`Não foi possível aprovar. Status atual: ${refetch?.status || 'desconhecido'}`);
    }

    // 3. Paralelo: instalação concluída + veículo + configurações + associado update + renavam/chassi
    const veiculoIdDoContrato = (contrato as any).veiculo_id;

    const [
      instalacaoConcluidaRes,
      veiculosRes,
      configRes,
      associadoUpdateRes,
    ] = await Promise.all([
      // Instalação concluída
      supabase.from('instalacoes').select('id, status, rastreador_id')
        .eq('contrato_id', contrato_id).eq('status', 'concluida').maybeSingle(),
      // Veículo
      veiculoIdDoContrato
        ? supabase.from('veiculos').select('id, placa, modelo, valor_fipe').eq('id', veiculoIdDoContrato)
        : supabase.from('veiculos').select('id, placa, modelo, valor_fipe').eq('associado_id', associadoId).limit(1),
      // Configurações de rastreador
      supabase.from('configuracoes').select('chave, valor')
        .in('chave', ['operacional_fipe_minimo_rastreador', 'operacional_fipe_minimo_rastreador_moto']),
      // Atualizar associado
      supabase.from('associados').update({
        status: 'ativo', data_adesao: agora.split('T')[0], aprovado_por, aprovado_em: agora,
      }).eq('id', associadoId).select('id, status').single(),
    ]);

    // Atualizar renavam/chassi se fornecidos
    if (veiculoIdDoContrato && (veiculo_renavam || veiculo_chassi)) {
      const updateData: Record<string, string> = {};
      if (veiculo_renavam) updateData.renavam = veiculo_renavam;
      if (veiculo_chassi) updateData.chassi = veiculo_chassi;
      await supabase.from('veiculos').update(updateData).eq('id', veiculoIdDoContrato);
    }

    const jaTemInstalacaoConcluida = !!instalacaoConcluidaRes.data;
    const instalacaoConcluida = instalacaoConcluidaRes.data;
    const veiculos = veiculosRes.data;

    if (associadoUpdateRes.error) {
      console.error('[aprovar-proposta] Erro associado:', associadoUpdateRes.error);
      throw new Error(`Falha ao atualizar associado: ${associadoUpdateRes.error.message}`);
    }

    // Parse configurações rastreador
    let fipeMinRastreador = FIPE_MINIMO_RASTREADOR_PADRAO;
    let fipeMinRastreadorMoto = FIPE_MINIMO_RASTREADOR_MOTO_PADRAO;
    if (configRes.data) {
      for (const cfg of configRes.data) {
        if (cfg.chave === 'operacional_fipe_minimo_rastreador') fipeMinRastreador = Number(cfg.valor) || FIPE_MINIMO_RASTREADOR_PADRAO;
        if (cfg.chave === 'operacional_fipe_minimo_rastreador_moto') fipeMinRastreadorMoto = Number(cfg.valor) || FIPE_MINIMO_RASTREADOR_MOTO_PADRAO;
      }
    }

    // Verificar instalação ativa para o veículo
    const veiculoIdParaInstalacao = veiculoIdDoContrato || (veiculos && veiculos[0]?.id);
    let jaTemInstalacaoAtiva = false;
    if (veiculoIdParaInstalacao) {
      const { data: instalacaoAtiva } = await supabase.from('instalacoes')
        .select('id, status, contrato_id')
        .eq('veiculo_id', veiculoIdParaInstalacao)
        .in('status', ['agendada', 'em_rota', 'em_andamento'])
        .maybeSingle();
      jaTemInstalacaoAtiva = !!instalacaoAtiva;
    }

    // 4. Atualizar veículo e criar instalação se necessário
    let protecao360SemRastreador = false;
    if (veiculos && veiculos.length > 0) {
      const veiculo = veiculos[0];
      const veiculoId = veiculo.id;
      const valorFipe = (veiculo as any).valor_fipe || 0;

      const veiculoPrecisaRastreador = precisaRastreador(valorFipe, fipeMinRastreador, 'automovel', fipeMinRastreadorMoto);
      const ativarProtecao360 = jaTemInstalacaoConcluida || !veiculoPrecisaRastreador;
      const statusVeiculo = ativarProtecao360 ? 'ativo' : 'instalacao_pendente';

      if (!veiculoPrecisaRastreador) {
        protecao360SemRastreador = true;
        console.log(`[aprovar-proposta] FIPE R$${valorFipe} < R$${fipeMinRastreador} — Sem rastreador`);
      }

      await supabase.from('veiculos').update({
        status: statusVeiculo, cobertura_roubo_furto: true, cobertura_total: ativarProtecao360,
      }).eq('id', veiculoId);

      // Se instalação concluída — ativar rastreador na plataforma
      if (jaTemInstalacaoConcluida && instalacaoConcluida?.rastreador_id) {
        try {
          const { data: rastreadorData } = await supabase.from('rastreadores')
            .select('imei, plataforma').eq('id', instalacaoConcluida.rastreador_id).single();

          if (rastreadorData?.imei) {
            const { data: associadoEmail } = await supabase.from('associados')
              .select('email').eq('id', associadoId).single();

            if (rastreadorData.plataforma === 'softruck') {
              await supabase.functions.invoke('softruck-ativar-dispositivo', {
                body: { imei: rastreadorData.imei, veiculoId, associadoId, associadoEmail: associadoEmail?.email },
              });
            } else if (rastreadorData.plataforma === 'rede_veiculos') {
              await supabase.functions.invoke('rede-veiculos-vincular-cliente', {
                body: { imei: rastreadorData.imei, veiculoId, associadoId },
              });
            }

            await supabase.functions.invoke('ativar-associado', {
              body: { veiculo_id: veiculoId, rastreador_id: instalacaoConcluida.rastreador_id, associado_id: associadoId },
            });

            // Notificar cobertura 360 (fire and forget)
            supabase.functions.invoke('notificar-cliente', {
              body: { tipo: 'cobertura_total_ativada', associado_id: associadoId, dados: { placa: veiculo.placa || '', marca: '', modelo: veiculo.modelo || '' } },
            }).catch(() => {});
          }
        } catch (err) {
          console.warn('[aprovar-proposta] Erro ativação automática:', err);
        }
      }

      // Criar instalação se necessário
      if (!jaTemInstalacaoConcluida && !jaTemInstalacaoAtiva && veiculoPrecisaRastreador) {
        const associadoData = contrato.associado as any;
        let dataAgendada = new Date().toISOString().split('T')[0];
        let periodoPreferido = 'manha';
        let enderecoLogradouro = associadoData?.logradouro || null;
        let enderecoNumero = associadoData?.numero || null;
        let enderecoBairro = associadoData?.bairro || null;
        let enderecoCidade = associadoData?.cidade || null;
        let enderecoUf = associadoData?.uf || null;
        let enderecoCep = associadoData?.cep || null;
        let permiteEncaixe = false;

        if (contrato.cotacao_id) {
          try {
            const { data: cotacaoDados } = await supabase.from('cotacoes')
              .select('vistoria_completa_data_agendada, vistoria_completa_horario_agendado, vistoria_completa_periodo, vistoria_completa_endereco_cep, vistoria_completa_endereco_logradouro, vistoria_completa_endereco_numero, vistoria_completa_endereco_bairro, vistoria_completa_endereco_cidade, vistoria_completa_endereco_estado, vistoria_permite_encaixe')
              .eq('id', contrato.cotacao_id).single();

            if (cotacaoDados?.vistoria_completa_data_agendada) {
              dataAgendada = cotacaoDados.vistoria_completa_data_agendada;
              periodoPreferido = cotacaoDados.vistoria_completa_periodo || cotacaoDados.vistoria_completa_horario_agendado || 'manha';
            }
            if (cotacaoDados?.vistoria_completa_endereco_logradouro) {
              enderecoLogradouro = cotacaoDados.vistoria_completa_endereco_logradouro;
              enderecoNumero = cotacaoDados.vistoria_completa_endereco_numero || null;
              enderecoBairro = cotacaoDados.vistoria_completa_endereco_bairro || null;
              enderecoCidade = cotacaoDados.vistoria_completa_endereco_cidade || null;
              enderecoUf = cotacaoDados.vistoria_completa_endereco_estado || null;
              enderecoCep = cotacaoDados.vistoria_completa_endereco_cep || null;
            }
            if (cotacaoDados?.vistoria_permite_encaixe) permiteEncaixe = true;
          } catch (e) {
            console.warn('[aprovar-proposta] Erro buscar cotação:', e);
          }
        }

        // Geocodificar
        let endereco_latitude: number | null = null;
        let endereco_longitude: number | null = null;
        if (enderecoLogradouro && enderecoCidade) {
          try {
            const geoResponse = await fetch(`${supabaseUrl}/functions/v1/geocode-endereco`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify({ logradouro: enderecoLogradouro, numero: enderecoNumero, bairro: enderecoBairro, cidade: enderecoCidade, uf: enderecoUf, cep: enderecoCep }),
            });
            const geoResult = await geoResponse.json();
            if (geoResult?.latitude && geoResult?.longitude) {
              endereco_latitude = geoResult.latitude;
              endereco_longitude = geoResult.longitude;
            }
          } catch (e) {
            console.warn('[aprovar-proposta] Geocodificação falhou:', e);
          }
        }

        await supabase.from('instalacoes').insert({
          associado_id: associadoId,
          veiculo_id: veiculoId,
          contrato_id: contrato_id,
          cotacao_id: contrato.cotacao_id || null,
          status: 'agendada',
          data_agendada: dataAgendada,
          periodo: ['manha', 'tarde'].includes(periodoPreferido) ? periodoPreferido : 'manha',
          logradouro: enderecoLogradouro,
          numero: enderecoNumero,
          bairro: enderecoBairro,
          cidade: enderecoCidade,
          uf: enderecoUf,
          cep: enderecoCep,
          endereco_latitude,
          endereco_longitude,
          local_vistoria: 'cliente',
          permite_encaixe: permiteEncaixe,
        });
        console.log('[aprovar-proposta] Instalação criada');
      } else if (!veiculoPrecisaRastreador) {
        // Notificar cobertura 360 sem rastreador
        supabase.functions.invoke('notificar-cliente', {
          body: { tipo: 'cobertura_total_ativada', associado_id: associadoId, dados: { placa: veiculo.placa || '', marca: '', modelo: veiculo.modelo || '' } },
        }).catch(() => {});
      }

      // Criar acesso do associado se instalação não concluída
      if (!jaTemInstalacaoConcluida) {
        try {
          await supabase.functions.invoke('ativar-associado', {
            body: { associado_id: associadoId, veiculo_id: veiculoId },
          });
        } catch (e) {
          console.warn('[aprovar-proposta] Erro criar acesso:', e);
        }
      }
    }

    // 5. Paralelo: histórico + documentos + link_token + SGA
    const mensagemHistorico = jaTemInstalacaoConcluida
      ? 'Proposta aprovada pelo analista de cadastro. Instalação já concluída. Proteção 360º ativada.'
      : protecao360SemRastreador
        ? 'Proposta aprovada pelo analista de cadastro. Proteção 360° ativada (veículo sem necessidade de rastreador).'
        : 'Proposta aprovada pelo analista de cadastro. Cobertura Roubo/Furto ativada. Aguardando instalação para Proteção 360º.';

    const docPromises = [
      supabase.from('associados_historico').insert({
        associado_id: associadoId, contrato_id: contrato_id, tipo: 'status_alterado',
        descricao: mensagemHistorico, usuario_id: aprovado_por,
      }),
      supabase.from('documentos').update({
        status: 'aprovado', analista_id: aprovado_por, data_analise: agora, motivo_reprovacao: null,
      }).eq('associado_id', associadoId).in('status', ['pendente', 'em_analise']),
      supabase.from('documentos_solicitados').update({
        status: 'aprovado', updated_at: agora,
      }).eq('associado_id', associadoId).eq('status', 'enviado'),
    ];

    if (contrato.cotacao_id) {
      docPromises.push(
        supabase.from('contratos_documentos').update({
          status: 'aprovado', updated_at: agora,
        }).eq('cotacao_id', contrato.cotacao_id).in('status', ['pendente', 'processando'])
      );
    }

    await Promise.all(docPromises);

    // SGA Hinova sync (background, não bloqueia)
    try {
      const { data: veiculoParaSGA } = await supabase.from('veiculos')
        .select('id').eq('associado_id', associadoId).eq('sincronizado_hinova', false).limit(1).maybeSingle();

      if (veiculoParaSGA?.id) {
        console.log('[aprovar-proposta] Enviando para SGA...');
        fetch(`${supabaseUrl}/functions/v1/sga-hinova-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
          body: JSON.stringify({ veiculo_id: veiculoParaSGA.id, associado_id: associadoId }),
        }).catch(e => console.warn('[aprovar-proposta] SGA falhou:', e));
      }
    } catch (e) {
      console.warn('[aprovar-proposta] Erro SGA:', e);
    }

    const mensagemRetorno = jaTemInstalacaoConcluida
      ? 'Proposta aprovada! Instalação já concluída. Proteção 360º ativada.'
      : protecao360SemRastreador
        ? 'Proposta aprovada! Proteção 360° ativada (sem necessidade de rastreador).'
        : 'Proposta aprovada! Cobertura Roubo/Furto ativada. Aguardando instalação para Proteção 360º.';

    console.log('[aprovar-proposta] Concluído:', mensagemRetorno);

    return jsonResponse({ success: true, contratoId: contrato_id, associadoId, mensagem: mensagemRetorno });

  } catch (error) {
    console.error('[aprovar-proposta] Erro:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status,
  });
}
