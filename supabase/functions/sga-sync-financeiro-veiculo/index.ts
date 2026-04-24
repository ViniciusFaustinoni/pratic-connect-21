// Sincroniza o financeiro de UM veículo via API SGA Hinova.
// - Reusável para on-demand (botão "Atualizar agora") e workers do backfill.
// - Body: { veiculo_id: string, job_id?: string }
// - Idempotente: upsert em cobrancas por nosso_numero.
// - Distingue erros transitórios (auth/janela/5xx) → status 'pendente_retry' com proximo_retry_em.
// v3: janela de 5 meses passados em listarBoletosVeiculo (data_inicial/data_final obrigatórios pela Hinova).
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
  buscarVeiculoPorPlaca,
  HinovaTransientError,
  HinovaNotFoundError,
  calcularProximoRetry,
} from '../_shared/hinova-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const cleanCPF = (value: string | null | undefined) => String(value || '').replace(/\D/g, '');

// listarBoletosVeiculo já cuida da janela: itera em chunks de 90 dias (limite documentado da Hinova)
// cobrindo até 3 anos para trás, com link_boleto=true para já gravar a URL do boleto.

function extractCodigoAssociado(payload: any): number | null {
  const candidates = [
    payload?.codigo_associado,
    payload?.codigo_associado_pf,
    payload?.codigo,
    payload?.data?.codigo_associado,
    payload?.data?.codigo_associado_pf,
    payload?.data?.codigo,
    payload?.associado?.codigo_associado,
    payload?.associado?.codigo_associado_pf,
    Array.isArray(payload) ? payload[0]?.codigo_associado : null,
    Array.isArray(payload) ? payload[0]?.codigo_associado_pf : null,
    Array.isArray(payload) ? payload[0]?.codigo : null,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
}

async function buscarAssociadoPorCpf(session: any, cpf: string | null | undefined) {
  const cpfLimpo = cleanCPF(cpf);
  if (cpfLimpo.length !== 11) return null;

  const response = await fetch(`${session.apiUrl}/associado/buscar/${cpfLimpo}/cpf`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.tokenUsuario}`,
    },
  });

  const text = await response.text();

  // Detectar janela horária / auth recusada também aqui
  if (response.status === 401 || response.status === 403 || response.status >= 500) {
    throw new HinovaTransientError(`[buscarAssociadoPorCpf] http=${response.status}: ${text.slice(0, 200)}`, {
      httpStatus: response.status,
      reason: response.status >= 500 ? 'server' : 'auth',
      bodySample: text.slice(0, 300),
    });
  }

  if (!response.ok) {
    console.warn('[SGA Sync Veículo] busca CPF status', response.status, text.slice(0, 200));
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  let jobId: string | undefined;
  let veiculoId: string | undefined;

  // Marca job como pendente_retry em vez de erro permanente
  async function marcarRetry(err: HinovaTransientError) {
    if (!jobId) return;
    const proximoRetry = calcularProximoRetry(err.reason);
    await supabase
      .from('sga_sync_financeiro_jobs')
      .update({
        status: 'pendente_retry',
        proximo_retry_em: proximoRetry.toISOString(),
        ultimo_erro: `[${err.reason}] ${err.message}`,
      })
      .eq('id', jobId);
  }

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

    const { data: veiculo, error: vErr } = await supabase
      .from('veiculos')
      .select('id, placa, codigo_hinova, associado_id, associados:associados(id, codigo_hinova, cpf, nome, email)')
      .eq('id', veiculoId)
      .single();

    if (vErr || !veiculo) throw new Error(`Veículo não encontrado: ${vErr?.message || veiculoId}`);

    const associado: any = Array.isArray((veiculo as any).associados) ? (veiculo as any).associados[0] : (veiculo as any).associados;
    if (!associado?.id) throw new Error('Associado não encontrado para o veículo');

    const authStart = Date.now();
    let session;
    try {
      const creds = await getHinovaCreds(supabase);
      if (!creds) throw new Error('Credenciais Hinova não configuradas');
      session = await autenticarHinova(creds);
      if (!session) throw new Error('Falha ao autenticar na Hinova');

      await supabase.from('sga_sync_logs').insert({
        veiculo_id: veiculoId,
        associado_id: associado.id,
        action: 'autenticar',
        status: 'success',
        duracao_ms: Date.now() - authStart,
      });
    } catch (authErr: any) {
      const msg = String(authErr?.message || authErr);
      await supabase.from('sga_sync_logs').insert({
        veiculo_id: veiculoId,
        associado_id: associado.id,
        action: 'autenticar',
        status: 'error',
        error_message: msg,
        duracao_ms: Date.now() - authStart,
      });
      throw authErr;
    }

    let codigoVeiculo = Number(veiculo.codigo_hinova) || null;
    let codigoAssociado = Number(associado.codigo_hinova) || null;

    if (veiculo.placa) {
      try {
        const { found, debug } = await buscarVeiculoPorPlaca(session, veiculo.placa);
        const codigoVeiculoEncontrado = Number(found?.codigo_veiculo) || null;
        const codigoAssociadoEncontrado = extractCodigoAssociado(found);

        await supabase.from('sga_sync_logs').insert({
          veiculo_id: veiculo.id,
          associado_id: associado.id,
          action: 'reconciliar_codigos_placa',
          status: codigoVeiculoEncontrado ? 'success' : 'info',
          request_payload: { placa: veiculo.placa },
          response_payload: {
            endpoint: debug.endpoint,
            http_status: debug.status,
            codigo_veiculo: codigoVeiculoEncontrado,
            codigo_associado: codigoAssociadoEncontrado,
            body_sample: debug.bodySample,
          },
        });

        if (codigoVeiculoEncontrado && codigoVeiculoEncontrado !== codigoVeiculo) {
          codigoVeiculo = codigoVeiculoEncontrado;
          await supabase.from('veiculos').update({ codigo_hinova: codigoVeiculoEncontrado }).eq('id', veiculo.id);
        }

        if (codigoAssociadoEncontrado && codigoAssociadoEncontrado !== codigoAssociado) {
          codigoAssociado = codigoAssociadoEncontrado;
          await supabase.from('associados').update({ codigo_hinova: codigoAssociadoEncontrado }).eq('id', associado.id);
        }
      } catch (e) {
        if (e instanceof HinovaNotFoundError) {
          // Placa não existe na Hinova — segue com o codigo que já tínhamos (se houver)
          await supabase.from('sga_sync_logs').insert({
            veiculo_id: veiculo.id,
            associado_id: associado.id,
            action: 'reconciliar_codigos_placa',
            status: 'info',
            request_payload: { placa: veiculo.placa },
            response_payload: { not_found: true },
          });
        } else {
          throw e; // transitório → bubble up para marcar retry
        }
      }
    }

    // Fallback CPF SEMPRE: tenta CPF se faltar codigoAssociado OU se já temos um mas pode estar desatualizado.
    // Se já temos codigoAssociado, só fazemos a chamada se a primeira tentativa de boletos falhar (ver abaixo).
    if (!codigoAssociado && associado.cpf) {
      try {
        const associadoPorCpf = await buscarAssociadoPorCpf(session, associado.cpf);
        const codigoAssociadoPorCpf = extractCodigoAssociado(associadoPorCpf);

        await supabase.from('sga_sync_logs').insert({
          veiculo_id: veiculo.id,
          associado_id: associado.id,
          action: 'reconciliar_codigos_cpf',
          status: codigoAssociadoPorCpf ? 'success' : 'info',
          request_payload: { cpf: '***' },
          response_payload: codigoAssociadoPorCpf
            ? { codigo_associado: codigoAssociadoPorCpf, descricao_situacao: associadoPorCpf?.descricao_situacao ?? null }
            : { descricao_situacao: associadoPorCpf?.descricao_situacao ?? null },
        });

        if (codigoAssociadoPorCpf) {
          codigoAssociado = codigoAssociadoPorCpf;
          await supabase.from('associados').update({ codigo_hinova: codigoAssociadoPorCpf }).eq('id', associado.id);
        }
      } catch (e) {
        if (e instanceof HinovaTransientError) throw e;
        // outros: ignora e segue
      }
    }

    if (!codigoVeiculo) {
      // Sem código de veículo após reconciliação → not found definitivo
      throw new HinovaNotFoundError('Veículo sem codigo_hinova válido após reconciliação');
    }
    if (!codigoAssociado) {
      throw new HinovaNotFoundError('Associado sem codigo_hinova válido após reconciliação');
    }

    let situacao: string | null = null;
    try {
      situacao = await buscarSituacaoFinanceiraVeiculo(session, codigoVeiculo);
    } catch (e) {
      if (e instanceof HinovaTransientError) throw e;
      // Erro não-transitório de situação não bloqueia listagem de boletos
    }

    // Cobertura: 3 anos para trás, em janelas iterativas de 90 dias (limite Hinova),
    // com link_boleto=true para já gravar a URL do boleto.
    const opcoesBoletos = { anosTras: 3, diasJanela: 90, linkBoleto: true } as const;
    let boletos: any[] = [];
    try {
      boletos = await listarBoletosVeiculo(session, codigoAssociado, codigoVeiculo, opcoesBoletos);
    } catch (e) {
      if (e instanceof HinovaTransientError) throw e;
      throw e;
    }

    // Fallback CPF SEMPRE quando vazio — tenta reconciliar pelo CPF mesmo se já tínhamos codigoAssociado
    if ((!boletos || boletos.length === 0) && associado.cpf) {
      try {
        const associadoPorCpf = await buscarAssociadoPorCpf(session, associado.cpf);
        const codigoAssociadoPorCpf = extractCodigoAssociado(associadoPorCpf);

        if (codigoAssociadoPorCpf && codigoAssociadoPorCpf !== codigoAssociado) {
          await supabase.from('sga_sync_logs').insert({
            veiculo_id: veiculo.id,
            associado_id: associado.id,
            action: 'reconciliar_codigos_cpf_fallback',
            status: 'success',
            response_payload: { codigo_associado_antigo: codigoAssociado, codigo_associado_novo: codigoAssociadoPorCpf },
          });
          codigoAssociado = codigoAssociadoPorCpf;
          await supabase.from('associados').update({ codigo_hinova: codigoAssociadoPorCpf }).eq('id', associado.id);
          boletos = await listarBoletosVeiculo(session, codigoAssociadoPorCpf, codigoVeiculo, opcoesBoletos);
        }
      } catch (e) {
        if (e instanceof HinovaTransientError) throw e;
      }
    }

    await supabase.from('sga_sync_logs').insert({
      veiculo_id: veiculo.id,
      associado_id: associado.id,
      action: 'listar_boletos_financeiro',
      status: boletos.length > 0 ? 'success' : 'info',
      request_payload: { codigo_associado: codigoAssociado, codigo_veiculo: codigoVeiculo },
      response_payload: { quantidade: boletos.length, situacao_financeira: situacao },
    });

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
        const match = mesRef.match(/(\d{1,2})\D+(\d{4})/) || mesRef.match(/(\d{4})\D+(\d{1,2})/);
        if (match) {
          const a = parseInt(match[1]);
          const b2 = parseInt(match[2]);
          if (a > 12) {
            refAno = a;
            refMes = b2;
          } else {
            refMes = a;
            refAno = b2;
          }
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
        valor_pago: status === 'pago'
          ? toNumber(b.valor_pago_boleto ?? b.valor_recebido ?? b.valor_pago ?? valorFinal)
          : null,
        forma_pagamento: status === 'pago'
          ? (b.forma_pagamento_boleto ?? b.tipo_pagamento ?? b.forma_pagamento ?? null)
          : null,
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
        codigo_hinova: codigoVeiculo,
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
          status: boletos.length > 0 ? 'concluido' : 'sem_historico_hinova',
          concluido_em: new Date().toISOString(),
          boletos_importados: importados,
          proximo_retry_em: null,
          ultimo_erro: boletos.length > 0 ? null : 'Nenhum boleto retornado pela Hinova para o vínculo atual de associado/veículo',
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
      codigo_associado_utilizado: codigoAssociado,
      codigo_veiculo_utilizado: codigoVeiculo,
    });
  } catch (err: any) {
    console.error('[SGA Sync Veículo] erro:', err);

    // Erros transitórios → pendente_retry, NÃO consome contador permanente
    if (err instanceof HinovaTransientError) {
      await marcarRetry(err);
      return json(200, {
        success: false,
        retry: true,
        reason: err.reason,
        http_status: err.httpStatus,
        error: err.message,
      });
    }

    // Not found definitivo → sem_historico_hinova
    if (err instanceof HinovaNotFoundError) {
      if (jobId) {
        await supabase
          .from('sga_sync_financeiro_jobs')
          .update({
            status: 'sem_historico_hinova',
            concluido_em: new Date().toISOString(),
            ultimo_erro: err.message,
          })
          .eq('id', jobId);
      }
      return json(200, { success: false, not_found: true, error: err.message });
    }

    // Outros erros → erro permanente
    if (jobId) {
      await supabase
        .from('sga_sync_financeiro_jobs')
        .update({ status: 'erro', concluido_em: new Date().toISOString(), ultimo_erro: String(err?.message || err) })
        .eq('id', jobId);
    }
    return json(200, { success: false, error: String(err?.message || err) });
  }
});
