-- =====================================================================
-- Guard "vistoria sem rastreador" + hotfix Gleice/JOAO VICTOR
-- Bloqueia ativação automática de associado/contrato/veículo quando
-- o veículo dispensa rastreador (FIPE<30k carro / 9k moto, não-Diesel)
-- e ainda não há vistoria aprovada.
-- =====================================================================

-- 1) Função utilitária: veículo precisa de rastreador?
CREATE OR REPLACE FUNCTION public.fn_veiculo_precisa_rastreador(_veiculo_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Diesel sempre exige rastreador.
  IF v_combustivel ILIKE '%diesel%' THEN RETURN true; END IF;

  -- Pega configurações se existirem.
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
    -- Aceita JSON array ou CSV
    IF position(v_marca_norm IN upper(v_marcas_moto)) > 0 THEN
      v_is_moto := true;
    END IF;
  END IF;

  -- Heurística de modelo (palavras-chave comuns de moto)
  IF NOT v_is_moto AND v_modelo IS NOT NULL THEN
    IF lower(' '||v_modelo||' ') ~ '\m(cg|fan|titan|biz|pop|bros|xre|cb|hornet|fazer|ybr|factor|xtz|crf|cbr|gsr|gsx|cgr|ttr|nxr|cb300|cb500|pcx|nmax|burgman|sh ?150|elite ?125|adv ?150|nh ?125|kasinski|harley)\m' THEN
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
$$;

GRANT EXECUTE ON FUNCTION public.fn_veiculo_precisa_rastreador(uuid)
  TO anon, authenticated, service_role;

-- 2) Trigger de consistência em instalacoes:
--    se o veículo NÃO precisa de rastreador, dispensa_rastreador deve ser TRUE.
--    Garante que nenhum caminho legado crie instalação fantasma sem o flag.
CREATE OR REPLACE FUNCTION public.fn_instalacoes_consistencia_dispensa_rastreador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.veiculo_id IS NOT NULL
     AND public.fn_veiculo_precisa_rastreador(NEW.veiculo_id) = false
     AND COALESCE(NEW.dispensa_rastreador, false) = false THEN
    NEW.dispensa_rastreador := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_instalacoes_consistencia_dispensa_rastreador ON public.instalacoes;
CREATE TRIGGER trg_instalacoes_consistencia_dispensa_rastreador
BEFORE INSERT OR UPDATE ON public.instalacoes
FOR EACH ROW EXECUTE FUNCTION public.fn_instalacoes_consistencia_dispensa_rastreador();

-- 3) Ajuste em fn_reconciliar_status_pos_instalacao:
--    para veículos que dispensam rastreador, exigir vistoria aprovada antes
--    de promover de instalacao_pendente para ativo.
CREATE OR REPLACE FUNCTION public.fn_reconciliar_status_pos_instalacao()
RETURNS TABLE(veiculo_id uuid, placa text, acao text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH divergentes AS (
    SELECT v.id, v.placa
    FROM public.veiculos v
    JOIN public.associados a ON a.id = v.associado_id
    WHERE v.status = 'instalacao_pendente'
      AND a.status = 'ativo'
      AND (
        EXISTS (SELECT 1 FROM public.instalacoes i WHERE i.veiculo_id = v.id AND i.status = 'concluida')
        OR EXISTS (SELECT 1 FROM public.servicos s WHERE s.veiculo_id = v.id AND s.tipo = 'instalacao' AND s.status = 'concluida')
      )
      -- Para vistoria-sem-rastreador: só promove se vistoria aprovada.
      AND (
        public.fn_veiculo_precisa_rastreador(v.id) = true
        OR EXISTS (SELECT 1 FROM public.vistorias vi
                    WHERE vi.veiculo_id = v.id AND vi.status = 'aprovada')
      )
  ),
  upd AS (
    UPDATE public.veiculos v
       SET status = 'ativo',
           updated_at = now()
      FROM divergentes d
      WHERE v.id = d.id
    RETURNING v.id, v.placa
  )
  SELECT u.id, u.placa, 'promovido_para_ativo_pos_aprovacao'::text FROM upd u;
END;
$$;

-- 4) HOTFIX dos casos órfãos (Gleice + JOAO VICTOR):
--    reverter associado/contrato para aguardando_instalacao/assinado,
--    remover instalação e servico fantasma, manter vistoria pendente
--    para aparecer corretamente em Aprovação de Associados.
DO $hotfix$
DECLARE
  r record;
  v_servico_id uuid;
  v_instalacao_id uuid;
BEGIN
  FOR r IN
    SELECT a.id AS assoc_id, c.id AS contrato_id, v.id AS veiculo_id, v.placa
      FROM public.associados a
      JOIN public.contratos c ON c.associado_id = a.id AND c.status = 'ativo'
      JOIN public.veiculos v ON v.id = c.veiculo_id
     WHERE a.status = 'ativo'
       AND v.status = 'em_analise'
       AND public.fn_veiculo_precisa_rastreador(v.id) = false
       AND NOT EXISTS (
         SELECT 1 FROM public.vistorias vi
          WHERE vi.veiculo_id = v.id AND vi.status = 'aprovada'
       )
  LOOP
    RAISE NOTICE 'Hotfix vistoria-sem-rastreador: placa=%, assoc=%, contrato=%',
      r.placa, r.assoc_id, r.contrato_id;

    -- Reverter contrato
    UPDATE public.contratos
       SET status = 'assinado',
           data_ativacao = NULL,
           updated_at = now()
     WHERE id = r.contrato_id;

    -- Reverter associado para aguardando_instalacao (entra na fila Monitoramento)
    UPDATE public.associados
       SET status = 'aguardando_instalacao',
           data_ativacao = NULL,
           updated_at = now()
     WHERE id = r.assoc_id;

    -- Garantir veículo sem cobertura
    UPDATE public.veiculos
       SET cobertura_total = false,
           cobertura_roubo_furto = false,
           updated_at = now()
     WHERE id = r.veiculo_id;

    -- Remover servicos fantasma de instalação (que materializam fila de técnico)
    DELETE FROM public.servicos
     WHERE veiculo_id = r.veiculo_id
       AND tipo = 'instalacao';

    -- Remover instalações fantasma (sem rastreador, criadas indevidamente)
    DELETE FROM public.instalacoes
     WHERE veiculo_id = r.veiculo_id;

    -- Auditoria
    INSERT INTO public.ativacao_status_log
      (associado_id, contrato_id, from_status, to_status, source, payload)
    VALUES
      (r.assoc_id, r.contrato_id, 'ativo', 'aguardando_instalacao',
       'manual:hotfix-vistoria-sem-rastreador',
       jsonb_build_object(
         'placa', r.placa,
         'veiculo_id', r.veiculo_id,
         'motivo', 'Reset de ativação automática indevida — vistoria-sem-rastreador exige aprovação manual do Monitoramento'
       ));
  END LOOP;
END
$hotfix$;