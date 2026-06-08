// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { translateDbError } from "../_shared/db-error-translator.ts";
import { insertAuditLog } from '../_shared/auditLog.ts';
import {
  checarCompletudeAutovistoriaSubFipe,
  type TipoVeiculoSubFipe,
} from '../_shared/fotosVistoriaSubFipe.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIPE_MINIMO_RASTREADOR_PADRAO = 30000;
const FIPE_MINIMO_RASTREADOR_MOTO_PADRAO = 9000;

// Detecção moto/automóvel canônica vive na RPC `fn_veiculo_precisa_rastreador`
// (que consulta `configuracoes.marcas_exclusivas_moto` + keywords no banco).
// Não há heurística local nesta edge — qualquer decisão por tipo de veículo
// deve ser delegada à RPC.

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

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status,
  });
}

// ============================================================================
// Carregamento
// ============================================================================

async function buscarContrato(supabase: any, contrato_id: string) {
  const { data: contrato, error: fetchError } = await supabase
    .from('contratos')
    .select(`
      id, status, associado_id, veiculo_id, plano_id, valor_mensal, dia_vencimento, cotacao_id, tipo_entrada, origem_troca_titularidade_id, cadastro_aprovado, documentos_aprovados_em,

      associado:associados!fk_contratos_associado (
        id, nome, dia_vencimento, logradouro, numero, bairro, cidade, uf, cep
      )
    `)
    .eq('id', contrato_id)
    .single();

  if (fetchError) throw fetchError;
  if (!contrato?.associado_id) throw new Error('Associado não encontrado');
  return contrato;
}

async function checarPlanoTemRouboFurto(supabase: any, plano_id: string | null | undefined): Promise<boolean> {
  // 1b. Verificar se o plano contratado tem cobertura de Roubo/Furto.
  // Mesma heurística do frontend (regex /roubo|furto/i sobre coberturas.nome).
  let planoTemRouboFurto = false;
  if (plano_id) {
    const { data: planoCobs } = await supabase
      .from('planos_coberturas')
      .select('coberturas(nome)')
      .eq('plano_id', plano_id);
    planoTemRouboFurto = (planoCobs || []).some((row: any) => {
      const nome = row?.coberturas?.nome || '';
      return /roubo|furto/i.test(nome);
    });
  }
  console.log(`[aprovar-proposta] Plano ${plano_id} tem R&F? ${planoTemRouboFurto}`);
  return planoTemRouboFurto;
}

async function carregarContextoParalelo(
  supabase: any,
  args: { contrato_id: string; associadoId: string; veiculoIdDoContrato: string | null; aprovado_por: string; agora: string },
) {
  const { contrato_id, associadoId, veiculoIdDoContrato, aprovado_por, agora } = args;
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

  if (associadoUpdateRes.error) {
    console.error('[aprovar-proposta] Erro associado:', associadoUpdateRes.error);
    throw new Error(`Falha ao atualizar associado: ${associadoUpdateRes.error.message}`);
  }

  // Parse configurações
  // NOTA: `marcas_exclusivas_moto` NÃO é mais lida aqui — a detecção moto/carro
  // vive na RPC `fn_veiculo_precisa_rastreador` (fonte canônica). Os limites FIPE
  // ainda são usados como fallback informativo em logs/respostas downstream.
  let fipeMinRastreador = FIPE_MINIMO_RASTREADOR_PADRAO;
  let fipeMinRastreadorMoto = FIPE_MINIMO_RASTREADOR_MOTO_PADRAO;
  if (configRes.data) {
    for (const cfg of configRes.data) {
      if (cfg.chave === 'operacional_fipe_minimo_rastreador') fipeMinRastreador = Number(cfg.valor) || FIPE_MINIMO_RASTREADOR_PADRAO;
      if (cfg.chave === 'operacional_fipe_minimo_rastreador_moto') fipeMinRastreadorMoto = Number(cfg.valor) || FIPE_MINIMO_RASTREADOR_MOTO_PADRAO;
    }
  }

  return {
    instalacaoConcluida: instalacaoConcluidaRes.data,
    jaTemInstalacaoConcluida: !!instalacaoConcluidaRes.data,
    veiculos: veiculosRes.data || [],
    fipeMinRastreador,
    fipeMinRastreadorMoto,
  };
}

async function atualizarVeiculoComDocs(
  supabase: any,
  veiculoIdDoContrato: string | null,
  campos: { renavam?: string; chassi?: string; numero_motor?: string },
) {
  if (veiculoIdDoContrato && (campos.renavam || campos.chassi || campos.numero_motor)) {
    const updateData: Record<string, string> = {};
    if (campos.renavam) updateData.renavam = campos.renavam;
    if (campos.chassi) updateData.chassi = campos.chassi;
    if (campos.numero_motor) updateData.numero_motor = campos.numero_motor;
    await supabase.from('veiculos').update(updateData).eq('id', veiculoIdDoContrato);
  }
}

// ============================================================================
// Desvio: Troca de Titularidade
// ============================================================================

