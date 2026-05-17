
-- Etapa 4/4: Guard no banco - impede veiculos.status='ativo' sem rastreador quando exigido
CREATE OR REPLACE FUNCTION public.fn_guard_veiculo_ativo_exige_rastreador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tem_rastreador boolean;
  v_exige boolean;
  v_combustivel text;
  v_fipe numeric;
  v_tipo text;
BEGIN
  -- Só age na transição para 'ativo'
  IF NEW.status IS DISTINCT FROM 'ativo' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'ativo' THEN
    RETURN NEW;
  END IF;

  v_combustivel := lower(coalesce(NEW.combustivel, ''));
  v_fipe := coalesce(NEW.valor_fipe, 0);

  -- Detecta tipo (carro vs moto) via marcas_modelos quando possível
  SELECT lower(coalesce(mm.tipo_veiculo, 'carro'))
    INTO v_tipo
    FROM public.marcas_modelos mm
   WHERE mm.marca = NEW.marca AND mm.modelo = NEW.modelo
   LIMIT 1;
  v_tipo := coalesce(v_tipo, 'carro');

  -- Regra canônica
  v_exige := (v_combustivel = 'diesel')
          OR (v_tipo = 'moto' AND v_fipe >= 9000)
          OR (v_tipo <> 'moto' AND v_fipe >= 30000);

  IF NOT v_exige THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.rastreadores r WHERE r.veiculo_id = NEW.id
  ) INTO v_tem_rastreador;

  IF NOT v_tem_rastreador THEN
    RAISE EXCEPTION 'veiculo_ativo_exige_rastreador_fisico: veículo % (placa %, FIPE %, %) não pode ser promovido a ativo sem rastreador vinculado',
      NEW.id, NEW.placa, v_fipe, v_combustivel
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_veiculo_ativo_exige_rastreador ON public.veiculos;
CREATE TRIGGER trg_guard_veiculo_ativo_exige_rastreador
  BEFORE INSERT OR UPDATE OF status ON public.veiculos
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_veiculo_ativo_exige_rastreador();

COMMENT ON FUNCTION public.fn_guard_veiculo_ativo_exige_rastreador IS
  'Etapa 4/4 (autovistoria-nao-ativa-cobertura): bloqueia veiculos.status=ativo sem rastreador físico quando Diesel, Carro FIPE>=30k ou Moto FIPE>=9k. Última linha de defesa após hook UI (Etapa 1), saneamento (Etapa 2) e edge ativar-associado (Etapa 3).';
