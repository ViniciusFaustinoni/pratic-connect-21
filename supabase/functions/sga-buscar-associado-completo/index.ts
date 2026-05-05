// Endpoint único usado pelo fluxo de cotação para consultar a base SGA (Hinova) — v2 (406 boletos vazio)
// em vez da base local. Retorna, em uma chamada:
//   - dados do associado (se existir no SGA)
//   - veículos vinculados (placa + codigo_veiculo)
//   - boletos em aberto por veículo (com linha digitável e link do boleto)
//   - saldo devedor agregado
//
// Input: { cpf?: string, placa?: string } (pelo menos um)
// Output: ver tipo SgaAssociadoCompletoResponse abaixo
//
// Em caso de erro transitório (auth/janela horária/5xx/rede), retorna HTTP 503
// com { encontrado: false, erro_transitorio: true, motivo, retry_em } — a UI
// avisa o usuário sem bloquear o fluxo manual de cotação.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getHinovaSession,
  buscarAssociadoComVeiculosPorCpf,
  buscarVeiculoPorPlaca,
  listarBoletosVeiculo,
  mapStatusBoleto,
  parseDataHinova,
  toNumber,
  HinovaTransientError,
  HinovaNotFoundError,
  calcularProximoRetry,
  type HinovaSession,
} from '../_shared/hinova-client.ts';

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
const cleanPlaca = (v: unknown) => String(v ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

const STATUS_ABERTO = new Set(['pendente', 'vencido', 'aguardando_pagamento']);

interface BoletoAberto {
  nosso_numero: string | null;
  valor: number;
  data_vencimento: string | null;
  data_emissao: string | null;
  linha_digitavel: string | null;
  link_boleto: string | null;
  situacao_label: string;
}

interface VeiculoSGA {
  codigo_veiculo: number;
  placa: string;
  marca: string | null;
  modelo: string | null;
  ano: string | null;
  saldo_devedor: number;
  boletos_abertos: BoletoAberto[];
}

interface SgaAssociadoCompletoResponse {
  encontrado: boolean;
  codigo_associado: number | null;
  associado: {
    nome: string | null;
    cpf: string | null;
    email: string | null;
    telefone: string | null;
  } | null;
  veiculos: VeiculoSGA[];
  saldo_devedor_total: number;
  tem_debito: boolean;
  origem_busca: 'cpf' | 'placa';
  erro_transitorio?: boolean;
  motivo?: string;
  retry_em?: string;
}

function emptyResponse(origem: 'cpf' | 'placa'): SgaAssociadoCompletoResponse {
  return {
    encontrado: false,
    codigo_associado: null,
    associado: null,
    veiculos: [],
    saldo_devedor_total: 0,
    tem_debito: false,
    origem_busca: origem,
  };
}

/** Busca metadados crus do associado (nome/email/telefone) — best-effort */
async function fetchAssociadoMeta(s: HinovaSession, cpf: string) {
  const cpfLimpo = cleanCPF(cpf);
  if (cpfLimpo.length !== 11) return null;
  try {
    const r = await fetch(`${s.apiUrl}/associado/buscar/${cpfLimpo}/cpf`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.tokenUsuario}` },
    });
    if (!r.ok) {
      await r.text();
      return null;
    }
    const txt = await r.text();
    let j: any;
    try { j = JSON.parse(txt); } catch { return null; }
    const root = j?.data ?? j?.dados ?? j;
    const a = Array.isArray(root) ? root[0] : root;
    if (!a) return null;
    return {
      nome: a.nome ?? a.nome_completo ?? null,
      cpf: cpfLimpo,
      email: a.email ?? a.email_principal ?? null,
      telefone: a.telefone ?? a.telefone_celular ?? a.celular ?? null,
    };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: { cpf?: string; placa?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Body JSON inválido' });
  }

  const cpfInput = cleanCPF(body.cpf);
  const placaInput = cleanPlaca(body.placa);

  if (!cpfInput && !placaInput) {
    return json(400, { error: 'Informe cpf ou placa' });
  }

  const origem: 'cpf' | 'placa' = cpfInput ? 'cpf' : 'placa';

  let session: HinovaSession;
  try {
    session = await getHinovaSession(supabase);
  } catch (e: any) {
    console.error('[sga-buscar-associado-completo] auth falhou:', e?.message);
    if (e instanceof HinovaTransientError) {
      const retry = calcularProximoRetry(e.reason);
      // 200 (não 503) — invoke() do supabase-js trata 5xx como exceção e quebra a UI.
      return json(200, {
        ...emptyResponse(origem),
        erro_transitorio: true,
        motivo: e.reason,
        retry_em: retry.toISOString(),
      });
    }
    return json(200, { ...emptyResponse(origem), erro_transitorio: true, motivo: 'auth_falhou' });
  }

  try {
    let codigoAssociado: number | null = null;
    let veiculosSGA: Array<{ placa: string; codigo_veiculo: number; meta?: any }> = [];
    let cpfParaMeta = cpfInput || '';

    // ── 1) Resolver associado/veículos via CPF ou Placa ───────────────────────
    if (origem === 'cpf') {
      try {
        const r = await buscarAssociadoComVeiculosPorCpf(session, cpfInput);
        codigoAssociado = r.codigo_associado;
        veiculosSGA = r.veiculos.map((v) => ({ placa: v.placa, codigo_veiculo: v.codigo_veiculo }));
      } catch (e) {
        if (e instanceof HinovaNotFoundError) {
          return json(200, emptyResponse(origem));
        }
        throw e;
      }
    } else {
      // origem = 'placa' → primeiro acha o veículo, depois usa CPF do dono p/ trazer todos
      try {
        const { found } = await buscarVeiculoPorPlaca(session, placaInput);
        if (!found?.codigo_veiculo) return json(200, emptyResponse(origem));

        const cpfDono = cleanCPF(found.cpf_associado ?? found.cpf ?? found.associado?.cpf);
        if (cpfDono.length === 11) {
          cpfParaMeta = cpfDono;
          try {
            const r = await buscarAssociadoComVeiculosPorCpf(session, cpfDono);
            codigoAssociado = r.codigo_associado;
            veiculosSGA = r.veiculos.map((v) => ({ placa: v.placa, codigo_veiculo: v.codigo_veiculo }));
          } catch (e) {
            if (!(e instanceof HinovaNotFoundError)) throw e;
          }
        }

        // Garante o veículo atual no resultado mesmo que a busca CPF não o liste
        if (!veiculosSGA.find((v) => v.codigo_veiculo === Number(found.codigo_veiculo))) {
          veiculosSGA.push({
            placa: cleanPlaca(found.placa ?? placaInput),
            codigo_veiculo: Number(found.codigo_veiculo),
            meta: found,
          });
        }
      } catch (e) {
        if (e instanceof HinovaNotFoundError) return json(200, emptyResponse(origem));
        throw e;
      }
    }

    if (!codigoAssociado || veiculosSGA.length === 0) {
      return json(200, emptyResponse(origem));
    }

    // ── 2) Metadados do associado (best-effort, paralelo com boletos) ──────────
    const [metaAssociado, ...resBoletos] = await Promise.all([
      fetchAssociadoMeta(session, cpfParaMeta),
      ...veiculosSGA.map((v) =>
        listarBoletosVeiculo(session, codigoAssociado!, v.codigo_veiculo, {
          anosTras: 3,
          linkBoleto: true,
        }).catch((err) => {
          // Falha em UM veículo não derruba a chamada inteira — apenas registra.
          console.warn('[sga-buscar-associado-completo] boletos falharam para veiculo', v.codigo_veiculo, err?.message);
          if (err instanceof HinovaTransientError) throw err; // transitório → propaga
          return [] as any[];
        }),
      ),
    ]);

    // ── 3) Filtrar boletos em aberto e agregar ─────────────────────────────────
    const veiculos: VeiculoSGA[] = veiculosSGA.map((v, i) => {
      const raw: any[] = (resBoletos[i] as any[]) || [];
      const abertos: BoletoAberto[] = [];
      let saldo = 0;

      for (const b of raw) {
        const status = mapStatusBoleto(b?.situacao);
        const pago = !!b?.data_pagamento;
        if (pago) continue;
        if (!STATUS_ABERTO.has(status)) continue;
        const valor = toNumber(b?.valor ?? b?.valor_documento ?? b?.valor_titulo);
        if (valor <= 0) continue;

        saldo += valor;
        abertos.push({
          nosso_numero: b?.nosso_numero ? String(b.nosso_numero) : null,
          valor,
          data_vencimento: parseDataHinova(b?.data_vencimento ?? b?.vencimento),
          data_emissao: parseDataHinova(b?.data_emissao ?? b?.emissao),
          linha_digitavel: b?.linha_digitavel ?? b?.linha_digitavel_boleto ?? null,
          link_boleto: b?.link_boleto ?? b?.url_boleto ?? null,
          situacao_label: b?.situacao ? String(b.situacao) : status,
        });
      }

      // Tenta enriquecer placa/marca/modelo a partir do payload do veículo (quando viemos de placa)
      const meta = (v as any).meta || {};
      return {
        codigo_veiculo: v.codigo_veiculo,
        placa: v.placa,
        marca: meta.marca ?? meta.marca_veiculo ?? null,
        modelo: meta.modelo ?? meta.modelo_veiculo ?? null,
        ano: meta.ano ?? meta.ano_modelo ?? null,
        saldo_devedor: Math.round(saldo * 100) / 100,
        boletos_abertos: abertos.sort((a, b) =>
          (a.data_vencimento || '').localeCompare(b.data_vencimento || ''),
        ),
      };
    });

    const saldoTotal = Math.round(veiculos.reduce((s, v) => s + v.saldo_devedor, 0) * 100) / 100;

    const resp: SgaAssociadoCompletoResponse = {
      encontrado: true,
      codigo_associado: codigoAssociado,
      associado: metaAssociado,
      veiculos,
      saldo_devedor_total: saldoTotal,
      tem_debito: saldoTotal > 0,
      origem_busca: origem,
    };

    return json(200, resp);
  } catch (e: any) {
    if (e instanceof HinovaTransientError) {
      const retry = calcularProximoRetry(e.reason);
      console.warn('[sga-buscar-associado-completo] transitório:', e.reason, e.message);
      return json(200, {
        ...emptyResponse(origem),
        erro_transitorio: true,
        motivo: e.reason,
        retry_em: retry.toISOString(),
      });
    }
    console.error('[sga-buscar-associado-completo] erro:', e?.message, e?.stack);
    return json(200, { ...emptyResponse(origem), erro_transitorio: true, motivo: 'erro_inesperado' });
  }
});