async function tratarTrocaTitularidade(
  supabase: any,
  contrato: any,
  ctx: { contrato_id: string; aprovado_por: string; agora: string; supabaseUrl: string; supabaseServiceKey: string; authHeader: string | null; bypass_janela?: boolean; bypass_justificativa?: string; bypass_nome_autorizador?: string },
): Promise<{ response: Response } | null> {
  const { contrato_id, aprovado_por, agora, supabaseUrl, supabaseServiceKey, authHeader, bypass_janela, bypass_justificativa, bypass_nome_autorizador } = ctx;

  // ──────────────────────────────────────────────────────────────────────
  // DESVIO: TROCA DE TITULARIDADE
  // ──────────────────────────────────────────────────────────────────────
  // Quando a proposta é uma troca de titularidade, a aprovação do Cadastro
  // tem regras próprias (termo de cancelamento, janela mesmo-dia, SGA do
  // antigo titular). Delegamos para `aprovar-troca-cadastro`, que avança a
  // solicitação para `aguardando_monitoramento`. Aqui só marcamos
  // `contratos.cadastro_aprovado=true` para sair da fila Propostas
  // Pendentes — a efetivação real segue por `efetivar-troca-titularidade`
  // após aprovação do Monitoramento. Não criamos instalação nem ativamos
  // associado/veículo (troca tem caminho próprio).
  let solicitacaoTroca: { id: string; status: string | null } | null = null;
  if ((contrato as any).origem_troca_titularidade_id) {
    const { data: solPorOrigem, error: solPorOrigemErr } = await supabase
      .from('solicitacoes_troca_titularidade')
      .select('id, status')
      .eq('id', (contrato as any).origem_troca_titularidade_id)
      .maybeSingle();
    if (solPorOrigemErr) throw solPorOrigemErr;
    solicitacaoTroca = solPorOrigem;
  }
  if (!solicitacaoTroca && contrato.cotacao_id) {
    const { data: solPorCotacao, error: solPorCotacaoErr } = await supabase
      .from('solicitacoes_troca_titularidade')
      .select('id, status')
      .eq('cotacao_id', contrato.cotacao_id)
      .maybeSingle();
    if (solPorCotacaoErr) throw solPorCotacaoErr;
    solicitacaoTroca = solPorCotacao;
  }

  const isTrocaTitularidade =
    (contrato as any).tipo_entrada === 'troca_titularidade' ||
    !!(contrato as any).origem_troca_titularidade_id ||
    !!solicitacaoTroca;

  if (!isTrocaTitularidade) return null;

  console.log('[aprovar-proposta] Detectada TROCA DE TITULARIDADE — delegando para aprovar-troca-cadastro');
  if (!contrato.cotacao_id) {
    return { response: jsonResponse({ success: false, error: 'Cotação não vinculada à proposta de troca.' }, 400) };
  }
  if (!solicitacaoTroca) {
    return { response: jsonResponse({ success: false, error: 'Solicitação de troca não encontrada para esta cotação.' }, 404) };
  }

  // Idempotência: se contrato já tem cadastro_aprovado, é só retornar OK.
  if ((contrato as any).cadastro_aprovado === true) {
    return {
      response: jsonResponse({
        success: true,
        jaAprovado: true,
        mensagem: 'Troca já aprovada pelo Cadastro.',
        contratoId: contrato_id,
        associadoId: contrato.associado_id,
      }),
    };
  }

  const trocaUrl = `${supabaseUrl}/functions/v1/aprovar-troca-cadastro`;
  const trocaResp = await fetch(trocaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // aprovar-troca-cadastro exige Authorization para resolver o aprovador.
      Authorization: authHeader || `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({
      solicitacao_id: solicitacaoTroca.id,
      ...(bypass_janela ? { bypass_janela: true, bypass_justificativa: bypass_justificativa || '', bypass_nome_autorizador: bypass_nome_autorizador || '' } : {}),
    }),
  });
  const trocaJson: any = await trocaResp.json().catch(() => ({}));

  if (!trocaResp.ok && !trocaJson?.already_advanced) {
    // Repassar erros estruturados (link_publico_incompleto, inadimplencia_sga_pendente, JANELA_TROCA_EXPIRADA)
    return {
      response: new Response(JSON.stringify({
        success: false,
        error: trocaJson?.message || trocaJson?.error || 'Falha na aprovação da troca',
        codigo: trocaJson?.code || trocaJson?.error,
        mensagem: trocaJson?.message || trocaJson?.error || 'Falha na aprovação da troca',
      }), {
        status: trocaResp.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }),
    };
  }

  // Marcar contrato como aprovado pelo Cadastro para sair da fila Propostas Pendentes.
  await supabase
    .from('contratos')
    .update({ cadastro_aprovado: true, aprovado_por, aprovado_em: agora })
    .eq('id', contrato_id);

  try {
    await supabase.from('associados_historico').insert({
      associado_id: contrato.associado_id,
      contrato_id: contrato_id,
      tipo: 'status_alterado',
      descricao: 'Troca de titularidade aprovada pelo Cadastro — enviada ao Monitoramento.',
      usuario_id: aprovado_por,
    });
  } catch (_) { /* log opcional */ }

  return {
    response: jsonResponse({
      success: true,
      contratoId: contrato_id,
      associadoId: contrato.associado_id,
      mensagem: 'Troca de titularidade aprovada pelo Cadastro! Enviada ao Monitoramento.',
    }),
  };
}

// ============================================================================
// Gates
// ============================================================================

function gateDocumentosAprovados(contrato: any): Response | null {
  // ── GATE: Sub-etapa 1 do Cadastro (aprovação de documentos) ────────────
  // Canônico: o Cadastro trabalha em DUAS sub-etapas sequenciais.
  //   1) Aprovação de documentos  → aprovar-documentos-cadastro
  //   2) Aprovação da vistoria enxuta (esta edge)
  // Troca de titularidade segue fluxo próprio (delegado acima) e não usa
  // sub-etapas — por isso a checagem fica APÓS o early-return da troca.
  if (!(contrato as any).documentos_aprovados_em) {
    return new Response(
      JSON.stringify({
        success: false,
        codigo: 'documentos_nao_aprovados',
        error: 'documentos_nao_aprovados',
        mensagem: 'Aprove primeiro a sub-etapa 1 (documentos) antes de aprovar a vistoria enxuta.',
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  return null;
}

async function gateSituacaoFinanceiraSGA(supabase: any, contrato_id: string): Promise<Response | null> {
  // ── GATE: Situação Financeira (SGA) ────────────────────────────────────
  // Bloqueia aprovação se não houver registro liberador recente em
  // sga_situacao_check (≤ 24h). Liberador = !tem_debito OU bypass=true OU
  // origem_resultado em ('transitorio','associado_inexistente_sga').
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
  return null;
}

async function gateCaminhoPublicoCompleto(
  supabase: any,
  args: { contrato_id: string; cotacao_id: string | null; veiculo_id: string | null; aprovado_por: string },
): Promise<Response | null> {
  const { contrato_id, cotacao_id, veiculo_id, aprovado_por } = args;
  // ── GATE: Caminho público completo ─────────────────────────────────────
  // Réplica server-side do gate hoje só client-side em
  // src/hooks/usePropostasPendentes.ts (linhas 760–778). Garante que
  // o cliente cumpriu pelo menos uma das etapas canônicas antes do
  // Cadastro poder aprovar. Sem isso, qualquer chamada à edge (script,
  // API externa, integração) consegue marcar `cadastro_aprovado=true`
  // pulando a etapa.
  //
  // Aceita uma das condições:
  //   1) Autovistoria enxuta: ≥2 fotos em vistoria modalidade='autovistoria' + video_360_url
  //   2) Vistoria presencial materializada: vistoria modalidade≠'autovistoria' + ≥1 foto
  //   3) Agendamento de instalação ativo: agendamentos_base em ('agendado','realizado')
  //   4) Instalação ativa: instalacoes com status ≠ ('cancelada','concluida')
  //   5) Instalação já concluída (caminho histórico — não pode bloquear).
  //
  // Troca de titularidade já foi delegada acima (return early) e nem
  // chega aqui — segue isenta conforme regra canônica.
  const cotacaoIdForGate = cotacao_id || null;
  const veiculoIdForGate = veiculo_id || null;

  type GateResult = { ok: boolean; via: string };
  const checks: Array<Promise<GateResult>> = [];

  // (5) Instalação JÁ concluída — caso histórico (re-aprovação)
  checks.push(
    supabase.from('instalacoes')
      .select('id', { head: true, count: 'exact' })
      .eq('contrato_id', contrato_id)
      .eq('status', 'concluida')
      .then((r: any) => ({ ok: (r.count ?? 0) > 0, via: 'instalacao_concluida' })),
  );

  // (4) Instalação ativa (agendada / em_andamento / em_rota / em_analise)
  checks.push(
    supabase.from('instalacoes')
      .select('id', { head: true, count: 'exact' })
      .eq('contrato_id', contrato_id)
      .in('status', ['agendada', 'em_andamento', 'em_rota', 'em_analise'])
      .then((r: any) => ({ ok: (r.count ?? 0) > 0, via: 'instalacao_ativa' })),
  );

  // (3) Agendamento de instalação base ativo
  if (cotacaoIdForGate) {
    checks.push(
      supabase.from('agendamentos_base')
        .select('id', { head: true, count: 'exact' })
        .eq('cotacao_id', cotacaoIdForGate)
        .in('status', ['agendado', 'realizado'])
        .then((r: any) => ({ ok: (r.count ?? 0) > 0, via: 'agendamento_base' })),
    );
  }

  // (1) e (2) Vistoria materializada (presencial ou autovistoria)
  // CANÔNICO B1: detecta sub-FIPE via `fn_veiculo_precisa_rastreador` e exige
  // completude COMPLETA (31 carro / 15 moto + vídeo 360°) — autovistoria enxuta
  // de 2 fotos + vídeo só é aceita para ≥30k. Sem essa distinção, sub-FIPE com
  // 3 fotos avançava para `cadastro_aprovado=true` e até `ativo` (casos
  // confirmados em jun/26: 0e685fc0, b8704b27, 534dd759, d3126a85, c735c5e6).
  let subFipeRequereCompleta = false;
  let tipoVeiculoSubFipe: TipoVeiculoSubFipe = 'carro';
  if (veiculoIdForGate) {
    try {
      const { data: precisa } = await supabase
        .rpc('fn_veiculo_precisa_rastreador', { _veiculo_id: veiculoIdForGate });
      subFipeRequereCompleta = precisa === false;
      if (subFipeRequereCompleta) {
        const { data: vinfo } = await supabase
          .from('veiculos')
          .select('marca, modelo, marca_modelo:marcas_modelos(tipo_veiculo)')
          .eq('id', veiculoIdForGate)
          .maybeSingle();
        const tipoCat = ((vinfo as any)?.marca_modelo?.tipo_veiculo || '').toLowerCase();
        if (tipoCat === 'moto') {
          tipoVeiculoSubFipe = 'moto';
        } else {
          const marca = ((vinfo as any)?.marca || '').toUpperCase();
          const modelo = ((vinfo as any)?.modelo || '').toUpperCase();
          if (/MOTO|CG|XRE|FAZER|YBR|TITAN|BIZ|POP|BROS|FAN/.test(marca + ' ' + modelo)) {
            tipoVeiculoSubFipe = 'moto';
          }
        }
      }
    } catch (e) {
      console.warn('[aprovar-proposta] gate: falha detecção sub-FIPE — usa enxuta como fallback fail-safe:', e);
      subFipeRequereCompleta = false;
    }
  }

  const vistoriaFilter: string[] = [];
  vistoriaFilter.push(`contrato_id.eq.${contrato_id}`);
  if (cotacaoIdForGate) vistoriaFilter.push(`cotacao_id.eq.${cotacaoIdForGate}`);
  if (veiculoIdForGate) vistoriaFilter.push(`veiculo_id.eq.${veiculoIdForGate}`);
  checks.push(
    supabase.from('vistorias')
      .select('id, modalidade, video_360_url')
      .or(vistoriaFilter.join(','))
      .then(async (r: any) => {
        const vist = (r.data || []) as any[];
        if (vist.length === 0) return { ok: false, via: 'sem_vistoria' };
        const ids = vist.map((v) => v.id);
        const { data: fotosRows } = await supabase
          .from('vistoria_fotos')
          .select('vistoria_id, tipo')
          .in('vistoria_id', ids);
        const fotosPorVist = new Map<string, any[]>();
        for (const f of (fotosRows || []) as any[]) {
          const arr = fotosPorVist.get(f.vistoria_id) || [];
          arr.push(f);
          fotosPorVist.set(f.vistoria_id, arr);
        }
        for (const v of vist) {
          const fotos = fotosPorVist.get(v.id) || [];
          const modalidade = (v.modalidade || '').toLowerCase();
          if (modalidade === 'autovistoria') {
            const temVideo = !!v.video_360_url
              || fotos.some((f) => ['video_360', 'video'].includes((f.tipo || '').toLowerCase()));
            if (subFipeRequereCompleta) {
              // Sub-FIPE: roteiro COMPLETO obrigatório.
              const tiposEnviados = fotos.map((f) => (f.tipo || '').toLowerCase());
              if (temVideo) tiposEnviados.push('video_360');
              const completude = checarCompletudeAutovistoriaSubFipe({
                tipo: tipoVeiculoSubFipe,
                fotosEnviadas: tiposEnviados,
              });
              if (completude.ok) {
                return { ok: true, via: 'autovistoria_sub_fipe_completa' };
              }
              console.warn('[aprovar-proposta] gate sub-FIPE incompleto:', {
                vistoria_id: v.id,
                tipo: tipoVeiculoSubFipe,
                faltantes: completude.obrigatoriasFaltantes,
                videoFaltante: completude.videoFaltante,
                recebidas: completude.recebidas,
              });
              // Não retorna ok aqui — segue avaliando outras vistorias/checks.
            } else if (fotos.length >= 2 && temVideo) {
              // ≥FIPE: autovistoria enxuta basta (2 fotos + vídeo 360°).
              return { ok: true, via: 'autovistoria_enxuta' };
            }
          } else {
            // (2) vistoria presencial materializada: ≥1 foto
            if (fotos.length >= 1) {
              return { ok: true, via: 'vistoria_presencial' };
            }
          }
        }
        return {
          ok: false,
          via: subFipeRequereCompleta ? 'autovistoria_sub_fipe_incompleta' : 'vistoria_incompleta',
        };
      }),
  );


  const results = await Promise.all(checks);
  const aprovado = results.find((r) => r.ok);

  if (!aprovado) {
    const motivos = results.map((r) => r.via).join(',');
    console.warn('[aprovar-proposta] BLOQUEIO caminho_publico_incompleto:', { contrato_id, motivos });
    try {
      await insertAuditLog(supabase as any, {
        acao: 'aprovar_proposta_bloqueado_caminho_incompleto',
        modulo: 'contratos',
        tabela: 'contratos',
        registro_id: contrato_id,
        descricao: `Aprovação bloqueada pelo gate de caminho público: nenhuma das etapas canônicas foi cumprida (autovistoria enxuta, vistoria presencial materializada, agendamento de instalação ou instalação ativa). Verificações: ${motivos}.`,
        usuario_id: aprovado_por || null,
      });
    } catch (_) { /* log opcional */ }
    return new Response(
      JSON.stringify({
        success: false,
        codigo: 'caminho_publico_incompleto',
        error: 'caminho_publico_incompleto',
        mensagem:
          'Não é possível aprovar: o cliente ainda não concluiu o caminho público. ' +
          'É necessário pelo menos uma destas etapas: autovistoria enxuta concluída ' +
          '(2 fotos + vídeo 360°), vistoria presencial materializada, agendamento de ' +
          'instalação ativo ou instalação já agendada/em andamento.',
        verificacoes: motivos,
      }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  console.log(`[aprovar-proposta] caminho público OK via "${aprovado.via}" — prosseguindo com aprovação.`);
  return null;
}

// ============================================================================
// Mutações principais
// ============================================================================

async function registrarAprovacaoCadastral(
  supabase: any,
  contrato_id: string,
  aprovado_por: string,
  agora: string,
  associadoId: string,
): Promise<{ jaAprovadoResponse?: Response }> {
  // 2. Registrar aprovação cadastral no contrato sem ativar ainda.
  // A ativação definitiva acontece somente após instalação + aprovação do Monitoramento.
  const { data: contratoAtualizado, error: contratoError } = await supabase
    .from('contratos')
    .update({ aprovado_por, aprovado_em: agora, cadastro_aprovado: true })
    .eq('id', contrato_id)
    .eq('status', 'assinado')
    .select('id, status')
    .maybeSingle();

  // NOTA: a promoção do servico vistoria_entrada (autovistoria) para `concluida`
  // NÃO é mais feita aqui de forma incondicional. O comportamento agora depende
  // de o veículo precisar ou não de rastreador:
  //   - Sub-FIPE (sem rastreador): bloco SUB-FIPE adiante promove para `concluida`
  //     (único caminho de aprovação, vai direto para a fila do Monitoramento).
  //   - ≥30k (com rastreador): bloco "AUTOVISTORIA ANTECIPADA" adiante marca o
  //     servico de autovistoria como `aprovada` (terminal, fora da fila). A fila
  //     do Monitoramento só verá o caso quando o servico vistoria_entrada/instalacao
  //     PRESENCIAL do técnico for concluído.

  if (contratoError) throw new Error(`Falha ao atualizar contrato: ${contratoError.message}`);

  if (!contratoAtualizado) {
    const { data: refetch } = await supabase.from('contratos').select('status').eq('id', contrato_id).single();
    if (refetch?.status === 'ativo' || refetch?.status === 'assinado') {
      return {
        jaAprovadoResponse: jsonResponse({ success: true, jaAprovado: true, mensagem: 'Este contrato já foi aprovado por outro usuário.', contratoId: contrato_id, associadoId }),
      };
    }
    throw new Error(`Não foi possível aprovar. Status atual: ${refetch?.status || 'desconhecido'}`);
  }
  return {};
}

// ============================================================================
// Loop por veículo (extraído como processador único)
// ============================================================================

async function processarVeiculoAprovado(
  supabase: any,
  args: {
    veiculo: any;
    contrato: any;
    contrato_id: string;
    associadoId: string;
    veiculoIdDoContrato: string | null;
    planoTemRouboFurto: boolean;
    jaTemInstalacaoConcluida: boolean;
    instalacaoConcluida: any;
    aprovado_por: string;
    agora: string;
    supabaseUrl: string;
    supabaseServiceKey: string;
  },
): Promise<{ precisouRastreador: boolean; criouProtecao360SemRastreador: boolean }> {
  const {
    veiculo, contrato, contrato_id, associadoId, veiculoIdDoContrato,
    planoTemRouboFurto, jaTemInstalacaoConcluida, instalacaoConcluida,
    aprovado_por, agora, supabaseUrl, supabaseServiceKey,
  } = args;

  const veiculoId = veiculo.id;
  const valorFipe = (veiculo as any).valor_fipe || 0;

  // CANÔNICO: usar RPC `fn_veiculo_precisa_rastreador` como fonte única de verdade.
  // Heurística local foi removida (falhava em casos como Honda ADV 150, que o catálogo
  // marcas_modelos classificava como 'carro', causando `dispensa_rastreador=true` indevido).
  // A RPC centraliza: Diesel sempre exige; FIPE mínimo carro vs moto via configurações;
  // detecção moto via marcas_exclusivas_moto + keywords de modelo. Mesma fonte usada
  // por triggers e UI.
  let veiculoPrecisaRastreador = true;
  try {
    const { data: precisa, error: rpcErr } = await supabase
      .rpc('fn_veiculo_precisa_rastreador', { _veiculo_id: veiculoId });
    if (rpcErr) throw rpcErr;
    veiculoPrecisaRastreador = precisa !== false; // fail-safe: null/undefined → true
  } catch (e) {
    console.warn(`[aprovar-proposta] RPC fn_veiculo_precisa_rastreador falhou para ${veiculoId} (${(e as Error).message}); fallback fail-safe=true`);
    veiculoPrecisaRastreador = true;
  }

  const instalacaoDesteVeiculo = jaTemInstalacaoConcluida && (instalacaoConcluida as any)?.veiculo_id === veiculoId;
  // REGRA CORE: ativação SEMPRE via edge `ativar-associado` (lock + CAS + log + SGA).
  // Aqui NUNCA marcamos veiculos.status='ativo' nem ativamos coberturas — mesmo que
  // a instalação já esteja concluída, a vistoria ainda precisa ser aprovada manualmente
  // (paridade total com ≥30k/9k). A aprovação da vistoria é o único gatilho que dispara
  // ativar-associado e promove veículo+associado+contrato para ativo de forma sincronizada
  // com o SGA. Marcar ativo aqui causava estado inconsistente (veículo ativo, associado
  // em_analise, sem código Hinova) e mantinha o caso preso na fila de Cadastro.
  const statusVeiculo = 'instalacao_pendente';

  console.log(`[aprovar-proposta] Veículo ${veiculo.placa} (FIPE R$${valorFipe}): precisaRastreador=${veiculoPrecisaRastreador}, instalacaoJaConcluida=${instalacaoDesteVeiculo}, status=${statusVeiculo} (ativação real virá pela aprovação da vistoria → ativar-associado)`);

  await supabase.from('veiculos').update({
    status: statusVeiculo,
    cobertura_roubo_furto: false,
    cobertura_total: false,
  }).eq('id', veiculoId);

  // Verificar se já existe instalação ativa para este veículo.
  // REGRA CANÔNICA (sub-FIPE / dispensa_rastreador): veículos que NÃO precisam de
  // rastreador NÃO geram instalacao — o artefato canônico é o servico vistoria_entrada
  // criado pelo finalizar-autovistoria-cotacao. Criar instalação aqui causava o caso
  // entrar duplicado na fila do Monitoramento (instalacao concluida + servico concluido)
  // e pular a etapa de atribuição. Ver mem://logic/operations/vistoria-sem-rastreador-flow.
  let jaTemInstalacaoAtivaDesteVeic = false;
  if (!veiculoPrecisaRastreador) {
    console.log(`[aprovar-proposta] Veículo ${veiculo.placa} dispensa rastreador — NÃO criar instalação (artefato canônico = servico vistoria_entrada).`);
    jaTemInstalacaoAtivaDesteVeic = true; // bloqueia o bloco de criação abaixo
  }
  if (!instalacaoDesteVeiculo && veiculoPrecisaRastreador) {
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

        // CAMADA 2: só anuncia 'cobertura_total_ativada' se associado/veiculo já estão
        // efetivamente ATIVOS. Caso contrário (sub-FIPE, aguardando instalação,
        // pendente de monitoramento) a notificação é mentira — quem libera o anúncio
        // é o `aplicar-conclusao-vistoria` → `ativar-associado` ao virar ATIVO de fato.
        try {
          const { data: vAtivo } = await supabase
            .from('veiculos')
            .select('status, cobertura_total')
            .eq('id', veiculoId)
            .maybeSingle();
          if (vAtivo?.status === 'ativo' && vAtivo?.cobertura_total === true) {
            supabase.functions.invoke('notificar-cliente', {
              body: { tipo: 'cobertura_total_ativada', associado_id: associadoId, dados: { placa: veiculo.placa || '', marca: (veiculo as any).marca || '', modelo: veiculo.modelo || '' } },
            }).catch(() => {});
          } else {
            console.log('[aprovar-proposta] suprimindo cobertura_total_ativada — veículo ainda não está ativo', { veiculoId, status: vAtivo?.status, cobertura_total: vAtivo?.cobertura_total });
          }
        } catch (_) { /* não bloqueia */ }
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

    // ============================================================
    // AUTOVISTORIA ANTECIPADA + RASTREADOR OBRIGATÓRIO
    // ------------------------------------------------------------
    // Cenário: associado fez autovistoria (motor + chassi + vídeo 360°)
    // ANTES do dia da instalação base já agendada, justamente para liberar
    // a Cobertura R&F já no Cadastro. Quando a autovistoria está completa
    // (canônica nova >=2 fotos+vídeo OU legado 31/15) e o plano tem R&F,
    // o Cadastro libera R&F agora e marca a autovistoria como aprovada.
    // A instalação do rastreador segue para o Monitoramento normalmente.
    // ============================================================
    if (planoTemRouboFurto) {
      try {
        const { data: vistAutoRf } = await supabase
          .from('vistorias')
          .select('id, status, video_360_url')
          .eq('veiculo_id', veiculoId)
          .eq('modalidade', 'autovistoria')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (vistAutoRf?.id && vistAutoRf.status === 'pendente') {
          const { count: nFotos } = await supabase
            .from('vistoria_fotos')
            .select('id', { count: 'exact', head: true })
            .eq('vistoria_id', vistAutoRf.id);

          // DEFESA: vistorias.video_360_url pode estar nulo se o vídeo chegou
          // depois das fotos em uploads separados (bug histórico do trigger
          // fn_materializar_autovistoria_cotacao — já corrigido, mas mantemos
          // fallback consultando vistoria_fotos por tipo video_360/video).
          let temVideo360 = !!vistAutoRf.video_360_url;
          if (!temVideo360) {
            const { count: nVid } = await supabase
              .from('vistoria_fotos')
              .select('id', { count: 'exact', head: true })
              .eq('vistoria_id', vistAutoRf.id)
              .in('tipo', ['video_360', 'video']);
            temVideo360 = (nVid ?? 0) > 0;
            if (temVideo360) {
              // Self-heal: sincroniza o header da vistoria com o vídeo já existente.
              const { data: vidRow } = await supabase
                .from('vistoria_fotos')
                .select('arquivo_url')
                .eq('vistoria_id', vistAutoRf.id)
                .in('tipo', ['video_360', 'video'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              if (vidRow?.arquivo_url) {
                await supabase
                  .from('vistorias')
                  .update({ video_360_url: vidRow.arquivo_url })
                  .eq('id', vistAutoRf.id);
              }
            }
          }

          // REGRA CANÔNICA: Cadastro só libera R/F via autovistoria ENXUTA
          // (2 fotos motor+chassi + vídeo 360°) acima da FIPE mínima.
          // Roteiro completo (31/15) é sub-FIPE → Monitoramento decide R/F,
          // NÃO o Cadastro. Memória: mem://logic/operations/cadastro-escopo-canonico
          // Detecção moto/carro via RPC canônica fn_detectar_tipo_veiculo
          // (mesma fonte usada por fn_veiculo_precisa_rastreador).
          let isMotoVeic = false;
          try {
            const { data: tipoDet } = await supabase.rpc('fn_detectar_tipo_veiculo', {
              _marca: (veiculo as any).marca || '',
              _modelo: veiculo.modelo || '',
            });
            isMotoVeic = tipoDet === 'moto';
          } catch (e) {
            console.warn('[aprovar-proposta] fn_detectar_tipo_veiculo falhou, assumindo carro:', e);
          }
          const minCompleta = isMotoVeic ? 15 : 31;
          const temFotosEnxuta =
            (nFotos ?? 0) >= 2 &&
            (nFotos ?? 0) < minCompleta &&
            temVideo360;
          const temFotosLegado = false; // Desativado por regra canônica.


          if (temFotosEnxuta || temFotosLegado) {
            await supabase
              .from('vistorias')
              .update({
                status: 'aprovada',
                analisado_em: agora,
                analisado_por: aprovado_por || null,
              })
              .eq('id', vistAutoRf.id)
              .eq('status', 'pendente');

            await supabase
              .from('veiculos')
              .update({ cobertura_roubo_furto: true })
              .eq('id', veiculoId);

            // Marcar o servico vistoria_entrada (autovistoria) como `aprovada`
            // (terminal, fora da fila do Monitoramento). A fila só receberá o
            // caso quando o servico PRESENCIAL do técnico for concluído.
            if (contrato.cotacao_id) {
              // REWIND ROBUSTO: aceita também 'concluida' — em fluxos antigos o
              // servico vistoria_entrada de autovistoria foi indevidamente promovido
              // para 'concluida' (entrando na fila final do Monitoramento). Como o
              // veículo exige rastreador, a fila final só pode receber instalação
              // técnica concluída; rebaixamos para 'aprovada' (terminal, fora da fila).
              const { error: errAprovServ } = await supabase
                .from('servicos')
                .update({
                  status: 'aprovada',
                  analisado_em: agora,
                  analisado_por: aprovado_por || null,
                  concluida_em: null,
                  observacoes_analise: 'Autovistoria aprovada pelo Cadastro — Roubo/Furto liberado. Aguardando vistoria/instalação presencial do técnico para entrar na fila do Monitoramento.',
                })
                .eq('cotacao_id', contrato.cotacao_id)
                .eq('tipo', 'vistoria_entrada')
                .eq('modalidade', 'autovistoria')
                .in('status', ['em_analise', 'concluida']);
              if (errAprovServ) console.warn('[aprovar-proposta] Falha ao marcar servico autovistoria como aprovada:', errAprovServ);
            }

            await supabase.from('associados_historico').insert({
              associado_id: associadoId,
              contrato_id: contrato_id,
              tipo: 'status_alterado',
              descricao: `Cobertura Roubo/Furto liberada pelo Cadastro via autovistoria (veículo ${veiculo.placa}). Instalação do rastreador segue no agendamento já marcado.`,
              usuario_id: aprovado_por || null,
            });

            // CANÔNICO: após o Cadastro liberar R/F via autovistoria enxuta acima FIPE,
            // se NÃO houver instalação física agendada para o veículo, reabrir a etapa
            // de agendamento no link público — `status_contratacao='aguardando_instalacao'`.
            // Sem isso, a cotação fica em `pagamento_ok`, a etapa some, e o caso
            // nunca chega à fila Serviços de Campo (caso Eder Lopes / RJX3E41).
            try {
              const { data: instAgendada } = await supabase
                .from('instalacoes')
                .select('id')
                .eq('veiculo_id', veiculoId)
                .in('status', ['agendada', 'em_rota', 'em_andamento'])
                .limit(1)
                .maybeSingle();

              if (!instAgendada?.id && contrato.cotacao_id) {
                await supabase
                  .from('cotacoes')
                  .update({ status_contratacao: 'aguardando_instalacao' })
                  .eq('id', contrato.cotacao_id);
                console.log(`[aprovar-proposta] Cotação ${contrato.cotacao_id} reaberta para agendamento (sem instalação física agendada).`);
              }
            } catch (e) {
              console.warn('[aprovar-proposta] Falha ao reabrir cotação para agendamento:', e);
            }

            console.log(`[aprovar-proposta] Autovistoria ${vistAutoRf.id} aprovada e R&F liberado para veículo ${veiculo.placa}.`);
          } else {
            console.log(`[aprovar-proposta] Autovistoria ${vistAutoRf.id} incompleta (fotos=${nFotos}, video=${!!vistAutoRf.video_360_url}) — R&F não liberado.`);
          }
        }
      } catch (e) {
        console.warn('[aprovar-proposta] Erro liberação R&F via autovistoria antecipada:', e);
      }
    }
  } else if (!veiculoPrecisaRastreador) {
    // SUB-FIPE: comportamento depende da via escolhida no link público
    // (cotacoes.dados_extras.via_vistoria_sub_fipe):
    //   - completa_celular: comportamento atual (Monitoramento decide R/F).
    //   - rf_celular: Cadastro libera Roubo & Furto agora; presencial pendente.
    //   - sem_fotos: nenhuma cobertura até concluir presencial.
    let viaSubFipe: 'completa_celular' | 'rf_celular' | 'sem_fotos' | null = null;
    if (contrato.cotacao_id) {
      try {
        const { data: cotExtras } = await supabase
          .from('cotacoes')
          .select('dados_extras')
          .eq('id', contrato.cotacao_id)
          .maybeSingle();
        const via = (cotExtras as any)?.dados_extras?.via_vistoria_sub_fipe;
        if (via === 'completa_celular' || via === 'rf_celular' || via === 'sem_fotos') {
          viaSubFipe = via;
        }
      } catch (e) {
        console.warn('[aprovar-proposta] sub-FIPE: falha lendo via_vistoria_sub_fipe', e);
      }
    }
    console.log(`[aprovar-proposta] sub-FIPE via=${viaSubFipe ?? 'indefinida'} veic=${veiculoId}`);

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
        // PRÉ-REQUISITO do guard trg_guard_servico_autovistoria_concluida:
        // a vistoria precisa estar `aprovada` ANTES do servico virar `concluida`.
        // Sem isso o UPDATE abaixo dispara o guard e o caso fica em limbo
        // (cadastro_aprovado=true porém servico em_analise → some das filas).
        if (vistAuto.status !== 'aprovada') {
          const { error: errVistAprov } = await supabase
            .from('vistorias')
            .update({ status: 'aprovada', analisado_em: agora, concluida_em: agora })
            .eq('id', vistAuto.id)
            .in('status', ['pendente', 'em_analise']);
          if (errVistAprov) console.warn('[aprovar-proposta] sub-FIPE aprovar vistoria falhou:', errVistAprov);
          else console.log(`[aprovar-proposta] Sub-FIPE: vistoria ${vistAuto.id} aprovada antes de promover servico.`);
        }

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


        // Via 2 (rf_celular) — Cadastro libera R&F agora se o plano tem.
        if (viaSubFipe === 'rf_celular' && planoTemRouboFurto) {
          await supabase
            .from('veiculos')
            .update({ cobertura_roubo_furto: true })
            .eq('id', veiculoId);
          await supabase.from('associados_historico').insert({
            associado_id: associadoId,
            contrato_id: contrato_id,
            tipo: 'status_alterado',
            descricao: `Sub-FIPE Via 2 (R&F pelo celular): Cobertura Roubo/Furto liberada pelo Cadastro (veículo ${veiculo.placa}). Vistoria presencial pendente.`,
            usuario_id: aprovado_por || null,
          });
          console.log(`[aprovar-proposta] sub-FIPE Via 2: R&F liberado para veículo ${veiculo.placa}.`);
        } else if (viaSubFipe === 'sem_fotos') {
          // Via 3 — explicitamente NÃO libera nada até presencial.
          console.log(`[aprovar-proposta] sub-FIPE Via 3 (sem fotos): cobertura permanece suspensa até presencial.`);
        }

        // Atualizar status_contratacao da cotação
        if (contrato.cotacao_id) {
          await supabase
            .from('cotacoes')
            .update({ status_contratacao: 'aguardando_aprovacao_monitoramento' })
            .eq('id', contrato.cotacao_id);
        }
      } else {
        // C1: defesa em profundidade. Se chegou aqui é porque o gate
        // gateCaminhoPublicoCompleto deixou passar (race, ou caminho legado
        // via instalação/agendamento), mas o branch sub-FIPE espera vistoria
        // materializada. NUNCA promover `cadastro_aprovado` sem vistoria —
        // reverte e devolve 409 sem_autovistoria_sub_fipe.
        console.error('[aprovar-proposta] sub-FIPE sem autovistoria materializada — revertendo cadastro_aprovado', {
          contrato_id, veiculoId, cotacaoId: contrato.cotacao_id,
        });
        await supabase
          .from('contratos')
          .update({
            cadastro_aprovado: false,
            aprovado_em: null,
            aprovado_por: null,
            documentos_aprovados_em: null,
          })
          .eq('id', contrato_id);
        try {
          await insertAuditLog(supabase, {
            usuario_id: aprovado_por || null,
            acao: 'aprovar_proposta_bloqueado_sub_fipe_sem_vistoria',
            modulo: 'contratos',
            tabela: 'contratos',
            registro_id: contrato_id,
            descricao: 'Aprovação revertida: veículo sub-FIPE não possui autovistoria materializada. Cliente precisa concluir o roteiro completo (31 carro / 15 moto + vídeo 360°) antes do Cadastro aprovar.',
          });
        } catch { /* best-effort */ }
        const err = new Error('sem_autovistoria_sub_fipe');
        (err as any).aprovarPropostaResponse = jsonResponse({
          success: false,
          codigo: 'sem_autovistoria_sub_fipe',
          error: 'sem_autovistoria_sub_fipe',
          mensagem: 'Veículo sub-FIPE não possui autovistoria materializada. Aguarde o cliente concluir o roteiro completo no link público antes de aprovar.',
        }, 409);
        throw err;
      }
    } catch (e: any) {
      // Re-lança sentinelas estruturadas; loga e segue para os demais erros transitórios.
      if (e?.aprovarPropostaResponse) throw e;
      console.warn('[aprovar-proposta] Erro promoção sub-FIPE pós-autovistoria:', e);
    }



    // CAMADA 2: gating idêntico ao caminho acima — só notifica se veículo realmente ATIVO.
    try {
      const { data: vAtivo2 } = await supabase
        .from('veiculos')
        .select('status, cobertura_total')
        .eq('id', veiculoId)
        .maybeSingle();
      if (vAtivo2?.status === 'ativo' && vAtivo2?.cobertura_total === true) {
        supabase.functions.invoke('notificar-cliente', {
          body: { tipo: 'cobertura_total_ativada', associado_id: associadoId, dados: { placa: veiculo.placa || '', marca: (veiculo as any).marca || '', modelo: veiculo.modelo || '' } },
        }).catch(() => {});
      } else {
        console.log('[aprovar-proposta/pos-autovistoria] suprimindo cobertura_total_ativada — veículo ainda não ativo', { veiculoId, status: vAtivo2?.status, cobertura_total: vAtivo2?.cobertura_total });
      }
    } catch (_) { /* não bloqueia */ }
  }

  return {
    precisouRastreador: veiculoPrecisaRastreador,
    criouProtecao360SemRastreador: !veiculoPrecisaRastreador,
  };
}

// ============================================================================
// Guards finais
// ============================================================================

async function guardAntiLimboPosProcessamento(
  supabase: any,
  args: { contrato: any; contrato_id: string; associadoId: string; jaTemInstalacaoConcluida: boolean; algumPrecisouRastreador: boolean; aprovado_por: string },
): Promise<Response | null> {
  const { contrato, contrato_id, associadoId, jaTemInstalacaoConcluida, algumPrecisouRastreador, aprovado_por } = args;

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
    const semInstalacaoOuAgendamento = (instCount || 0) === 0 && (agbCount || 0) === 0;

    if (totalRegistros === 0) {
      console.warn('[aprovar-proposta] LIMBO detectado — sem instalação/vistoria/agendamento/servico. Revertendo cadastro_aprovado.');
      await supabase.from('contratos')
        .update({ cadastro_aprovado: false, aprovado_por: null, aprovado_em: null })
        .eq('id', contrato_id);
      try {
        await insertAuditLog(supabase as any, {
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

    // GUARD ADICIONAL: rastreador obrigatório + só existe autovistoria (sem instalação
    // física agendada). Autovistoria antecipa R/F, mas a instalação do rastreador é
    // OBRIGATÓRIA e precisa estar agendada antes da aprovação do Cadastro.
    if (algumPrecisouRastreador && semInstalacaoOuAgendamento) {
      console.warn('[aprovar-proposta] BLOQUEIO — autovistoria sem instalação física agendada (rastreador obrigatório). Revertendo cadastro_aprovado.');
      await supabase.from('contratos')
        .update({ cadastro_aprovado: false, aprovado_por: null, aprovado_em: null })
        .eq('id', contrato_id);
      try {
        await insertAuditLog(supabase as any, {
          acao: 'aprovar_proposta_bloqueado_sem_instalacao',
          modulo: 'contratos',
          tabela: 'contratos',
          registro_id: contrato_id,
          descricao: `Aprovação bloqueada: cotação ${contrato.cotacao_id} tem autovistoria mas o veículo exige rastreador e não há instalação física agendada. Cliente precisa agendar a instalação pelo link público.`,
          usuario_id: aprovado_por || null,
        });
      } catch (_) { /* log opcional */ }
      return jsonResponse({
        success: false,
        codigo: 'instalacao_nao_agendada',
        mensagem: 'Autovistoria liberou Roubo/Furto, mas a instalação do rastreador precisa ser agendada pelo link público antes da aprovação. O cliente verá a etapa "Instalação" no link.',
        contratoId: contrato_id,
        associadoId,
      }, 409);
    }
  }
  return null;
}

// ============================================================================
// Ativação / aguardo
// ============================================================================

async function checarVistoriaJaAprovada(
  supabase: any,
  args: { cotacao_id: string | null; veiculo_id: string | null },
): Promise<boolean> {
  // Detectar se autovistoria/vistoria já foi aprovada antes da aprovação do Cadastro.
  // Isso muda apenas a mensagem exibida — a ativação real de R/F é feita por
  // processar-vistoria/ativar-associado.
  try {
    let vistQuery = supabase
      .from('vistorias')
      .select('id, status')
      .in('status', ['aprovada', 'aprovada_ressalvas'])
      .limit(1);
    if (args.cotacao_id) {
      vistQuery = vistQuery.eq('cotacao_id', args.cotacao_id);
    } else if (args.veiculo_id) {
      vistQuery = vistQuery.eq('veiculo_id', args.veiculo_id);
    }
    const { data: vistAprov } = await vistQuery.maybeSingle();
    return !!vistAprov;
  } catch (e) {
    console.warn('[aprovar-proposta] Falha ao checar vistoria aprovada:', e);
    return false;
  }
}

async function aguardarOuAtivar(
  supabase: any,
  args: {
    contrato_id: string;
    associadoId: string;
    deveAguardarInstalacao: boolean;
    algumPrecisouRastreador: boolean;
    aprovado_por: string;
    planoTemRouboFurto: boolean;
    jaTemInstalacaoConcluida: boolean;
    motivoDecisaoSga: string;
  },
) {
  const {
    contrato_id, associadoId, deveAguardarInstalacao, algumPrecisouRastreador,
    aprovado_por, planoTemRouboFurto, jaTemInstalacaoConcluida, motivoDecisaoSga,
  } = args;

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
}

// ============================================================================
// Pós-aprovação (histórico, documentos, fila SGA)
// ============================================================================

function montarMensagemHistorico(
  args: { jaTemInstalacaoConcluida: boolean; planoTemRouboFurto: boolean; algumPrecisouRastreador: boolean; autovistoriaAprovada: boolean },
): string {
  const { jaTemInstalacaoConcluida, planoTemRouboFurto, algumPrecisouRastreador, autovistoriaAprovada } = args;
  return jaTemInstalacaoConcluida
    ? 'Cadastro documental aprovado pelo analista. Instalação já concluída. Proteção 360º ativada.'
    : !planoTemRouboFurto
      ? 'Cadastro documental aprovado pelo analista. Enviado para o Monitoramento para ativação (plano de assistência sem cobertura de Roubo/Furto).'
      : algumPrecisouRastreador
        ? (autovistoriaAprovada
            ? 'Cadastro documental aprovado pelo analista. Cobertura Roubo/Furto liberada (autovistoria já aprovada). Enviado para o Monitoramento agendar a instalação.'
            : 'Cadastro documental aprovado pelo analista. Enviado para o Monitoramento — ativação completa (incluindo Roubo/Furto) ocorrerá após conclusão do Monitoramento.')
        : 'Cadastro documental aprovado pelo analista. Enviado para o Monitoramento para ativação (veículo sem necessidade de rastreador).';
}

function montarMensagemRetorno(
  args: { jaTemInstalacaoConcluida: boolean; planoTemRouboFurto: boolean; algumPrecisouRastreador: boolean; autovistoriaAprovada: boolean },
): string {
  const { jaTemInstalacaoConcluida, planoTemRouboFurto, algumPrecisouRastreador, autovistoriaAprovada } = args;
  return jaTemInstalacaoConcluida
    ? 'Cadastro documental aprovado! Instalação já concluída. Proteção 360º ativada.'
    : !planoTemRouboFurto
      ? 'Cadastro documental aprovado! Enviado para o Monitoramento para ativação.'
      : algumPrecisouRastreador
        ? (autovistoriaAprovada
            ? 'Cadastro documental aprovado! Cobertura R/F liberada. Enviado para o Monitoramento agendar a instalação.'
            : 'Cadastro documental aprovado! Enviado para o Monitoramento — ativação completa (incluindo Roubo/Furto) ocorrerá após conclusão do Monitoramento.')
        : 'Cadastro documental aprovado! Enviado para o Monitoramento para ativação.';
}

async function gravarHistoricoEDocumentos(
  supabase: any,
  args: { associadoId: string; contrato_id: string; cotacao_id: string | null; aprovado_por: string; agora: string; mensagemHistorico: string },
) {
  const { associadoId, contrato_id, cotacao_id, aprovado_por, agora, mensagemHistorico } = args;
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

  if (cotacao_id) {
    docPromises.push(
      supabase.from('contratos_documentos').update({
        status: 'aprovado', updated_at: agora,
      }).eq('cotacao_id', cotacao_id).in('status', ['pendente', 'processando'])
    );
  }

  await Promise.all(docPromises);
}

async function enfileirarSGA(
  supabase: any,
  args: { associadoId: string; veiculoIdDoContrato: string | null; deveAguardarInstalacao: boolean; aprovado_por: string; motivoDecisaoSga: string },
) {
  const { associadoId, veiculoIdDoContrato, deveAguardarInstalacao, aprovado_por, motivoDecisaoSga } = args;

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
}

// ============================================================================
// Handler
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { contrato_id, aprovado_por, veiculo_renavam, veiculo_chassi, veiculo_numero_motor, bypass_janela, bypass_justificativa, bypass_nome_autorizador } = await req.json();

    if (!contrato_id || !aprovado_por) {
      throw new Error('contrato_id e aprovado_por são obrigatórios');
    }

    const authHeader = req.headers.get('Authorization');
    const agora = new Date().toISOString();
    console.log('[aprovar-proposta] Iniciando aprovação:', contrato_id);

    // 1. Buscar contrato
    const contrato = await buscarContrato(supabase, contrato_id);

    // Desvio: Troca de Titularidade (early-return)
    const troca = await tratarTrocaTitularidade(supabase, contrato, {
      contrato_id, aprovado_por, agora, supabaseUrl, supabaseServiceKey, authHeader,
      bypass_janela, bypass_justificativa, bypass_nome_autorizador,
    });
    if (troca) return troca.response;
    // ──────────────────────────────────────────────────────────────────────

    // 1b. Plano tem R&F?
    const planoTemRouboFurto = await checarPlanoTemRouboFurto(supabase, contrato.plano_id);

    // IDEMPOTÊNCIA
    if (contrato.status === 'ativo') {
      console.log('[aprovar-proposta] Já aprovado:', contrato_id);
      return jsonResponse({ success: true, jaAprovado: true, mensagem: 'Este contrato já foi aprovado anteriormente.', contratoId: contrato_id, associadoId: contrato.associado_id });
    }

    if (contrato.status !== 'assinado') {
      throw new Error(`Este contrato não pode ser aprovado. Status atual: ${contrato.status}`);
    }

    // Gates
    const r1 = gateDocumentosAprovados(contrato);
    if (r1) return r1;

    const r2 = await gateSituacaoFinanceiraSGA(supabase, contrato_id);
    if (r2) return r2;

    const associadoId = contrato.associado_id;

    const r3 = await gateCaminhoPublicoCompleto(supabase, {
      contrato_id,
      cotacao_id: contrato.cotacao_id || null,
      veiculo_id: (contrato as any).veiculo_id || null,
      aprovado_por,
    });
    if (r3) return r3;
    // ── fim do gate ────────────────────────────────────────────────────────

    // 2. Registrar aprovação cadastral
    const aprov = await registrarAprovacaoCadastral(supabase, contrato_id, aprovado_por, agora, associadoId);
    if (aprov.jaAprovadoResponse) return aprov.jaAprovadoResponse;

    // 3. Paralelo: instalação concluída + veículos + configurações + associado update
    const veiculoIdDoContrato = (contrato as any).veiculo_id;
    const ctx = await carregarContextoParalelo(supabase, {
      contrato_id, associadoId, veiculoIdDoContrato, aprovado_por, agora,
    });
    const { instalacaoConcluida, jaTemInstalacaoConcluida, veiculos } = ctx;

    // Atualizar renavam/chassi no veículo do contrato se fornecidos
    await atualizarVeiculoComDocs(supabase, veiculoIdDoContrato, {
      renavam: veiculo_renavam, chassi: veiculo_chassi, numero_motor: veiculo_numero_motor,
    });

    // 4. Iterar TODOS os veículos do associado
    let algumProtecao360SemRastreador = false;
    let algumPrecisouRastreador = false;
    let veiculoPrincipal: any = null;

    for (const veiculo of veiculos) {
      if (veiculo.id === veiculoIdDoContrato || !veiculoPrincipal) veiculoPrincipal = veiculo;
      const r = await processarVeiculoAprovado(supabase, {
        veiculo, contrato, contrato_id, associadoId, veiculoIdDoContrato,
        planoTemRouboFurto, jaTemInstalacaoConcluida, instalacaoConcluida,
        aprovado_por, agora, supabaseUrl, supabaseServiceKey,
      });
      if (r.precisouRastreador) algumPrecisouRastreador = true;
      if (r.criouProtecao360SemRastreador) algumProtecao360SemRastreador = true;
    }

    // Guard anti-limbo pós-processamento
    const g = await guardAntiLimboPosProcessamento(supabase, {
      contrato, contrato_id, associadoId, jaTemInstalacaoConcluida, algumPrecisouRastreador, aprovado_por,
    });
    if (g) return g;

    // Aguardar quando:
    //  (a) algum veículo precisa de rastreador e ainda não há instalação concluída, OU
    //  (b) NENHUM veículo precisa de rastreador (fluxo "vistoria sem rastreador" — FIPE<30k carro / 9k moto não-Diesel).
    //      Nesse fluxo a ativação só ocorre após aprovação manual da vistoria pelo Monitoramento
    //      (edge `aplicar-conclusao-vistoria` chama `ativar-associado`). Sem este guard, a chamada
    //      abaixo promovia indevidamente associado/contrato/veículo para 'ativo'.
    const deveAguardarInstalacao = !jaTemInstalacaoConcluida || !algumPrecisouRastreador;

    const autovistoriaAprovada = await checarVistoriaJaAprovada(supabase, {
      cotacao_id: contrato.cotacao_id || null,
      veiculo_id: veiculoIdDoContrato || null,
    });

    // POLÍTICA: o primeiro envio ao SGA é SEMPRE 'pendente', independente de R/F,
    // auto-vistoria ou instalação já concluída. A promoção para 'ativo' acontece
    // exclusivamente após a ativação completa (segundo disparo abaixo).
    const statusSgaDestino: 'pendente' | 'ativo' = 'pendente';
    const motivoDecisaoSga = 'Primeiro envio ao SGA — sempre pendente por política. Promoção para ativo ocorre na ativação completa.';

    await aguardarOuAtivar(supabase, {
      contrato_id, associadoId, deveAguardarInstalacao, algumPrecisouRastreador,
      aprovado_por, planoTemRouboFurto, jaTemInstalacaoConcluida, motivoDecisaoSga,
    });

    // 5. Histórico + documentos + SGA
    const mensagemHistorico = montarMensagemHistorico({
      jaTemInstalacaoConcluida, planoTemRouboFurto, algumPrecisouRastreador, autovistoriaAprovada,
    });

    await gravarHistoricoEDocumentos(supabase, {
      associadoId, contrato_id, cotacao_id: contrato.cotacao_id || null,
      aprovado_por, agora, mensagemHistorico,
    });

    await enfileirarSGA(supabase, {
      associadoId, veiculoIdDoContrato, deveAguardarInstalacao, aprovado_por, motivoDecisaoSga,
    });

    const mensagemRetorno = montarMensagemRetorno({
      jaTemInstalacaoConcluida, planoTemRouboFurto, algumPrecisouRastreador, autovistoriaAprovada,
    });

    console.log('[aprovar-proposta] Concluído:', mensagemRetorno);

    return jsonResponse({ success: true, contratoId: contrato_id, associadoId, mensagem: mensagemRetorno });

  } catch (error: any) {
    if (error?.aprovarPropostaResponse) {
      console.warn('[aprovar-proposta] resposta estruturada propagada:', error.message);
      return error.aprovarPropostaResponse;
    }
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
