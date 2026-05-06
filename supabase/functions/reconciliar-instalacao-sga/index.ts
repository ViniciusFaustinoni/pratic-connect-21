// Edge function: reconciliar-instalacao-sga
// Para uma instalação 'concluida' aguardando ativação no painel de Aprovações
// do Monitoramento, consulta o SGA (Hinova) por CPF do associado. Se o
// associado/veículo já existem lá, dispara `ativar-associado` localmente para
// promover associado/veículo/contrato a 'ativo' (caminho único de ativação).
//
// Body: { instalacao_id: string, source?: string, actor_id?: string|null }
// Retorno: { success, ja_ativo, sga_encontrado, ativado, codigo_hinova, ... }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const cleanCPF = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const cleanPlaca = (v: unknown) =>
  String(v ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: { instalacao_id?: string; source?: string; actor_id?: string | null };
  try {
    body = await req.json();
  } catch {
    return json(400, { success: false, error: 'invalid_json' });
  }

  const instalacaoId = body.instalacao_id;
  const source = body.source || 'edge:reconciliar-instalacao-sga';
  const actorId = body.actor_id ?? null;

  if (!instalacaoId) {
    return json(400, { success: false, error: 'instalacao_id obrigatório' });
  }

  // 1) Carregar instalação + associado + veículo
  const { data: inst, error: instErr } = await supabase
    .from('instalacoes')
    .select(`
      id, status, associado_id, veiculo_id, contrato_id, rastreador_id,
      associados:associado_id ( id, cpf, nome, status, codigo_hinova, sincronizado_hinova ),
      veiculos:veiculo_id ( id, placa, status, cobertura_total, cobertura_roubo_furto )
    `)
    .eq('id', instalacaoId)
    .maybeSingle();

  if (instErr) return json(500, { success: false, error: instErr.message });
  if (!inst) return json(404, { success: false, error: 'instalacao_nao_encontrada' });

  const associado: any = inst.associados;
  const veiculo: any = inst.veiculos;

  if (!associado || !veiculo) {
    return json(422, { success: false, error: 'instalacao_sem_associado_ou_veiculo' });
  }

  // 2) Idempotência: já ativo localmente?
  if (associado.status === 'ativo' && veiculo.status === 'ativo') {
    return json(200, {
      success: true,
      ja_ativo: true,
      mensagem: 'Associado e veículo já estão ativos localmente.',
    });
  }

  // 3) Consultar SGA via função existente (single source of truth)
  const cpf = cleanCPF(associado.cpf);
  const placa = cleanPlaca(veiculo.placa);
  if (!cpf && !placa) {
    return json(422, { success: false, error: 'sem_cpf_nem_placa_para_consultar_sga' });
  }

  const sgaUrl = `${SUPABASE_URL}/functions/v1/sga-buscar-associado-completo`;
  let sgaJson: any = null;
  try {
    const r = await fetch(sgaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        apikey: SERVICE_ROLE_KEY,
      },
      body: JSON.stringify(cpf ? { cpf } : { placa }),
    });
    sgaJson = await r.json();
  } catch (e: any) {
    return json(502, { success: false, error: 'sga_indisponivel', detail: e?.message });
  }

  if (sgaJson?.erro_transitorio) {
    return json(503, {
      success: false,
      error: 'sga_transitorio',
      motivo: sgaJson.motivo,
      retry_em: sgaJson.retry_em,
    });
  }

  if (!sgaJson?.encontrado || !sgaJson?.codigo_associado) {
    return json(409, {
      success: false,
      sga_encontrado: false,
      error: 'associado_nao_encontrado_no_sga',
      mensagem:
        'Este associado ainda não consta no SGA. Conclua a aprovação cadastral antes de sincronizar.',
    });
  }

  const codigoAssociadoSGA: number = sgaJson.codigo_associado;
  const veiculosSGA: any[] = Array.isArray(sgaJson.veiculos) ? sgaJson.veiculos : [];
  const veiculoNoSGA = veiculosSGA.find(
    (v) => cleanPlaca(v.placa) === placa,
  );

  if (!veiculoNoSGA) {
    return json(409, {
      success: false,
      sga_encontrado: true,
      veiculo_no_sga: false,
      codigo_associado: codigoAssociadoSGA,
      error: 'veiculo_nao_vinculado_no_sga',
      mensagem: `Associado existe no SGA (cód. ${codigoAssociadoSGA}), mas a placa ${placa} não está vinculada lá.`,
    });
  }

  // 4) Salvar codigo_hinova (se faltava) — sem mudar status
  const updates: Record<string, unknown> = {};
  if (!associado.codigo_hinova) updates.codigo_hinova = codigoAssociadoSGA;
  if (!associado.sincronizado_hinova) {
    updates.sincronizado_hinova = true;
    updates.sincronizado_hinova_em = new Date().toISOString();
  }
  if (Object.keys(updates).length > 0) {
    await supabase.from('associados').update(updates).eq('id', associado.id);
  }

  // 5) Ativar via função canônica (lock + CAS + log)
  const { data: ativacao, error: ativErr } = await supabase.functions.invoke(
    'ativar-associado',
    {
      body: {
        associado_id: associado.id,
        veiculo_id: veiculo.id,
        contrato_id: inst.contrato_id ?? null,
        instalacao_id: inst.id,
        source: `${source}#sga-confirmou`,
        actor_id: actorId,
        ativar_cobertura_total: true,
        ativar_cobertura_roubo_furto: true,
        // O SGA confirma cliente ativo; permitir entrar a partir de qualquer
        // estado de pré-ativação local.
        allowed_from: ['assinado', 'aguardando_instalacao', 'pendente'],
        metadata: {
          reconciliado_via: 'sga',
          codigo_associado_sga: codigoAssociadoSGA,
          codigo_veiculo_sga: veiculoNoSGA.codigo_veiculo ?? null,
        },
      },
    },
  );

  if (ativErr) {
    return json(500, {
      success: false,
      error: 'ativar_associado_falhou',
      detail: ativErr.message,
    });
  }

  if (ativacao && (ativacao as any).success === false) {
    return json(409, {
      success: false,
      error: 'ativar_associado_recusado',
      detail: ativacao,
    });
  }

  return json(200, {
    success: true,
    sga_encontrado: true,
    ativado: true,
    codigo_associado_sga: codigoAssociadoSGA,
    codigo_veiculo_sga: veiculoNoSGA.codigo_veiculo ?? null,
    ativacao,
  });
});
