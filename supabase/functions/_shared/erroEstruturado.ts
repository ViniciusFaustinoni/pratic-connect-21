// ============================================================================
// SHARED: erroEstruturado
// ----------------------------------------------------------------------------
// Helpers canônicos para edges devolverem erros 4xx ACIONÁVEIS para a UI:
//   { code, mensagem, hint, campo, valor_atual, ...extras }
//
// O front (src/lib/ui/toastErroEdge.ts) já sabe parsear esse formato e abre
// modais de correção quando reconhece o `code` (ex.: EMAIL_INVALIDO →
// CorrigirEmailDialog).
//
// Uso típico:
//   throw new ConsultorActionableError({
//     code: 'EMAIL_INVALIDO',
//     mensagem: `O e-mail (${valor}) é inválido.`,
//     campo: 'email_solicitante',
//     valorAtual: valor,
//     hint: 'Formato esperado: nome@dominio.com',
//   });
//
// E no catch principal da edge:
//   if (error instanceof ConsultorActionableError) {
//     return respostaErroEstruturado(error, corsHeaders);
//   }
// ============================================================================

export interface ConsultorActionableErrorInit {
  code: string;
  mensagem: string;
  status?: number;
  hint?: string | null;
  campo?: string | null;
  valorAtual?: unknown;
  extras?: Record<string, unknown>;
}

export class ConsultorActionableError extends Error {
  code: string;
  status: number;
  hint: string | null;
  campo: string | null;
  valorAtual: unknown;
  extras: Record<string, unknown>;

  constructor(init: ConsultorActionableErrorInit) {
    super(init.mensagem);
    this.name = 'ConsultorActionableError';
    this.code = init.code;
    this.status = init.status ?? 400;
    this.hint = init.hint ?? null;
    this.campo = init.campo ?? null;
    this.valorAtual = init.valorAtual;
    this.extras = init.extras ?? {};
  }

  toPayload() {
    return {
      success: false,
      code: this.code,
      mensagem: this.message,
      error: this.message, // back-compat
      hint: this.hint,
      campo: this.campo,
      valor_atual: this.valorAtual ?? null,
      ...this.extras,
    };
  }
}

export function respostaErroEstruturado(
  err: ConsultorActionableError,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(err.toPayload()), {
    status: err.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// E-mail regex compartilhado para validação consistente em todas as edges.
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validarEmailOuLancar(
  email: string | null | undefined,
  opts: { campo?: string; contexto?: string } = {},
): string {
  const limpo = (email || '').trim();
  if (!limpo || !EMAIL_REGEX.test(limpo)) {
    throw new ConsultorActionableError({
      code: 'EMAIL_INVALIDO',
      mensagem: `O e-mail ${opts.contexto ? `(${opts.contexto}) ` : ''}"${limpo || 'vazio'}" é inválido. Corrija e reprocese — o Autentique exige formato nome@dominio.com.`,
      campo: opts.campo ?? 'email',
      valorAtual: limpo,
      hint: 'Formato esperado: nome@dominio.com',
    });
  }
  return limpo;
}
