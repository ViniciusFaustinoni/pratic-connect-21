
-- Tornar justificativa opcional (Regra do 1% agora aplica automático, sem justificativa)
ALTER TABLE public.aprovacoes_fipe_menor
  ALTER COLUMN justificativa DROP NOT NULL;

-- Mudar default do status para o novo fluxo de "ciência"
ALTER TABLE public.aprovacoes_fipe_menor
  ALTER COLUMN status SET DEFAULT 'ciente_pendente';

-- Backfill: tudo que estava em pendente/aprovado/recusado vira 'ciente'
UPDATE public.aprovacoes_fipe_menor
   SET status = 'ciente',
       respondido_em = COALESCE(respondido_em, updated_at)
 WHERE status IN ('pendente','aprovado','recusado');
