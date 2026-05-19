
-- Trigger que promove a solicitação de troca para 'aguardando_cadastro'
-- quando a cotação canônica vinculada entra em 'aguardando_aprovacao_cadastro'.
-- Isso espelha a régua da nova adesão: a fila do Cadastro só vê o caso
-- depois que o novo titular conclui o link público.

CREATE OR REPLACE FUNCTION public.fn_troca_promove_cadastro_via_cotacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol_id uuid;
BEGIN
  -- Só age quando o status_contratacao acaba de virar 'aguardando_aprovacao_cadastro'
  IF NEW.status_contratacao IS DISTINCT FROM 'aguardando_aprovacao_cadastro' THEN
    RETURN NEW;
  END IF;
  IF OLD.status_contratacao = 'aguardando_aprovacao_cadastro' THEN
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
$$;

DROP TRIGGER IF EXISTS trg_troca_promove_cadastro_via_cotacao ON public.cotacoes;
CREATE TRIGGER trg_troca_promove_cadastro_via_cotacao
AFTER UPDATE OF status_contratacao ON public.cotacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_troca_promove_cadastro_via_cotacao();

-- Backfill: solicitações vivas em 'aguardando_cadastro' cuja cotação ainda não
-- atingiu 'aguardando_aprovacao_cadastro' (ou que sequer têm cotação) voltam
-- para 'cotacao_em_andamento'. Não toca em quem já passou para fases seguintes.
UPDATE public.solicitacoes_troca_titularidade s
   SET status = 'cotacao_em_andamento',
       updated_at = now()
  WHERE s.status = 'aguardando_cadastro'
    AND NOT EXISTS (
      SELECT 1 FROM public.cotacoes c
       WHERE c.id = s.cotacao_id
         AND c.status_contratacao IN (
           'aguardando_aprovacao_cadastro',
           'aguardando_aprovacao_monitoramento',
           'cadastro_aprovado',
           'monitoramento_aprovado',
           'vistoria_ok',
           'autovistoria_ok',
           'vistoria_agendada',
           'vistoria_concluida',
           'pagamento_ok',
           'contrato_gerado',
           'ativo'
         )
    );
