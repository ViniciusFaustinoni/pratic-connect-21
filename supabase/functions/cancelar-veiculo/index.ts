// Cancelar 1 veículo (escopo de veículo, não associado).
// Cascata escopada: cotações, instalações, serviços, vistorias, contrato 1:1, coberturas.
// Desvincula rastreador (Softruck/Rede best-effort). Inativa veículo no SGA Hinova (não-bloqueante).
// Se associado ficar órfão (sem veículo/contrato ativos), cancela associado via fn_cancelar_associado_se_orfao.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { insertAuditLog } from '../_shared/auditLog.ts'
import { alterarSituacaoParaVeiculoHinova } from '../_shared/hinova-client.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReqBody {
  veiculoId?: string
  motivo?: string
}

interface StepResult { step: string; ok: boolean; detail?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // Identificar usuário a partir do JWT (não bloqueia se ausente).
  let usuarioId: string | null = null
  let usuarioNome: string | null = null
  try {
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (token) {
      const { data: userData } = await admin.auth.getUser(token)
      usuarioId = userData?.user?.id ?? null
      if (usuarioId) {
        const { data: prof } = await admin
          .from('profiles')
          .select('nome')
          .eq('user_id', usuarioId)
          .maybeSingle()
        usuarioNome = (prof as any)?.nome ?? null
      }
    }
  } catch (_) { /* anon ok */ }

