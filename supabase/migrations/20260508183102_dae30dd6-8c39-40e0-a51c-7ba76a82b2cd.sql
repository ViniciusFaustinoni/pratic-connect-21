
CREATE TABLE IF NOT EXISTS public.rastreadores_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rastreador_id UUID REFERENCES public.rastreadores(id) ON DELETE CASCADE,
  veiculo_id UUID,
  associado_id UUID,
  plataforma TEXT NOT NULL CHECK (plataforma IN ('softruck','rede')),
  operacao TEXT NOT NULL DEFAULT 'ativar_completo',
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','processando','falha','falha_permanente','concluido')),
  tentativas INT NOT NULL DEFAULT 0,
  max_tentativas INT NOT NULL DEFAULT 5,
  etapa_parou TEXT,
  erro_ultimo TEXT,
  payload JSONB,
  response_ultimo JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_tentativa_em TIMESTAMPTZ,
  proximo_reenvio_em TIMESTAMPTZ DEFAULT now(),
  concluido_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rast_sync_queue_status ON public.rastreadores_sync_queue (plataforma, status, proximo_reenvio_em);
CREATE INDEX IF NOT EXISTS idx_rast_sync_queue_rastreador ON public.rastreadores_sync_queue (rastreador_id);

ALTER TABLE public.rastreadores_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos gerenciam fila rastreadores"
ON public.rastreadores_sync_queue
FOR ALL
USING (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'admin_master'::app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'admin_master'::app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
);

CREATE TABLE IF NOT EXISTS public.rastreadores_sync_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma TEXT NOT NULL CHECK (plataforma IN ('softruck','rede')),
  conexao_ok BOOLEAN NOT NULL DEFAULT false,
  tempo_resposta_ms INT,
  fila_pendentes INT DEFAULT 0,
  fila_falhas INT DEFAULT 0,
  rastreadores_nao_vinculados INT DEFAULT 0,
  erro_mensagem TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rast_sync_health_plat ON public.rastreadores_sync_health_checks (plataforma, created_at DESC);

ALTER TABLE public.rastreadores_sync_health_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internos leem health rastreadores"
ON public.rastreadores_sync_health_checks
FOR SELECT
USING (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'admin_master'::app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
);

CREATE POLICY "Internos inserem health rastreadores"
ON public.rastreadores_sync_health_checks
FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'admin_master'::app_role)
  OR public.has_role(auth.uid(), 'desenvolvedor'::app_role)
  OR public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
);

CREATE OR REPLACE VIEW public.rastreadores_pendentes_vinculo
WITH (security_invoker=on) AS
SELECT
  r.id AS rastreador_id,
  r.imei,
  r.plataforma,
  r.status,
  r.veiculo_id,
  r.associado_id,
  r.plataforma_device_id,
  r.plataforma_user_id,
  r.plataforma_veiculo_id,
  v.placa AS veiculo_placa,
  a.nome AS associado_nome,
  CASE
    WHEN r.plataforma_device_id IS NULL THEN 'sem_device'
    WHEN r.plataforma_veiculo_id IS NULL THEN 'sem_veiculo'
    WHEN r.plataforma_user_id IS NULL THEN 'sem_usuario'
    ELSE 'ok'
  END AS motivo
FROM public.rastreadores r
LEFT JOIN public.veiculos v ON v.id = r.veiculo_id
LEFT JOIN public.associados a ON a.id = r.associado_id
WHERE r.plataforma IN ('softruck','rede')
  AND r.status = 'instalado'
  AND r.veiculo_id IS NOT NULL
  AND (
    r.plataforma_device_id IS NULL
    OR r.plataforma_veiculo_id IS NULL
    OR r.plataforma_user_id IS NULL
  );
