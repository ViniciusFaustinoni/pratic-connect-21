// Edge enxuta para amostragem na tela de Substituição de Placa.
// Faz apenas dois GETs no Hinova e devolve o payload cru — sem boletos,
// sem agregação por CPF, sem listagem de outros veículos.
//
// Input:  { placa: string }
// Output: { encontrado, veiculo, associado, erro_transitorio?, motivo? }
//
// IMPORTANTE: não substitui `sga-buscar-associado-completo` (que segue
// canônico para verificação de débito/elegibilidade). Esta edge serve
// só para exibição informativa no card de confirmação.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getHinovaSession,
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
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const cleanPlaca = (v: unknown) =>
  String(v ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
const cleanCPF = (v: unknown) => String(v ?? '').replace(/\D/g, '');

interface VeiculoOut {
  placa: string | null;
  chassi: string | null;
  marca: string | null;
  modelo: string | null;
  ano_fabricacao: string | null;
  ano_modelo: string | null;
  valor_fipe: number | null;
  codigo_fipe: string | null;
  codigo_veiculo: number | null;
  codigo_situacao: string | null;
  descricao_situacao: string | null;
  renavam: string | null;
  codigo_cor: string | null;
  codigo_combustivel: string | null;
}

interface AssociadoOut {
  codigo_associado: number | null;
  nome: string | null;
  cpf: string | null;
  email: string | null;
  telefone_celular: string | null;
  telefone_fixo: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  data_nascimento: string | null;
  dia_vencimento: string | null;
  descricao_situacao: string | null;
}

interface RespOk {
  encontrado: boolean;
  veiculo: VeiculoOut | null;
  associado: AssociadoOut | null;
  erro_transitorio?: boolean;
  motivo?: string;
  retry_em?: string;
}

const empty: RespOk = { encontrado: false, veiculo: null, associado: null };

function mapVeiculo(raw: any): VeiculoOut | null {
  if (!raw) return null;
  const num = (v: any) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  return {
    placa: raw.placa ?? null,
    chassi: raw.chassi ?? null,
    marca: raw.marca ?? null,
    modelo: raw.modelo ?? null,
    ano_fabricacao: raw.ano_fabricacao ?? null,
    ano_modelo: raw.ano_modelo ?? null,
    valor_fipe: num(raw.valor_fipe),
    codigo_fipe: raw.codigo_fipe ?? null,
    codigo_veiculo: raw.codigo_veiculo ? Number(raw.codigo_veiculo) : null,
    codigo_situacao: raw.codigo_situacao != null ? String(raw.codigo_situacao) : null,
    descricao_situacao: raw.descricao_situacao ?? null,
    renavam: raw.renavam ?? null,
    codigo_cor: raw.codigo_cor != null ? String(raw.codigo_cor) : null,
    codigo_combustivel: raw.codigo_combustivel != null ? String(raw.codigo_combustivel) : null,
  };
}

function mapAssociado(raw: any): AssociadoOut | null {
  if (!raw) return null;
  return {
    codigo_associado: raw.codigo_associado ? Number(raw.codigo_associado) : null,
    nome: raw.nome ?? null,
    cpf: raw.cpf ?? null,
    email: raw.email ?? raw.email_principal ?? null,
    telefone_celular: raw.telefone_celular ?? raw.celular ?? null,
    telefone_fixo: raw.telefone_fixo ?? raw.telefone ?? null,
    logradouro: raw.logradouro ?? null,
    numero: raw.numero ?? null,
    complemento: raw.complemento ?? null,
    bairro: raw.bairro ?? null,
    cidade: raw.cidade ?? null,
    estado: raw.estado ?? null,
    cep: raw.cep ?? null,
    data_nascimento: raw.data_nascimento ?? null,
    dia_vencimento: raw.dia_vencimento != null ? String(raw.dia_vencimento) : null,
    descricao_situacao: raw.descricao_situacao ?? null,
  };
}

async function fetchAssociadoFull(apiUrl: string, token: string, cpf: string): Promise<any | null> {
  const cpfLimpo = cleanCPF(cpf);
  if (cpfLimpo.length !== 11) return null;
  try {
    const r = await fetch(`${apiUrl}/associado/buscar/${cpfLimpo}/cpf`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      await r.text();
      return null;
    }
    const txt = await r.text();
    let j: any;
    try { j = JSON.parse(txt); } catch { return null; }
    const root = j?.data ?? j?.dados ?? j;
    return Array.isArray(root) ? root[0] : root;
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

  let body: { placa?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Body JSON inválido' });
  }

  const placa = cleanPlaca(body.placa);
  if (!placa) return json(400, { error: 'Informe placa' });

  let session;
  try {
    session = await getHinovaSession(supabase);
  } catch (e: any) {
    console.error('[sga-buscar-veiculo-associado] auth falhou:', e?.message);
    const motivo = e instanceof HinovaTransientError ? e.reason : 'auth_falhou';
    const retry = calcularProximoRetry(motivo);
    return json(200, { ...empty, erro_transitorio: true, motivo, retry_em: retry.toISOString() });
  }

  try {
    const { found } = await buscarVeiculoPorPlaca(session, placa);
    if (!found?.codigo_veiculo) return json(200, empty);

    const veiculo = mapVeiculo(found);
    const cpfDono = cleanCPF(
      found.cpf ?? found.cpf_associado ?? found.associado?.cpf,
    );

    let assocRaw: any = null;
    if (cpfDono.length === 11) {
      assocRaw = await fetchAssociadoFull(session.apiUrl, session.tokenUsuario, cpfDono);
    }
    const associado = mapAssociado(assocRaw) ?? mapAssociado({
      codigo_associado: found.codigo_associado,
      nome: found.nome,
      cpf: cpfDono || found.cpf,
      email: found.email,
      telefone_celular: found.telefone_celular,
      telefone_fixo: found.telefone,
      logradouro: found.logradouro,
      numero: found.numero,
      complemento: found.complemento,
      bairro: found.bairro,
      cidade: found.cidade,
      estado: found.estado,
      cep: found.cep,
      descricao_situacao: found.descricao_situacao,
    });

    const resp: RespOk = { encontrado: true, veiculo, associado };
    return json(200, resp);
  } catch (e: any) {
    if (e instanceof HinovaTransientError) {
      const retry = calcularProximoRetry(e.reason);
      console.warn('[sga-buscar-veiculo-associado] transitório:', e.reason, e.message);
      return json(200, { ...empty, erro_transitorio: true, motivo: e.reason, retry_em: retry.toISOString() });
    }
    console.error('[sga-buscar-veiculo-associado] erro:', e?.message, e?.stack);
    return json(200, { ...empty, erro_transitorio: true, motivo: 'erro_inesperado' });
  }
});