  let body: ReqBody
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const veiculoId = (body.veiculoId || '').trim()
  const motivo = (body.motivo || '').trim()
  if (!veiculoId) {
    return new Response(JSON.stringify({ error: 'veiculoId_obrigatorio' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (!motivo || motivo.length < 3) {
    return new Response(JSON.stringify({ error: 'motivo_obrigatorio' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const results: StepResult[] = []

  // ─── Guard 1: veículo existe e não está em estado terminal ───
  const { data: veiculo, error: vErr } = await admin
    .from('veiculos')
    .select('id, placa, status, associado_id, codigo_hinova, em_troca_titularidade')
    .eq('id', veiculoId)
    .maybeSingle()
  if (vErr || !veiculo) {
    return new Response(JSON.stringify({ error: 'veiculo_nao_encontrado' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const statusAtual = String((veiculo as any).status || '')
  if (['cancelado', 'vendido', 'transferido'].includes(statusAtual)) {
    return new Response(JSON.stringify({ error: 'veiculo_em_estado_terminal', status: statusAtual }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ─── Guard 2: troca de titularidade aberta ───
  if ((veiculo as any).em_troca_titularidade === true) {
    return new Response(JSON.stringify({ error: 'TROCA_EM_ANDAMENTO' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const { data: trocas } = await admin
    .from('solicitacoes_troca_titularidade')
    .select('id, status')
    .eq('veiculo_id', veiculoId)
    .not('status', 'in', '(efetivada,reprovada,cancelada,expirada)')
    .limit(1)
  if (trocas && trocas.length > 0) {
    return new Response(JSON.stringify({ error: 'TROCA_EM_ANDAMENTO' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // ─── Guard 3: substituição aberta (veículo antigo OU novo) ───
  const { data: substA } = await admin
    .from('substituicoes_veiculo')
    .select('id, status')
    .or(`veiculo_antigo_id.eq.${veiculoId},veiculo_novo_id.eq.${veiculoId}`)
    .eq('status', 'aguardando_termo_cancelamento')
    .limit(1)
  if (substA && substA.length > 0) {
    return new Response(JSON.stringify({ error: 'SUBSTITUICAO_EM_ANDAMENTO' }), {
      status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const associadoId = (veiculo as any).associado_id as string | null
  const placa = (veiculo as any).placa as string
  const nowIso = new Date().toISOString()
  const motivoTag = `[cancelar-veiculo] ${motivo}`

  // ─── Passo 1: cancelar cotações abertas do veículo ───
  try {
    const { data: cotacoes } = await admin
      .from('cotacoes')
      .select('id, status_contratacao')
      .eq('veiculo_id', veiculoId)
      .not('status_contratacao', 'in', '(ativo,cancelada)')
    if (cotacoes && cotacoes.length > 0) {
      const ids = cotacoes.map((c: any) => c.id)
      const { error } = await admin
        .from('cotacoes')
        .update({
          status_contratacao: 'cancelada',
          motivo_cancelamento: motivoTag,
          updated_at: nowIso,
        })
        .in('id', ids)
      results.push({ step: 'cotacoes', ok: !error, detail: error ? error.message : `${ids.length} cotações canceladas` })
    } else {
      results.push({ step: 'cotacoes', ok: true, detail: 'nenhuma cotação aberta' })
    }
  } catch (e) {
    results.push({ step: 'cotacoes', ok: false, detail: (e as Error).message })
  }

  // ─── Passo 2: cancelar instalações abertas (triggers em cascata propagam aos serviços) ───
  try {
    const { data: inst } = await admin
      .from('instalacoes')
      .select('id, status, veiculo_id')
      .eq('veiculo_id', veiculoId)
      .in('status', ['agendada', 'em_andamento', 'pendente'])
    if (inst && inst.length > 0) {
      const ids = inst.map((i: any) => i.id)
      const { error } = await admin
        .from('instalacoes')
        .update({ status: 'cancelada', updated_at: nowIso })
        .in('id', ids)
      results.push({ step: 'instalacoes', ok: !error, detail: error ? error.message : `${ids.length} instalações canceladas` })
    } else {
      results.push({ step: 'instalacoes', ok: true, detail: 'nenhuma instalação aberta' })
    }
  } catch (e) {
    results.push({ step: 'instalacoes', ok: false, detail: (e as Error).message })
  }

  // ─── Passo 3: cancelar serviços abertos do veículo (trigger fecha agendamentos_base) ───
  try {
    const { data: servs } = await admin
      .from('servicos')
      .select('id, status')
      .eq('veiculo_id', veiculoId)
      .in('status', ['em_aberto', 'agendada', 'em_rota', 'em_andamento', 'em_analise'])
    if (servs && servs.length > 0) {
      const ids = servs.map((s: any) => s.id)
      const { error } = await admin
        .from('servicos')
        .update({ status: 'cancelada', updated_at: nowIso })
        .in('id', ids)
      results.push({ step: 'servicos', ok: !error, detail: error ? error.message : `${ids.length} serviços cancelados` })
    } else {
      results.push({ step: 'servicos', ok: true, detail: 'nenhum serviço aberto' })
    }
  } catch (e) {
    results.push({ step: 'servicos', ok: false, detail: (e as Error).message })
  }

  // ─── Passo 4: cancelar vistorias em andamento ligadas ao veículo ───
  try {
    const { data: vist } = await admin
      .from('vistorias')
      .select('id, status')
      .eq('veiculo_id', veiculoId)
      .in('status', ['agendada', 'em_andamento', 'em_analise', 'pendente'])
    if (vist && vist.length > 0) {
      const ids = vist.map((v: any) => v.id)
      const { error } = await admin
        .from('vistorias')
        .update({ status: 'cancelada', updated_at: nowIso })
        .in('id', ids)
      results.push({ step: 'vistorias', ok: !error, detail: error ? error.message : `${ids.length} vistorias canceladas` })
    } else {
      results.push({ step: 'vistorias', ok: true, detail: 'nenhuma vistoria aberta' })
    }
  } catch (e) {
    results.push({ step: 'vistorias', ok: false, detail: (e as Error).message })
  }

  // ─── Passo 5: cancelar contrato do veículo (1:1) ───
  try {
    const { data: contratos } = await admin
      .from('contratos')
      .select('id, status')
      .eq('veiculo_id', veiculoId)
      .in('status', ['ativo', 'assinado', 'pendente', 'pendente_assinatura', 'enviado'])
    if (contratos && contratos.length > 0) {
      const ids = contratos.map((c: any) => c.id)
      const { error } = await admin
        .from('contratos')
        .update({
          status: 'cancelado',
          data_cancelamento: nowIso,
          updated_at: nowIso,
        })
        .in('id', ids)
      results.push({ step: 'contratos', ok: !error, detail: error ? error.message : `${ids.length} contratos cancelados` })
    } else {
      results.push({ step: 'contratos', ok: true, detail: 'nenhum contrato vivo' })
    }
  } catch (e) {
    results.push({ step: 'contratos', ok: false, detail: (e as Error).message })
  }

  // ─── Passo 6: desativar coberturas do veículo ───
  try {
    const { error } = await admin
      .from('veiculos')
      .update({
        cobertura_total: false,
        cobertura_roubo_furto: false,
        updated_at: nowIso,
      })
      .eq('id', veiculoId)
    results.push({ step: 'coberturas', ok: !error, detail: error?.message })
  } catch (e) {
    results.push({ step: 'coberturas', ok: false, detail: (e as Error).message })
  }

  // ─── Passo 7: desvincular rastreadores (Softruck / Rede best-effort) ───
  try {
    const { data: rastreadores } = await admin
      .from('rastreadores')
      .select('id, imei, plataforma, status')
      .eq('veiculo_id', veiculoId)
    if (rastreadores && rastreadores.length > 0) {
      for (const r of rastreadores as any[]) {
        // Softruck
        if (r.plataforma === 'softruck') {
          try {
            await admin.functions.invoke('softruck-api', {
              body: { operation: 'desassociar-device-veiculo', data: { deviceId: r.id } },
            })
          } catch (e) {
            console.warn('[cancelar-veiculo] softruck desassociar falhou', e)
          }
        }
        // Rede Veículos
        if (r.plataforma === 'rede' || r.plataforma === 'rede_veiculos') {
          try {
            await admin.functions.invoke('rede-veiculos-desvincular-cliente', {
              body: { veiculoId },
            })
          } catch (e) {
            console.warn('[cancelar-veiculo] rede desvincular falhou', e)
          }
        }
      }
      // Liberar rastreadores ao estoque
      await admin
        .from('rastreadores')
        .update({
          veiculo_id: null,
          associado_id: null,
          status: 'estoque',
          updated_at: nowIso,
        })
        .eq('veiculo_id', veiculoId)
      results.push({ step: 'rastreadores', ok: true, detail: `${rastreadores.length} liberado(s) ao estoque` })
    } else {
      results.push({ step: 'rastreadores', ok: true, detail: 'sem rastreador vinculado' })
    }
  } catch (e) {
    results.push({ step: 'rastreadores', ok: false, detail: (e as Error).message })
  }

  // ─── Passo 8: SGA Hinova — inativar veículo (situação 2) — não-bloqueante ───
  try {
    const codigoHinova = (veiculo as any).codigo_hinova
    if (codigoHinova) {
      const r = await alterarSituacaoParaVeiculoHinova(admin, Number(codigoHinova), 2)
      results.push({
        step: 'sga_inativar_veiculo',
        ok: r.ok,
        detail: r.ok ? 'situação=2' : `HTTP ${r.status} — ${r.errors?.join('; ') || r.mensagem || 'sem detalhe'}`,
      })
    } else {
      results.push({ step: 'sga_inativar_veiculo', ok: true, detail: 'veículo sem codigo_hinova' })
    }
  } catch (e) {
    results.push({ step: 'sga_inativar_veiculo', ok: false, detail: (e as Error).message })
  }

  // ─── Passo 9: marcar veículo como cancelado ───
  const { error: cancErr } = await admin
    .from('veiculos')
    .update({
      status: 'cancelado',
      data_inativacao: nowIso,
      motivo_inativacao: motivo,
      updated_at: nowIso,
    })
    .eq('id', veiculoId)
  if (cancErr) {
    results.push({ step: 'veiculo_cancelar', ok: false, detail: cancErr.message })
    await insertAuditLog(admin, {
      usuario_id: usuarioId,
      usuario_nome: usuarioNome,
      acao: 'cancelar',
      modulo: 'veiculos',
      tabela: 'veiculos',
      registro_id: veiculoId,
      descricao: `Falha ao cancelar veículo ${placa}: ${cancErr.message}`,
      dados_novos: { motivo, results },
    })
    return new Response(JSON.stringify({ error: 'falha_ao_cancelar_veiculo', detail: cancErr.message, results }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  results.push({ step: 'veiculo_cancelar', ok: true })

  // ─── Passo 10: auto-cancelar associado órfão ───
  let associadoCancelado = false
  if (associadoId) {
    try {
      const { data: orfData, error: orfErr } = await admin.rpc('fn_cancelar_associado_se_orfao', {
        _associado_id: associadoId,
        _motivo: motivoTag,
      })
      if (orfErr) {
        results.push({ step: 'associado_orfao', ok: false, detail: orfErr.message })
      } else {
        associadoCancelado = orfData === true
        results.push({
          step: 'associado_orfao',
          ok: true,
          detail: associadoCancelado ? 'associado cancelado (sem veículos/contratos vivos)' : 'associado mantido',
        })
      }
    } catch (e) {
      results.push({ step: 'associado_orfao', ok: false, detail: (e as Error).message })
    }
  }

  // ─── Auditoria ───
  await insertAuditLog(admin, {
    usuario_id: usuarioId,
    usuario_nome: usuarioNome,
    acao: 'cancelar',
    modulo: 'veiculos',
    tabela: 'veiculos',
    registro_id: veiculoId,
    descricao: `Veículo ${placa} cancelado · motivo: ${motivo}${associadoCancelado ? ' · associado também cancelado (órfão)' : ''}`,
    dados_novos: { motivo, associadoCancelado, results },
  })

  return new Response(JSON.stringify({
    ok: true,
    veiculoId,
    placa,
    associadoCancelado,
    results,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
