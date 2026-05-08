
-- Corrigir CHECK constraints e view para usar 'rede_veiculos' (valor canônico)
ALTER TABLE public.rastreadores_sync_queue DROP CONSTRAINT rastreadores_sync_queue_plataforma_check;
ALTER TABLE public.rastreadores_sync_queue ADD CONSTRAINT rastreadores_sync_queue_plataforma_check
  CHECK (plataforma = ANY (ARRAY['softruck'::text, 'rede_veiculos'::text]));

ALTER TABLE public.rastreadores_sync_health_checks DROP CONSTRAINT rastreadores_sync_health_checks_plataforma_check;
ALTER TABLE public.rastreadores_sync_health_checks ADD CONSTRAINT rastreadores_sync_health_checks_plataforma_check
  CHECK (plataforma = ANY (ARRAY['softruck'::text, 'rede_veiculos'::text]));

-- Adicionar operação 'desvincular' ao default
ALTER TABLE public.rastreadores_sync_queue
  ADD COLUMN IF NOT EXISTS x_dummy_noop boolean DEFAULT false;
ALTER TABLE public.rastreadores_sync_queue DROP COLUMN x_dummy_noop;

-- Recriar view com plataforma canônica
DROP VIEW IF EXISTS public.rastreadores_pendentes_vinculo;
CREATE VIEW public.rastreadores_pendentes_vinculo AS
SELECT
  r.id AS rastreador_id,
  r.imei,
  r.codigo,
  r.plataforma,
  r.status,
  r.veiculo_id,
  r.associado_id,
  r.plataforma_device_id,
  r.plataforma_user_id,
  r.plataforma_veiculo_id,
  v.placa,
  a.nome AS associado_nome,
  a.email AS associado_email,
  r.updated_at
FROM public.rastreadores r
LEFT JOIN public.veiculos v ON v.id = r.veiculo_id
LEFT JOIN public.associados a ON a.id = r.associado_id
WHERE r.plataforma IN ('softruck','rede_veiculos')
  AND r.status = 'instalado'
  AND r.veiculo_id IS NOT NULL
  AND r.associado_id IS NOT NULL
  AND (
    r.plataforma_device_id IS NULL
    OR r.plataforma_veiculo_id IS NULL
    OR r.plataforma_user_id IS NULL
  );
