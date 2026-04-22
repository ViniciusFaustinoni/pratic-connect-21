// deno-lint-ignore-file no-explicit-any
/**
 * Cliente Hinova SGA compartilhado
 * - Resolve credenciais (ENV → integracoes_credenciais)
 * - Autentica e cacheia token_usuario por execução
 * - Helpers para os endpoints usados no backfill financeiro
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
      // IMPORTANTE: a função `integracoes-credenciais` SEMPRE encripta com SUPABASE_SERVICE_ROLE_KEY.
      // Manter alinhado para evitar 401 enganoso na Hinova por decriptação com chave divergente.
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
  const r = await fetch(`${creds.apiUrl}/usuario/autenticar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.token}` },
    body: JSON.stringify({ usuario: creds.usuario, senha: creds.senha }),
  });
  const txt = await r.text();
  let data: any;
  try { data = JSON.parse(txt); } catch { data = null; }

  if (r.status === 401) {
    const msg = data?.mensagem || data?.message || 'Login ou senha inválido';
    console.error('[Hinova] auth 401:', msg);
    throw new Error(`Hinova autenticação 401: ${msg}`);
  }

  if (!r.ok || !data?.token_usuario) {
    const msg = data?.mensagem || data?.message || txt.slice(0, 200);
    console.error('[Hinova] auth falhou:', msg);
    throw new Error(`Hinova autenticação falhou (${r.status}): ${msg}`);
  }
  return { ...creds, tokenUsuario: data.token_usuario };
}

function authHeaders(s: HinovaSession): HeadersInit {
  // IMPORTANTE: Hinova SGA v2 espera o token de SESSÃO (token_usuario retornado por /usuario/autenticar)
  // no header Authorization. Usar o token de aplicação aqui causa respostas vazias/200 silenciosas
  // em rotas GET de consulta (sem 401), mascarando o erro como "não encontrado".
  // Alinhado com sga-hinova-sync (caminho comprovadamente funcional).
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${s.tokenUsuario}`,
  };
}

/**
 * Busca veículo por placa na Hinova.
 * Endpoint primário: GET /veiculo/consultar/placa/{placa} (mesmo usado em sga-hinova-sync, comprovadamente funcional).
 * Fallback: GET /veiculo/buscar/{placa}/placa (endpoint legado, mantido por segurança).
 */
export async function buscarVeiculoPorPlaca(s: HinovaSession, placa: string): Promise<any | null> {
  const placaLimpa = placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

  const tryParse = (txt: string): any | null => {
    try {
      const j = JSON.parse(txt);
      if (Array.isArray(j)) return j[0] ?? null;
      if (j && typeof j === 'object') {
        if (j.codigo_veiculo) return j;
        // Algumas variantes envelopam em data/dados
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
  try {
    const r1 = await fetch(`${s.apiUrl}/veiculo/consultar/placa/${placaLimpa}`, { method: 'GET', headers: authHeaders(s) });
    if (r1.ok) {
      const txt = await r1.text();
      const found = tryParse(txt);
      if (found?.codigo_veiculo) return found;
    } else if (r1.status !== 404) {
      console.warn('[Hinova] consultar/placa status', r1.status);
    }
  } catch (e) {
    console.warn('[Hinova] consultar/placa erro', e);
  }

  // Fallback endpoint legado (buscar/{placa}/placa)
  try {
    const r2 = await fetch(`${s.apiUrl}/veiculo/buscar/${placaLimpa}/placa`, { method: 'GET', headers: authHeaders(s) });
    if (r2.status === 404) return null;
    if (r2.ok) {
      const txt = await r2.text();
      return tryParse(txt);
    }
  } catch (e) {
    console.warn('[Hinova] buscar/placa erro', e);
  }

  return null;
}

/** GET /buscar/situacao-financeira-veiculo/{codigo} */
export async function buscarSituacaoFinanceiraVeiculo(s: HinovaSession, codigoVeiculo: number | string): Promise<string | null> {
  const r = await fetch(`${s.apiUrl}/buscar/situacao-financeira-veiculo/${codigoVeiculo}`, {
    method: 'GET',
    headers: authHeaders(s),
  });
  const txt = await r.text();
  if (!r.ok) {
    console.warn('[Hinova] situacao-financeira-veiculo status', r.status, txt.slice(0, 200));
    return null;
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

/** POST /listar/boleto-associado-veiculo */
export async function listarBoletosVeiculo(
  s: HinovaSession,
  codigoAssociado: number | string,
  codigoVeiculo: number | string,
): Promise<any[]> {
  const r = await fetch(`${s.apiUrl}/listar/boleto-associado-veiculo`, {
    method: 'POST',
    headers: authHeaders(s),
    body: JSON.stringify({
      codigo_associado: Number(codigoAssociado),
      codigo_veiculo: Number(codigoVeiculo),
    }),
  });
  const txt = await r.text();
  if (!r.ok) {
    console.warn('[Hinova] listar boletos status', r.status, txt.slice(0, 200));
    return [];
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
