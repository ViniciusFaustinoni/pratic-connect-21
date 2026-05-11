-- Fix: trigger sync_vistoria_update_to_servicos was overwriting servicos.status
-- on every vistoria UPDATE (including innocuous saves like uploading the 360
-- video), pushing 'em_analise' into servicos and making the technician's
-- current task disappear. Status-terminal sync is already handled by
-- sync_servico_on_vistoria_decisao — so we drop the status field here.

CREATE OR REPLACE FUNCTION public.sync_vistoria_update_to_servicos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Sync only logistical fields. NEVER touch status here — that's the job
  -- of sync_servico_on_vistoria_decisao (which fires only on decision states).
  UPDATE public.servicos SET
    profissional_id = COALESCE(NEW.vistoriador_id, servicos.profissional_id),
    data_agendada   = COALESCE(NEW.data_agendada, servicos.data_agendada),
    hora_agendada   = COALESCE(NEW.horario_agendado, servicos.hora_agendada),
    logradouro      = COALESCE(NEW.endereco_logradouro, servicos.logradouro),
    numero          = COALESCE(NEW.endereco_numero, servicos.numero),
    bairro          = COALESCE(NEW.endereco_bairro, servicos.bairro),
    cidade          = COALESCE(NEW.endereco_cidade, servicos.cidade),
    uf              = COALESCE(NEW.endereco_estado, servicos.uf),
    latitude        = COALESCE(NEW.endereco_latitude, servicos.latitude),
    longitude       = COALESCE(NEW.endereco_longitude, servicos.longitude),
    updated_at      = now()
  WHERE vistoria_origem_id = NEW.id;
  RETURN NEW;
END;
$function$;

-- One-shot recovery: services stuck in 'em_analise' purely due to the bug.
-- Conditions:
--  * vistoria still in non-terminal status (em_analise) and NOT decided
--  * service has no decision/imprevisto from technician
--  * instalacao (if any) is not concluded/cancelled
-- Restore status from the latest known real state.
WITH candidatos AS (
  SELECT s.id,
         CASE
           WHEN s.iniciada_em IS NOT NULL THEN 'em_andamento'::status_servico
           WHEN s.em_rota_em  IS NOT NULL THEN 'em_rota'::status_servico
           ELSE 'agendada'::status_servico
         END AS novo_status
    FROM public.servicos s
    JOIN public.vistorias v ON v.id = s.vistoria_origem_id
    LEFT JOIN public.instalacoes i ON i.id = s.instalacao_origem_id
   WHERE s.status::text = 'em_analise'
     AND s.decisao_instalador IS NULL
     AND s.imprevisto_registrado_em IS NULL
     AND s.concluida_em IS NULL
     AND v.status::text NOT IN ('aprovada','aprovada_ressalvas','reprovada','cancelada')
     AND v.concluida_em IS NULL
     AND (i.id IS NULL OR (i.status::text NOT IN ('concluida','cancelada')))
)
UPDATE public.servicos s
   SET status = c.novo_status,
       updated_at = now()
  FROM candidatos c
 WHERE s.id = c.id;