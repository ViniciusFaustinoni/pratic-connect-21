// deno-lint-ignore-file no-explicit-any
/**
 * Cliente Hinova SGA compartilhado
 * - Resolve credenciais (ENV → integracoes_credenciais)
 * - Autentica e cacheia token_usuario por execução
 * - Helpers para os endpoints usados no backfill financeiro
 *
 * Tratamento de erros:
 * - HinovaTransientError: erros temporários (401, 403, 5xx, restrição de horário, rate limit) — devem causar retry.
 * - HinovaNotFoundError: o recurso realmente não existe (HTTP 404 confirmado).
 */

export interface HinovaCreds {
  apiUrl: string;
  token: string;
  usuario: string;
  senha: string;
}

export interface HinovaSession extends HinovaCreds {
  tokenUsuario: string;
}

export class HinovaTransientError extends Error {
  httpStatus: number;
  reason: 'auth' | 'janela_horaria' | 'rate_limit' | 'server' | 'network';
  bodySample: string;
  constructor(message: string, opts: { httpStatus: number; reason: HinovaTransientError['reason']; bodySample?: string }) {
    super(message);
    this.name = 'HinovaTransientError';
    this.httpStatus = opts.httpStatus;
    this.reason = opts.reason;
    this.bodySample = opts.bodySample ?? '';
  }
}

export class HinovaNotFoundError extends Error {
  bodySample: string;
  constructor(message: string, bodySample = '') {
    super(message);
    this.name = 'HinovaNotFoundError';
    this.bodySample = bodySample;
  }
}

/** Detecta se o body indica restrição de horário do usuário SGA */
function isJanelaHorariaError(body: string): boolean {
  const s = (body || '').toLowerCase();
  return /restri/.test(s) && /hor[áa]rio|hor[áa]rio/.test(s);
}

/** Classifica erro HTTP e lança a exceção apropriada */
function throwHttpError(httpStatus: number, body: string, ctx: string): never {
  const sample = (body || '').slice(0, 300);

  if (isJanelaHorariaError(body)) {
    throw new HinovaTransientError(`[${ctx}] Janela horária restrita: ${sample}`, {
      httpStatus,
      reason: 'janela_horaria',
      bodySample: sample,
    });
  }
  if (httpStatus === 401 || httpStatus === 403) {
    throw new HinovaTransientError(`[${ctx}] Auth recusada (http=${httpStatus}): ${sample}`, {
      httpStatus,
      reason: 'auth',
      bodySample: sample,
    });
  }
  if (httpStatus === 429) {
    throw new HinovaTransientError(`[${ctx}] Rate limit (http=429): ${sample}`, {
      httpStatus,
      reason: 'rate_limit',
      bodySample: sample,
    });
  }
  if (httpStatus >= 500 && httpStatus <= 599) {
    throw new HinovaTransientError(`[${ctx}] Servidor Hinova indisponível (http=${httpStatus}): ${sample}`, {
      httpStatus,
      reason: 'server',
      bodySample: sample,
    });
  }
  // 404 → not found real
  if (httpStatus === 404) {
    throw new HinovaNotFoundError(`[${ctx}] Recurso não encontrado (http=404)`, sample);
  }
  // Outros (400, 406, 422...) — tratamos como transitório por segurança (Hinova às vezes retorna 406 para auth)
  throw new HinovaTransientError(`[${ctx}] HTTP ${httpStatus}: ${sample}`, {
    httpStatus,
    reason: 'server',
    bodySample: sample,
  });
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('integracoes_credenciais_salt'), iterations: 100000, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

export async function getHinovaCreds(supabase: any): Promise<HinovaCreds | null> {
  let apiUrl = Deno.env.get('HINOVA_API_URL') || 'https://api.hinova.com.br/api/sga/v2';
  let token = Deno.env.get('HINOVA_TOKEN') || '';
  let usuario = Deno.env.get('HINOVA_USUARIO') || '';
  let senha = Deno.env.get('HINOVA_SENHA') || '';

  if (!token || !usuario || !senha) {
    const { data } = await supabase
      .from('integracoes_credenciais')
      .select('credenciais_encrypted, iv, configurado')
      .eq('integracao', 'hinova')
      .single();

    if (data?.configurado && data?.credenciais_encrypted && data?.iv) {
      const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      let creds: any;
      try {
        const key = await deriveKey(secret);
        const enc = Uint8Array.from(atob(data.credenciais_encrypted), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(data.iv), c => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, enc);
        creds = JSON.parse(new TextDecoder().decode(decrypted));
      } catch (e) {
        console.error('[Hinova] Falha ao decriptar credenciais:', e);
        throw new Error('Falha ao decriptar credenciais Hinova — verifique SUPABASE_SERVICE_ROLE_KEY ou refaça o cadastro em Configurações > Integrações');
      }

      token = creds.token || token;
      usuario = creds.usuario || usuario;
      senha = creds.senha || senha;
      if (creds.api_url) apiUrl = creds.api_url;

      if (!token || !usuario || !senha) {
        throw new Error('Credenciais Hinova incompletas no banco — refaça o cadastro em Configurações > Integrações');
      }
    }
  }

  if (!token || !usuario || !senha) return null;
  return { apiUrl, token, usuario, senha };
}

export async function autenticarHinova(creds: HinovaCreds): Promise<HinovaSession | null> {
  let r: Response;
  try {
    r = await fetch(`${creds.apiUrl}/usuario/autenticar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.token}` },
      body: JSON.stringify({ usuario: creds.usuario, senha: creds.senha }),
    });
  } catch (e: any) {
    throw new HinovaTransientError(`[autenticar] Erro de rede: ${String(e?.message || e)}`, {
      httpStatus: 0,
      reason: 'network',
    });
  }

  const txt = await r.text();
  let data: any;
  try { data = JSON.parse(txt); } catch { data = null; }

  // Detecta restrição de horário ANTES de tudo (Hinova retorna 401 para isso)
  if (isJanelaHorariaError(txt) || isJanelaHorariaError(String(data?.mensagem || data?.message || ''))) {
    const msg = data?.mensagem || data?.message || txt.slice(0, 200);
    console.error('[Hinova] auth bloqueada por janela horária:', msg);
    throw new HinovaTransientError(`Hinova janela horária: ${msg}`, {
      httpStatus: r.status,
      reason: 'janela_horaria',
      bodySample: txt.slice(0, 300),
    });
  }

  if (r.status === 401 || r.status === 403) {
    const msg = data?.mensagem || data?.message || 'Login ou senha inválido';
    console.error('[Hinova] auth 401:', msg);
    throw new HinovaTransientError(`Hinova autenticação 401: ${msg}`, {
      httpStatus: r.status,
      reason: 'auth',
      bodySample: txt.slice(0, 300),
    });
  }

  if (r.status >= 500) {
    throw new HinovaTransientError(`Hinova autenticação 5xx (${r.status}): ${txt.slice(0, 200)}`, {
      httpStatus: r.status,
      reason: 'server',
      bodySample: txt.slice(0, 300),
    });
  }

  if (!r.ok || !data?.token_usuario) {
    const msg = data?.mensagem || data?.message || txt.slice(0, 200);
    console.error('[Hinova] auth falhou:', msg);
    throw new Error(`Hinova autenticação falhou (${r.status}): ${msg}`);
  }
  return { ...creds, tokenUsuario: data.token_usuario };
}

