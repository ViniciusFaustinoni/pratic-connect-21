// Lista veículos + boletos do associado no SGA (Hinova) usando o
// `codigo_associado` (codigo_hinova) como chave canônica.
//
// Diferente de `sga-buscar-associado-completo`, esta função foi desenhada
// para o fluxo Local-First: a UI já tem o associado local (com codigo_hinova
// e CPF), então enviamos os dois — o codigo_associado é a fonte de verdade
// para chamadas de boleto, e o CPF é usado apenas para enumerar os veículos
// no Hinova (não há endpoint público para listar veículos por código).
//
// Input: { codigo_associado: number, cpf?: string }
// Output: SgaAssociadoCompletoResponse (mesma forma usada por useBuscaSGA)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getHinovaSession,
  buscarAssociadoComVeiculosPorCpf,
  buscarSituacaoFinanceiraVeiculo,
  listarBoletosVeiculo,
  mapStatusBoleto,
  parseDataHinova,
  toNumber,
  HinovaTransientError,
  HinovaNotFoundError,
  calcularProximoRetry,
  withHinovaAuthRetry,
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
  situacao_financeira: 'ADIMPLENTE' | 'INADIMPLENTE' | null;
}

interface ResponsePayload {
  encontrado: boolean;
  codigo_associado: number | null;
  associado: { nome: string | null; cpf: string | null; email: string | null; telefone: string | null } | null;
  veiculos: VeiculoSGA[];
  saldo_devedor_total: number;
  tem_debito: boolean;
  origem_busca: 'cpf' | 'placa';
  erro_transitorio?: boolean;
  motivo?: string;
  retry_em?: string;
}

const empty = (codigo: number | null): ResponsePayload => ({
  encontrado: false,
  codigo_associado: codigo,
  associado: null,
  veiculos: [],
  saldo_devedor_total: 0,
  tem_debito: false,
  origem_busca: 'cpf',
});

