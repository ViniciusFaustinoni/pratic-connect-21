-- Expand CHECK constraint on email_suspensao_envios.status to include observability statuses
-- for early-return states (desativado, template_ausente, template_inativo)
ALTER TABLE public.email_suspensao_envios
  DROP CONSTRAINT IF EXISTS email_suspensao_envios_status_check;

ALTER TABLE public.email_suspensao_envios
  ADD CONSTRAINT email_suspensao_envios_status_check
  CHECK (status IN (
    'pendente',
    'entregue',
    'falhou',
    'sem_email',
    'sem_template',
    'template_inativo',
    'desativado'
  ));