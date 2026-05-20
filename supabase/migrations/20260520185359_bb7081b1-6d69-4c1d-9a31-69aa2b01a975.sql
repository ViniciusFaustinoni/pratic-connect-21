-- 1) Ampliar trigger para promover em qualquer status pós-fluxo do cliente
CREATE OR REPLACE FUNCTION public.fn_troca_promove_cadastro_via_cotacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sol_id uuid;
BEGIN
  -- Promove quando o status_contratacao entra em qualquer fase pós-fluxo do cliente.
  -- Antes só disparava em 'aguardando_aprovacao_cadastro'; cotações que pulam direto
  -- para pagamento_ok/contrato_gerado deixavam a solicitação eterna em 'cotacao_em_andamento'.
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
  IF COALESCE(NEW.origem_troca_titularidade, false) = false THEN
    RETURN NEW;
  END IF;

  -- Achar a solicitação ligada: 1) por cotacao_id direto; 2) por dados_extras.solicitacao_troca_id
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

  -- Idempotente: só promove se ainda estiver em 'cotacao_em_andamento'.
  UPDATE public.solicitacoes_troca_titularidade
     SET status = 'aguardando_cadastro',
         updated_at = now()
   WHERE id = v_sol_id
     AND status = 'cotacao_em_andamento';

  RETURN NEW;
END;
$function$;

-- 2) Backfill: regulariza solicitações travadas em 'cotacao_em_andamento' cuja cotação já avançou
UPDATE public.solicitacoes_troca_titularidade s
   SET status = 'aguardando_cadastro',
       updated_at = now()
  FROM public.cotacoes c
 WHERE s.status = 'cotacao_em_andamento'
   AND s.termo_cancelamento_assinado_em IS NOT NULL
   AND (s.cotacao_id = c.id OR c.id::text = (
         SELECT NULLIF(c2.dados_extras->>'solicitacao_troca_id','')
           FROM public.cotacoes c2 WHERE c2.id = c.id
       ))
   AND c.origem_troca_titularidade = true
   AND c.status_contratacao IN (
     'aguardando_aprovacao_cadastro',
     'pagamento_ok',
     'contrato_gerado',
     'aguardando_aprovacao_monitoramento'
   );