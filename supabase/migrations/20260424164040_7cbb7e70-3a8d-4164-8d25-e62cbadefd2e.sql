-- 1) Remover roles comerciais de qualquer profile com tipo 'associado'
DELETE FROM public.user_roles
WHERE role IN ('vendedor_clt','vendedor_externo','agencia','supervisor_vendas','gerente_comercial')
  AND user_id IN (
    SELECT user_id FROM public.profiles WHERE tipo = 'associado' AND user_id IS NOT NULL
  );

-- 2) Trigger preventivo: bloquear futura atribuição de role comercial a associado
CREATE OR REPLACE FUNCTION public.prevent_commercial_role_for_associate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('vendedor_clt','vendedor_externo','agencia','supervisor_vendas','gerente_comercial') THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE user_id = NEW.user_id AND tipo = 'associado'
    ) THEN
      RAISE EXCEPTION 'Associados não podem ter perfis comerciais (role: %)', NEW.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_commercial_role_for_associate ON public.user_roles;
CREATE TRIGGER trg_prevent_commercial_role_for_associate
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_commercial_role_for_associate();