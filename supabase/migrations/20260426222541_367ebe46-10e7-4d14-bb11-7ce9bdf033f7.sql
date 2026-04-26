-- Bloqueia atribuição de grade própria para usuários cujo único papel é
-- supervisor_vendas e/ou gerente_comercial.
--
-- Regra: a comissão de supervisor/gerente é sempre derivada da grade do
-- vendedor que ORIGINOU a venda (fn_gerar_comissoes_por_pagamento).
-- Permanecem permitidos: vendedor_clt, vendedor_externo, agencia.
-- Usuários acumulando papéis (ex.: vendedor_clt + supervisor_vendas)
-- continuam podendo receber grade.

CREATE OR REPLACE FUNCTION public.fn_validar_grade_papel_origem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_auth_user_id uuid;
  v_tem_papel_origem boolean;
BEGIN
  -- usuario_grade_comissao.user_id armazena profiles.id (NÃO auth.users.id)
  SELECT user_id INTO v_auth_user_id
  FROM public.profiles
  WHERE id = NEW.user_id
  LIMIT 1;

  IF v_auth_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_auth_user_id
      AND ur.role::text IN ('vendedor_clt', 'vendedor_externo', 'agencia')
  ) INTO v_tem_papel_origem;

  IF NOT v_tem_papel_origem THEN
    RAISE EXCEPTION
      'Supervisores/Gerentes não recebem grade própria — a comissão deles é calculada pela grade do vendedor que originou a venda.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_grade_papel_origem ON public.usuario_grade_comissao;

CREATE TRIGGER trg_validar_grade_papel_origem
BEFORE INSERT OR UPDATE OF user_id, grade_id ON public.usuario_grade_comissao
FOR EACH ROW
WHEN (NEW.data_fim IS NULL)
EXECUTE FUNCTION public.fn_validar_grade_papel_origem();

-- Limpeza defensiva: encerra qualquer atribuição ativa residual para
-- usuários que hoje só têm papéis de supervisor/gerente.
UPDATE public.usuario_grade_comissao ugc
SET data_fim = now()
WHERE ugc.data_fim IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE p.id = ugc.user_id
      AND ur.role::text IN ('vendedor_clt', 'vendedor_externo', 'agencia')
  );