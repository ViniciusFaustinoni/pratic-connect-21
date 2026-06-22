-- =============================================================================
-- Foco Ads — Politica de acesso: SOMENTE admin_master
-- =============================================================================
-- Decisao do produto: apenas o admin_master ve e edita o Foco Ads. Nenhum outro
-- papel acessa o modulo (nem para visualizar). Corrige a migration inicial, que
-- havia concedido foco_ads.* tambem ao 'desenvolvedor'.
-- Idempotente.
-- =============================================================================

-- 1. admin_master: garante as 3 permissoes (ver + aprovar + executar).
UPDATE public.app_roles_config
SET permissions = (
  SELECT to_jsonb(array_agg(DISTINCT p))
  FROM jsonb_array_elements_text(
    COALESCE(permissions, '[]'::jsonb)
    || '["foco_ads.ver","foco_ads.aprovar","foco_ads.executar"]'::jsonb
  ) AS p
)
WHERE role = 'admin_master';

-- 2. Demais papeis: remove qualquer permissao foco_ads.* (view e edicao).
UPDATE public.app_roles_config
SET permissions = (
  SELECT COALESCE(to_jsonb(array_agg(p)), '[]'::jsonb)
  FROM jsonb_array_elements_text(permissions) AS p
  WHERE p NOT LIKE 'foco_ads.%'
)
WHERE role <> 'admin_master'
  AND permissions IS NOT NULL;
