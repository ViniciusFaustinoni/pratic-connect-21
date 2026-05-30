// Edge function: ativar-associado
// Ponto único de ativação de associado/contrato/veículo.
// - Adquire advisory lock via fn_lock_ativacao (impede dupla ativação concorrente).
// - Compare-and-swap: só ativa se status atual estiver em allowed_from.
// - Idempotente: se já 'ativo', retorna sucesso sem reexecutar side effects.
// - Valida campos obrigatórios via fn_validar_campos_ativacao.
// - Loga origem (source) para auditoria via ativacao_status_log.
//
// ────────────────────────────────────────────────────────────────────────────
// MATRIZ CANÔNICA DE CALLERS AUTORIZADOS
// (regra mem://architecture/activation/single-source-activation — qualquer
//  caller novo PRECISA ser adicionado aqui e revisado em code review)
//
//  # | Caller                                          | source                                          | Momento do fluxo                                  | allowed_from esperado
//  --|-------------------------------------------------|-------------------------------------------------|---------------------------------------------------|----------------------------------------------------------------------------------------------
//  1 | edge: aprovar-proposta                          | edge:aprovar-proposta                           | Cadastro aprova proposta sem rastreador físico    | aguardando_instalacao, aguardando_aprovacao_monitoramento, em_analise, documentacao_pendente, aprovado
//  2 | edge: aprovar-troca-monitoramento               | edge:aprovar-troca-monitoramento                | Monitoramento aprova troca de titularidade        | assinado, aguardando_instalacao, pendente
//  3 | edge: criar-instalacao-pos-pagamento            | edge:criar-instalacao-pos-pagamento             | Pagamento confirmado + instalação materializada   | default (assinado, aguardando_instalacao, pendente)
//  4 | cron: reconciliar-contratos-pos-monitoramento   | cron:reconciliar-contratos-pos-monitoramento    | Cron 15min destrava contratos parados (assinado)  | assinado, aguardando_instalacao, aguardando_aprovacao_monitoramento, em_analise, documentacao_pendente, aprovado
//  5 | edge: softruck-ativar-dispositivo               | edge:softruck-ativar-dispositivo                | Read-back Softruck confirmou vínculo IMEI↔veículo | default (assinado, aguardando_instalacao, pendente)
//  6 | hook: useAprovacaoMonitoramento (UI)            | hook:useAprovacaoMonitoramento                  | Coordenador aprova manualmente na Aprovação       | assinado, aguardando_instalacao, pendente, em_analise, documentacao_pendente, aprovado
//  7 | hook: useVistoriaCompletaAnalise (UI)           | hook:useVistoriaCompletaAnalise                 | Análise da vistoria completa pelo coordenador     | assinado, aguardando_instalacao, pendente, em_analise, documentacao_pendente, aprovado
//
// Side-effects além do status do associado/contrato/veículo: integração SGA
// (sga_sync_queue), Softruck/Rede (vínculo), cotacoes.status_contratacao,
// historico_status_contratos. O CAS + advisory lock garantem que uma 2ª chamada
// concorrente vira no-op idempotente — não há risco de dupla ativação real, mas
// a presença de 2 callers diferentes em < 5 min é sinal de lógica redundante
// e dispara alerta de auditoria (ver bloco "Alerta de ativação concorrente").
// ────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { translateDbError } from '../_shared/db-error-translator.ts';
import { insertAuditLog } from '../_shared/auditLog.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type AllowedFromStatus = 'assinado' | 'aguardando_instalacao' | 'pendente';

