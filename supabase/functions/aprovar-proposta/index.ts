import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIPE_MINIMO_RASTREADOR_PADRAO = 30000;
const FIPE_MINIMO_RASTREADOR_MOTO_PADRAO = 9000;

// Keywords que indicam motocicleta (paridade com src/data/vistoriaConfigCompleta.ts)
const MOTO_KEYWORDS = [
  'moto', 'motocicleta', 'ciclomotor', 'triciclo', 'scooter',
  'nxr', 'bros', 'cg ', 'cg-', 'cb ', 'cb-', 'cbr', 'pcx', 'biz', 'pop',
  'titan', 'fan', 'xre', 'lander', 'tenere', 'crosser', 'fazer', 'ybr',
  'neo', 'fluo', 'burgman', 'intruder', 'yes', 'gsr', 'v-strom', 'factor',
  'dl ', 'crf', 'sahara', 'twister', 'hornet', 'africa twin', 'ninja',
  'z900', 'z800', 'z750', 'z400', 'versys', 'vulcan', 'next', ' riva',
  'citycom', 'maxsym', 'boulevard', 'bandit', 'hayabusa', 'gsxr', 'gsx',
  'elite', 'adv', 'sh ', 'sh-', 'lead', 'xadv', 'x-adv', 'transalp',
  'nmax', 'xtz', 'xj6', 'mt-', 'mt ', 'crypton',
  'duke', 'apache', 'jet', 'kansas', 'mirage', 'horizon',
];

function detectarTipoVeiculo(
  marca: string | null | undefined,
  modelo: string | null | undefined,
  marcasExclusivasMoto: string[]
): 'moto' | 'automovel' {
  const marcaNorm = (marca || '').trim().toUpperCase();
  if (marcaNorm && marcasExclusivasMoto.some(m => marcaNorm === m.toUpperCase().trim())) {
    return 'moto';
  }
  if (modelo) {
    const modeloLower = ` ${modelo.toLowerCase()} `;
    if (MOTO_KEYWORDS.some(kw => modeloLower.includes(kw))) return 'moto';
  }
  return 'automovel';
}

