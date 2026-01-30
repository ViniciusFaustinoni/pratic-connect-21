-- Tabela para rastrear instalações que falharam ao serem criadas
CREATE TABLE IF NOT EXISTS instalacoes_pendentes_criacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID REFERENCES cotacoes(id),
  contrato_id UUID REFERENCES contratos(id),
  motivo TEXT,
  tentativas INTEGER DEFAULT 0,
  ultima_tentativa TIMESTAMPTZ,
  erro_detalhes TEXT,
  resolvido BOOLEAN DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  resolvido_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida de pendentes
CREATE INDEX idx_instalacoes_pendentes_nao_resolvidas 
ON instalacoes_pendentes_criacao(resolvido) 
WHERE resolvido = false;

-- RLS
ALTER TABLE instalacoes_pendentes_criacao ENABLE ROW LEVEL SECURITY;

-- Política para funcionários visualizarem
CREATE POLICY "Funcionários podem visualizar pendentes"
ON instalacoes_pendentes_criacao FOR SELECT
USING (public.is_funcionario(auth.uid()));

-- Política para funcionários atualizarem (resolver)
CREATE POLICY "Funcionários podem atualizar pendentes"
ON instalacoes_pendentes_criacao FOR UPDATE
USING (public.is_funcionario(auth.uid()));

-- Política para service role inserir
CREATE POLICY "Service role pode inserir pendentes"
ON instalacoes_pendentes_criacao FOR INSERT
WITH CHECK (true);