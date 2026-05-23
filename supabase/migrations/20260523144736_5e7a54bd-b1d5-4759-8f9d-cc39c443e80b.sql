-- ============================================================
-- A1: Corrigir regex de detecção de moto
-- Em Postgres: \m = início de palavra, \M = fim de palavra.
-- Usar \y (qualquer borda) em ambos os lados resolve casos
-- onde o nome termina em número (ELITE 125, ADV 150, NH 125...).
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_veiculo_precisa_rastreador(_veiculo_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_fipe numeric;
  v_combustivel text;
  v_marca text;
  v_modelo text;
  v_fipe_min_carro numeric := 30000;
  v_fipe_min_moto  numeric := 9000;
  v_marcas_moto text;
  v_is_moto boolean := false;
  v_marca_norm text;
BEGIN
  IF _veiculo_id IS NULL THEN RETURN true; END IF;

  SELECT v.valor_fipe, v.combustivel, v.marca, v.modelo
    INTO v_fipe, v_combustivel, v_marca, v_modelo
  FROM public.veiculos v WHERE v.id = _veiculo_id;

  IF NOT FOUND THEN RETURN true; END IF;

  IF v_combustivel ILIKE '%diesel%' THEN RETURN true; END IF;

  BEGIN
    SELECT (valor)::numeric INTO v_fipe_min_carro
      FROM public.configuracoes
     WHERE chave='operacional_fipe_minimo_rastreador' LIMIT 1;
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    SELECT (valor)::numeric INTO v_fipe_min_moto
      FROM public.configuracoes
     WHERE chave='operacional_fipe_minimo_rastreador_moto' LIMIT 1;
  EXCEPTION WHEN others THEN NULL; END;
  BEGIN
    SELECT valor::text INTO v_marcas_moto
      FROM public.configuracoes
     WHERE chave='marcas_exclusivas_moto' LIMIT 1;
  EXCEPTION WHEN others THEN NULL; END;

  v_marca_norm := upper(trim(coalesce(v_marca, '')));

  IF v_marcas_moto IS NOT NULL AND v_marca_norm <> '' THEN
    IF position(v_marca_norm IN upper(v_marcas_moto)) > 0 THEN
      v_is_moto := true;
    END IF;
  END IF;

  -- Heurística de modelo: usar \y (qualquer borda de palavra) em ambos
  -- os lados — \m só casa início, \M só casa fim. Antes "ELITE 125"
  -- não casava porque \m no final exige começo de palavra.
  IF NOT v_is_moto AND v_modelo IS NOT NULL THEN
    IF lower(' '||v_modelo||' ') ~ '\y(cg|fan|titan|biz|pop|bros|xre|cb|hornet|fazer|ybr|factor|xtz|crf|cbr|gsr|gsx|cgr|ttr|nxr|cb300|cb500|pcx|nmax|burgman|sh ?150|elite ?125|adv ?150|nh ?125|kasinski|harley)\y' THEN
      v_is_moto := true;
    END IF;
  END IF;

  IF coalesce(v_fipe, 0) <= 0 THEN RETURN true; END IF;

  IF v_is_moto THEN
    RETURN v_fipe >= v_fipe_min_moto;
  ELSE
    RETURN v_fipe >= v_fipe_min_carro;
  END IF;
END;
$function$;

-- ============================================================
-- B2: Materializar a instalação da cotação COT-20260523-094748331-003
-- reaproveitando o agendamento que o cliente já fez no link público.
-- Honda ELITE 125, FIPE R$ 15.779 → moto sub-FIPE (precisa_rastreador=false
-- após A1). Devolve cotação para 'aguardando_instalacao' para que o
-- caminho canônico continue (Cadastro já aprovou em 23/05 13:22).
-- ============================================================
DO $$
DECLARE
  v_cotacao_id uuid := 'a9960f90-2430-4bf0-88eb-675c593261f2';
  v_contrato_id uuid := '35f6d01c-30e6-49da-9cf4-4d211935f197';
  v_veiculo_id uuid := 'ec0039cc-8803-4968-8c5e-7dc67480586f';
  v_associado_id uuid := '92c39f2c-2957-4989-b78c-a056e1b99ebd';
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM public.instalacoes
   WHERE cotacao_id = v_cotacao_id OR contrato_id = v_contrato_id
   LIMIT 1;

  IF v_existing IS NULL THEN
    INSERT INTO public.instalacoes (
      associado_id, veiculo_id, contrato_id, cotacao_id,
      data_agendada, periodo,
      cep, logradouro, numero, bairro, cidade, uf,
      status, local_vistoria, permite_encaixe,
      dispensa_rastreador,
      observacoes
    ) VALUES (
      v_associado_id, v_veiculo_id, v_contrato_id, v_cotacao_id,
      '2026-05-25', 'manha'::periodo_instalacao,
      '25060280', 'RUA JOÃO ALVES TORRES FILHO', '4858',
      'VILA LEOPOLDINA', 'DUQUE DE CAXIAS', 'RJ',
      'agendada'::status_instalacao, 'cliente', true,
      NOT public.fn_veiculo_precisa_rastreador(v_veiculo_id),
      'Materializada manualmente — agendamento original do link público preservado (correção pós-fix regex fn_veiculo_precisa_rastreador).'
    );
  END IF;

  -- Devolve a cotação ao estado canônico pós-cadastro-aprovado.
  UPDATE public.cotacoes
     SET status_contratacao = 'aguardando_instalacao',
         updated_at = now()
   WHERE id = v_cotacao_id
     AND status_contratacao = 'pagamento_ok';

  -- Garante log de auditoria
  INSERT INTO public.logs_auditoria (acao, descricao, entidade, entidade_id, usuario_id)
  VALUES (
    'atualizar',
    '[CORRECAO_MANUAL] Materializada instalacao da cotacao COT-20260523-094748331-003 (Honda ELITE 125) apos fix do regex fn_veiculo_precisa_rastreador. Agendamento original 2026-05-25 manha preservado.',
    'cotacoes',
    v_cotacao_id,
    NULL
  );
EXCEPTION WHEN others THEN
  -- Não bloqueia migration se log_auditoria recusar acao
  RAISE NOTICE 'Log auditoria skip: %', SQLERRM;
END $$;