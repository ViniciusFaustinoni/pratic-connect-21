INSERT INTO public.servicos (
  tipo, status, veiculo_id, associado_id, contrato_id, vistoria_origem_id,
  data_agendada, periodo, observacoes, created_at, updated_at
)
SELECT
  'vistoria_entrada'::tipo_servico, 'concluida'::status_servico,
  v.veiculo_id, v.associado_id, v.contrato_id, v.id,
  CURRENT_DATE, 'manha'::periodo_servico,
  'Materializado para fila Aprovação de Associados (sub-FIPE sem rastreador)',
  now(), now()
FROM public.vistorias v
WHERE v.id IN ('8abc0e61-3a27-49c9-bb87-219ee58e9af2','20b1ae9c-ee82-4dac-9781-49959465753e')
  AND NOT EXISTS (
    SELECT 1 FROM public.servicos s
    WHERE s.vistoria_origem_id = v.id
      AND s.tipo IN ('vistoria_entrada'::tipo_servico,'instalacao'::tipo_servico)
  );

CREATE OR REPLACE FUNCTION public.fn_materializar_servico_vistoria_sub_fipe()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_precisa boolean;
BEGIN
  IF NEW.tipo <> 'entrada' OR NEW.veiculo_id IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_precisa := public.fn_veiculo_precisa_rastreador(NEW.veiculo_id);
  EXCEPTION WHEN OTHERS THEN
    v_precisa := true;
  END;
  IF v_precisa THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.servicos s
    WHERE s.vistoria_origem_id = NEW.id
      AND s.tipo IN ('vistoria_entrada'::tipo_servico,'instalacao'::tipo_servico)
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.servicos (
    tipo, status, veiculo_id, associado_id, contrato_id, vistoria_origem_id,
    data_agendada, periodo, observacoes, created_at, updated_at
  ) VALUES (
    'vistoria_entrada'::tipo_servico,
    (CASE WHEN NEW.status IN ('em_analise','aprovada','reprovada','aprovada_ressalvas')
          THEN 'concluida' ELSE 'agendada' END)::status_servico,
    NEW.veiculo_id, NEW.associado_id, NEW.contrato_id, NEW.id,
    CURRENT_DATE, 'manha'::periodo_servico,
    'Materializado automaticamente (sub-FIPE sem rastreador)',
    now(), now()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_materializar_servico_vistoria_sub_fipe ON public.vistorias;
CREATE TRIGGER trg_materializar_servico_vistoria_sub_fipe
AFTER INSERT OR UPDATE OF status ON public.vistorias
FOR EACH ROW
EXECUTE FUNCTION public.fn_materializar_servico_vistoria_sub_fipe();