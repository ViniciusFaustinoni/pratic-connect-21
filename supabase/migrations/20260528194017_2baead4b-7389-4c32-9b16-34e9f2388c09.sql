-- Fix troca de titularidade: promoção da solicitação ao Cadastro estava falhando
-- quando `cotacoes.origem_troca_titularidade=false` mesmo havendo
-- `dados_extras.solicitacao_troca_id` (caso ANDERSON / SRZ2E82).
-- A trigger agora aceita o fallback via dados_extras.

CREATE OR REPLACE FUNCTION public.fn_troca_promove_cadastro_via_cotacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sol_id uuid;
  v_eh_troca boolean;
BEGIN
  IF NEW.status_contratacao IS NULL
     OR NEW.status_contratacao NOT IN (
       'aguardando_aprovacao_cadastro',
       'pagamento_ok',
       'contrato_gerado',
       'aguardando_aprovacao_monitoramento'
     ) THEN
    RETURN NEW;
  END IF;
  IF OLD.status_contratacao IS NOT DISTINCT FROM NEW.status_contratacao THEN
    RETURN NEW;
  END IF;

  -- Reconhece troca por flag OU por dados_extras.solicitacao_troca_id (fallback
  -- canônico, pois vincular-cotacao-troca nem sempre escreve a flag).
  v_eh_troca := COALESCE(NEW.origem_troca_titularidade, false)
                OR (NEW.dados_extras ? 'solicitacao_troca_id'
                    AND NULLIF(NEW.dados_extras->>'solicitacao_troca_id','') IS NOT NULL);
  IF NOT v_eh_troca THEN
    RETURN NEW;
  END IF;

  SELECT s.id INTO v_sol_id
    FROM public.solicitacoes_troca_titularidade s
   WHERE s.cotacao_id = NEW.id
   LIMIT 1;

  IF v_sol_id IS NULL THEN
    BEGIN
      v_sol_id := NULLIF(NEW.dados_extras->>'solicitacao_troca_id','')::uuid;
    EXCEPTION WHEN others THEN
      v_sol_id := NULL;
    END;
  END IF;

  IF v_sol_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.solicitacoes_troca_titularidade
     SET status = 'aguardando_cadastro',
         updated_at = now()
   WHERE id = v_sol_id
     AND status = 'cotacao_em_andamento';

  RETURN NEW;
END;
$function$;

-- Hotfix: cotação SRZ2E82 / ANDERSON — promove agora (cotação já está em pagamento_ok).
UPDATE public.cotacoes
   SET origem_troca_titularidade = true,
       updated_at = now()
 WHERE id = '45d67b5d-7946-481c-a9f9-9bf7c5f03ce4'
   AND COALESCE(origem_troca_titularidade,false) = false;

UPDATE public.solicitacoes_troca_titularidade
   SET status = 'aguardando_cadastro',
       updated_at = now()
 WHERE id = 'd3e09159-22a0-449d-aa2b-ca1cb8faf00a'
   AND status = 'cotacao_em_andamento';

-- Saneamento geral: outras cotações de troca presas no mesmo estado.
UPDATE public.solicitacoes_troca_titularidade s
   SET status = 'aguardando_cadastro', updated_at = now()
  FROM public.cotacoes c
 WHERE s.cotacao_id = c.id
   AND s.status = 'cotacao_em_andamento'
   AND c.status_contratacao IN ('aguardando_aprovacao_cadastro','pagamento_ok','contrato_gerado','aguardando_aprovacao_monitoramento');