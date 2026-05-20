-- 1) DATA-FIX caso Eder Lopes / RJX3E41 — instalação fantasma
UPDATE public.instalacoes
   SET status = 'cancelada',
       observacoes = COALESCE(observacoes,'') ||
         E'\n[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Cancelada por saneamento — instalacao fantasma (concluida sem rastreador e dispensa_rastreador=true indevido para moto FIPE R$20.653).',
       updated_at = now()
 WHERE id = 'e24a80c4-f3e2-4885-b70c-23d280cb138c';

UPDATE public.cotacoes
   SET status_contratacao = 'aguardando_instalacao',
       updated_at = now()
 WHERE id = 'fc709049-d372-4984-94b6-939fe903c638'
   AND status_contratacao = 'pagamento_ok';

INSERT INTO public.associados_historico (associado_id, contrato_id, tipo, descricao, usuario_id)
VALUES (
  '59020c34-8173-46c3-bc01-56003595f5d0',
  'ee1e3a8b-eb89-4d1f-a937-052b82ba15bb',
  'observacao_adicionada',
  'Saneamento: instalação e24a80c4 cancelada (era fantasma — concluida sem rastreador). Cotação reaberta para agendamento via link público.',
  NULL
);

-- 2) Saneamento de instalações vivas com dispensa_rastreador=true indevido + sem rastreador
WITH alvos AS (
  SELECT i.id
    FROM public.instalacoes i
    JOIN public.veiculos v ON v.id = i.veiculo_id
   WHERE i.dispensa_rastreador = true
     AND i.rastreador_id IS NULL
     AND i.status::text NOT IN ('cancelada','reprovada')
     AND (
       LOWER(COALESCE(v.combustivel,'')) LIKE '%diesel%'
       OR (LOWER(COALESCE(v.marca,'')) ~ '(honda|yamaha|suzuki|kawasaki|harley|bmw motorrad|royal enfield|dafra|haojue|shineray|kasinski|triumph|husqvarna|ducati|mv agusta|cf moto|sym|piaggio|vespa|traxx|sundown|garinni|kymco)'
           AND COALESCE(v.valor_fipe,0) >= 9000)
       OR (NOT (LOWER(COALESCE(v.marca,'')) ~ '(honda|yamaha|suzuki|kawasaki|harley|bmw motorrad|royal enfield|dafra|haojue|shineray|kasinski|triumph|husqvarna|ducati|mv agusta|cf moto|sym|piaggio|vespa|traxx|sundown|garinni|kymco)')
           AND COALESCE(v.valor_fipe,0) >= 30000)
     )
)
UPDATE public.instalacoes i
   SET status = 'cancelada',
       observacoes = COALESCE(i.observacoes,'') ||
         E'\n[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Cancelada por saneamento (dispensa_rastreador=true indevido para veículo que exige rastreador).',
       updated_at = now()
  FROM alvos a
 WHERE i.id = a.id;

-- 3) Guard novo
CREATE OR REPLACE FUNCTION public.fn_guard_dispensa_rastreador_coerente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_valor_fipe numeric;
  v_combustivel text;
  v_marca text;
  v_modelo text;
  v_is_moto boolean;
  v_exige boolean;
BEGIN
  IF COALESCE(NEW.dispensa_rastreador, false) = false THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.dispensa_rastreador,false) = true
     AND COALESCE(OLD.veiculo_id::text,'') = COALESCE(NEW.veiculo_id::text,'') THEN
    RETURN NEW;
  END IF;

  IF NEW.veiculo_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT v.valor_fipe, v.combustivel, v.marca, v.modelo
    INTO v_valor_fipe, v_combustivel, v_marca, v_modelo
    FROM public.veiculos v WHERE v.id = NEW.veiculo_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF LOWER(COALESCE(v_combustivel,'')) LIKE '%diesel%' THEN
    RAISE EXCEPTION 'dispensa_rastreador_incoerente: veículo Diesel (instalacao=%, veiculo=%) NÃO pode ter dispensa_rastreador=true.',
      NEW.id, NEW.veiculo_id USING ERRCODE = 'check_violation';
  END IF;

  v_is_moto := LOWER(COALESCE(v_marca,'')) ~ '(honda|yamaha|suzuki|kawasaki|harley|bmw motorrad|royal enfield|dafra|haojue|shineray|kasinski|triumph|husqvarna|ducati|mv agusta|cf moto|sym|piaggio|vespa|traxx|sundown|garinni|kymco)'
              OR LOWER(COALESCE(v_modelo,'')) ~ '(cb |cg |titan|biz|nmax|xre|fazer|bros|pop |xtz|hornet|cbr|gixxer|burgman|ybr|fan |factor| adv|pcx|crf|twister)';

  v_exige := CASE
    WHEN v_is_moto THEN COALESCE(v_valor_fipe,0) >= 9000
    ELSE COALESCE(v_valor_fipe,0) >= 30000
  END;

  IF v_exige THEN
    RAISE EXCEPTION 'dispensa_rastreador_incoerente: veículo % (FIPE R$ %) exige rastreador — dispensa_rastreador=true não é permitido (instalacao=%).',
      COALESCE(v_marca,'') || ' ' || COALESCE(v_modelo,''), v_valor_fipe, NEW.id
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_dispensa_rastreador_coerente ON public.instalacoes;
CREATE TRIGGER trg_guard_dispensa_rastreador_coerente
  BEFORE INSERT OR UPDATE OF dispensa_rastreador, veiculo_id ON public.instalacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_dispensa_rastreador_coerente();