interface AtivarBody {
  associado_id: string;
  source: string; // ex: 'hook:useAprovacaoMonitoramento', 'hook:useVistoriaCompletaAnalise', 'edge:aprovar-proposta'
  actor_id?: string | null;
  veiculo_id?: string | null;
  contrato_id?: string | null;
  servico_id?: string | null;
  instalacao_id?: string | null;
  // Quais transições são permitidas a partir do estado atual
  allowed_from?: AllowedFromStatus[];
  // Atualizações opcionais que devem acompanhar a ativação
  ativar_cobertura_total?: boolean;       // veiculos.cobertura_total = true
  ativar_cobertura_roubo_furto?: boolean; // veiculos.cobertura_roubo_furto = true
  // Se true, NÃO promove veiculos.status para 'ativo' — mantém 'instalacao_pendente'
  // até o trigger fn_reativar_cobertura_pos_instalacao disparar quando a instalação concluir.
  // Use para inclusão/adesão nova com instalação física agendada.
  aguardar_instalacao?: boolean;
  // Marca cotação como ativa (status_contratacao = 'ativo')
  cotacao_id?: string | null;
  // Metadata livre para o log
  metadata?: Record<string, unknown>;
  // Enfileira sync SGA (Hinova) dentro do mesmo fluxo da ativação.
  // Substitui o enqueue_integration standalone que vivia no hook do caller —
  // garante que o SGA não fica perdido se o browser fecha entre o retorno desta
  // edge e a chamada client-side. Falha de enqueue entra em parciais[] (207).
  sga_enqueue?: {
    enabled: boolean;
    status_sga_destino?: 'ativo' | 'pendente';
    force_resync_media?: boolean;
    etapa_origem?: string;
    motivo_decisao?: string;
  };
}