async function fetchAssociadoMeta(s: HinovaSession, cpf: string) {
  const cpfLimpo = cleanCPF(cpf);
  if (cpfLimpo.length !== 11) return null;
  try {
    const r = await fetch(`${s.apiUrl}/associado/buscar/${cpfLimpo}/cpf`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.tokenUsuario}` },
    });
    if (!r.ok) { await r.text(); return null; }
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
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let body: { codigo_associado?: number | string; cpf?: string };
  try { body = await req.json(); } catch { return json(400, { error: 'Body JSON inválido' }); }

  const codigoAssociadoIn = Number(body.codigo_associado || 0) || null;
  let cpf = cleanCPF(body.cpf);

  if (!codigoAssociadoIn && !cpf) {
    return json(400, { error: 'Informe codigo_associado ou cpf' });
  }

  // Se faltar CPF, tentamos resolver pelo associado local (mirror) usando codigo_hinova
  if (!cpf && codigoAssociadoIn) {
    const { data } = await supabase
      .from('associados')
      .select('cpf')
      .eq('codigo_hinova', codigoAssociadoIn)
      .maybeSingle();
    cpf = cleanCPF((data as any)?.cpf);
  }

  if (cpf.length !== 11) {
    return json(200, { ...empty(codigoAssociadoIn), erro_transitorio: false, motivo: 'cpf_invalido' });
  }

  // Pré-aquece a sessão (early-fail amigável se Hinova estiver fora)
  try {
    await getHinovaSession(supabase);
  } catch (e: any) {
    console.error('[sga-listar-boletos-associado] auth falhou:', e?.message);
    if (e instanceof HinovaTransientError) {
      const retry = calcularProximoRetry(e.reason);
      return json(200, { ...empty(codigoAssociadoIn), erro_transitorio: true, motivo: e.reason, retry_em: retry.toISOString() });
    }
    return json(200, { ...empty(codigoAssociadoIn), erro_transitorio: true, motivo: 'auth_falhou' });
  }

  try {
    // 1) Enumerar veículos do associado via CPF — usa supabase (hinovaFetch
    //    com auto-reauth em 401/403) ao invés de session direto.
    let codigoAssociado: number | null = codigoAssociadoIn;
    let veiculosSGA: Array<{ placa: string; codigo_veiculo: number }> = [];
    try {
      const r = await buscarAssociadoComVeiculosPorCpf(supabase, cpf);
      if (r.codigo_associado && codigoAssociadoIn && r.codigo_associado !== codigoAssociadoIn) {
        console.warn('[sga-listar-boletos-associado] codigo_associado divergente', {
          local: codigoAssociadoIn, sga: r.codigo_associado, cpf,
        });
      }
      codigoAssociado = codigoAssociadoIn || r.codigo_associado;
      veiculosSGA = r.veiculos.map((v) => ({ placa: v.placa, codigo_veiculo: v.codigo_veiculo }));
    } catch (e) {
      if (e instanceof HinovaNotFoundError) return json(200, empty(codigoAssociadoIn));
      throw e;
    }

    if (!codigoAssociado || veiculosSGA.length === 0) {
      return json(200, empty(codigoAssociado));
    }

    // 2) Metadados do associado + boletos por veículo (SEQUENCIAL).
    //    Hinova invalida tokens antigos a cada /usuario/autenticar — múltiplas
    //    reautenticações concorrentes provocam 401 cruzados. Por isso processamos
    //    um veículo por vez e fechamos cada chamada com `withHinovaAuthRetry`,
    //    que reautentica 1x se a sessão cacheada estiver fria.
    const metaAssociado = await withHinovaAuthRetry(supabase, async (session) =>
      fetchAssociadoMeta(session, cpf),
    );

    const resBoletos: any[][] = [];
    const resSituacao: (string | null)[] = [];
    for (const v of veiculosSGA) {
      try {
        const boletos = await withHinovaAuthRetry(supabase, async (session) =>
          listarBoletosVeiculo(session, codigoAssociado!, v.codigo_veiculo, {
            anosTras: 3,
            linkBoleto: true,
            paralelismoJanelas: 1, // serializa janelas para reduzir contenção de auth
          }),
        );
        resBoletos.push(boletos);
      } catch (err: any) {
        console.warn(
          '[sga-listar-boletos-associado] boletos falharam veiculo',
          v.codigo_veiculo,
          err?.message,
        );
        if (err instanceof HinovaTransientError) throw err;
        resBoletos.push([]);
      }

      // Consulta situação financeira do VEÍCULO (ADIMPLENTE/INADIMPLENTE).
      // Esta é a flag canônica do SGA — boletos podem ter sido baixados
      // manualmente e ainda assim o veículo permanecer INADIMPLENTE.
      try {
        const sit = await withHinovaAuthRetry(supabase, async (session) =>
          buscarSituacaoFinanceiraVeiculo(session, {
            codigoVeiculo: v.codigo_veiculo,
            placa: v.placa,
          }),
        );
        const norm = sit ? String(sit).trim().toUpperCase() : null;
        resSituacao.push(norm === 'ADIMPLENTE' || norm === 'INADIMPLENTE' ? norm : null);
      } catch (err: any) {
        console.warn(
          '[sga-listar-boletos-associado] situacao_financeira falhou veiculo',
          v.codigo_veiculo,
          v.placa,
          err?.message,
        );
        if (err instanceof HinovaTransientError) throw err;
        resSituacao.push(null);
      }
    }

    // Diagnóstico: se TODOS os veículos com placa válida retornaram null,
    // provavelmente o endpoint /buscar/situacao-financeira-veiculo não está
    // liberado no token SGA — gate de inadimplência fica cego nesse caso.
    if (
      veiculosSGA.length > 0 &&
      veiculosSGA.some((v) => v.placa) &&
      resSituacao.every((s) => s === null)
    ) {
      console.warn(
        '[sga-listar-boletos-associado] situacao_financeira indisponivel para todos os veiculos — verificar permissao do token SGA para /buscar/situacao-financeira-veiculo',
        { cpf, codigoAssociado, placas: veiculosSGA.map((v) => v.placa) },
      );
    }


    // 3) Filtrar boletos em aberto e agregar saldo
    const veiculos: VeiculoSGA[] = veiculosSGA.map((v, i) => {
      const raw: any[] = (resBoletos[i] as any[]) || [];
      const abertos: BoletoAberto[] = [];
      let saldo = 0;
      for (const b of raw) {
        const status = mapStatusBoleto(b?.situacao);
        if (b?.data_pagamento) continue;
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
      return {
        codigo_veiculo: v.codigo_veiculo,
        placa: v.placa,
        marca: null,
        modelo: null,
        ano: null,
        saldo_devedor: Math.round(saldo * 100) / 100,
        boletos_abertos: abertos.sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || '')),
        situacao_financeira: (resSituacao[i] as VeiculoSGA['situacao_financeira']) ?? null,
      };
    });

    // 4) Enriquecer marca/modelo/ano a partir da base local (espelho)
    const placas = veiculos.map((v) => v.placa).filter(Boolean);
    if (placas.length) {
      const { data: locais } = await supabase
        .from('veiculos')
        .select('placa, marca, modelo, ano_modelo')
        .in('placa', placas);
      const byPlaca = new Map((locais || []).map((l: any) => [String(l.placa).toUpperCase(), l]));
      for (const v of veiculos) {
        const l = byPlaca.get(v.placa.toUpperCase());
        if (l) {
          v.marca = l.marca ?? v.marca;
          v.modelo = l.modelo ?? v.modelo;
          v.ano = l.ano_modelo ? String(l.ano_modelo) : v.ano;
        }
      }
    }

    const saldoTotal = Math.round(veiculos.reduce((s, v) => s + v.saldo_devedor, 0) * 100) / 100;
    const algumInadimplente = veiculos.some((v) => v.situacao_financeira === 'INADIMPLENTE');

    const resp: ResponsePayload = {
      encontrado: true,
      codigo_associado: codigoAssociado,
      associado: metaAssociado,
      veiculos,
      saldo_devedor_total: saldoTotal,
      tem_debito: saldoTotal > 0 || algumInadimplente,
      origem_busca: 'cpf',
    };
    return json(200, resp);
  } catch (e: any) {
    if (e instanceof HinovaTransientError) {
      const retry = calcularProximoRetry(e.reason);
      console.warn('[sga-listar-boletos-associado] transitório:', e.reason, e.message);
      return json(200, { ...empty(codigoAssociadoIn), erro_transitorio: true, motivo: e.reason, retry_em: retry.toISOString() });
    }
    console.error('[sga-listar-boletos-associado] erro:', e?.message, e?.stack);
    return json(200, { ...empty(codigoAssociadoIn), erro_transitorio: true, motivo: 'erro_inesperado' });
  }
});
