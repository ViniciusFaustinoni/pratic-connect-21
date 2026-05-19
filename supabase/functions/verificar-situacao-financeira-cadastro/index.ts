// Gate de Situação Financeira (SGA) para o Cadastro.
// Disparado ao abrir uma aprovação (proposta comum ou troca de titularidade).
// Reusa a edge `sga-listar-boletos-associado` para a consulta SGA.
// Persiste cada consulta em `sga_situacao_check` (auditoria).
//
// Input:
//   { contrato_id?, solicitacao_troca_id?, force?: boolean,
//     bypass?: { motivo: string } }
// Output:
//   { ok: true, check: SgaSituacaoCheckRow, sga: ResponseSga, liberado: boolean }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const cleanCPF = (v: unknown) => String(v ?? '').replace(/\D/g, '');

const CACHE_MIN = 10; // minutos para reuso de check anterior

interface ResolvedCtx {
  contrato_id: string | null;
  solicitacao_troca_id: string | null;
  associado_id: string | null;
  cpf: string;
  codigo_hinova: number | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Identifica usuário (para auditoria + bypass)
  let userId: string | null = null;
  const authHeader = req.headers.get('Authorization') ?? '';
  if (authHeader.startsWith('Bearer ')) {
    try {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      userId = data.user?.id ?? null;
    } catch { /* ignore */ }
  }

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: 'Body JSON inválido' }); }

  const contratoId: string | null = body?.contrato_id ?? null;
  const trocaId: string | null = body?.solicitacao_troca_id ?? null;
  const force: boolean = !!body?.force;
  const bypass = body?.bypass && typeof body.bypass === 'object' ? body.bypass : null;

  if (!contratoId && !trocaId) {
    return json(400, { error: 'Informe contrato_id ou solicitacao_troca_id' });
  }

  // 1) Resolve CPF + codigo_hinova + associado_id a partir do contexto
  const ctx: ResolvedCtx = {
    contrato_id: contratoId,
    solicitacao_troca_id: trocaId,
    associado_id: null,
    cpf: '',
    codigo_hinova: null,
  };

  if (contratoId) {
    const { data: c, error: cErr } = await admin
      .from('contratos')
      .select('id, associado_id, cliente_cpf, associado:associados!fk_contratos_associado(id, cpf, codigo_hinova)')
      .eq('id', contratoId)
      .maybeSingle();
    if (cErr) return json(500, { error: 'contrato_lookup_falhou', detail: cErr.message });
    if (!c) return json(404, { error: 'contrato_nao_encontrado' });
    ctx.associado_id = c.associado_id ?? null;
    ctx.cpf = cleanCPF((c as any).associado?.cpf || c.cliente_cpf);
    ctx.codigo_hinova = (c as any).associado?.codigo_hinova ?? null;
  } else if (trocaId) {
    const { data: t, error: tErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, associado_antigo_id, associado_antigo:associados!associado_antigo_id(id, cpf, codigo_hinova)')
      .eq('id', trocaId)
      .maybeSingle();
    if (tErr) return json(500, { error: 'troca_lookup_falhou', detail: tErr.message });
    if (!t) return json(404, { error: 'troca_nao_encontrada' });
    ctx.associado_id = (t as any).associado_antigo_id ?? null;
    ctx.cpf = cleanCPF((t as any).associado_antigo?.cpf);
    ctx.codigo_hinova = (t as any).associado_antigo?.codigo_hinova ?? null;
  }

  if (!ctx.cpf || ctx.cpf.length !== 11) {
    // Sem CPF não há como consultar — registra como liberado (associado novo)
    const inserted = await admin.from('sga_situacao_check').insert({
      contrato_id: ctx.contrato_id,
      solicitacao_troca_id: ctx.solicitacao_troca_id,
      associado_id: ctx.associado_id,
      cpf: ctx.cpf || '00000000000',
      codigo_hinova: ctx.codigo_hinova,
      verificado_por: userId,
      tem_debito: false,
      saldo_devedor: 0,
      qtd_boletos_abertos: 0,
      origem_resultado: 'associado_inexistente_sga',
      motivo: 'cpf_indisponivel',
      payload: null,
    }).select().single();
    return json(200, { ok: true, check: inserted.data, liberado: true });
  }

  // 2) Bypass (Diretor) — valida permissão e grava registro liberador
  if (bypass) {
    const motivo = String(bypass.motivo || '').trim();
    if (motivo.length < 5) return json(400, { error: 'bypass_motivo_obrigatorio' });
    if (!userId) return json(401, { error: 'nao_autenticado' });
    const { data: perm } = await admin.rpc('has_permission', {
      _user_id: userId,
      _permission: 'cadastro.bypass_inadimplencia_sga',
    });
    if (!perm) return json(403, { error: 'sem_permissao_bypass' });

    const inserted = await admin.from('sga_situacao_check').insert({
      contrato_id: ctx.contrato_id,
      solicitacao_troca_id: ctx.solicitacao_troca_id,
      associado_id: ctx.associado_id,
      cpf: ctx.cpf,
      codigo_hinova: ctx.codigo_hinova,
      verificado_por: userId,
      tem_debito: true,
      saldo_devedor: 0,
      qtd_boletos_abertos: 0,
      origem_resultado: 'bypass',
      motivo: 'bypass_diretor',
      bypass: true,
      bypass_motivo: motivo,
      bypass_por: userId,
      payload: null,
    }).select().single();
    return json(200, { ok: true, check: inserted.data, liberado: true });
  }

  // 3) Cache de 10 minutos
  if (!force) {
    const filterCol = ctx.contrato_id ? 'contrato_id' : 'solicitacao_troca_id';
    const filterVal = ctx.contrato_id ?? ctx.solicitacao_troca_id;
    const { data: prev } = await admin
      .from('sga_situacao_check')
      .select('*')
      .eq(filterCol, filterVal)
      .order('verificado_em', { ascending: false })
      .limit(1);
    const last = prev?.[0];
    if (last) {
      const ageMs = Date.now() - new Date(last.verificado_em).getTime();
      if (ageMs < CACHE_MIN * 60 * 1000) {
        const liberado = last.origem_resultado === 'inconclusivo'
          ? false
          : (!last.tem_debito || last.bypass === true || last.origem_resultado === 'transitorio' || last.origem_resultado === 'associado_inexistente_sga');
        return json(200, { ok: true, check: last, liberado, cached: true });
      }
    }
  }

  // 4) Consulta SGA via edge existente (reuso integral)
  let sgaResp: any = null;
  let transitorio = false;
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/sga-listar-boletos-associado`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        apikey: SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({ codigo_associado: ctx.codigo_hinova ?? undefined, cpf: ctx.cpf }),
    });
    sgaResp = await r.json().catch(() => null);
    if (sgaResp?.erro_transitorio) transitorio = true;
  } catch (e: any) {
    transitorio = true;
    sgaResp = { motivo: 'fetch_falhou', detail: String(e?.message || e) };
  }

  // 5) Determinar inadimplência (TRÊS estados):
  //    OK            → todos os veículos com ADIMPLENTE e nenhum boleto vencido
  //    INADIMPLENTE  → qualquer boleto vencido OU qualquer situacao_financeira=INADIMPLENTE
  //    INCONCLUSIVO  → SGA respondeu mas TODOS os veículos vieram com
  //                    situacao_financeira=null E nenhum boleto vencido.
  //                    Hoje isso era lido como OK (falso-positivo) — passa a bloquear.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let saldo = 0;
  let qtd = 0;
  const placasInadimplentes: string[] = [];
  let totalVeiculos = 0;
  let veiculosComSinal = 0; // tem ADIMPLENTE ou INADIMPLENTE
  if (sgaResp && Array.isArray(sgaResp.veiculos)) {
    for (const v of sgaResp.veiculos) {
      totalVeiculos += 1;
      for (const b of (v.boletos_abertos || [])) {
        if (!b?.data_vencimento) continue;
        const d = new Date(b.data_vencimento);
        if (isNaN(d.getTime())) continue;
        if (d < today) {
          saldo += Number(b.valor || 0);
          qtd += 1;
        }
      }
      const sit = String(v?.situacao_financeira || '').toUpperCase();
      if (sit === 'INADIMPLENTE') {
        if (v?.placa) placasInadimplentes.push(String(v.placa));
        veiculosComSinal += 1;
      } else if (sit === 'ADIMPLENTE') {
        veiculosComSinal += 1;
      }
    }
  }
  const temDebito = qtd > 0 || placasInadimplentes.length > 0;

  let origem = 'sga';
  let motivo: string | null = null;
  if (transitorio) { origem = 'transitorio'; motivo = sgaResp?.motivo ?? 'sga_transitorio'; }
  else if (sgaResp && sgaResp.encontrado === false) { origem = 'associado_inexistente_sga'; motivo = sgaResp?.motivo ?? 'nao_encontrado'; }
  else if (qtd === 0 && placasInadimplentes.length > 0) {
    motivo = `veiculo_inadimplente_sga: ${placasInadimplentes.join(', ')}`;
  }
  // INCONCLUSIVO: SGA respondeu, encontrou veículos, mas TODOS sem sinal
  // financeiro (situacao_financeira=null em todos) E sem boletos vencidos.
  // Esse foi exatamente o falso-OK do caso ALEXANDRE GUTTI / KRN9E64.
  if (
    origem === 'sga' &&
    !temDebito &&
    totalVeiculos > 0 &&
    veiculosComSinal === 0
  ) {
    origem = 'inconclusivo';
    motivo = 'sga_sem_sinal_situacao_financeira_em_todos_veiculos';
  }

  const { data: inserted, error: insErr } = await admin.from('sga_situacao_check').insert({
    contrato_id: ctx.contrato_id,
    solicitacao_troca_id: ctx.solicitacao_troca_id,
    associado_id: ctx.associado_id,
    cpf: ctx.cpf,
    codigo_hinova: ctx.codigo_hinova ?? sgaResp?.codigo_associado ?? null,
    verificado_por: userId,
    tem_debito: origem === 'sga' ? temDebito : (origem === 'inconclusivo' ? true : false),
    saldo_devedor: Math.round(saldo * 100) / 100,
    qtd_boletos_abertos: qtd,
    origem_resultado: origem,
    motivo,
    payload: sgaResp,
  }).select().single();

  if (insErr) {
    console.error('[verificar-situacao-financeira-cadastro] insert falhou', insErr);
    return json(500, { error: 'persistencia_falhou', detail: insErr.message });
  }

  // Telemetria opcional
  try {
    await admin.from('sga_sync_logs').insert({
      action: 'check_situacao_cadastro',
      payload: {
        contrato_id: ctx.contrato_id,
        solicitacao_troca_id: ctx.solicitacao_troca_id,
        cpf: ctx.cpf,
        tem_debito: temDebito,
        saldo_devedor: saldo,
        qtd_boletos_abertos: qtd,
        origem,
        total_veiculos: totalVeiculos,
        veiculos_com_sinal: veiculosComSinal,
      },
      success: true,
    });
  } catch { /* tabela pode não existir; tolerar */ }

  // INCONCLUSIVO bloqueia (libera apenas via bypass auditado ou nova consulta com sinal)
  const liberado = origem === 'sga' ? !temDebito : (origem === 'inconclusivo' ? false : true);
  return json(200, { ok: true, check: inserted, sga: sgaResp, liberado });
});
