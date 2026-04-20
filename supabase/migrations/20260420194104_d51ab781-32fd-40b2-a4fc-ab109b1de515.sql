-- 1) Atualiza CHECK constraint para aceitar 'cancelado'
ALTER TABLE public.documentos_solicitados
  DROP CONSTRAINT IF EXISTS documentos_solicitados_status_check;

ALTER TABLE public.documentos_solicitados
  ADD CONSTRAINT documentos_solicitados_status_check
  CHECK (status::text = ANY (ARRAY['pendente'::varchar, 'enviado'::varchar, 'aprovado'::varchar, 'reprovado'::varchar, 'cancelado'::varchar]::text[]));

-- 2) Cancela os 5 documentos pendentes do ALEX que nunca foram enviados
UPDATE public.documentos_solicitados
SET status = 'cancelado', updated_at = now()
WHERE associado_id = '28a82785-ee88-4df5-a051-4874e8c1eb71'
  AND status = 'pendente';