-- =============================================
-- SOLICITAÇÕES FINANCEIRAS — Notificações WhatsApp (Evolution API)
-- Colunas de controle, RPC de sócios e agendamento de crons
-- =============================================

-- ---------------------------------------------
-- Colunas: telefone do solicitante + flags anti-duplicidade
-- ---------------------------------------------
ALTER TABLE public.solicitacoes_financeiras
  ADD COLUMN IF NOT EXISTS solicitante_telefone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS notificado_criada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notificado_decisao BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notificado_pago BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lembrete_vespera_enviado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lembrete_dia_enviado BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------
-- RPC: lista os sócios ativos (id + nome) de forma segura.
-- Permite ao solicitante ver quem liberou / ainda não liberou
-- sem expor a tabela profiles inteira.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.listar_socios()
RETURNS TABLE (id uuid, nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome::text
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role = 'socio'
    AND p.ativo = true
    AND (p.bloqueado IS NULL OR p.bloqueado = false)
  ORDER BY p.nome
$$;

GRANT EXECUTE ON FUNCTION public.listar_socios() TO authenticated;

-- ---------------------------------------------
-- CRON: lembrete de vencimento (véspera + dia) — 11:00 UTC ≈ 08:00 BRT
-- ---------------------------------------------
DO $$ BEGIN
  PERFORM cron.unschedule('solicitacoes-lembrete-vencimento');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'solicitacoes-lembrete-vencimento',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-solicitacoes-lembrete-vencimento',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- ---------------------------------------------
-- CRON: resumo financeiro do dia — 22:00 UTC ≈ 19:00 BRT
-- ---------------------------------------------
DO $$ BEGIN
  PERFORM cron.unschedule('solicitacoes-resumo-diario');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'solicitacoes-resumo-diario',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url:='https://iyxdgmukrrdkffraptsx.supabase.co/functions/v1/cron-solicitacoes-resumo-diario',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5eGRnbXVrcnJka2ZmcmFwdHN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczODA2MDIsImV4cCI6MjA4Mjk1NjYwMn0.ky2mnyV-zad5peCNb8Ss16LaVlCQ8hWk6kwaQHStDnI"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
