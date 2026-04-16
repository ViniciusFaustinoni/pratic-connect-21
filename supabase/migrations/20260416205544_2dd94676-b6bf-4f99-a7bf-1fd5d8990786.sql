-- 1) Coluna base_id em alocacoes_diarias
ALTER TABLE public.alocacoes_diarias
  ADD COLUMN IF NOT EXISTS base_id uuid REFERENCES public.oficinas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_alocacoes_diarias_base_id
  ON public.alocacoes_diarias(base_id);

CREATE INDEX IF NOT EXISTS idx_alocacoes_diarias_data
  ON public.alocacoes_diarias(data);

-- 2) Trigger de validação
CREATE OR REPLACE FUNCTION public.validar_alocacao_base()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_alocacao = 'base' THEN
    IF NEW.base_id IS NULL THEN
      RAISE EXCEPTION 'Quando tipo_alocacao = base, base_id é obrigatório';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.oficinas
      WHERE id = NEW.base_id
        AND COALESCE(is_base_pratic, false) = true
    ) THEN
      RAISE EXCEPTION 'A oficina informada não é uma base Pratic ativa';
    END IF;
  ELSE
    -- Se tipo for "rota", limpa base_id
    NEW.base_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_alocacao_base ON public.alocacoes_diarias;
CREATE TRIGGER trg_validar_alocacao_base
BEFORE INSERT OR UPDATE ON public.alocacoes_diarias
FOR EACH ROW
EXECUTE FUNCTION public.validar_alocacao_base();

-- 3) RLS — garantir INSERT/UPDATE para coordenador de monitoramento e diretor
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='alocacoes_diarias' AND policyname='alocacoes_coord_monit_manage') THEN
    DROP POLICY "alocacoes_coord_monit_manage" ON public.alocacoes_diarias;
  END IF;
END $$;

CREATE POLICY "alocacoes_coord_monit_manage"
ON public.alocacoes_diarias
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR profissional_id = auth.uid()
)
WITH CHECK (
  public.has_role(auth.uid(), 'diretor'::app_role)
  OR public.has_role(auth.uid(), 'coordenador_monitoramento'::app_role)
  OR public.has_role(auth.uid(), 'admin'::app_role)
);
