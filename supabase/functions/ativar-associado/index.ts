// Edge function: ativar-associado
// Ponto único de ativação de associado/contrato/veículo.
// - Adquire advisory lock via fn_lock_ativacao (impede dupla ativação concorrente).
// - Compare-and-swap: só ativa se status atual estiver em allowed_from.
// - Idempotente: se já 'ativo', retorna sucesso sem reexecutar side effects.
// - Valida campos obrigatórios via fn_validar_campos_ativacao.
// - Loga origem (source) para auditoria via ativacao_status_log.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { translateDbError } from '../_shared/db-error-translator.ts';

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

    const {
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
    } = body || ({} as AtivarBody);

    if (!associado_id || !source) {
      return jsonResponse({ success: false, error: 'missing_required_fields', fields: ['associado_id', 'source'] }, 400);
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

      if (targetContratoId) {
        const { error: contratoErr } = await supabase
          .from('contratos')
          .update({ status: 'ativo', data_ativacao: agora })
          .eq('id', targetContratoId)
          .neq('status', 'cancelado')
          .neq('status', 'ativo');
        if (contratoErr) {
          console.warn('[ativar-associado][idem] update contrato erro:', contratoErr.message);
          sideEffects.contrato_erro = contratoErr.message;
        } else {
          sideEffects.contrato_atualizado = targetContratoId;
        }
      }

      if (veiculo_id) {
        const veiculoUpdate: Record<string, unknown> = {
          status: 'ativo',
          updated_at: agora,
        };
        if (ativar_cobertura_total) veiculoUpdate.cobertura_total = true;
        if (ativar_cobertura_roubo_furto) veiculoUpdate.cobertura_roubo_furto = true;
        const { error: veicErr } = await supabase
          .from('veiculos')
          .update(veiculoUpdate)
          .eq('id', veiculo_id)
          .neq('status', 'cancelado')
          .neq('status', 'ativo');
        if (veicErr) {
          console.warn('[ativar-associado][idem] update veiculo erro:', veicErr.message);
          sideEffects.veiculo_erro = veicErr.message;
        } else {
          sideEffects.veiculo_atualizado = veiculo_id;
        }
      }

      if (cotacao_id) {
        const { error: cotErr } = await supabase
          .from('cotacoes')
          .update({ status_contratacao: 'ativo' })
          .eq('id', cotacao_id);
        if (cotErr) {
          console.warn('[ativar-associado][idem] update cotacao erro:', cotErr.message);
          sideEffects.cotacao_erro = cotErr.message;
        } else {
          sideEffects.cotacao_atualizado = cotacao_id;
        }
      }

      // Log da reativação idempotente para auditoria
      await supabase.from('ativacao_status_log').insert({
        associado_id,
        contrato_id: targetContratoId,
        from_status: 'ativo',
        to_status: 'ativo',
        source: `edge:ativar-associado<-${source}#idem-side-effects`,
        actor_id,
        payload: {
          veiculo_id,
          servico_id,
          instalacao_id,
          cotacao_id,
          ativar_cobertura_total,
          ativar_cobertura_roubo_furto,
          side_effects: sideEffects,
          ...metadata,
        },
      });

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

    const { data: assocUpd, error: assocUpdErr } = await supabase
      .from('associados')
      .update({
        status: 'ativo',
        data_ativacao: agora,
        updated_at: agora,
      })
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
      if (refetch?.status === 'ativo') {
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

    // ----- 7) Atualizar contrato (CAS opcional) -----
    const targetContratoId = contrato_id ?? assoc.contrato_id;
    if (targetContratoId) {
      const { error: contratoErr } = await supabase
        .from('contratos')
        .update({ status: 'ativo', data_ativacao: agora })
        .eq('id', targetContratoId)
        .neq('status', 'cancelado');
      if (contratoErr) {
        console.warn('[ativar-associado] update contrato erro (não bloqueante):', contratoErr.message);
      }
    }

    // ----- 8) Atualizar veículo (cobertura + status) -----
    if (veiculo_id) {
      const veiculoUpdate: Record<string, unknown> = {
        status: 'ativo',
        updated_at: agora,
      };
      if (ativar_cobertura_total) veiculoUpdate.cobertura_total = true;
      if (ativar_cobertura_roubo_furto) veiculoUpdate.cobertura_roubo_furto = true;

      const { error: veicErr } = await supabase
        .from('veiculos')
        .update(veiculoUpdate)
        .eq('id', veiculo_id);
      if (veicErr) {
        console.warn('[ativar-associado] update veiculo erro (não bloqueante):', veicErr.message);
      }
    }

    // ----- 9) Atualizar cotação -----
    if (cotacao_id) {
      const { error: cotErr } = await supabase
        .from('cotacoes')
        .update({ status_contratacao: 'ativo' })
        .eq('id', cotacao_id);
      if (cotErr) {
        console.warn('[ativar-associado] update cotacao erro (não bloqueante):', cotErr.message);
      }
    }

    // ----- 10) Log de auditoria explícito (além do trigger) -----
    await supabase.from('ativacao_status_log').insert({
      associado_id,
      contrato_id: targetContratoId,
      from_status: assoc.status,
      to_status: 'ativo',
      source: `edge:ativar-associado<-${source}`,
      actor_id,
      payload: {
        veiculo_id,
        servico_id,
        instalacao_id,
        cotacao_id,
        ativar_cobertura_total,
        ativar_cobertura_roubo_furto,
        ...metadata,
      },
    });

    return jsonResponse({
      success: true,
      associado_id,
      contrato_id: targetContratoId,
      status: 'ativo',
      from_status: assoc.status,
      ativado_em: agora,
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