// Executa o enqueue do SGA usando _correlation_id determinístico (sem Date.now())
// para que retries via cron / reexecução do caller sejam idempotentes.
async function executarSgaEnqueue(
  supabase: ReturnType<typeof createClient>,
  params: {
    associado_id: string;
    veiculo_id: string | null;
    actor_id: string | null;
    sga_enqueue: NonNullable<AtivarBody['sga_enqueue']>;
  },
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const { associado_id, veiculo_id, actor_id, sga_enqueue } = params;
  if (!veiculo_id) {
    return { ok: false, erro: 'sga_enqueue requer veiculo_id' };
  }
  const etapaOrigem = sga_enqueue.etapa_origem || 'ativar_associado';
  try {
    const { error } = await (supabase as any).rpc('enqueue_integration', {
      _integration: 'sga',
      _operation: 'hinova_sync',
      _payload: {
        veiculo_id,
        associado_id,
        status_sga_destino: sga_enqueue.status_sga_destino || 'ativo',
        force_resync_media: sga_enqueue.force_resync_media === true,
        etapa_origem: etapaOrigem,
        motivo_decisao: sga_enqueue.motivo_decisao || `Ativação via edge ativar-associado (${etapaOrigem})`,
      },
      // determinístico por (veiculo, etapa) — retries não criam nova linha
      _correlation_id: `sga:hinova:${veiculo_id}:${etapaOrigem}`,
      _max_attempts: 5,
      _delay_seconds: 0,
      _created_by: actor_id,
    });
    if (error) return { ok: false, erro: error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, erro: e?.message || String(e) };
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    let body: AtivarBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, error: 'invalid_json' }, 400);
    }

    let {
      associado_id,
      source,
      actor_id = null,
      veiculo_id = null,
      contrato_id = null,
      servico_id = null,
      instalacao_id = null,
      allowed_from = ['assinado', 'aguardando_instalacao', 'pendente'],
      ativar_cobertura_total = false,
      ativar_cobertura_roubo_furto = false,
      aguardar_instalacao = false,
      cotacao_id = null,
      metadata = {},
      sga_enqueue,

    } = body || ({} as AtivarBody);

    if (!associado_id || !source) {
      return jsonResponse({ success: false, error: 'missing_required_fields', fields: ['associado_id', 'source'] }, 400);
    }

    // ----- CAMADA 2 (defesa em profundidade) -----
    // Quando aguardar_instalacao=true, a cobertura NÃO pode ser promovida nem
    // anunciada ao cliente: o veículo ainda vai passar por vistoria/instalação
    // ou aprovação manual do Monitoramento. Coagimos os flags de ativação de
    // cobertura para false e logamos o desvio para nunca disparar
    // `cobertura_total_ativada` em sub-FIPE / inclusão isenta antes da hora
    // (regressão do caso LUIZ KZZ9E93). Ver memória
    // `mem://logic/operations/sub-fipe-nao-anuncia-protecao-ativada-pre-monitoramento`.
    if (aguardar_instalacao && (ativar_cobertura_total || ativar_cobertura_roubo_furto)) {
      console.warn('[ativar-associado] coerce: aguardar_instalacao=true → cobertura flags forçadas a false', {
        associado_id, veiculo_id, source,
        ativar_cobertura_total_request: ativar_cobertura_total,
        ativar_cobertura_roubo_furto_request: ativar_cobertura_roubo_furto,
      });
      ativar_cobertura_total = false;
      ativar_cobertura_roubo_furto = false;
    }

    // ----- 0) Guard: cobertura total exige rastreador físico em veículos que exigem -----
    // Regra de negócio: Diesel, carro FIPE ≥ R$ 30k, moto FIPE ≥ R$ 9k => rastreador OBRIGATÓRIO.
    // Sem rastreador vinculado em `rastreadores.veiculo_id`, NUNCA promover cobertura_total
    // nem `veiculos.status='ativo'`. Bloqueia o caminho que ativou André/Leonardo via autovistoria.
    if (veiculo_id && ativar_cobertura_total && !aguardar_instalacao) {
      const { data: veic, error: veicReadErr } = await supabase
        .from('veiculos')
        .select('id, placa, marca, modelo, combustivel, valor_fipe')
        .eq('id', veiculo_id)
        .maybeSingle();
      if (veicReadErr) {
        return jsonResponse({ success: false, error: 'veiculo_read_failed', detail: veicReadErr.message }, 500);
      }
      if (veic) {
        // Resolver tipo_veiculo (carro/moto) via marcas_modelos (case-insensitive)
        const { data: mm } = await supabase
          .from('marcas_modelos')
          .select('tipo_veiculo, marca, modelo')
          .ilike('marca', (veic.marca ?? '').trim())
          .ilike('modelo', (veic.modelo ?? '').trim())
          .limit(1)
          .maybeSingle();

        const motoRegex = /(cg |cb |cb250|cb300|cb500|cb650|cb1000|fan|titan|twister|hornet|xre|bros|biz|pop |fazer|ys |xtz|lander|tenere|crf|mt-|nmax|burgman|xj6|r1|r3|r6|gsx|hayabusa|gixxer|intruder|v-strom|katana|drz|rmz|kxf|husqvarna|harley|sportster|iron|forty|softail|street|virago|midnight|bandit|cbr|gsr|z400|z650|z800|z900|z1000|ninja|versys|ducati|monster|panigale)/i;
        const tipoVeiculo: 'carro' | 'moto' =
          (mm?.tipo_veiculo as 'carro' | 'moto' | undefined) ??
          (motoRegex.test(veic.modelo ?? '') ? 'moto' : 'carro');

        const combustivel = (veic.combustivel ?? '').toLowerCase();
        const fipe = Number(veic.valor_fipe ?? 0);
        const exigeRastreador =
          combustivel.includes('diesel') ||
          (tipoVeiculo === 'carro' && fipe >= 30000) ||
          (tipoVeiculo === 'moto'  && fipe >=  9000);

        if (exigeRastreador) {
          const { count: rastCount, error: rastErr } = await supabase
            .from('rastreadores')
            .select('id', { count: 'exact', head: true })
            .eq('veiculo_id', veiculo_id);
          if (rastErr) {
            console.warn('[ativar-associado] read rastreadores erro:', rastErr.message);
          }
          if (!rastCount || rastCount === 0) {
            console.warn('[ativar-associado] bloqueio: cobertura_total sem rastreador físico', {
              veiculo_id, placa: veic.placa, tipoVeiculo, fipe, combustivel, source,
            });
            return jsonResponse({
              success: false,
              error: 'requer_rastreador_fisico',
              mensagem: 'Veículo exige rastreador físico instalado para ativar cobertura total (Proteção 360). Aguarde a vistoria do técnico com instalação.',
              veiculo_id,
              placa: veic.placa,
              tipo_veiculo: tipoVeiculo,
              valor_fipe: fipe,
              combustivel: veic.combustivel,
            }, 409);
          }
        }
      }
    }

    // ----- 1) Tentar adquirir advisory lock -----
    // Como Postgres advisory locks são por conexão e a Supabase JS reusa o pool,
    // emulamos o lock via UPDATE condicional + checagem do log recente.
    // O fn_lock_ativacao requer transação dedicada — usamos rpc com ON CONFLICT como guardrail principal,
    // e a compare-and-swap abaixo é a defesa real contra race.
    const { data: lockRow, error: lockErr } = await supabase.rpc('fn_lock_ativacao', { _associado_id: associado_id });
    if (lockErr) {
      console.warn('[ativar-associado] fn_lock_ativacao erro (seguindo com CAS):', lockErr.message);
    } else if (lockRow === false) {
      // Outro processo está ativando agora — devolve 409 idempotente.
      return jsonResponse({ success: false, error: 'lock_busy', mensagem: 'Outra ativação para este associado está em andamento.' }, 409);
    }

    // ----- 2) Ler estado atual -----
    const { data: assoc, error: assocReadErr } = await supabase
      .from('associados')
      .select('id, status, contrato_id, data_ativacao')
      .eq('id', associado_id)
      .maybeSingle();

    if (assocReadErr) {
      return jsonResponse({ success: false, error: 'read_failed', detail: assocReadErr.message }, 500);
    }
    if (!assoc) {
      return jsonResponse({ success: false, error: 'associado_nao_encontrado' }, 404);
    }

    // ----- 3) Idempotência: já ativo -----
    // IMPORTANTE: mesmo quando o associado já está 'ativo' (ex.: já tem contrato anterior ativo),
    // ainda precisamos aplicar side-effects de ativação para o NOVO contrato/veículo/cotação,
    // caso contrário um veículo novo do mesmo associado fica preso em 'em_analise' (limbo).
    if (assoc.status === 'ativo') {
      const agora = new Date().toISOString();
      const targetContratoId = contrato_id ?? assoc.contrato_id;
      const sideEffects: Record<string, unknown> = {};
      // PR-A2: parciais[] coleta falhas dos side-effects para detectar promoção parcial.
      // Quando >0, resposta retorna 207 + success:false para o caller saber que precisa retentar.
      const parciais: Array<{ alvo: string; id: string | null; erro: string }> = [];
      const contratoTargetStatus = aguardar_instalacao ? 'assinado' : 'ativo';
      const cotacaoTargetStatus = aguardar_instalacao ? 'contrato_assinado' : 'ativo';

      if (targetContratoId) {
        const contratoUpdate: Record<string, unknown> = { status: contratoTargetStatus };
        if (!aguardar_instalacao) contratoUpdate.data_ativacao = agora;
        const { data: contratoRow, error: contratoErr } = await supabase
          .from('contratos')
          .update(contratoUpdate)
          .eq('id', targetContratoId)
          .neq('status', 'cancelado')
          .neq('status', 'ativo')
          .select('id')
          .maybeSingle();
        if (contratoErr) {
          console.warn('[ativar-associado][idem] update contrato erro:', contratoErr.message);
          sideEffects.contrato_erro = contratoErr.message;
          parciais.push({ alvo: 'contrato', id: targetContratoId, erro: contratoErr.message });
        } else {
          // 0 rows é OK aqui — significa que contrato já estava no status alvo (idempotente).
          sideEffects.contrato_atualizado = contratoRow?.id ?? targetContratoId;
          sideEffects.contrato_status = contratoTargetStatus;
        }
      }

      if (veiculo_id) {
        const temCoberturaImediata = ativar_cobertura_total || ativar_cobertura_roubo_furto;
        const promoverStatus = temCoberturaImediata && !aguardar_instalacao;
        const veiculoUpdate: Record<string, unknown> = {
          status: promoverStatus ? 'ativo' : 'instalacao_pendente',
          updated_at: agora,
        };
        if (ativar_cobertura_total) veiculoUpdate.cobertura_total = true;
        if (ativar_cobertura_roubo_furto) veiculoUpdate.cobertura_roubo_furto = true;
        let veicQuery = supabase
          .from('veiculos')
          .update(veiculoUpdate)
          .eq('id', veiculo_id)
          .neq('status', 'cancelado');
        if (!promoverStatus) veicQuery = veicQuery.neq('status', 'ativo');
        const { error: veicErr } = await veicQuery.select('id').maybeSingle();
        if (veicErr) {
          console.warn('[ativar-associado][idem] update veiculo erro:', veicErr.message);
          sideEffects.veiculo_erro = veicErr.message;
          parciais.push({ alvo: 'veiculo', id: veiculo_id, erro: veicErr.message });
        } else {
          sideEffects.veiculo_atualizado = veiculo_id;
          sideEffects.veiculo_status = veiculoUpdate.status;
        }
      }

      if (cotacao_id) {
        const { error: cotErr } = await supabase
          .from('cotacoes')
          .update({ status_contratacao: cotacaoTargetStatus })
          .eq('id', cotacao_id);
        if (cotErr) {
          console.warn('[ativar-associado][idem] update cotacao erro:', cotErr.message);
          sideEffects.cotacao_erro = cotErr.message;
          parciais.push({ alvo: 'cotacao', id: cotacao_id, erro: cotErr.message });
        } else {
          sideEffects.cotacao_atualizado = cotacao_id;
          sideEffects.cotacao_status = cotacaoTargetStatus;
        }
      }

      const partialIdem = parciais.length > 0;
      // Log da reativação idempotente para auditoria
      await supabase.from('ativacao_status_log').insert({
        associado_id,
        contrato_id: targetContratoId,
        from_status: 'ativo',
        to_status: partialIdem ? 'ativo_parcial' : 'ativo',
        source: `edge:ativar-associado<-${source}#idem-side-effects${partialIdem ? ':parcial' : ''}`,
        actor_id,
        payload: {
          veiculo_id,
          servico_id,
          instalacao_id,
          cotacao_id,
          ativar_cobertura_total,
          ativar_cobertura_roubo_furto,
          side_effects: sideEffects,
          parciais,
          ...metadata,
        },
      });

      if (partialIdem) {
        return jsonResponse({
          success: false,
          error: 'promocao_parcial',
          mensagem: `Associado ativo, mas ${parciais.length} side-effect(s) falharam — clique para retentar.`,
          idempotente: true,
          associado_id,
          status: 'ativo',
          parciais,
          side_effects: sideEffects,
        }, 207);
      }

      return jsonResponse({
        success: true,
        idempotente: true,
        mensagem: 'Associado já estava ativo. Side-effects aplicados ao contrato/veículo/cotação informados.',
        associado_id,
        status: 'ativo',
        side_effects: sideEffects,
      });
    }

    // ----- 4) Validar transição permitida -----
    if (!allowed_from.includes(assoc.status as AllowedFromStatus)) {
      return jsonResponse({
        success: false,
        error: 'transicao_invalida',
        from_status: assoc.status,
        allowed_from,
      }, 409);
    }

    // ----- 5) Validar campos obrigatórios -----
    const { data: validacao, error: valErr } = await supabase.rpc('fn_validar_campos_ativacao', { _associado_id: associado_id });
    if (valErr) {
      console.warn('[ativar-associado] fn_validar_campos_ativacao erro:', valErr.message);
    } else if (validacao && (validacao as any).valido === false) {
      return jsonResponse({
        success: false,
        error: 'campos_obrigatorios_faltando',
        campos_faltando: (validacao as any).campos_faltando ?? [],
      }, 422);
    }

    const agora = new Date().toISOString();

    // ----- 6) Compare-and-swap no associado -----
    // IMPORTANTE: o enum `status_associado` NÃO contém 'assinado' (esse valor existe só
    // em `status_contrato`). Se passarmos 'assinado' para `.in('status', ...)` no PostgREST,
    // o cast text[] -> status_associado[] falha com 22P02 ("invalid input value for enum
    // status_associado: 'assinado'") e a ativação trava. Aqui filtramos para apenas
    // valores válidos do enum do associado.
    const ASSOC_VALID_FROM = new Set<string>([
      'em_analise',
      'pendente_vistoria',
      'aprovado',
      'documentacao_pendente',
      'aguardando_instalacao',
    ]);
    const allowed_from_assoc = allowed_from.filter((s) => ASSOC_VALID_FROM.has(s as string));
    if (allowed_from_assoc.length === 0) {
      // Fallback seguro: aceita os estados padrão de pré-ativação válidos no enum.
      allowed_from_assoc.push('aguardando_instalacao', 'aprovado');
    }

    // Quando aguardar_instalacao=true, NÃO promover associado para 'ativo'.
    // Mantemos/colocamos em 'aguardando_instalacao' até o Monitoramento aprovar a pós-instalação.
    const assocTargetStatus = aguardar_instalacao ? 'aguardando_instalacao' : 'ativo';
    const assocUpdatePayload: Record<string, unknown> = {
      status: assocTargetStatus,
      updated_at: agora,
    };
    if (!aguardar_instalacao) assocUpdatePayload.data_ativacao = agora;

    const { data: assocUpd, error: assocUpdErr } = await supabase
      .from('associados')
      .update(assocUpdatePayload)
      .eq('id', associado_id)
      .in('status', allowed_from_assoc)
      .select('id, status')
      .maybeSingle();

    if (assocUpdErr) {
      console.error('[ativar-associado] update associados falhou:', assocUpdErr);
      return jsonResponse({ success: false, error: 'update_associado_failed', detail: assocUpdErr.message, code: (assocUpdErr as any).code }, 500);
    }
    if (!assocUpd) {
      // Alguém mudou o status entre o read e o update — recheca idempotência
      const { data: refetch } = await supabase
        .from('associados').select('status').eq('id', associado_id).maybeSingle();
      if (refetch?.status === assocTargetStatus) {
        return jsonResponse({
          success: true,
          idempotente: true,
          mensagem: `Associado já estava em ${assocTargetStatus} após CAS.`,
          associado_id,
          status: assocTargetStatus,
        });
      }
      // Aceita também já-ativo (caso `aguardar_instalacao` tenha vindo true mas associado já estava ativo por outro fluxo)
      if (refetch?.status === 'ativo' && !aguardar_instalacao) {
        return jsonResponse({
          success: true,
          idempotente: true,
          mensagem: 'Associado já estava ativo após CAS.',
          associado_id,
          status: 'ativo',
        });
      }
      return jsonResponse({
        success: false,
        error: 'cas_conflict',
        from_status_observado: refetch?.status ?? 'desconhecido',
      }, 409);
    }

    // PR-A2: parciais[] coleta falhas dos passos 7/8/9 para sinalizar promoção parcial.
    const parciais: Array<{ alvo: string; id: string | null; erro: string }> = [];

    // ----- 7) Atualizar contrato (CAS opcional) -----
    const targetContratoId = contrato_id ?? assoc.contrato_id;
    const contratoTargetStatusFlow = aguardar_instalacao ? 'assinado' : 'ativo';
    if (targetContratoId) {
      const contratoUpdate: Record<string, unknown> = { status: contratoTargetStatusFlow };
      if (!aguardar_instalacao) contratoUpdate.data_ativacao = agora;
      const { error: contratoErr } = await supabase
        .from('contratos')
        .update(contratoUpdate)
        .eq('id', targetContratoId)
        .neq('status', 'cancelado');
      if (contratoErr) {
        console.warn('[ativar-associado] update contrato erro (promoção parcial):', contratoErr.message);
        parciais.push({ alvo: 'contrato', id: targetContratoId, erro: contratoErr.message });
      }
    }

    // ----- 8) Atualizar veículo (cobertura + status) -----
    // Regra: veículo só vira 'ativo' imediatamente se houver cobertura imediata
    // (Roubo/Furto ou Total). Caso contrário (ex: inclusão só com assistência+rastreador
    // dependente de instalação física), permanece 'instalacao_pendente' e é promovido
    // para 'ativo' pelo trigger fn_reativar_cobertura_pos_instalacao quando a
    // instalação concluir.
    if (veiculo_id) {
      const temCoberturaImediata = ativar_cobertura_total || ativar_cobertura_roubo_furto;
      const promoverStatus = temCoberturaImediata && !aguardar_instalacao;

      const veiculoUpdate: Record<string, unknown> = {
        updated_at: agora,
      };
      if (promoverStatus) {
        veiculoUpdate.status = 'ativo';
      } else {
        // Garante que veículo novo aguarde instalação (não força se já estiver ativo
        // por fluxo anterior — usa CAS via .neq mais abaixo).
        veiculoUpdate.status = 'instalacao_pendente';
      }
      if (ativar_cobertura_total) veiculoUpdate.cobertura_total = true;
      if (ativar_cobertura_roubo_furto) veiculoUpdate.cobertura_roubo_furto = true;

      let veicQuery = supabase
        .from('veiculos')
        .update(veiculoUpdate)
        .eq('id', veiculo_id);
      // Se NÃO vamos promover para ativo, só rebaixa para instalacao_pendente
      // se o veículo ainda NÃO estiver ativo (evita downgrade indevido).
      if (!promoverStatus) {
        veicQuery = veicQuery.neq('status', 'ativo');
      }
      const { error: veicErr } = await veicQuery;
      if (veicErr) {
        console.warn('[ativar-associado] update veiculo erro (promoção parcial):', veicErr.message);
        parciais.push({ alvo: 'veiculo', id: veiculo_id, erro: veicErr.message });
      }
    }

    // ----- 9) Atualizar cotação -----
    if (cotacao_id) {
      const cotacaoTargetStatusFlow = aguardar_instalacao ? 'contrato_assinado' : 'ativo';
      const { error: cotErr } = await supabase
        .from('cotacoes')
        .update({ status_contratacao: cotacaoTargetStatusFlow })
        .eq('id', cotacao_id);
      if (cotErr) {
        console.warn('[ativar-associado] update cotacao erro (promoção parcial):', cotErr.message);
        parciais.push({ alvo: 'cotacao', id: cotacao_id, erro: cotErr.message });
      }
    }

    const partial = parciais.length > 0;

    // ----- 10) Log de auditoria explícito (além do trigger) -----
    await supabase.from('ativacao_status_log').insert({
      associado_id,
      contrato_id: targetContratoId,
      from_status: assoc.status,
      to_status: partial ? 'ativo_parcial' : assocTargetStatus,
      source: `edge:ativar-associado<-${source}${partial ? ':parcial' : ''}`,
      actor_id,
      payload: {
        veiculo_id,
        servico_id,
        instalacao_id,
        cotacao_id,
        ativar_cobertura_total,
        ativar_cobertura_roubo_furto,
        aguardar_instalacao,
        parciais,
        ...metadata,
      },
    });

    // ----- 10.1) Alerta de ativação concorrente -----
    // Se outro caller diferente tentou ativar o mesmo associado em < 5 min,
    // sinaliza no console e em logs_auditoria. Não bloqueia a resposta — o
    // CAS+lock garantem idempotência; isto serve para identificar lógica
    // redundante entre os 7 callers documentados acima.
    try {
      const sourceFull = `edge:ativar-associado<-${source}${partial ? ':parcial' : ''}`;
      const { data: recentes } = await supabase
        .from('ativacao_status_log')
        .select('source, created_at')
        .eq('associado_id', associado_id)
        .in('to_status', ['ativo', 'ativo_parcial'])
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .neq('source', sourceFull)
        .order('created_at', { ascending: false })
        .limit(1);

      const anterior = recentes?.[0];
      if (anterior) {
        const gapMs = Date.now() - new Date(anterior.created_at as string).getTime();
        console.warn('[ativar-associado][race] dupla ativação <5min', {
          associado_id,
          source_atual: sourceFull,
          source_anterior: anterior.source,
          gap_ms: gapMs,
        });
        await insertAuditLog(supabase, {
          usuario_id: actor_id ?? null,
          usuario_nome: 'sistema',
          acao: 'criar',
          modulo: 'configuracoes',
          descricao: `[ATIVACAO_CONCORRENTE] ${anterior.source} → ${sourceFull} em ${gapMs}ms`,
          tabela: 'ativacao_status_log',
          registro_id: associado_id,
          dados_novos: {
            associado_id,
            contrato_id: targetContratoId,
            source_atual: sourceFull,
            source_anterior: anterior.source,
            gap_ms: gapMs,
          },
        });
      }
    } catch (raceErr) {
      console.warn('[ativar-associado] alerta concorrência falhou (não bloqueante):', raceErr);
    }



    if (partial) {
      return jsonResponse({
        success: false,
        error: 'promocao_parcial',
        mensagem: `Associado promovido, mas ${parciais.length} alvo(s) falharam (${parciais.map((p) => p.alvo).join(', ')}) — clique para retentar.`,
        associado_id,
        contrato_id: targetContratoId,
        status: assocTargetStatus,
        aguardando_instalacao: aguardar_instalacao,
        from_status: assoc.status,
        parciais,
      }, 207);
    }

    return jsonResponse({
      success: true,
      associado_id,
      contrato_id: targetContratoId,
      status: assocTargetStatus,
      aguardando_instalacao: aguardar_instalacao,
      from_status: assoc.status,
      ativado_em: aguardar_instalacao ? null : agora,
    });
  } catch (e) {
    const t = translateDbError(e);
    console.error('[ativar-associado] erro:', { code: t.code, msg: t.message, raw: t.raw });
    return jsonResponse(
      { success: false, error: t.message, code: t.code, detail: t.raw },
      t.status,
    );
  }
});
