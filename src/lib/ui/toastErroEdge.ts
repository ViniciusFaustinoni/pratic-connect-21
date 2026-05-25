/**
 * Helper canônico para tratar erros 4xx/5xx de Edge Functions na UI.
 *
 * Motivação: hoje muitas chamadas a `supabase.functions.invoke()` engolem o body
 * em status >= 400 (o erro só traz `error.message` genérico tipo
 * "Edge Function returned a non-2xx status code"). O body útil — com `code`,
 * `hint`, `mensagem` — está em `error.context` (uma Response). Outras chamadas
 * usam `fetch` direto e já têm o JSON parseado em `e.payload`.
 *
 * Este helper unifica as duas formas, expõe sempre `{ code, message, hint }`,
 * e exibe um toast PERSISTENTE com o `code` visível para os 409s conhecidos
 * (`link_publico_incompleto`, `cotacao_ja_vinculada`, `cotacao_duplicada`,
 * `sem_agendamento`, `requer_rastreador_fisico`, `JA_VINCULADA`,
 * `COTACAO_NAO_PERTENCE`).
 *
 * Ver memória: prevenção de cotação duplicada em Troca de Titularidade.
 */
import { toast } from 'sonner';

export interface EdgeErrorParsed {
  code: string | null;
  message: string;
  hint: string | null;
  raw: any;
}

/**
 * Extrai `{ code, message, hint }` de um erro lançado por:
 * - `supabase.functions.invoke()` (FunctionsHttpError com `.context: Response`)
 * - `fetch` direto com `e.payload` já parseado (helper `chamarEdge` interno)
 * - Erro de Postgres direto (`code` SQLSTATE em `error.code`)
 * - `Error` genérico.
 */
export async function parseEdgeError(err: any): Promise<EdgeErrorParsed> {
  if (!err) {
    return { code: null, message: 'Erro desconhecido', hint: null, raw: err };
  }

  // Caso 1: erro do helper interno (chamarEdge no CotacaoFormDialog)
  if (err.payload && typeof err.payload === 'object') {
    const p = err.payload;
    return {
      code: p.code ?? p.codigo ?? err.code ?? null,
      message: p.mensagem || p.error || p.message || err.message || 'Erro',
      hint: p.hint ?? p.dica ?? null,
      raw: p,
    };
  }

  // Caso 2: FunctionsHttpError do supabase-js — body em error.context (Response)
  const ctx: any = err.context;
  if (ctx && (typeof ctx.json === 'function' || typeof ctx.text === 'function')) {
    let parsed: any = null;
    try {
      if (typeof ctx.json === 'function') {
        parsed = await ctx.json();
      } else {
        const txt = await ctx.text();
        try {
          parsed = JSON.parse(txt);
        } catch {
          parsed = { error: txt };
        }
      }
    } catch {
      /* noop */
    }
    if (parsed) {
      return {
        code: parsed.code ?? parsed.codigo ?? null,
        message: parsed.mensagem || parsed.error || parsed.message || err.message || 'Erro',
        hint: parsed.hint ?? parsed.dica ?? null,
        raw: parsed,
      };
    }
  }

  // Caso 3: erro de Postgres (SQLSTATE)
  if (err.code && /^[0-9A-Z]{5}$/.test(String(err.code))) {
    return {
      code: err.code,
      message: err.message || err.details || 'Erro de banco de dados',
      hint: err.hint ?? null,
      raw: err,
    };
  }

  // Caso 4: Error genérico
  return {
    code: err.code ?? err.codigo ?? null,
    message: err.message || String(err) || 'Erro',
    hint: err.hint ?? null,
    raw: err,
  };
}

/** Códigos 409 "informativos" que devem aparecer com toast persistente + code visível. */
const CODIGOS_409_CONHECIDOS = new Set([
  'link_publico_incompleto',
  'cotacao_ja_vinculada',
  'cotacao_duplicada',
  'sem_agendamento',
  'requer_rastreador_fisico',
  'JA_VINCULADA',
  'COTACAO_NAO_PERTENCE',
  'TERMO_NAO_ASSINADO',
]);

/**
 * Exibe toast de erro padronizado para erros vindos de Edge Functions.
 * 409 conhecidos ficam visíveis até o usuário fechar (duration: Infinity).
 * Demais erros usam duration de 8s.
 *
 * @param contextoLegivel  Frase curta para abrir a mensagem ("Aprovar proposta", "Criar cotação", etc.)
 */
export async function toastErroEdge(err: any, contextoLegivel?: string): Promise<EdgeErrorParsed> {
  const parsed = await parseEdgeError(err);
  const prefixo = contextoLegivel ? `${contextoLegivel}: ` : '';
  const codeTag = parsed.code ? ` [${parsed.code}]` : '';
  const hintLine = parsed.hint ? `\n${parsed.hint}` : '';
  const persistente = parsed.code ? CODIGOS_409_CONHECIDOS.has(parsed.code) : false;

  toast.error(`${prefixo}${parsed.message}${codeTag}${hintLine}`, {
    duration: persistente ? Infinity : 10000,
    closeButton: true,
  });

  return parsed;
}
