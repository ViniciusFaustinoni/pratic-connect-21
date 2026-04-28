// Tradução de erros Postgres/PostgREST em mensagens humanas
// Usado pelas edge functions de ativação para evitar mensagens crípticas (42501, 23514, etc.)

export interface PgLikeError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

export interface TranslatedError {
  code: string;
  status: number;
  message: string;
  raw?: string;
}

const MAP: Record<string, { status: number; message: (e: PgLikeError) => string }> = {
  // Permissão insuficiente
  "42501": {
    status: 403,
    message: (e) =>
      "Permissão insuficiente para concluir a operação. Verifique se você possui o papel necessário (ex.: Coordenador de Monitoramento, Diretor) ou se a regra de acesso (RLS) permite esta ação para o registro indicado.",
  },
  // Violação de check constraint (inclui nossos triggers de bloqueio)
  "23514": {
    status: 409,
    message: (e) =>
      e.message?.includes("associado está em status")
        ? `Operação bloqueada: ${e.message.replace(/^.*?:\s*/, "")}`
        : "A operação viola uma regra de validação do banco de dados.",
  },
  // FK / not null / unique
  "23503": {
    status: 409,
    message: () => "Registro relacionado não encontrado ou já removido.",
  },
  "23502": {
    status: 400,
    message: (e) => `Campo obrigatório ausente: ${e.message ?? ""}`.trim(),
  },
  "23505": {
    status: 409,
    message: () => "Já existe um registro com estes dados (duplicação).",
  },
  // Lock / concorrência
  "55P03": {
    status: 423,
    message: () => "Recurso em uso por outra operação. Tente novamente em alguns segundos.",
  },
  "40001": {
    status: 409,
    message: () => "Conflito de concorrência detectado. Tente novamente.",
  },
  // Timeout
  "57014": {
    status: 504,
    message: () => "A operação demorou demais e foi cancelada. Tente novamente.",
  },
};

export function translateDbError(err: unknown): TranslatedError {
  const e = (err ?? {}) as PgLikeError;
  const code = e.code ?? "";
  const entry = MAP[code];

  if (entry) {
    return {
      code,
      status: entry.status,
      message: entry.message(e),
      raw: e.message,
    };
  }

  // PostgREST devolve mensagens com 'permission denied' sem code numérico
  if (typeof e.message === "string" && /permission denied|insufficient_privilege/i.test(e.message)) {
    return {
      code: "42501",
      status: 403,
      message: MAP["42501"].message(e),
      raw: e.message,
    };
  }

  return {
    code: code || "UNKNOWN",
    status: 500,
    message: e.message ?? "Erro inesperado ao acessar o banco de dados.",
    raw: e.message,
  };
}
