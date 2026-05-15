// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { translateDbError } from "../_shared/db-error-translator.ts";

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
    const { contrato_id, aprovado_por, veiculo_renavam, veiculo_chassi, veiculo_numero_motor } = await req.json();

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

    // ── GATE: Situação Financeira (SGA) ────────────────────────────────────
    // Bloqueia aprovação se não houver registro liberador recente em
    // sga_situacao_check (≤ 24h). Liberador = !tem_debito OU bypass=true OU
    // origem_resultado em ('transitorio','associado_inexistente_sga').
    {
      const dia = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: ultimo } = await supabase
        .from('sga_situacao_check')
        .select('id, tem_debito, bypass, origem_resultado, verificado_em')
        .eq('contrato_id', contrato_id)
        .gte('verificado_em', dia)
        .order('verificado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      const liberador = ultimo && (
        !ultimo.tem_debito ||
        ultimo.bypass === true ||
        ultimo.origem_resultado === 'transitorio' ||
        ultimo.origem_resultado === 'associado_inexistente_sga'
      );
      if (!liberador) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'inadimplencia_sga_pendente',
            message: 'Consulte a situação financeira do associado no SGA antes de aprovar.',
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const associadoId = contrato.associado_id;

    // 2. Registrar aprovação cadastral no contrato sem ativar ainda.
    // A ativação definitiva acontece somente após instalação + aprovação do Monitoramento.
    const { data: contratoAtualizado, error: contratoError } = await supabase
      .from('contratos')
      .update({ aprovado_por, aprovado_em: agora, cadastro_aprovado: true })
      .eq('id', contrato_id)
      .eq('status', 'assinado')
      .select('id, status')
      .maybeSingle();

    if (contratoError) throw new Error(`Falha ao atualizar contrato: ${contratoError.message}`);

    if (!contratoAtualizado) {
      const { data: refetch } = await supabase.from('contratos').select('status').eq('id', contrato_id).single();
      if (refetch?.status === 'ativo' || refetch?.status === 'assinado') {
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
      supabase.from('instalacoes').select('id, status, rastreador_id, veiculo_id')
        .eq('contrato_id', contrato_id).eq('status', 'concluida').maybeSingle(),
      // Buscar APENAS o veículo do contrato sendo aprovado.
      // Cada contrato representa UMA proposta (um veículo). Iterar todos os
      // veículos do associado causava criação de instalações cruzadas
      // (instalação de outro veículo vinculada a este contrato), gerando
      // associados "presos" no Cadastro mesmo após o processo concluir.
      veiculoIdDoContrato
        ? supabase.from('veiculos').select('id, placa, marca, modelo, valor_fipe').eq('id', veiculoIdDoContrato)
        : supabase.from('veiculos').select('id, placa, marca, modelo, valor_fipe').eq('associado_id', associadoId).limit(1),
      supabase.from('configuracoes').select('chave, valor')
        .in('chave', ['operacional_fipe_minimo_rastreador', 'operacional_fipe_minimo_rastreador_moto', 'marcas_exclusivas_moto']),
      supabase.from('associados').update({
        status: 'aguardando_instalacao', data_adesao: agora.split('T')[0], aprovado_por, aprovado_em: agora,
      }).eq('id', associadoId).select('id, status').single(),
    ]);

    // Atualizar renavam/chassi no veículo do contrato se fornecidos
    if (veiculoIdDoContrato && (veiculo_renavam || veiculo_chassi || veiculo_numero_motor)) {
      const updateData: Record<string, string> = {};
      if (veiculo_renavam) updateData.renavam = veiculo_renavam;
      if (veiculo_chassi) updateData.chassi = veiculo_chassi;
      if (veiculo_numero_motor) updateData.numero_motor = veiculo_numero_motor;
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

      const instalacaoDesteVeiculo = jaTemInstalacaoConcluida && (instalacaoConcluida as any)?.veiculo_id === veiculoId;
      // REGRA CORE: ativação SEMPRE via edge `ativar-associado` (lock + CAS + log + SGA).
      // Aqui NUNCA marcamos veiculos.status='ativo' nem ativamos coberturas — mesmo que
      // a instalação já esteja concluída, a vistoria ainda precisa ser aprovada manualmente
      // (paridade total com ≥30k/9k). A aprovação da vistoria é o único gatilho que dispara
      // ativar-associado e promove veículo+associado+contrato para ativo de forma sincronizada
      // com o SGA. Marcar ativo aqui causava estado inconsistente (veículo ativo, associado
      // em_analise, sem código Hinova) e mantinha o caso preso na fila de Cadastro.
      const statusVeiculo = 'instalacao_pendente';

      console.log(`[aprovar-proposta] Veículo ${veiculo.placa} (${tipoVeiculo}, FIPE R$${valorFipe}): precisaRastreador=${veiculoPrecisaRastreador}, instalacaoJaConcluida=${instalacaoDesteVeiculo}, status=${statusVeiculo} (ativação real virá pela aprovação da vistoria → ativar-associado)`);

      if (!veiculoPrecisaRastreador) algumProtecao360SemRastreador = true;
      if (veiculoPrecisaRastreador) algumPrecisouRastreador = true;
      if (veiculoId === veiculoIdDoContrato || !veiculoPrincipal) veiculoPrincipal = veiculo;

      await supabase.from('veiculos').update({
        status: statusVeiculo,
        cobertura_roubo_furto: false,
        cobertura_total: false,
      }).eq('id', veiculoId);

      // Verificar se já existe instalação ativa para este veículo.
      // IMPORTANTE: criamos instalação para TODOS os veículos (mesmo os que dispensam rastreador),
      // porque o link público de vistoria depende de uma instalação como âncora.
      // Veículos sem rastreador recebem dispensa_rastreador=true; o link público trata o resto.
      let jaTemInstalacaoAtivaDesteVeic = false;
      if (!instalacaoDesteVeiculo) {
        const { data: instalacaoAtiva } = await supabase.from('instalacoes')
          .select('id')
          .eq('veiculo_id', veiculoId)
          .in('status', ['agendada', 'em_rota', 'em_andamento', 'em_analise', 'concluida'])
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
              await supabase.rpc('enqueue_integration', {
                _integration: 'softruck',
                _operation: 'ativar_dispositivo',
                _payload: { imei: rastreadorData.imei, veiculoId, associadoId, associadoEmail: associadoEmail?.email },
                _correlation_id: `softruck:ativar:${veiculoId}`,
                _max_attempts: 5,
                _delay_seconds: 0,
                _created_by: aprovado_por ?? null,
              });
            } else if (rastreadorData.plataforma === 'rede_veiculos') {
              await supabase.rpc('enqueue_integration', {
                _integration: 'rede',
                _operation: 'vincular_cliente',
                _payload: { imei: rastreadorData.imei, veiculoId, associadoId },
                _correlation_id: `rede:vincular:${veiculoId}`,
                _max_attempts: 5,
                _delay_seconds: 0,
                _created_by: aprovado_por ?? null,
              });
            }

            // NOTE: ativação centralizada acontece mais abaixo (bloco "deveAguardarInstalacao = false"),
            // chamando ativar-associado com source/allowed_from corretos. Aqui apenas garantimos
            // a notificação ao cliente — não invocar ativar-associado novamente para evitar payload inválido.

            supabase.functions.invoke('notificar-cliente', {
              body: { tipo: 'cobertura_total_ativada', associado_id: associadoId, dados: { placa: veiculo.placa || '', marca: (veiculo as any).marca || '', modelo: veiculo.modelo || '' } },
            }).catch(() => {});
          }
        } catch (err) {
          console.warn('[aprovar-proposta] Erro ativação automática:', err);
        }
      }

      // Criar instalação se necessário (sempre, para permitir geração do link público de vistoria)
      if (!instalacaoDesteVeiculo && !jaTemInstalacaoAtivaDesteVeic) {
        const associadoData = contrato.associado as any;
        // IMPORTANTE: NÃO usar default = hoje. A data DEVE vir da etapa "Instalação"
        // do link público (vistoria_completa_data_agendada). Se não houver, pulamos
        // a criação da instalação para não jogar o cadastro do dia na fila do dia.
        let dataAgendada: string | null = null;
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

        // Se não há data agendada (cliente não completou etapa "Instalação" do link público),
        // NÃO criar instalação — evita poluir fila do dia com data=hoje. A instalação será
        // criada por criar-instalacao-pos-pagamento quando o cliente concluir o agendamento.
        let instalacaoCriadaId: string | null = null;
        if (!dataAgendada) {
          console.warn(`[aprovar-proposta] Sem data agendada para ${veiculo.placa} — instalação NÃO será criada agora (aguardando agendamento via link público).`);
        } else {
          // Guard de idempotência: não criar nova instalação se já existe ativa para a mesma cotação+veículo
          const { data: instJaExiste } = await supabase
            .from('instalacoes')
            .select('id')
            .eq('cotacao_id', contrato.cotacao_id || '')
            .eq('veiculo_id', veiculoId)
            .in('status', ['agendada', 'em_andamento', 'em_analise'])
            .limit(1)
            .maybeSingle();

          instalacaoCriadaId = instJaExiste?.id ?? null;
          if (instJaExiste?.id) {
            console.log(`[aprovar-proposta] Instalação já existe (${instJaExiste.id}) — pulando criação para veículo ${veiculo.placa}`);
          } else {
            const { data: novaInst, error: insErr } = await supabase.from('instalacoes').insert({
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
              dispensa_rastreador: !veiculoPrecisaRastreador,
            }).select('id').single();
            if (insErr) {
              console.error(`[aprovar-proposta] Erro ao criar instalação para ${veiculo.placa}:`, insErr);
            } else {
              instalacaoCriadaId = novaInst?.id ?? null;
              console.log(`[aprovar-proposta] Instalação criada (${instalacaoCriadaId}) para veículo ${veiculo.placa}`);
            }
          }
        }

        // Gerar link público de vistoria automaticamente (idempotente)
        if (instalacaoCriadaId) {
          try {
            const { error: linkErr } = await supabase.functions.invoke('gerar-link-vistoria-publica', {
              body: {
                instalacao_id: instalacaoCriadaId,
                cotacao_id: contrato.cotacao_id || null,
                criado_por: aprovado_por || null,
              },
            });
            if (linkErr) {
              console.warn('[aprovar-proposta] Falha não-bloqueante ao gerar link de vistoria:', linkErr);
            } else {
              console.log(`[aprovar-proposta] Link público de vistoria gerado para instalação ${instalacaoCriadaId}`);
            }
          } catch (e) {
            console.warn('[aprovar-proposta] Exceção não-bloqueante ao gerar link de vistoria:', e);
          }
        }

        // Fallback: se nenhuma instalação foi criada acima (ex.: tipo_vistoria='agendada' sem
        // vistoria_completa_*), delegar para criar-instalacao-pos-pagamento que já lê os campos
        // vistoria_* corretos. É idempotente (checa instalação existente) e respeita aprovação.
        if (!instalacaoCriadaId && contrato.cotacao_id) {
          try {
            const { data: instResp, error: instErr } = await supabase.functions.invoke('criar-instalacao-pos-pagamento', {
              body: { cotacaoId: contrato.cotacao_id, skipPaymentCheck: true },
            });
            if (instErr) {
              console.warn('[aprovar-proposta] Fallback criar-instalacao-pos-pagamento falhou:', instErr);
            } else if (instResp?.instalacaoId) {
              instalacaoCriadaId = instResp.instalacaoId;
              console.log(`[aprovar-proposta] Instalação criada via fallback: ${instalacaoCriadaId}`);
              // gerar link público
              try {
                await supabase.functions.invoke('gerar-link-vistoria-publica', {
                  body: { instalacao_id: instalacaoCriadaId, cotacao_id: contrato.cotacao_id, criado_por: aprovado_por || null },
                });
              } catch (e) {
                console.warn('[aprovar-proposta] Falha não-bloqueante ao gerar link (fallback):', e);
              }
            }
          } catch (e) {
            console.warn('[aprovar-proposta] Exceção no fallback criar-instalacao-pos-pagamento:', e);
          }
        }
      } else if (!veiculoPrecisaRastreador) {
        // SUB-FIPE: Cadastro está aprovando após a autovistoria. Promove o servico
        // vistoria_entrada (em_analise → concluida) para entrar na fila do Monitoramento,
        // e libera Roubo/Furto no veículo. A ativação final continua sendo do Monitoramento
        // (via aprovar-vistoria-monitoramento → ativar-associado).
        try {
          const { data: vistAuto } = await supabase
            .from('vistorias')
            .select('id, status')
            .eq('veiculo_id', veiculoId)
            .eq('modalidade', 'autovistoria')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (vistAuto?.id) {
            // Promover servico vistoria_entrada da cotação (em_analise → concluida)
            if (contrato.cotacao_id) {
              const { error: errPromote } = await supabase
                .from('servicos')
                .update({
                  status: 'concluida',
                  concluida_em: agora,
                })
                .eq('cotacao_id', contrato.cotacao_id)
                .eq('tipo', 'vistoria_entrada')
                .eq('status', 'em_analise');
              if (errPromote) console.warn('[aprovar-proposta] sub-FIPE promote servico falhou:', errPromote);
              else console.log(`[aprovar-proposta] Sub-FIPE: servico vistoria_entrada promovido a concluida (cotação ${contrato.cotacao_id}).`);
            }

            // Liberar Roubo/Furto no veículo
            await supabase
              .from('veiculos')
              .update({ cobertura_roubo_furto: true })
              .eq('id', veiculoId);

            // Atualizar status_contratacao da cotação
            if (contrato.cotacao_id) {
              await supabase
                .from('cotacoes')
                .update({ status_contratacao: 'aguardando_aprovacao_monitoramento' })
                .eq('id', contrato.cotacao_id);
            }
          }
        } catch (e) {
          console.warn('[aprovar-proposta] Erro promoção sub-FIPE pós-autovistoria:', e);
        }

        supabase.functions.invoke('notificar-cliente', {
          body: { tipo: 'cobertura_total_ativada', associado_id: associadoId, dados: { placa: veiculo.placa || '', marca: (veiculo as any).marca || '', modelo: veiculo.modelo || '' } },
        }).catch(() => {});
      }
    }

    // GUARD ANTI-LIMBO: contratos que precisam de rastreador devem ter pelo menos
    // um registro operacional (instalação/vistoria/agendamento_base) ao final do
    // aprovar-proposta. Caso contrário (típico em vendas externas onde a cotação
    // foi marcada como tipo_vistoria='agendada' sem coleta de data/endereço), o
    // associado fica fora de Propostas Pendentes e nunca aparece em Aprovações
    // do Monitoramento. Reverte cadastro_aprovado e devolve erro claro.
    // Reforço: no fluxo "vistoria sem rastreador" (FIPE<30k carro / 9k moto não-Diesel),
    // o veículo NÃO obriga rastreador, mas exige vistoria materializada para entrar na
    // fila do Monitoramento (servico vistoria_entrada concluida → vistorias pendente).
    // Aplicamos o mesmo guard sempre que houver cotação vinculada e nenhuma instalação
    // concluída — independente de algumPrecisouRastreador — para impedir que casos
    // < 30k fiquem em limbo após a aprovação do Cadastro.
    if (!jaTemInstalacaoConcluida && contrato.cotacao_id) {
      const [{ count: instCount }, { count: vistCount }, { count: agbCount }, { count: servCount }] = await Promise.all([
        supabase.from('instalacoes').select('id', { count: 'exact', head: true })
          .eq('cotacao_id', contrato.cotacao_id)
          .in('status', ['agendada', 'em_andamento', 'em_analise', 'em_rota', 'concluida']),
        supabase.from('vistorias').select('id', { count: 'exact', head: true })
          .eq('cotacao_id', contrato.cotacao_id)
          .in('status', ['agendada', 'pendente', 'aprovada', 'em_analise', 'em_rota', 'em_andamento']),
        supabase.from('agendamentos_base').select('id', { count: 'exact', head: true })
          .eq('cotacao_id', contrato.cotacao_id)
          .in('status', ['agendado', 'confirmado', 'realizado']),
        supabase.from('servicos').select('id', { count: 'exact', head: true })
          .eq('cotacao_id', contrato.cotacao_id)
          .in('tipo', ['instalacao', 'vistoria_entrada'])
          .in('status', ['agendada', 'pendente', 'em_andamento', 'em_rota', 'em_analise', 'concluida', 'aprovada', 'aprovada_ressalvas']),
      ]);

      const totalRegistros = (instCount || 0) + (vistCount || 0) + (agbCount || 0) + (servCount || 0);
      if (totalRegistros === 0) {
        console.warn('[aprovar-proposta] LIMBO detectado — sem instalação/vistoria/agendamento/servico. Revertendo cadastro_aprovado.');
        await supabase.from('contratos')
          .update({ cadastro_aprovado: false, aprovado_por: null, aprovado_em: null })
          .eq('id', contrato_id);
        try {
          await supabase.from('logs_auditoria').insert({
            acao: 'aprovar_proposta_bloqueado_sem_agendamento',
            modulo: 'contratos',
            tabela: 'contratos',
            registro_id: contrato_id,
            descricao: `Aprovação bloqueada: cotação ${contrato.cotacao_id} sem vistoria/instalação/agendamento materializado. Cliente precisa concluir autovistoria ou agendar vistoria presencial pelo link público.`,
            usuario_id: aprovado_por || null,
          });
        } catch (_) { /* log opcional */ }
        return jsonResponse({
          success: false,
          codigo: algumPrecisouRastreador ? 'sem_agendamento' : 'sem_vistoria_materializada',
          mensagem: algumPrecisouRastreador
            ? 'Não é possível aprovar: a cotação ainda não possui agendamento de vistoria/instalação. Oriente o cliente a concluir a etapa Vistoria no link público.'
            : 'Não é possível aprovar: a autovistoria/vistoria não foi materializada. Peça ao cliente para refinalizar a vistoria pelo link público.',
          contratoId: contrato_id,
          associadoId,
        }, 409);
      }
    }

    // Aguardar quando:
    //  (a) algum veículo precisa de rastreador e ainda não há instalação concluída, OU
    //  (b) NENHUM veículo precisa de rastreador (fluxo "vistoria sem rastreador" — FIPE<30k carro / 9k moto não-Diesel).
    //      Nesse fluxo a ativação só ocorre após aprovação manual da vistoria pelo Monitoramento
    //      (edge `aplicar-conclusao-vistoria` chama `ativar-associado`). Sem este guard, a chamada
    //      abaixo promovia indevidamente associado/contrato/veículo para 'ativo'.
    const deveAguardarInstalacao = !jaTemInstalacaoConcluida || !algumPrecisouRastreador;

    // Detectar se autovistoria/vistoria já foi aprovada antes da aprovação do Cadastro.
    // Isso muda apenas a mensagem exibida — a ativação real de R/F é feita por
    // processar-vistoria/ativar-associado.
    let autovistoriaAprovada = false;
    try {
      let vistQuery = supabase
        .from('vistorias')
        .select('id, status')
        .in('status', ['aprovada', 'aprovada_ressalvas'])
        .limit(1);
      if (contrato.cotacao_id) {
        vistQuery = vistQuery.eq('cotacao_id', contrato.cotacao_id);
      } else if (veiculoIdDoContrato) {
        vistQuery = vistQuery.eq('veiculo_id', veiculoIdDoContrato);
      }
      const { data: vistAprov } = await vistQuery.maybeSingle();
      autovistoriaAprovada = !!vistAprov;
    } catch (e) {
      console.warn('[aprovar-proposta] Falha ao checar vistoria aprovada:', e);
    }
    // POLÍTICA: o primeiro envio ao SGA é SEMPRE 'pendente', independente de R/F,
    // auto-vistoria ou instalação já concluída. A promoção para 'ativo' acontece
    // exclusivamente após a ativação completa (segundo disparo abaixo).
    const statusSgaDestino: 'pendente' | 'ativo' = 'pendente';
    const motivoDecisaoSga = 'Primeiro envio ao SGA — sempre pendente por política. Promoção para ativo ocorre na ativação completa.';

    if (deveAguardarInstalacao) {
      // Sem rastreador obrigatório → status semanticamente correto: aguardando aprovação do Monitoramento.
      const statusAssociadoAlvo = algumPrecisouRastreador
        ? 'aguardando_instalacao'
        : 'aguardando_aprovacao_monitoramento';
      await Promise.all([
        supabase.from('contratos').update({ status: 'assinado', data_ativacao: null }).eq('id', contrato_id),
        supabase.from('associados').update({ status: statusAssociadoAlvo }).eq('id', associadoId),
      ]);
    } else {
      // Ativação atômica via edge function única (lock + CAS + log)
      const ativarUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ativar-associado`;
      const ativarResp = await fetch(ativarUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          associado_id: associadoId,
          contrato_id: contrato_id,
          source: 'edge:aprovar-proposta',
          actor_id: aprovado_por,
          // status_associado válidos (enum não inclui 'assinado'/'pendente' — esses são de contratos)
          allowed_from: ['aguardando_instalacao', 'aguardando_aprovacao_monitoramento', 'em_analise', 'documentacao_pendente', 'aprovado'],
          metadata: { motivoDecisaoSga, jaTemInstalacaoConcluida, planoTemRouboFurto },
        }),
      });
      const ativarJson: any = await ativarResp.json().catch(() => ({}));
      if (!ativarResp.ok && !ativarJson?.idempotente) {
        console.error('[aprovar-proposta] Falha em ativar-associado:', ativarJson);
        throw new Error(`Falha na ativação atômica: ${ativarJson?.error || ativarResp.status}`);
      }
    }

    // 5. Histórico + documentos + SGA
    const mensagemHistorico = jaTemInstalacaoConcluida
      ? 'Cadastro documental aprovado pelo analista. Instalação já concluída. Proteção 360º ativada.'
      : !planoTemRouboFurto
        ? 'Cadastro documental aprovado pelo analista. Enviado para o Monitoramento para ativação (plano de assistência sem cobertura de Roubo/Furto).'
        : algumPrecisouRastreador
          ? (autovistoriaAprovada
              ? 'Cadastro documental aprovado pelo analista. Cobertura Roubo/Furto liberada (autovistoria já aprovada). Enviado para o Monitoramento agendar a instalação.'
              : 'Cadastro documental aprovado pelo analista. Enviado para o Monitoramento — ativação completa (incluindo Roubo/Furto) ocorrerá após conclusão do Monitoramento.')
          : 'Cadastro documental aprovado pelo analista. Enviado para o Monitoramento para ativação (veículo sem necessidade de rastreador).';

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
    // 1) Primeiro envio sempre PENDENTE (se ainda não sincronizado).
    // 2) Se a ativação completa ocorreu agora (!deveAguardarInstalacao), enfileirar
    //    também um segundo job ATIVO para promover a situação no Hinova.
    try {
      const { data: veiculoParaSGA } = await supabase.from('veiculos')
        .select('id').eq('associado_id', associadoId).eq('sincronizado_hinova', false).limit(1).maybeSingle();

      if (veiculoParaSGA?.id) {
        console.log('[aprovar-proposta] Enfileirando SGA pendente...');
        await supabase.rpc('enqueue_integration', {
          _integration: 'sga',
          _operation: 'hinova_sync',
          _payload: {
            veiculo_id: veiculoParaSGA.id,
            associado_id: associadoId,
            status_sga_destino: 'pendente',
            usuario_id: aprovado_por,
            etapa_origem: 'aprovar-proposta',
            motivo_decisao: motivoDecisaoSga,
          },
          _correlation_id: `sga:hinova:${veiculoParaSGA.id}:pendente`,
          _max_attempts: 5,
          _delay_seconds: 0,
          _created_by: aprovado_por ?? null,
        });
      }

      // Segundo disparo: promoção para ativo somente quando a ativação completa
      // ocorreu nesta chamada (não há etapa de instalação pendente).
      if (!deveAguardarInstalacao) {
        const veiculoIdParaAtivar = veiculoIdDoContrato ?? veiculoParaSGA?.id ?? null;
        if (veiculoIdParaAtivar) {
          console.log('[aprovar-proposta] Enfileirando SGA ativo (ativação completa)...');
          await supabase.rpc('enqueue_integration', {
            _integration: 'sga',
            _operation: 'hinova_sync',
            _payload: {
              veiculo_id: veiculoIdParaAtivar,
              associado_id: associadoId,
              status_sga_destino: 'ativo',
              usuario_id: aprovado_por,
              etapa_origem: 'ativacao-completa',
              motivo_decisao: 'Ativação completa do associado — promover veículo para ativo no SGA.',
            },
            _correlation_id: `sga:hinova:${veiculoIdParaAtivar}:ativo`,
            _max_attempts: 5,
            _delay_seconds: 5, // pequeno atraso para que o pendente cadastre primeiro
            _created_by: aprovado_por ?? null,
          });
        }
      }
    } catch (e) {
      console.warn('[aprovar-proposta] Erro SGA:', e);
    }

    const mensagemRetorno = jaTemInstalacaoConcluida
      ? 'Cadastro documental aprovado! Instalação já concluída. Proteção 360º ativada.'
      : !planoTemRouboFurto
        ? 'Cadastro documental aprovado! Enviado para o Monitoramento para ativação.'
        : algumPrecisouRastreador
          ? (autovistoriaAprovada
              ? 'Cadastro documental aprovado! Cobertura R/F liberada. Enviado para o Monitoramento agendar a instalação.'
              : 'Cadastro documental aprovado! Enviado para o Monitoramento — ativação completa (incluindo Roubo/Furto) ocorrerá após conclusão do Monitoramento.')
          : 'Cadastro documental aprovado! Enviado para o Monitoramento para ativação.';

    console.log('[aprovar-proposta] Concluído:', mensagemRetorno);

    return jsonResponse({ success: true, contratoId: contrato_id, associadoId, mensagem: mensagemRetorno });

  } catch (error) {
    console.error('[aprovar-proposta] Erro:', error);
    const t = translateDbError(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: t.message,
        code: t.code,
        raw: t.raw,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: t.status === 500 ? 400 : t.status }
    );
  }
});

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status,
  });
}
