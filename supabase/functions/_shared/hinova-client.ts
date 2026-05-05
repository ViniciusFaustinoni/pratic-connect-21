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
  // 406 com mensagem de "não encontrado / indisponível para consulta" → tratamos como NotFound
  // (Hinova devolve 406 quando o veículo está cancelado / situação indisponível, mas o fluxo deve
  // seguir para a próxima estratégia de busca em vez de abortar).
  if (httpStatus === 406) {
    const lower = sample.toLowerCase();
    if (
      lower.includes('não encontrad') || lower.includes('nao encontrad') ||
      lower.includes('indispon') || lower.includes('não existe') || lower.includes('nao existe')
    ) {
      throw new HinovaNotFoundError(`[${ctx}] Recurso não encontrado/indisponível (http=406)`, sample);
    }
  }
  // Outros (400, 406 sem padrão de not-found, 422...) — transitório por segurança
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

// ===================================================================
// CACHE GLOBAL DE SESSÃO (por instância da Edge Function)
// ===================================================================
// Hinova é stateful: cada novo login invalida o token anterior.
// Cachear a sessão por instância reduz drasticamente os 401 causados
// por contenção entre chamadas concorrentes (backfill, crons, etc).
// TTL conservador de 25 min (token Hinova dura ~30 min em produção).
// ===================================================================

const SESSION_TTL_MS = 25 * 60 * 1000;

interface CachedSession {
  session: HinovaSession;
  expiresAt: number;
}

let cachedSession: CachedSession | null = null;
let pendingAuth: Promise<HinovaSession> | null = null;

/** Invalida cache (chamado quando 401 indica token morto) */
export function invalidateHinovaSession(): void {
  cachedSession = null;
}

/**
 * Retorna sessão Hinova.
 *
 * IMPORTANTE: A Hinova é stateful — cada `/usuario/autenticar` invalida
 * tokens emitidos antes. Por isso o cache global é OPCIONAL e desabilitado
 * por padrão para o backfill (cada job autentica fresco).
 *
 * @param force  ignora cache e força nova autenticação (mas atualiza cache)
 * @param noCache não consulta nem grava no cache (recomendado para backfill)
 */
export async function getHinovaSession(
  supabase: any,
  opts?: { force?: boolean; noCache?: boolean },
): Promise<HinovaSession> {
  const force = !!opts?.force;
  const noCache = !!opts?.noCache;
  const now = Date.now();

  if (!noCache && !force && cachedSession && cachedSession.expiresAt > now) {
    return cachedSession.session;
  }

  // noCache = autenticação direta sem tocar no cache global
  if (noCache) {
    const creds = await getHinovaCreds(supabase);
    if (!creds) throw new Error('Credenciais Hinova não configuradas');
    const session = await autenticarHinova(creds);
    if (!session) throw new Error('autenticarHinova retornou null');
    return session;
  }

  // Se já há uma autenticação em andamento, aguarda ela
  if (pendingAuth) {
    return pendingAuth;
  }

  pendingAuth = (async () => {
    try {
      const creds = await getHinovaCreds(supabase);
      if (!creds) {
        throw new Error('Credenciais Hinova não configuradas');
      }
      const session = await autenticarHinova(creds);
      if (!session) {
        throw new Error('autenticarHinova retornou null');
      }
      cachedSession = { session, expiresAt: Date.now() + SESSION_TTL_MS };
      return session;
    } finally {
      pendingAuth = null;
    }
  })();

  return pendingAuth;
}

/**
 * Wrapper de fetch para chamadas autenticadas Hinova.
 * Em 401/403 (sem ser janela horária), invalida o cache, reautentica UMA vez
 * e refaz a requisição. Reduz quase 100% dos falsos positivos de auth.
 *
 * `buildRequest(token)` deve retornar { url, init } para a chamada,
 * usando o `token` recebido como Authorization Bearer.
 */
