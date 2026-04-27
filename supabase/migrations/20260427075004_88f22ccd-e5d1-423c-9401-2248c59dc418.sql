-- 1. Adicionar coluna tipo_entrada em cotacoes
ALTER TABLE public.cotacoes
  ADD COLUMN IF NOT EXISTS tipo_entrada text;

-- 2. Backfill a partir de dados_extras->>'tipo_entrada'
UPDATE public.cotacoes
   SET tipo_entrada = dados_extras->>'tipo_entrada'
 WHERE tipo_entrada IS NULL
   AND dados_extras IS NOT NULL
   AND dados_extras->>'tipo_entrada' IS NOT NULL;

-- 3. Índice
CREATE INDEX IF NOT EXISTS idx_cotacoes_tipo_entrada
  ON public.cotacoes(tipo_entrada)
  WHERE tipo_entrada IS NOT NULL;

-- 4. Trigger de defesa em profundidade: garantir conclusão da instalação
--    quando vistoria aprovada e rastreador vinculado.
CREATE OR REPLACE FUNCTION public.fn_instalacao_autoconcluir_pos_vistoria()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vistoria_aprovada boolean;
BEGIN
  -- Só age se rastreador foi vinculado e instalação ainda não está concluída
  IF NEW.rastreador_id IS NOT NULL
     AND NEW.status IN ('agendada','em_rota','em_andamento','atribuida') THEN
    SELECT EXISTS(
      SELECT 1 FROM public.vistorias v
       WHERE v.instalacao_id = NEW.id
         AND v.status = 'aprovada'
    ) INTO v_vistoria_aprovada;

    IF v_vistoria_aprovada THEN
      NEW.status := 'concluida';
      NEW.concluida_em := COALESCE(NEW.concluida_em, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instalacao_autoconcluir ON public.instalacoes;
CREATE TRIGGER trg_instalacao_autoconcluir
  BEFORE UPDATE ON public.instalacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_instalacao_autoconcluir_pos_vistoria();