function authHeaders(s: HinovaSession): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${s.tokenUsuario}`,
  };
}

/**
 * Busca veículo por placa.
 * - Lança HinovaTransientError em 401/403/429/5xx ou janela horária.
 * - Retorna { found: null } APENAS em 404 real (placa de fato não está na Hinova).
 */
export async function buscarVeiculoPorPlaca(
  s: HinovaSession,
  placa: string,
): Promise<{ found: any | null; debug: { endpoint: string; status: number; bodySample: string } }> {
  const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  let lastDebug = { endpoint: '', status: 0, bodySample: '' };

  const tryParse = (txt: string): any | null => {
    try {
      const j = JSON.parse(txt);
      if (Array.isArray(j)) return j[0] ?? null;
      if (j && typeof j === 'object') {
        if (j.codigo_veiculo) return j;
        if (j.data) {
          if (Array.isArray(j.data)) return j.data[0] ?? null;
          if (j.data.codigo_veiculo) return j.data;
        }
        if (Array.isArray(j.dados)) return j.dados[0] ?? null;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Endpoint primário (consultar/placa)
  let r1: Response;
  try {
    r1 = await fetch(`${s.apiUrl}/veiculo/consultar/placa/${placaLimpa}`, { method: 'GET', headers: authHeaders(s) });
  } catch (e: any) {
    throw new HinovaTransientError(`[buscarVeiculoPorPlaca] rede: ${String(e?.message || e)}`, {
      httpStatus: 0,
      reason: 'network',
    });
  }
  const txt1 = await r1.text();
  lastDebug = { endpoint: 'consultar/placa', status: r1.status, bodySample: txt1.slice(0, 200) };

  if (r1.ok) {
    const found = tryParse(txt1);
    if (found?.codigo_veiculo) return { found, debug: lastDebug };
    // 200 OK mas sem codigo_veiculo → tenta fallback
  } else if (r1.status === 404) {
    // Placa de fato não encontrada — tenta fallback legado e, se também 404, retorna null
  } else {
    // 401/403/429/5xx ou janela horária → propaga
    throwHttpError(r1.status, txt1, 'buscarVeiculoPorPlaca/consultar');
  }

  // Fallback endpoint legado
  let r2: Response;
  try {
    r2 = await fetch(`${s.apiUrl}/veiculo/buscar/${placaLimpa}/placa`, { method: 'GET', headers: authHeaders(s) });
  } catch (e: any) {
    throw new HinovaTransientError(`[buscarVeiculoPorPlaca/fallback] rede: ${String(e?.message || e)}`, {
      httpStatus: 0,
      reason: 'network',
    });
  }
  const txt2 = await r2.text();
  lastDebug = { endpoint: 'buscar/placa', status: r2.status, bodySample: txt2.slice(0, 200) };

  if (r2.status === 404) return { found: null, debug: lastDebug };
  if (r2.ok) {
    const found = tryParse(txt2);
    return { found, debug: lastDebug };
  }
  // Erro transitório no fallback
  throwHttpError(r2.status, txt2, 'buscarVeiculoPorPlaca/fallback');
}

/** GET /buscar/situacao-financeira-veiculo/{codigo} */
export async function buscarSituacaoFinanceiraVeiculo(s: HinovaSession, codigoVeiculo: number | string): Promise<string | null> {
  let r: Response;
  try {
    r = await fetch(`${s.apiUrl}/buscar/situacao-financeira-veiculo/${codigoVeiculo}`, {
      method: 'GET',
      headers: authHeaders(s),
    });
  } catch (e: any) {
    throw new HinovaTransientError(`[situacao-financeira] rede: ${String(e?.message || e)}`, {
      httpStatus: 0,
      reason: 'network',
    });
  }
  const txt = await r.text();
  if (r.status === 404) return null; // veículo sem situação financeira registrada — tolerável
  if (!r.ok) {
    throwHttpError(r.status, txt, 'buscarSituacaoFinanceiraVeiculo');
  }
  try {
    const j = JSON.parse(txt);
    return (j?.situacao_financeira ?? j?.situacao ?? j?.status ?? (typeof j === 'string' ? j : null)) as string | null;
  } catch {
    const t = txt.trim().toUpperCase();
    if (t === 'ADIMPLENTE' || t === 'INADIMPLENTE') return t;
    return null;
  }
}

/**
 * POST /listar/boleto-associado-veiculo
 * - Lança HinovaTransientError em 401/403/429/5xx/janela horária.
 * - Retorna [] APENAS quando HTTP 200 com array vazio (associado/veículo sem boletos).
 * - 404 → [] (não há boletos para esse vínculo).
 *
 * IMPORTANTE: A API exige `data_inicial` e `data_final` (formato dd/mm/aaaa),
 * caso contrário responde 406 "É necessario enviar ao menos uma data inicial e uma final".
 * Default: janela de 5 anos para trás até hoje (cobre todo histórico que a Hinova ainda guarda).
 */
function fmtDataBR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export async function listarBoletosVeiculo(
  s: HinovaSession,
  codigoAssociado: number | string,
  codigoVeiculo: number | string,
  opts?: { dataInicial?: string; dataFinal?: string; anosTras?: number },
): Promise<any[]> {
  const hoje = new Date();
  const anosTras = opts?.anosTras ?? 5;
  const inicio = new Date(hoje);
  inicio.setFullYear(inicio.getFullYear() - anosTras);

  const dataInicial = opts?.dataInicial ?? fmtDataBR(inicio);
  const dataFinal = opts?.dataFinal ?? fmtDataBR(hoje);

  let r: Response;
  try {
    r = await fetch(`${s.apiUrl}/listar/boleto-associado-veiculo`, {
      method: 'POST',
      headers: authHeaders(s),
      body: JSON.stringify({
        codigo_associado: Number(codigoAssociado),
        codigo_veiculo: Number(codigoVeiculo),
        data_inicial: dataInicial,
        data_final: dataFinal,
      }),
    });
  } catch (e: any) {
    throw new HinovaTransientError(`[listar boletos] rede: ${String(e?.message || e)}`, {
      httpStatus: 0,
      reason: 'network',
    });
  }
  const txt = await r.text();
  if (r.status === 404) return [];
  if (!r.ok) {
    throwHttpError(r.status, txt, 'listarBoletosVeiculo');
  }
  try {
    const j = JSON.parse(txt);
    if (Array.isArray(j)) return j;
    if (Array.isArray(j?.boletos)) return j.boletos;
    if (Array.isArray(j?.dados)) return j.dados;
    return [];
  } catch {
    return [];
  }
}

/** Mapeia situação textual da Hinova para o status interno de cobrancas */
export function mapStatusBoleto(situacao: string | null | undefined): string {
  const s = (situacao || '').toString().trim().toUpperCase();
  if (!s) return 'aguardando_pagamento';
  if (s.includes('BAIXA') || s.includes('PAGO') || s.includes('LIQUIDA')) return 'pago';
  if (s.includes('CANCEL')) return 'cancelado';
  if (s.includes('VENCID') || s.includes('ATRASO')) return 'vencido';
  return 'aguardando_pagamento';
}

/** Converte data Hinova (dd/MM/yyyy ou yyyy-MM-dd) para ISO yyyy-MM-dd */
export function parseDataHinova(d: string | null | undefined): string | null {
  if (!d) return null;
  const s = String(d).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10);
  return null;
}

export function toNumber(v: any): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.\-]/g, '');
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

/**
 * GET /associado/buscar/{cpf}/cpf
 * Retorna dados do associado + lista de veículos vinculados (placa + codigo_veiculo).
 * - Tenta primeiro com CPF limpo (somente dígitos), depois com CPF formatado.
 * - Lança HinovaTransientError em 401/403/429/5xx/janela horária.
 * - Lança HinovaNotFoundError em 404 confirmado em ambos formatos.
 */
export async function buscarAssociadoComVeiculosPorCpf(
  s: HinovaSession,
  cpf: string,
): Promise<{ codigo_associado: number | null; veiculos: Array<{ placa: string; codigo_veiculo: number }> }> {
  const cpfDigitos = (cpf || '').replace(/\D/g, '');
  if (cpfDigitos.length !== 11) {
    throw new HinovaNotFoundError(`[buscarAssociadoPorCpf] CPF inválido: ${cpf}`);
  }
  const cpfFormatado = `${cpfDigitos.slice(0, 3)}.${cpfDigitos.slice(3, 6)}.${cpfDigitos.slice(6, 9)}-${cpfDigitos.slice(9, 11)}`;
  const tentativas = [cpfDigitos, cpfFormatado];

  let last404Body = '';
  for (let i = 0; i < tentativas.length; i++) {
    const cpfTentativa = tentativas[i];
    let r: Response;
    try {
      r = await fetch(`${s.apiUrl}/associado/buscar/${encodeURIComponent(cpfTentativa)}/cpf`, {
        method: 'GET',
        headers: authHeaders(s),
      });
    } catch (e: any) {
      throw new HinovaTransientError(`[buscarAssociadoPorCpf] rede: ${String(e?.message || e)}`, {
        httpStatus: 0,
        reason: 'network',
      });
    }
    const txt = await r.text();

    if (r.status === 404) {
      last404Body = txt.slice(0, 200);
      continue; // tenta próximo formato
    }
    if (!r.ok) {
      throwHttpError(r.status, txt, 'buscarAssociadoPorCpf');
    }

    let j: any;
    try { j = JSON.parse(txt); } catch { j = null; }

    // Normaliza retorno (Hinova pode embrulhar em {data} ou {dados} ou retornar direto)
    const root = j?.data ?? j?.dados ?? j;
    const associado = Array.isArray(root) ? root[0] : root;
    if (!associado || typeof associado !== 'object') {
      // 200 com payload vazio → trata como not found
      last404Body = txt.slice(0, 200);
      continue;
    }

    const codigo_associado =
      Number(associado.codigo_associado ?? associado.codigo ?? associado.id ?? 0) || null;

    const rawVeiculos: any[] =
      (Array.isArray(associado.veiculos) && associado.veiculos) ||
      (Array.isArray(associado.lista_veiculos) && associado.lista_veiculos) ||
      (Array.isArray(associado.veiculos_associado) && associado.veiculos_associado) ||
      [];

    const veiculos = rawVeiculos
      .map((v: any) => {
        const placa = String(v?.placa ?? v?.placa_veiculo ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const codigo = Number(v?.codigo_veiculo ?? v?.codigo ?? v?.id ?? 0);
        return placa && codigo ? { placa, codigo_veiculo: codigo } : null;
      })
      .filter((x): x is { placa: string; codigo_veiculo: number } => !!x);

    return { codigo_associado, veiculos };
  }

  throw new HinovaNotFoundError(`[buscarAssociadoPorCpf] CPF não encontrado em nenhum formato: ${cpfDigitos}`, last404Body);
}

/** Calcula próximo retry com base no motivo do erro transitório */
export function calcularProximoRetry(reason: HinovaTransientError['reason']): Date {
  const now = new Date();
  if (reason === 'janela_horaria') {
    // Próximo dia útil às 09:00 BRT (12:00 UTC). Se já passou hoje, agenda para amanhã.
    const next = new Date(now);
    next.setUTCHours(12, 0, 0, 0);
    if (next.getTime() <= now.getTime()) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
    return next;
  }
  if (reason === 'rate_limit') {
    // 5 minutos
    return new Date(now.getTime() + 5 * 60 * 1000);
  }
  // server / auth / network → 30 minutos
  return new Date(now.getTime() + 30 * 60 * 1000);
}
