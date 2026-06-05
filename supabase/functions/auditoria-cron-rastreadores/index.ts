// One-shot audit: cron-driven modifications to Softruck/Rede in the last N days.
// Returns CSV. Auth via SERVICE_ROLE_KEY; not for app use.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const days = Number(url.searchParams.get('days') ?? '60');
  const format = url.searchParams.get('format') ?? 'csv';

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1) API logs (cron-originated only)
  const opsCronSoftruck = ['CRON_RECONCILIAR_PENDING', 'RECONCILED_FROM_PENDING', 'AUTO_DESVINCULO_REMOTO', 'reconciliar_pending_orfao'];
  const opsCronRede = ['obterStatusCliente', 'buscarDispositivo', 'informarVeiculoAdimplente', 'informarVeiculoInadimplente'];

  const sinceISO = new Date(Date.now() - days * 86400e3).toISOString();

  const apiRows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supa
      .from('rastreadores_api_logs')
      .select('id, created_at, plataforma, operacao, status, rastreador_id, erro_mensagem, request, response')
      .gte('created_at', sinceISO)
      .or(`operacao.in.(${opsCronSoftruck.join(',')}),and(plataforma.eq.rede_veiculos,operacao.in.(${opsCronRede.join(',')}))`)
      .order('created_at', { ascending: false })
      .range(from, from + 999);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    if (!data || data.length === 0) break;
    apiRows.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }

  // 2) Vinculo historico cron entries
  const { data: histRows } = await supa
    .from('rastreadores_vinculo_historico')
    .select('*')
    .gte('created_at', sinceISO)
    .in('origem', ['auto_desvinculo_remoto_softruck', 'cron'])
    .order('created_at', { ascending: false });

  // 3) Sync queue retried
  const { data: filaRows } = await supa
    .from('rastreadores_sync_queue')
    .select('*')
    .gte('created_at', sinceISO)
    .gt('tentativas', 1)
    .order('created_at', { ascending: false });

  // Resolve rastreadores + veiculos + associados
  const rastreadorIds = new Set<string>();
  [...apiRows, ...(histRows ?? []), ...(filaRows ?? [])].forEach((r: any) => r.rastreador_id && rastreadorIds.add(r.rastreador_id));

  const { data: rastreadores } = await supa
    .from('rastreadores')
    .select('id, codigo, imei, status, veiculo_id')
    .in('id', [...rastreadorIds]);
  const rastMap = new Map((rastreadores ?? []).map((r: any) => [r.id, r]));

  const veiculoIds = new Set<string>();
  (rastreadores ?? []).forEach((r: any) => r.veiculo_id && veiculoIds.add(r.veiculo_id));

  const { data: veiculos } = await supa
    .from('veiculos')
    .select('id, placa, associado_id')
    .in('id', [...veiculoIds]);
  const veicMap = new Map((veiculos ?? []).map((v: any) => [v.id, v]));

  const associadoIds = new Set<string>();
  (veiculos ?? []).forEach((v: any) => v.associado_id && associadoIds.add(v.associado_id));

  const { data: associados } = await supa
    .from('associados')
    .select('id, nome, cpf')
    .in('id', [...associadoIds]);
  const assMap = new Map((associados ?? []).map((a: any) => [a.id, a]));

  // Resolve veiculos for historico (anterior + novo separately)
  const veicHistIds = new Set<string>();
  (histRows ?? []).forEach((h: any) => {
    if (h.veiculo_id_anterior) veicHistIds.add(h.veiculo_id_anterior);
    if (h.veiculo_id_novo) veicHistIds.add(h.veiculo_id_novo);
  });
  const { data: veicHist } = veicHistIds.size
    ? await supa.from('veiculos').select('id, placa, associado_id').in('id', [...veicHistIds])
    : { data: [] };
  const veicHistMap = new Map((veicHist ?? []).map((v: any) => [v.id, v]));

  const motivos: Record<string, string> = {
    AUTO_DESVINCULO_REMOTO: 'Softruck removeu vínculo remotamente; cron desvinculou no DB',
    RECONCILED_FROM_PENDING: 'Cron confirmou vínculo Softruck e mudou status local PENDING→SUCCESS',
    CRON_RECONCILIAR_PENDING: 'Execução do job de reconciliação (varredura)',
    reconciliar_pending_orfao: 'Cron limpou PENDING órfão (sem device remoto)',
    obterStatusCliente: 'Cron consultou status do cliente na Rede',
    buscarDispositivo: 'Cron buscou dispositivo na Rede',
    informarVeiculoAdimplente: 'Cron informou veículo ADIMPLENTE na Rede',
    informarVeiculoInadimplente: 'Cron informou veículo INADIMPLENTE na Rede',
  };

  const tipoMod: Record<string, 'modifica_local' | 'modifica_remoto' | 'apenas_leitura'> = {
    AUTO_DESVINCULO_REMOTO: 'modifica_local',
    RECONCILED_FROM_PENDING: 'modifica_local',
    reconciliar_pending_orfao: 'modifica_local',
    CRON_RECONCILIAR_PENDING: 'apenas_leitura',
    obterStatusCliente: 'apenas_leitura',
    buscarDispositivo: 'apenas_leitura',
    informarVeiculoAdimplente: 'modifica_remoto',
    informarVeiculoInadimplente: 'modifica_remoto',
  };

  // Build CSV rows
  const csvRows: any[] = [];
  const toBRT = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  for (const a of apiRows) {
    const r: any = rastMap.get(a.rastreador_id);
    const v: any = r?.veiculo_id ? veicMap.get(r.veiculo_id) : null;
    const ass: any = v?.associado_id ? assMap.get(v.associado_id) : null;
    csvRows.push({
      data_hora_brt: toBRT(a.created_at),
      plataforma: a.plataforma,
      job_cron: opsCronSoftruck.includes(a.operacao) ? 'softruck-reconciliar-pending-10min' : 'rede-veiculos-sync-cron-30min',
      tipo_modificacao: tipoMod[a.operacao] ?? 'desconhecido',
      operacao: a.operacao,
      resultado: a.status,
      motivo: motivos[a.operacao] ?? a.operacao,
      rastreador_codigo: r?.codigo ?? '',
      rastreador_imei: r?.imei ?? '',
      status_atual: r?.status ?? '',
      placa: v?.placa ?? '',
      associado: ass?.nome ?? '',
      cpf: ass?.cpf ?? '',
      detalhe: a.erro_mensagem ?? '',
      fonte: 'rastreadores_api_logs',
      ref_id: a.id,
    });
  }

  for (const h of histRows ?? []) {
    const r: any = h.rastreador_id ? rastMap.get(h.rastreador_id) : null;
    const v: any = veicHistMap.get(h.veiculo_id_novo) || veicHistMap.get(h.veiculo_id_anterior);
    const ass: any = v?.associado_id ? assMap.get(v.associado_id) : null;
    csvRows.push({
      data_hora_brt: toBRT(h.created_at),
      plataforma: 'softruck',
      job_cron: 'softruck-reconciliar-pending-10min',
      tipo_modificacao: 'modifica_local',
      operacao: 'VINCULO_HISTORICO_' + (h.origem ?? 'cron'),
      resultado: 'sucesso',
      motivo: `Desvínculo automático: ${h.status_anterior ?? '-'} → ${h.status_novo ?? '-'} (placa ${h.placa_anterior ?? '-'} → ${h.placa_nova ?? 'NULL'})`,
      rastreador_codigo: r?.codigo ?? '',
      rastreador_imei: r?.imei ?? '',
      status_atual: r?.status ?? '',
      placa: h.placa_nova ?? h.placa_anterior ?? '',
      associado: ass?.nome ?? '',
      cpf: ass?.cpf ?? '',
      detalhe: JSON.stringify(h.contexto ?? {}),
      fonte: 'rastreadores_vinculo_historico',
      ref_id: h.id,
    });
  }

  for (const f of filaRows ?? []) {
    const r: any = f.rastreador_id ? rastMap.get(f.rastreador_id) : null;
    const v: any = r?.veiculo_id ? veicMap.get(r.veiculo_id) : null;
    const ass: any = v?.associado_id ? assMap.get(v.associado_id) : null;
    csvRows.push({
      data_hora_brt: toBRT(f.concluido_em || f.ultima_tentativa_em || f.created_at),
      plataforma: f.plataforma,
      job_cron: f.plataforma === 'softruck' ? 'cron-softruck-troca-retry / reconciliar' : 'rede-veiculos-sync-cron-30min',
      tipo_modificacao: f.status === 'concluido' ? 'modifica_remoto' : 'tentativa',
      operacao: 'FILA_RETRY:' + f.operacao,
      resultado: f.status,
      motivo: `Operação ao vivo falhou; concluída após ${f.tentativas} tentativas via cron`,
      rastreador_codigo: r?.codigo ?? '',
      rastreador_imei: r?.imei ?? '',
      status_atual: r?.status ?? '',
      placa: v?.placa ?? '',
      associado: ass?.nome ?? '',
      cpf: ass?.cpf ?? '',
      detalhe: `etapa_parou=${f.etapa_parou ?? '-'} | erro=${(f.erro_ultimo ?? '').toString().slice(0, 200)}`,
      fonte: 'rastreadores_sync_queue',
      ref_id: f.id,
    });
  }

  // Sort desc by data_hora_brt
  csvRows.sort((a, b) => (a.data_hora_brt < b.data_hora_brt ? 1 : -1));

  if (format === 'json') {
    return new Response(JSON.stringify({ total: csvRows.length, rows: csvRows }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // CSV
  const headers = ['data_hora_brt', 'plataforma', 'job_cron', 'tipo_modificacao', 'operacao', 'resultado', 'motivo', 'rastreador_codigo', 'rastreador_imei', 'status_atual', 'placa', 'associado', 'cpf', 'detalhe', 'fonte', 'ref_id'];
  const esc = (s: any) => {
    const v = (s ?? '').toString().replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return /[",;\n]/.test(v) ? `"${v}"` : v;
  };
  const csv = [headers.join(','), ...csvRows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');

  // Aggregates for summary
  const agg = {
    total: csvRows.length,
    por_plataforma: {} as Record<string, number>,
    por_tipo: {} as Record<string, number>,
    por_operacao: {} as Record<string, number>,
    por_resultado: {} as Record<string, number>,
    top10_rastreadores: {} as Record<string, number>,
  };
  for (const r of csvRows) {
    agg.por_plataforma[r.plataforma] = (agg.por_plataforma[r.plataforma] ?? 0) + 1;
    agg.por_tipo[r.tipo_modificacao] = (agg.por_tipo[r.tipo_modificacao] ?? 0) + 1;
    agg.por_operacao[r.operacao] = (agg.por_operacao[r.operacao] ?? 0) + 1;
    agg.por_resultado[r.resultado] = (agg.por_resultado[r.resultado] ?? 0) + 1;
    const key = r.rastreador_codigo || r.rastreador_imei || '(sem id)';
    agg.top10_rastreadores[key] = (agg.top10_rastreadores[key] ?? 0) + 1;
  }
  const top10 = Object.entries(agg.top10_rastreadores).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const summary = [
    `# Auditoria de modificações cron — Softruck & Rede Veículos`,
    `Período: últimos ${days} dias  |  Gerado: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} BRT`,
    ``,
    `## Totais`,
    `- **Total de eventos cron:** ${agg.total}`,
    ``,
    `### Por plataforma`,
    ...Object.entries(agg.por_plataforma).map(([k, v]) => `- ${k}: ${v}`),
    ``,
    `### Por tipo de modificação`,
    ...Object.entries(agg.por_tipo).map(([k, v]) => `- ${k}: ${v}`),
    ``,
    `### Por operação`,
    ...Object.entries(agg.por_operacao).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`),
    ``,
    `### Por resultado`,
    ...Object.entries(agg.por_resultado).map(([k, v]) => `- ${k}: ${v}`),
    ``,
    `## Top 10 rastreadores com mais intervenções cron`,
    ...top10.map(([k, v], i) => `${i + 1}. ${k} — ${v} eventos`),
  ].join('\n');

  return new Response(csv + '\n\n---SUMMARY---\n' + summary, {
    headers: { ...corsHeaders, 'Content-Type': 'text/csv; charset=utf-8' },
  });
});