export async function hinovaFetch(
  supabase: any,
  buildRequest: (token: string) => { url: string; init: RequestInit },
  ctx: string,
): Promise<{ response: Response; bodyText: string; session: HinovaSession }> {
  let session = await getHinovaSession(supabase);

  const doFetch = async (s: HinovaSession) => {
    const { url, init } = buildRequest(s.tokenUsuario);
    let r: Response;
    try {
      r = await fetch(url, init);
    } catch (e: any) {
      throw new HinovaTransientError(`[${ctx}] rede: ${String(e?.message || e)}`, {
        httpStatus: 0,
        reason: 'network',
      });
    }
    const txt = await r.text();
    return { r, txt };
  };

  let { r, txt } = await doFetch(session);

  // Se 401/403 e NÃO for janela horária, tenta reautenticar uma única vez
  if ((r.status === 401 || r.status === 403) && !isJanelaHorariaError(txt)) {
    console.warn(`[${ctx}] 401/403 detectado — invalidando cache e reautenticando`);
    invalidateHinovaSession();
    session = await getHinovaSession(supabase, { force: true });
    const retry = await doFetch(session);
    r = retry.r;
    txt = retry.txt;
  }

  return { response: r, bodyText: txt, session };
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
/**
 * Busca veículo por placa.
 *
 * IMPORTANTE: Aceita `HinovaSession` (legado) OU o client `supabase` (recomendado).
 * Quando recebe `supabase`, usa `hinovaFetch` que reautentica automaticamente em 401/403
 * — necessário porque a Hinova invalida tokens antigos a cada novo `/usuario/autenticar`,
 * e fluxos longos (sga-hinova-sync) podem ter a sessão local invalidada por chamadas
 * intermediárias que reautenticaram.
 */
export async function buscarVeiculoPorPlaca(
  sessionOrSupabase: HinovaSession | any,
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

  const isSession = sessionOrSupabase && typeof sessionOrSupabase === 'object'
    && typeof (sessionOrSupabase as any).tokenUsuario === 'string'
    && typeof (sessionOrSupabase as any).apiUrl === 'string';

  // ---- Caminho recomendado: usa hinovaFetch (retry automático em 401/403) ----
  if (!isSession) {
    const supabase = sessionOrSupabase;
    // Resolve apiUrl uma vez (hinovaFetch refresca o token internamente quando necessário).
    const sessionForUrl = await getHinovaSession(supabase);
    const apiUrl = sessionForUrl.apiUrl;

    // Endpoint primário
    const { response: r1, bodyText: txt1 } = await hinovaFetch(
      supabase,
      (token) => ({
        url: `${apiUrl}/veiculo/consultar/placa/${placaLimpa}`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
      }),
      'buscarVeiculoPorPlaca/consultar',
    );
    lastDebug = { endpoint: 'consultar/placa', status: r1.status, bodySample: txt1.slice(0, 200) };

    if (r1.ok) {
      const found = tryParse(txt1);
      if (found?.codigo_veiculo) return { found, debug: lastDebug };
    } else if (r1.status !== 404) {
      throwHttpError(r1.status, txt1, 'buscarVeiculoPorPlaca/consultar');
    }

    // Fallback
    const { response: r2, bodyText: txt2 } = await hinovaFetch(
      supabase,
      (token) => ({
        url: `${apiUrl}/veiculo/buscar/${placaLimpa}/placa`,
        init: { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } },
      }),
      'buscarVeiculoPorPlaca/fallback',
    );
    lastDebug = { endpoint: 'buscar/placa', status: r2.status, bodySample: txt2.slice(0, 200) };

    if (r2.status === 404) return { found: null, debug: lastDebug };
    if (r2.ok) {
      const found = tryParse(txt2);
      return { found, debug: lastDebug };
    }
    throwHttpError(r2.status, txt2, 'buscarVeiculoPorPlaca/fallback');
    return { found: null, debug: lastDebug };
  }

  // ---- Caminho legado: session direto (sem retry automático) ----
  const s = sessionOrSupabase as HinovaSession;
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
  } else if (r1.status !== 404) {
    throwHttpError(r1.status, txt1, 'buscarVeiculoPorPlaca/consultar');
  }

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
  throwHttpError(r2.status, txt2, 'buscarVeiculoPorPlaca/fallback');
  return { found: null, debug: lastDebug };
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

