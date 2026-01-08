-- Tabela para tokens de primeiro acesso
CREATE TABLE auth_tokens_primeiro_acesso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expira_em TIMESTAMPTZ NOT NULL,
    usado BOOLEAN DEFAULT false,
    usado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_auth_tokens_token ON auth_tokens_primeiro_acesso(token);
CREATE INDEX idx_auth_tokens_associado ON auth_tokens_primeiro_acesso(associado_id);
CREATE INDEX idx_auth_tokens_expira ON auth_tokens_primeiro_acesso(expira_em) WHERE usado = false;

-- RLS - Apenas service_role pode acessar
ALTER TABLE auth_tokens_primeiro_acesso ENABLE ROW LEVEL SECURITY;

-- Comentário explicativo
COMMENT ON TABLE auth_tokens_primeiro_acesso IS 'Tokens temporários para criação de senha no primeiro acesso do associado ao app';