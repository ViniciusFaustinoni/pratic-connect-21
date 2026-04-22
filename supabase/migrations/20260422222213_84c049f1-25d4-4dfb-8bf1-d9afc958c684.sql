-- Tabela de logs para chamadas a APIs externas de rastreadores (Softruck, Rede Veículos, etc.)
CREATE TABLE IF NOT EXISTS public.rastreadores_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rastreador_id UUID NULL,
  veiculo_id UUID NULL,
  plataforma TEXT NOT NULL,
  operacao TEXT NOT NULL,
  request JSONB NULL,
  response JSONB NULL,
  status TEXT NULL,
  erro_mensagem TEXT NULL,
  duracao_ms INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rastreadores_api_logs_rastreador
  ON public.rastreadores_api_logs(rastreador_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rastreadores_api_logs_veiculo
  ON public.rastreadores_api_logs(veiculo_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rastreadores_api_logs_plataforma_status
  ON public.rastreadores_api_logs(plataforma, status, created_at DESC);

ALTER TABLE public.rastreadores_api_logs ENABLE ROW LEVEL SECURITY;

-- Apenas admin/diretor podem visualizar logs
CREATE POLICY "Admin/diretor podem ver logs de API rastreadores"
  ON public.rastreadores_api_logs
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'diretor'::public.app_role)
  );

-- Service role (edge functions) escreve livremente — não precisa de policy explícita,
-- mas adicionamos uma para clareza sem permitir escrita por usuários comuns.
CREATE POLICY "Service role pode inserir logs"
  ON public.rastreadores_api_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);