/**
 * Faz UMA chamada ao endpoint /listar/boleto-associado-veiculo respeitando
 * a janela máxima de 90 dias documentada pela Hinova.
 *
 * Use diretamente quando quiser uma janela específica (ex.: a função de teste).
 * Para histórico longo, use `listarBoletosVeiculo` que itera em janelas de 90d.
 *
 * Retorna { boletos, raw, request_payload, http_status } para permitir
 * inspeção crua do que veio da Hinova.
 */
export async function listarBoletosVeiculoJanela(
  s: HinovaSession,
  codigoAssociado: number | string,
  codigoVeiculo: number | string,
  opts: {
    dataInicial: Date;
    dataFinal: Date;
    linkBoleto?: boolean;
    codigoSituacaoBoleto?: number;
  },
): Promise<{ boletos: any[]; raw: any; request_payload: any; http_status: number }> {
  const dataInicialBR = fmtDataBR(opts.dataInicial);
  const dataFinalBR = fmtDataBR(opts.dataFinal);

  // A Hinova exige `data_vencimento_inicial`/`data_vencimento_final` (formato dd/mm/aaaa).
  // Enviamos também `data_inicial`/`data_final` por compatibilidade com versões antigas.
  const payload: Record<string, any> = {
    codigo_associado: Number(codigoAssociado),
    codigo_veiculo: Number(codigoVeiculo),
    data_vencimento_inicial: dataInicialBR,
    data_vencimento_final: dataFinalBR,
    data_inicial: dataInicialBR,
    data_final: dataFinalBR,
    link_boleto: opts.linkBoleto ?? true,
  };
  if (opts.codigoSituacaoBoleto !== undefined) {
    payload.codigo_situacao_boleto = opts.codigoSituacaoBoleto;
  }

  let r: Response;
  try {
    r = await fetch(`${s.apiUrl}/listar/boleto-associado-veiculo`, {
      method: 'POST',
      headers: authHeaders(s),
      body: JSON.stringify(payload),
    });
  } catch (e: any) {
    throw new HinovaTransientError(`[listar boletos janela] rede: ${String(e?.message || e)}`, {
      httpStatus: 0,
      reason: 'network',
    });
  }
  const txt = await r.text();
  let raw: any = null;
  try { raw = JSON.parse(txt); } catch { raw = txt; }

  if (r.status === 404) {
    return { boletos: [], raw, request_payload: payload, http_status: 404 };
  }
  // Hinova retorna 406 com mensagem "Não foram encontrados boletos dentro dos parâmetros enviados"
  // quando a janela está vazia — é um resultado válido (sem boletos), não um erro.
  // Atenção: o body cru pode vir com escapes unicode (`N\u00e3o`), então testamos
  // também o conteúdo já decodificado (raw.error / raw.mensagem) e uma variante com `\u00e3o`.
  if (r.status === 406) {
    const errStr = Array.isArray(raw?.error) ? raw.error.join(' ') : String(raw?.error ?? '');
    const msgStr = String(raw?.mensagem ?? '');
    const decoded = `${errStr} ${msgStr}`;
    const reEmpty = /n[aã]o\s+foram\s+encontrados\s+boletos/i;
    const reEmptyEscaped = /n\\u00e3o\s+foram\s+encontrados\s+boletos/i;
    if (reEmpty.test(decoded) || reEmpty.test(txt) || reEmptyEscaped.test(txt)) {
      return { boletos: [], raw, request_payload: payload, http_status: 406 };
    }
  }
  if (!r.ok) {
    throwHttpError(r.status, txt, 'listarBoletosVeiculoJanela');
  }
  let boletos: any[] = [];
  if (Array.isArray(raw)) boletos = raw;
  else if (Array.isArray(raw?.boletos)) boletos = raw.boletos;
  else if (Array.isArray(raw?.dados)) boletos = raw.dados;
  return { boletos, raw, request_payload: payload, http_status: r.status };
}

/**
 * Lista boletos cobrindo um período arbitrário (default: 3 anos para trás)
 * iterando em janelas de até 90 dias (limite máximo da Hinova).
 * Deduplica por nosso_numero.
 */
