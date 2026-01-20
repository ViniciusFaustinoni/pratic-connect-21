-- Tabela para armazenar histórico de eventos das cotações
CREATE TABLE IF NOT EXISTS public.cotacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id UUID NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
  acao VARCHAR(100) NOT NULL,
  detalhes JSONB,
  autor_id UUID,
  autor_nome VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para busca rápida por cotação
CREATE INDEX idx_cotacoes_historico_cotacao_id ON public.cotacoes_historico(cotacao_id);
CREATE INDEX idx_cotacoes_historico_created_at ON public.cotacoes_historico(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.cotacoes_historico ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ver histórico
CREATE POLICY "cotacoes_historico_select" ON public.cotacoes_historico
  FOR SELECT TO authenticated
  USING (true);

-- Política: usuários autenticados podem inserir
CREATE POLICY "cotacoes_historico_insert" ON public.cotacoes_historico
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Adicionar à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.cotacoes_historico;