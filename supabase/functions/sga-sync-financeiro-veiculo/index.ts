// Sincroniza o financeiro de UM veículo via API SGA Hinova.
// - Reusável para on-demand (botão "Atualizar agora") e workers do backfill.
// - Body: { veiculo_id: string, job_id?: string }
// - Idempotente: upsert em cobrancas por nosso_numero.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getHinovaCreds,
  autenticarHinova,
  buscarSituacaoFinanceiraVeiculo,
  listarBoletosVeiculo,
  mapStatusBoleto,
  parseDataHinova,
  toNumber,
} from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let jobId: string | undefined;
  let veiculoId: string | undefined;

  try {
    const body = await req.json().catch(() => ({}));
    veiculoId = body.veiculo_id;
    jobId = body.job_id;

    if (!veiculoId) return json(400, { success: false, error: 'veiculo_id obrigatório' });

    if (jobId) {
      await supabase
        .from('sga_sync_financeiro_jobs')
        .update({ status: 'executando', iniciado_em: new Date().toISOString(), tentativas: 1 })
        .eq('id', jobId);
    }

    // Carregar veículo + associado
    const { data: veiculo, error: vErr } = await supabase
      .from('veiculos')
      .select('id, placa, codigo_hinova, associado_id, associados:associados(id, codigo_hinova)')
      .eq('id', veiculoId)
      .single();

    if (vErr || !veiculo) throw new Error(`Veículo não encontrado: ${vErr?.message || veiculoId}`);
    if (!veiculo.codigo_hinova) throw new Error('Veículo sem codigo_hinova — execute mapeamento antes');
    const associado: any = Array.isArray((veiculo as any).associados) ? (veiculo as any).associados[0] : (veiculo as any).associados;
    if (!associado?.codigo_hinova) throw new Error('Associado sem codigo_hinova');

    // Auth Hinova
    const creds = await getHinovaCreds(supabase);
    if (!creds) throw new Error('Credenciais Hinova não configuradas');
    const session = await autenticarHinova(creds);
    if (!session) throw new Error('Falha ao autenticar na Hinova');

    // 1) Situação financeira
    const situacao = await buscarSituacaoFinanceiraVeiculo(session, veiculo.codigo_hinova);

    // 2) Boletos
    const boletos = await listarBoletosVeiculo(session, associado.codigo_hinova, veiculo.codigo_hinova);

    let importados = 0;
    let totalAberto = 0;
    let totalVencido = 0;
    const hoje = new Date().toISOString().slice(0, 10);

    for (const b of boletos) {
      const nosso = String(b.nosso_numero ?? b.nossoNumero ?? '').trim();
      if (!nosso) continue;

      const status = mapStatusBoleto(b.situacao_boleto ?? b.situacao);
      const valor = toNumber(b.valor_boleto ?? b.valor);
      const valorFinal = toNumber(b.valor_boleto_multa_mora ?? b.valor_final ?? valor);
      const multa = toNumber(b.valor_multa);
      const juros = toNumber(b.valor_mora ?? b.juros);
      const dataEmissao = parseDataHinova(b.data_emissao) ?? hoje;
      const dataVencimento = parseDataHinova(b.data_vencimento) ?? hoje;
      const dataVencOriginal = parseDataHinova(b.data_vencimento_original);
      const dataPagamento = parseDataHinova(b.data_pagamento);
      const mesRef = b.mes_referente ? String(b.mes_referente) : null;
      let refMes: number | null = null;
      let refAno: number | null = null;
      if (mesRef) {
        const m = mesRef.match(/(\d{1,2})\D+(\d{4})/) || mesRef.match(/(\d{4})\D+(\d{1,2})/);
        if (m) {
          const a = parseInt(m[1]); const b2 = parseInt(m[2]);
          if (a > 12) { refAno = a; refMes = b2; } else { refMes = a; refAno = b2; }
        }
      }

      const row = {
        associado_id: veiculo.associado_id!,
        veiculo_id: veiculo.id,
        tipo: 'mensalidade',
        status,
        descricao: `Boleto Hinova ${b.tipo_boleto || ''} ${mesRef || ''}`.trim(),
        referencia_mes: refMes,
        referencia_ano: refAno,
        valor,
        valor_final: valorFinal,
        multa: multa || null,
        juros: juros || null,
        data_emissao: dataEmissao,
        data_vencimento: dataVencimento,
        data_vencimento_original: dataVencOriginal,
        data_pagamento: dataPagamento,
        linha_digitavel: b.linha_digitavel || null,
        codigo_barras: b.codigo_barras || null,
        boleto_url: b.url_boleto || b.boleto_url || null,
        nosso_numero: nosso,
        origem: 'sga_hinova',
        codigo_situacao_boleto_hinova: typeof b.codigo_situacao_boleto === 'number' ? b.codigo_situacao_boleto : null,
        tipo_boleto_hinova: b.tipo_boleto || null,
        dados_brutos_sga: b,
        sincronizado_sga_em: new Date().toISOString(),
      } as Record<string, any>;

      const { error: upErr } = await supabase
        .from('cobrancas')
        .upsert(row, { onConflict: 'nosso_numero' });

      if (upErr) {
        console.error('[SGA Sync Veículo] upsert falhou', nosso, upErr.message);
        continue;
      }
      importados++;

      if (status === 'aguardando_pagamento' || status === 'vencido') {
        totalAberto += valorFinal || valor;
        if (status === 'vencido' || (dataVencimento && dataVencimento < hoje)) {
          totalVencido += valorFinal || valor;
        }
      }
    }

    await supabase
      .from('veiculos')
      .update({
        situacao_financeira_sga: situacao,
        situacao_financeira_sga_em: new Date().toISOString(),
        total_aberto_sga: totalAberto,
        total_vencido_sga: totalVencido,
      })
      .eq('id', veiculo.id);

    if (jobId) {
      await supabase
        .from('sga_sync_financeiro_jobs')
        .update({
          status: 'concluido',
          concluido_em: new Date().toISOString(),
          boletos_importados: importados,
          ultimo_erro: null,
        })
        .eq('id', jobId);
    }

    return json(200, {
      success: true,
      veiculo_id: veiculo.id,
      situacao_financeira: situacao,
      boletos_importados: importados,
      total_aberto: totalAberto,
      total_vencido: totalVencido,
    });
  } catch (err: any) {
    console.error('[SGA Sync Veículo] erro:', err);
    if (jobId) {
      await supabase
        .from('sga_sync_financeiro_jobs')
        .update({ status: 'erro', concluido_em: new Date().toISOString(), ultimo_erro: String(err?.message || err) })
        .eq('id', jobId);
    }
    return json(200, { success: false, error: String(err?.message || err) });
  }
});