export async function listarBoletosVeiculo(
  s: HinovaSession,
  codigoAssociado: number | string,
  codigoVeiculo: number | string,
  opts?: { anosTras?: number; diasJanela?: number; linkBoleto?: boolean; paralelismoJanelas?: number },
): Promise<any[]> {
  const anosTras = Math.max(0.1, opts?.anosTras ?? 3);
  const diasJanela = Math.min(90, Math.max(7, opts?.diasJanela ?? 90));
  const linkBoleto = opts?.linkBoleto ?? true;
  const paralelismo = Math.min(8, Math.max(1, opts?.paralelismoJanelas ?? 4));

  const hoje = new Date();
  const inicioGeral = new Date(hoje);
  inicioGeral.setDate(inicioGeral.getDate() - Math.floor(anosTras * 365));

  // Pré-calcula TODAS as janelas (sem await) para podermos paralelizar
  const janelas: Array<{ ini: Date; fim: Date }> = [];
  let cursorFim = new Date(hoje);
  while (cursorFim >= inicioGeral) {
    const cursorIni = new Date(cursorFim);
    cursorIni.setDate(cursorIni.getDate() - (diasJanela - 1));
    const ini = cursorIni < inicioGeral ? new Date(inicioGeral) : cursorIni;
    janelas.push({ ini, fim: new Date(cursorFim) });
    const proxFim = new Date(ini);
    proxFim.setDate(proxFim.getDate() - 1);
    cursorFim = proxFim;
  }

  const dedup = new Map<string, any>();
  let janelasComErro = 0;
  let ultimoErro: any = null;
  let abortarPorTransitorio: any = null;

  // Processa em chunks paralelos. Erros transitórios "duros" (auth/rate/janela)
  // marcam abortarPorTransitorio e impedem novos chunks — preserva o contrato anterior.
  for (let i = 0; i < janelas.length && !abortarPorTransitorio; i += paralelismo) {
    const chunk = janelas.slice(i, i + paralelismo);
    const results = await Promise.allSettled(
      chunk.map((j) =>
        listarBoletosVeiculoJanela(s, codigoAssociado, codigoVeiculo, {
          dataInicial: j.ini,
          dataFinal: j.fim,
          linkBoleto,
        })
      )
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const b of r.value.boletos) {
          const key = String(b?.nosso_numero ?? b?.nossoNumero ?? '').trim();
          if (key && !dedup.has(key)) dedup.set(key, b);
        }
      } else {
        janelasComErro++;
        ultimoErro = r.reason;
        const reason = (r.reason as any)?.reason;
        if (reason === 'auth' || reason === 'rate_limit' || reason === 'janela_horaria') {
          abortarPorTransitorio = r.reason;
        }
      }
    }
  }

  if (abortarPorTransitorio) throw abortarPorTransitorio;

  // Se TODAS as janelas falharam e nada foi coletado, propaga o último erro
  if (janelasComErro > 0 && dedup.size === 0 && ultimoErro) {
    throw ultimoErro;
  }

  return Array.from(dedup.values());
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
  // Limpa caracteres não numéricos (mantém dígitos, ponto, vírgula e sinal)
  let s = String(v).trim().replace(/[^\d.,\-]/g, '');
  if (!s) return 0;

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // Formato BR clássico: "1.234,56" — pontos são milhar, vírgula é decimal
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // Só vírgula: "561,40" → BR decimal
    s = s.replace(',', '.');
  } else if (hasDot) {
    // Só ponto(s): pode ser decimal estilo Hinova ("561.40") ou milhar ("1.234")
    const parts = s.split('.');
    const last = parts[parts.length - 1];
    if (parts.length === 2 && last.length <= 2) {
      // Único ponto com 1-2 dígitos depois → decimal ("561.40", "12.5")
      // mantém s como está
    } else {
      // Múltiplos pontos ou 3+ dígitos depois do ponto → milhar ("1.234", "1.234.567")
      s = s.replace(/\./g, '');
    }
  }
  // Sem ponto nem vírgula: parseFloat funciona direto

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
  sessionOrSupabase: HinovaSession | any,
  cpf: string,
): Promise<{ codigo_associado: number | null; veiculos: Array<{ placa: string; codigo_veiculo: number }> }> {
  const cpfDigitos = (cpf || '').replace(/\D/g, '');
  if (cpfDigitos.length !== 11) {
    throw new HinovaNotFoundError(`[buscarAssociadoPorCpf] CPF inválido: ${cpf}`);
  }
  const cpfFormatado = `${cpfDigitos.slice(0, 3)}.${cpfDigitos.slice(3, 6)}.${cpfDigitos.slice(6, 9)}-${cpfDigitos.slice(9, 11)}`;
  const tentativas = [cpfDigitos, cpfFormatado];

  const isSession = isHinovaSession(sessionOrSupabase);
  // Resolve apiUrl: para session, usa direto; para supabase, busca via getHinovaSession
  const apiUrl = isSession
    ? (sessionOrSupabase as HinovaSession).apiUrl
    : (await getHinovaSession(sessionOrSupabase)).apiUrl;

  let last404Body = '';
  for (let i = 0; i < tentativas.length; i++) {
    const cpfTentativa = tentativas[i];
    let r: Response;
    let txt: string;
    try {
      if (isSession) {
        const s = sessionOrSupabase as HinovaSession;
        r = await fetch(`${s.apiUrl}/associado/buscar/${encodeURIComponent(cpfTentativa)}/cpf`, {
          method: 'GET',
          headers: authHeaders(s),
        });
        txt = await r.text();
      } else {
        // Caminho novo — com retry/reauth automático em 401/403
        const fetched = await hinovaFetch(
          sessionOrSupabase,
          (token) => ({
            url: `${apiUrl}/associado/buscar/${encodeURIComponent(cpfTentativa)}/cpf`,
            init: {
              method: 'GET',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            },
          }),
          'buscarAssociadoPorCpf',
        );
        r = fetched.response;
        txt = fetched.bodyText;
      }
    } catch (e: any) {
      if (e instanceof HinovaTransientError || e instanceof HinovaNotFoundError) throw e;
      throw new HinovaTransientError(`[buscarAssociadoPorCpf] rede: ${String(e?.message || e)}`, {
        httpStatus: 0,
        reason: 'network',
      });
    }

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

/**
 * Executa `op(session)` reusando o cache de sessão. Em caso de
 * `HinovaTransientError reason='auth'`, invalida o cache, força nova
 * autenticação e tenta UMA vez mais. Outros erros propagam direto.
 *
 * Use isto como wrapper padrão em todas as chamadas a helpers
 * (buscarVeiculoPorPlaca, listarBoletosVeiculo, etc).
 */
export async function withHinovaAuthRetry<T>(
  supabase: any,
  op: (s: HinovaSession) => Promise<T>,
): Promise<T> {
  let session = await getHinovaSession(supabase);
  try {
    return await op(session);
  } catch (e: any) {
    if (e instanceof HinovaTransientError && e.reason === 'auth') {
      console.warn('[withHinovaAuthRetry] auth falhou — invalidando cache e tentando 1x mais');
      invalidateHinovaSession();
      session = await getHinovaSession(supabase, { force: true });
      return await op(session);
    }
    throw e;
  }
}

/**
 * Verifica se o backfill financeiro está ativo (pausa crons concorrentes).
 * Crons de SGA devem chamar isto e pular execução quando true.
 */
export async function isBackfillFinanceiroAtivo(supabase: any): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('sga_runtime_state')
      .select('backfill_financeiro_ativo, backfill_expira_em')
      .limit(1)
      .maybeSingle();
    if (error || !data) return false;
    if (!data.backfill_financeiro_ativo) return false;
    // TTL: se expirou, considera inativo (anti-deadlock)
    if (data.backfill_expira_em && new Date(data.backfill_expira_em).getTime() < Date.now()) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Marca backfill como ativo por `ttlMinutes` (default 60min) */
export async function marcarBackfillAtivo(supabase: any, ttlMinutes = 60): Promise<void> {
  const now = new Date();
  const expira = new Date(now.getTime() + ttlMinutes * 60 * 1000);
  await supabase
    .from('sga_runtime_state')
    .update({
      backfill_financeiro_ativo: true,
      backfill_iniciado_em: now.toISOString(),
      backfill_expira_em: expira.toISOString(),
    })
    .gte('id', '00000000-0000-0000-0000-000000000000'); // update-all (singleton)
}

/** Limpa flag de backfill ativo */
export async function marcarBackfillInativo(supabase: any): Promise<void> {
  await supabase
    .from('sga_runtime_state')
    .update({
      backfill_financeiro_ativo: false,
      backfill_expira_em: null,
    })
    .gte('id', '00000000-0000-0000-0000-000000000000');
}


// ===================================================================
// CADASTRO (orquestração SGA)
// Endpoints oficiais Hinova v2:
//   POST /associado/cadastrar     → { mensagem, codigo_associado }
//   POST /veiculo/cadastrar       → { mensagem, codigo_veiculo }
//   POST /veiculo/foto/cadastrar  → { mensagem }
//   GET  /veiculo/buscar/:chassi/chassi
// ===================================================================

export interface CadastroResultado {
  ok: boolean;
  codigo: number | null;
  status: number;
  raw: any;
  mensagem: string | null;
  errors: string[];
}

function parseJsonSafe(txt: string): any {
  try { return JSON.parse(txt); } catch { return null; }
}

function extractCodigo(payload: any, key: 'codigo_associado' | 'codigo_veiculo'): number | null {
  if (!payload) return null;
  const candidates = [
    payload[key],
    payload?.data?.[key],
    payload?.dados?.[key],
    payload?.resultado?.[key],
    payload?.codigo,
    payload?.data?.codigo,
    Array.isArray(payload) ? payload[0]?.[key] : null,
    Array.isArray(payload) ? payload[0]?.codigo : null,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function extractErrors(payload: any): string[] {
  if (!payload) return [];
  const e = payload.error ?? payload.errors ?? payload.erros;
  if (Array.isArray(e)) return e.map((x: any) => String(x));
  if (typeof e === 'string') return [e];
  return [];
}

/**
 * Distingue um HinovaSession de um SupabaseClient.
 * HinovaSession tem `tokenUsuario`; SupabaseClient não.
 */
function isHinovaSession(x: any): x is HinovaSession {
  return !!(x && typeof x === 'object' && typeof x.tokenUsuario === 'string' && typeof x.apiUrl === 'string');
}

/**
 * Helper para POST autenticados a um endpoint Hinova com retry/reauth automático.
 * Aceita tanto `supabase` (caminho recomendado, com retry via hinovaFetch) quanto
 * `session` legado (mantém comportamento antigo, sem retry). Centralizar este
 * helper evita repetir o boilerplate em cada função e garante que toda nova função
 * já nasça com retry quando chamada via supabase.
 */
async function hinovaPostAuth(
  supabaseOrSession: any,
  path: string,
  body: unknown,
  ctx: string,
): Promise<{ status: number; ok: boolean; txt: string; data: any }> {
  let status: number;
  let ok: boolean;
  let txt: string;

  if (isHinovaSession(supabaseOrSession)) {
    // Caminho legado — sem retry. Mantido para chamadores antigos.
    const s = supabaseOrSession;
    let r: Response;
    try {
      r = await fetch(`${s.apiUrl}${path}`, {
        method: 'POST',
        headers: authHeaders(s),
        body: JSON.stringify(body),
      });
    } catch (e: any) {
      throw new HinovaTransientError(`[${ctx}] rede: ${String(e?.message || e)}`, {
        httpStatus: 0, reason: 'network',
      });
    }
    status = r.status;
    ok = r.ok;
    txt = await r.text();
  } else {
    // Caminho novo — com retry/reauth via hinovaFetch.
    const supabase = supabaseOrSession;
    const session0 = await getHinovaSession(supabase);
    const { response, bodyText } = await hinovaFetch(
      supabase,
      (token) => ({
        url: `${session0.apiUrl}${path}`,
        init: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        },
      }),
      ctx,
    );
    status = response.status;
    ok = response.ok;
    txt = bodyText;
  }

  const data = parseJsonSafe(txt);
  if ((status === 401 || status === 403) && !isJanelaHorariaError(txt)) {
    throwHttpError(status, txt, ctx);
  }
  if (status >= 500 || isJanelaHorariaError(txt)) {
    throwHttpError(status, txt, ctx);
  }
  return { status, ok, txt, data };
}

/**
 * POST /associado/cadastrar
 *
 * Aceita tanto `supabase` (recomendado — habilita retry automático em 401/403)
 * quanto um `HinovaSession` legado (compat com chamadores antigos).
 */
export async function cadastrarAssociadoHinova(
  supabaseOrSession: any,
  payload: Record<string, unknown>,
): Promise<CadastroResultado> {
  const { ok, status, txt, data } = await hinovaPostAuth(
    supabaseOrSession, '/associado/cadastrar', payload, 'cadastrarAssociado',
  );
  return {
    ok,
    codigo: extractCodigo(data, 'codigo_associado'),
    status,
    raw: data ?? txt.slice(0, 500),
    mensagem: data?.mensagem ?? null,
    errors: extractErrors(data),
  };
}

/**
 * POST /veiculo/cadastrar
 * Aceita supabase (recomendado, com retry) ou HinovaSession (legado).
 */
export async function cadastrarVeiculoHinova(
  supabaseOrSession: any,
  payload: Record<string, unknown>,
): Promise<CadastroResultado> {
  const { ok, status, txt, data } = await hinovaPostAuth(
    supabaseOrSession, '/veiculo/cadastrar', payload, 'cadastrarVeiculo',
  );
  return {
    ok,
    codigo: extractCodigo(data, 'codigo_veiculo'),
    status,
    raw: data ?? txt.slice(0, 500),
    mensagem: data?.mensagem ?? null,
    errors: extractErrors(data),
  };
}

/**
 * POST /veiculo/alterar/situacao — promove/altera a situação de um veículo já cadastrado.
 * Aceita supabase (recomendado, com retry) ou HinovaSession (legado).
 */
export async function alterarSituacaoVeiculoHinova(
  supabaseOrSession: any,
  codigo_veiculo: number,
  codigo_situacao: number,
): Promise<{ ok: boolean; status: number; raw: any; mensagem: string | null; errors: string[] }> {
  const payload = { codigo_veiculo, codigo_situacao };
  // Hinova já variou o nome desse endpoint entre versões. Tentamos alternativas
  // até alguma responder com sucesso (ou com erro != "Página não encontrada").
  const candidates = [
    '/veiculo/alterar/situacao',
    '/alterar/situacao/veiculo',
    '/alterar/situacao-veiculo',
    '/veiculo/alterar-situacao',
    '/veiculo/alterar',
    '/alterar/veiculo/situacao',
  ];
  let last: any = null;
  for (const path of candidates) {
    const { ok, status, txt, data } = await hinovaPostAuth(
      supabaseOrSession, path, payload, 'alterarSituacaoVeiculo',
    );
    last = { ok, status, txt, data, path };
    const isPaginaNaoEncontrada = status === 404 || /página não encontrada|endpoint não encontrado/i.test(
      `${data?.mensagem || ''} ${JSON.stringify(data?.error || '')}`
    );
    if (ok || !isPaginaNaoEncontrada) break;
  }
  return {
    ok: last.ok,
    status: last.status,
    raw: last.data ?? last.txt.slice(0, 500),
    mensagem: (last.data?.mensagem ?? null) ? `${last.data.mensagem} (path tentado: ${last.path})` : null,
    errors: extractErrors(last.data),
  };
}

/** POST /veiculo/foto/cadastrar — máx 50 fotos por chamada */
export interface FotoHinovaPayload {
  nome_arquivo: string;
  codigo_tipo: number;
  link?: string;
  binario?: string;
  observacao?: string;
}

/**
 * POST /veiculo/foto/cadastrar
 * Aceita supabase (recomendado, com retry) ou HinovaSession (legado).
 */
export async function cadastrarFotosVeiculoHinova(
  supabaseOrSession: any,
  codigo_veiculo: number,
  fotos: FotoHinovaPayload[],
): Promise<CadastroResultado> {
  if (fotos.length === 0) {
    return { ok: true, codigo: null, status: 200, raw: { mensagem: 'sem fotos' }, mensagem: 'sem fotos', errors: [] };
  }
  if (fotos.length > 50) {
    throw new Error('cadastrarFotosVeiculoHinova: máx. 50 fotos por chamada');
  }
  const { ok, status, txt, data } = await hinovaPostAuth(
    supabaseOrSession, '/veiculo/foto/cadastrar', { codigo_veiculo, foto: fotos }, 'cadastrarFotosVeiculo',
  );
  return {
    ok,
    codigo: null,
    status,
    raw: data ?? txt.slice(0, 500),
    mensagem: data?.mensagem ?? null,
    errors: extractErrors(data),
  };
}

/**
 * GET /veiculo/buscar/:chassi/chassi — retorna { codigo_veiculo, codigo_associado } ou null.
 * Aceita supabase (recomendado, com retry) ou HinovaSession (legado).
 */
export async function buscarVeiculoPorChassi(
  supabaseOrSession: any,
  chassi: string,
): Promise<{ found: any | null; debug: { endpoint: string; status: number; bodySample: string } }> {
  const c = (chassi || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length !== 17) {
    return { found: null, debug: { endpoint: 'buscar/chassi', status: 0, bodySample: 'chassi inválido' } };
  }

  let status: number;
  let ok: boolean;
  let txt: string;

  if (isHinovaSession(supabaseOrSession)) {
    const s = supabaseOrSession;
    let r: Response;
    try {
      r = await fetch(`${s.apiUrl}/veiculo/buscar/${c}/chassi`, { method: 'GET', headers: authHeaders(s) });
    } catch (e: any) {
      throw new HinovaTransientError(`[buscarVeiculoPorChassi] rede: ${String(e?.message || e)}`, {
        httpStatus: 0, reason: 'network',
      });
    }
    status = r.status; ok = r.ok; txt = await r.text();
  } else {
    const supabase = supabaseOrSession;
    const session0 = await getHinovaSession(supabase);
    const { response, bodyText } = await hinovaFetch(
      supabase,
      (token) => ({
        url: `${session0.apiUrl}/veiculo/buscar/${c}/chassi`,
        init: { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      }),
      'buscarVeiculoPorChassi',
    );
    status = response.status; ok = response.ok; txt = bodyText;
  }

  const debug = { endpoint: 'buscar/chassi', status, bodySample: txt.slice(0, 200) };
  if (status === 404) return { found: null, debug };
  if (!ok) throwHttpError(status, txt, 'buscarVeiculoPorChassi');
  const j = parseJsonSafe(txt);
  const root = Array.isArray(j) ? j[0] : (j?.data ?? j?.dados ?? j);
  if (root?.codigo_veiculo) return { found: root, debug };
  return { found: null, debug };
}

/**
 * POST /alterar/associado — atualiza dados cadastrais de um associado existente no SGA.
 * Aceita supabase (recomendado, com retry) ou HinovaSession (legado).
 */
export async function alterarAssociadoHinova(
  supabaseOrSession: any,
  payload: Record<string, unknown>,
): Promise<CadastroResultado> {
  const { ok, status, txt, data } = await hinovaPostAuth(
    supabaseOrSession, '/alterar/associado', payload, 'alterarAssociado',
  );
  return {
    ok,
    codigo: extractCodigo(data, 'codigo_associado'),
    status,
    raw: data ?? txt.slice(0, 500),
    mensagem: data?.mensagem ?? null,
    errors: extractErrors(data),
  };
}

/**
 * POST /cadastrar/historico-atendimento-associado
 * Registra uma anotação no histórico de atendimento do associado no SGA.
 *
 * Doc oficial: campos esperados podem variar por instalação; enviamos os mais comuns
 * (`codigo_associado`, `descricao`, `codigo_tipo_atendimento`, `codigo_status_atendimento`,
 * `codigo_departamento`). Campos faltantes são ignorados pelo SGA.
 */
export async function cadastrarHistoricoAtendimentoHinova(
  supabaseOrSession: any,
  payload: {
    codigo_associado: number;
    descricao: string;
    codigo_tipo_atendimento?: number;
    codigo_status_atendimento?: number;
    codigo_departamento?: number;
  },
): Promise<{ ok: boolean; status: number; raw: any; mensagem: string | null; errors: string[] }> {
  const { ok, status, txt, data } = await hinovaPostAuth(
    supabaseOrSession, '/cadastrar/historico-atendimento-associado', payload, 'cadastrarHistoricoAtendimento',
  );
  return {
    ok,
    status,
    raw: data ?? txt.slice(0, 500),
    mensagem: data?.mensagem ?? null,
    errors: extractErrors(data),
  };
}

