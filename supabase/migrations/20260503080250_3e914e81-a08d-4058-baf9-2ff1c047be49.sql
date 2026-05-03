
CREATE OR REPLACE FUNCTION public.fn_set_cobertura_from_sinistro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_map jsonb := '{
    "colisao":"COB-COL","roubo":"COB-RF","furto":"COB-FUR","incendio":"COB-INC",
    "fenomeno_natural":"COB-FN","vidros":"COB-VID","vandalismo":"COB-VAN","terceiros":"COB-TER"
  }'::jsonb;
  v_sinistro_id uuid;
  v_tipo text;
  v_cob uuid;
BEGIN
  IF NEW.cobertura_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'ordens_servico_itens' THEN
    SELECT os.sinistro_id INTO v_sinistro_id
    FROM public.ordens_servico os
    WHERE os.id = NEW.ordem_servico_id;
  ELSIF TG_TABLE_NAME = 'evento_cotacoes_pecas' THEN
    v_sinistro_id := NEW.sinistro_id;
  END IF;

  IF v_sinistro_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.tipo::text INTO v_tipo FROM public.sinistros s WHERE s.id = v_sinistro_id;
  IF v_tipo IS NULL OR NOT (v_map ? v_tipo) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_cob FROM public.coberturas WHERE codigo = (v_map ->> v_tipo) LIMIT 1;
  NEW.cobertura_id := v_cob;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_osi_set_cobertura ON public.ordens_servico_itens;
CREATE TRIGGER trg_osi_set_cobertura
  BEFORE INSERT ON public.ordens_servico_itens
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_cobertura_from_sinistro();

DROP TRIGGER IF EXISTS trg_ecp_set_cobertura ON public.evento_cotacoes_pecas;
CREATE TRIGGER trg_ecp_set_cobertura
  BEFORE INSERT ON public.evento_cotacoes_pecas
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_cobertura_from_sinistro();
