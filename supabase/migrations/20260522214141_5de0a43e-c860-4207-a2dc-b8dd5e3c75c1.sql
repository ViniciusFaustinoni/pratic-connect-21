-- Fix sync_instalacao_to_servicos: trg_instalacao_auto_status força status='atribuida'
-- (valor existente só em status_instalacao), e o cast direto pra status_servico falha.
-- Solução cirúrgica: traduzir status_instalacao -> status_servico via CASE.
-- Domínio de servicos.status permanece enxuto.

CREATE OR REPLACE FUNCTION public.sync_instalacao_to_servicos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_status_servico status_servico;
BEGIN
  -- Mapear status_instalacao -> status_servico.
  -- 'atribuida', 'aguardando_prestador', 'no_local' não existem em status_servico
  -- (são estados operacionais internos da instalação). Traduz para 'agendada'.
  v_status_servico := CASE NEW.status::text
    WHEN 'atribuida'           THEN 'agendada'::status_servico
    WHEN 'aguardando_prestador' THEN 'agendada'::status_servico
    WHEN 'no_local'            THEN 'em_andamento'::status_servico
    ELSE (NEW.status::text)::status_servico
  END;

  SELECT id INTO v_existing_id
  FROM public.servicos
  WHERE instalacao_origem_id = NEW.id
  LIMIT 1;
  IF v_existing_id IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.contrato_id IS NOT NULL AND NEW.veiculo_id IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.servicos
    WHERE instalacao_origem_id IS NULL
      AND contrato_id = NEW.contrato_id
      AND veiculo_id = NEW.veiculo_id
      AND tipo IN ('instalacao','vistoria_entrada')
      AND status NOT IN ('cancelada','reprovada','concluida','aprovada','aprovada_ressalvas')
      AND COALESCE(modalidade::text, 'presencial') <> 'autovistoria'
      AND COALESCE(origem, '') <> 'autovistoria_publica'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.servicos
      SET instalacao_origem_id = NEW.id,
          data_agendada = COALESCE(NEW.data_agendada, data_agendada),
          hora_agendada = COALESCE(NEW.hora_agendada, hora_agendada),
          periodo       = COALESCE((NEW.periodo::text)::periodo_servico, periodo),
          updated_at = now()
      WHERE id = v_existing_id;
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.servicos (
    tipo, status, data_agendada, hora_agendada, periodo,
    associado_id, veiculo_id, latitude, longitude,
    logradouro, numero, bairro, cidade, uf, cep,
    permite_encaixe, local_vistoria, cotacao_id, contrato_id,
    instalacao_origem_id, origem, created_at, updated_at
  ) VALUES (
    'instalacao', v_status_servico, NEW.data_agendada, NEW.hora_agendada,
    (NEW.periodo::text)::periodo_servico, NEW.associado_id, NEW.veiculo_id,
    NEW.endereco_latitude, NEW.endereco_longitude,
    NEW.logradouro, NEW.numero, NEW.bairro, NEW.cidade, NEW.uf, NEW.cep,
    COALESCE(NEW.permite_encaixe, false), COALESCE(NEW.local_vistoria, 'cliente'),
    NEW.cotacao_id, NEW.contrato_id, NEW.id, 'instalacao', NOW(), NOW()
  );
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.sync_instalacao_to_servicos() IS
'Sync instalacoes -> servicos. Status_instalacao "atribuida"/"aguardando_prestador" mapeiam para "agendada"; "no_local" -> "em_andamento". Mantém domínio de status_servico enxuto.';