function precisaRastreador(
  valorFipe: number | null | undefined,
  fipeMinimo: number,
  tipoVeiculo: 'moto' | 'automovel' = 'automovel',
  fipeMinimoMoto?: number
): boolean {
  const limite = tipoVeiculo === 'moto' ? (fipeMinimoMoto ?? FIPE_MINIMO_RASTREADOR_MOTO_PADRAO) : fipeMinimo;
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

    // 1b. Verificar se o plano contratado tem cobertura de Roubo/Furto.
    // Mesma heurística do frontend (regex /roubo|furto/i sobre coberturas.nome).
    let planoTemRouboFurto = false;
    if (contrato.plano_id) {
      const { data: planoCobs } = await supabase
        .from('planos_coberturas')
        .select('coberturas(nome)')
        .eq('plano_id', contrato.plano_id);
      planoTemRouboFurto = (planoCobs || []).some((row: any) => {
        const nome = row?.coberturas?.nome || '';
        return /roubo|furto/i.test(nome);
      });
    }
    console.log(`[aprovar-proposta] Plano ${contrato.plano_id} tem R&F? ${planoTemRouboFurto}`);

    // IDEMPOTÊNCIA
    if (contrato.status === 'ativo') {
      console.log('[aprovar-proposta] Já aprovado:', contrato_id);
      return jsonResponse({ success: true, jaAprovado: true, mensagem: 'Este contrato já foi aprovado anteriormente.', contratoId: contrato_id, associadoId: contrato.associado_id });
    }

    if (contrato.status !== 'assinado') {
      throw new Error(`Este contrato não pode ser aprovado. Status atual: ${contrato.status}`);
    }

    const associadoId = contrato.associado_id;

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

    // 3. Paralelo: instalação concluída + veículos + configurações + associado update
    const veiculoIdDoContrato = (contrato as any).veiculo_id;

    const [
      instalacaoConcluidaRes,
      veiculosRes,
      configRes,
      associadoUpdateRes,
    ] = await Promise.all([
      supabase.from('instalacoes').select('id, status, rastreador_id')
        .eq('contrato_id', contrato_id).eq('status', 'concluida').maybeSingle(),
      // Buscar TODOS os veículos do associado (para tratamento multi-veículo)
      supabase.from('veiculos').select('id, placa, marca, modelo, valor_fipe').eq('associado_id', associadoId),
      supabase.from('configuracoes').select('chave, valor')
        .in('chave', ['operacional_fipe_minimo_rastreador', 'operacional_fipe_minimo_rastreador_moto', 'marcas_exclusivas_moto']),
      supabase.from('associados').update({
        status: 'ativo', data_adesao: agora.split('T')[0], aprovado_por, aprovado_em: agora,
      }).eq('id', associadoId).select('id, status').single(),
    ]);

    // Atualizar renavam/chassi no veículo do contrato se fornecidos
    if (veiculoIdDoContrato && (veiculo_renavam || veiculo_chassi)) {
      const updateData: Record<string, string> = {};
      if (veiculo_renavam) updateData.renavam = veiculo_renavam;
      if (veiculo_chassi) updateData.chassi = veiculo_chassi;
      await supabase.from('veiculos').update(updateData).eq('id', veiculoIdDoContrato);
    }

    const jaTemInstalacaoConcluida = !!instalacaoConcluidaRes.data;
    const instalacaoConcluida = instalacaoConcluidaRes.data;
    const veiculos = veiculosRes.data || [];

    if (associadoUpdateRes.error) {
      console.error('[aprovar-proposta] Erro associado:', associadoUpdateRes.error);
      throw new Error(`Falha ao atualizar associado: ${associadoUpdateRes.error.message}`);
    }

    // Parse configurações
    let fipeMinRastreador = FIPE_MINIMO_RASTREADOR_PADRAO;
    let fipeMinRastreadorMoto = FIPE_MINIMO_RASTREADOR_MOTO_PADRAO;
    let marcasExclusivasMoto: string[] = [];
    if (configRes.data) {
      for (const cfg of configRes.data) {
        if (cfg.chave === 'operacional_fipe_minimo_rastreador') fipeMinRastreador = Number(cfg.valor) || FIPE_MINIMO_RASTREADOR_PADRAO;
        if (cfg.chave === 'operacional_fipe_minimo_rastreador_moto') fipeMinRastreadorMoto = Number(cfg.valor) || FIPE_MINIMO_RASTREADOR_MOTO_PADRAO;
        if (cfg.chave === 'marcas_exclusivas_moto' && cfg.valor) {
          try {
            const raw = String(cfg.valor).trim();
            marcasExclusivasMoto = raw.startsWith('[')
              ? JSON.parse(raw)
              : raw.split(',').map((m: string) => m.trim());
          } catch {
            marcasExclusivasMoto = [];
          }
        }
      }
    }

    // 4. Iterar TODOS os veículos do associado
    let algumProtecao360SemRastreador = false;
    let algumPrecisouRastreador = false;
    let veiculoPrincipal: any = null;

    for (const veiculo of veiculos) {
      const veiculoId = veiculo.id;
      const valorFipe = (veiculo as any).valor_fipe || 0;
      const tipoVeiculo = detectarTipoVeiculo((veiculo as any).marca, (veiculo as any).modelo, marcasExclusivasMoto);

      const veiculoPrecisaRastreador = precisaRastreador(valorFipe, fipeMinRastreador, tipoVeiculo, fipeMinRastreadorMoto);

      // Se a instalação concluída pertence a ESTE veículo, ativa Proteção 360
      const instalacaoDesteVeiculo = jaTemInstalacaoConcluida && (instalacaoConcluida as any)?.veiculo_id === veiculoId;
      const ativarProtecao360 = instalacaoDesteVeiculo || !veiculoPrecisaRastreador;
      const statusVeiculo = ativarProtecao360 ? 'ativo' : 'instalacao_pendente';

      console.log(`[aprovar-proposta] Veículo ${veiculo.placa} (${tipoVeiculo}, FIPE R$${valorFipe}): precisaRastreador=${veiculoPrecisaRastreador}, status=${statusVeiculo}`);

      if (!veiculoPrecisaRastreador) algumProtecao360SemRastreador = true;
      if (veiculoPrecisaRastreador) algumPrecisouRastreador = true;
      if (veiculoId === veiculoIdDoContrato || !veiculoPrincipal) veiculoPrincipal = veiculo;

      // Cobertura R&F só é ativada se o PLANO contratado a inclui.
      // Cobertura total continua dependendo da instalação concluída
      // (ou da dispensa de rastreador via FIPE/categoria).
      await supabase.from('veiculos').update({
        status: statusVeiculo,
        cobertura_roubo_furto: planoTemRouboFurto,
        cobertura_total: ativarProtecao360,
      }).eq('id', veiculoId);

      // Verificar se já existe instalação ativa para este veículo
      let jaTemInstalacaoAtivaDesteVeic = false;
      if (veiculoPrecisaRastreador && !instalacaoDesteVeiculo) {
        const { data: instalacaoAtiva } = await supabase.from('instalacoes')
          .select('id')
          .eq('veiculo_id', veiculoId)
          .in('status', ['agendada', 'em_rota', 'em_andamento'])
          .maybeSingle();
        jaTemInstalacaoAtivaDesteVeic = !!instalacaoAtiva;
      }

      // Ativação automática rastreador (apenas para veículo com instalação concluída)
      if (instalacaoDesteVeiculo && instalacaoConcluida?.rastreador_id) {
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

            supabase.functions.invoke('notificar-cliente', {
              body: { tipo: 'cobertura_total_ativada', associado_id: associadoId, dados: { placa: veiculo.placa || '', marca: (veiculo as any).marca || '', modelo: veiculo.modelo || '' } },
            }).catch(() => {});
          }
        } catch (err) {
          console.warn('[aprovar-proposta] Erro ativação automática:', err);
        }
      }

      // Criar instalação se necessário
      if (veiculoPrecisaRastreador && !instalacaoDesteVeiculo && !jaTemInstalacaoAtivaDesteVeic) {
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

        // Guard de idempotência: não criar nova instalação se já existe ativa para a mesma cotação+veículo
        const { data: instJaExiste } = await supabase
          .from('instalacoes')
          .select('id')
          .eq('cotacao_id', contrato.cotacao_id || '')
          .eq('veiculo_id', veiculoId)
          .in('status', ['agendada', 'em_andamento', 'em_analise'])
          .limit(1)
          .maybeSingle();

        if (instJaExiste?.id) {
          console.log(`[aprovar-proposta] Instalação já existe (${instJaExiste.id}) — pulando criação para veículo ${veiculo.placa}`);
        } else {
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
          console.log(`[aprovar-proposta] Instalação criada para veículo ${veiculo.placa}`);
        }
      } else if (!veiculoPrecisaRastreador) {
        supabase.functions.invoke('notificar-cliente', {
          body: { tipo: 'cobertura_total_ativada', associado_id: associadoId, dados: { placa: veiculo.placa || '', marca: (veiculo as any).marca || '', modelo: veiculo.modelo || '' } },
        }).catch(() => {});
      }
    }

    const deveAguardarInstalacao = algumPrecisouRastreador && !jaTemInstalacaoConcluida;
    const statusSgaDestino = deveAguardarInstalacao ? 'pendente' : 'ativo';

    if (deveAguardarInstalacao) {
      await Promise.all([
        supabase.from('contratos').update({ status: 'assinado', data_ativacao: null }).eq('id', contrato_id),
        supabase.from('associados').update({ status: 'aguardando_instalacao' }).eq('id', associadoId),
      ]);
    }

    // 5. Histórico + documentos + SGA
    const mensagemHistorico = jaTemInstalacaoConcluida
      ? 'Proposta aprovada pelo analista de cadastro. Instalação já concluída. Proteção 360º ativada.'
      : !planoTemRouboFurto
        ? 'Proposta aprovada pelo analista de cadastro. Plano de assistência ativado (sem cobertura de Roubo/Furto).'
        : algumPrecisouRastreador
          ? 'Proposta aprovada pelo analista de cadastro. Cobertura Roubo/Furto ativada. Aguardando instalação para Proteção 360º.'
          : 'Proposta aprovada pelo analista de cadastro. Proteção 360° ativada (veículo sem necessidade de rastreador).';

    const docPromises: Promise<any>[] = [
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

    // SGA Hinova sync (background)
    try {
      const { data: veiculoParaSGA } = await supabase.from('veiculos')
        .select('id').eq('associado_id', associadoId).eq('sincronizado_hinova', false).limit(1).maybeSingle();

      if (veiculoParaSGA?.id) {
        console.log('[aprovar-proposta] Enviando para SGA...');
        fetch(`${supabaseUrl}/functions/v1/sga-hinova-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
          body: JSON.stringify({ veiculo_id: veiculoParaSGA.id, associado_id: associadoId, status_sga_destino: statusSgaDestino }),
        }).catch(e => console.warn('[aprovar-proposta] SGA falhou:', e));
      }
    } catch (e) {
      console.warn('[aprovar-proposta] Erro SGA:', e);
    }

    const mensagemRetorno = jaTemInstalacaoConcluida
      ? 'Proposta aprovada! Instalação já concluída. Proteção 360º ativada.'
      : !planoTemRouboFurto
        ? 'Proposta aprovada! Plano de assistência ativado (sem cobertura de Roubo/Furto).'
        : algumPrecisouRastreador
          ? 'Proposta aprovada! Cobertura Roubo/Furto ativada. Aguardando instalação para Proteção 360º.'
          : 'Proposta aprovada! Proteção 360° ativada (sem necessidade de rastreador).';

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
