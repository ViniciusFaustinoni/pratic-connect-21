
-- ============================================================================
-- Camada 2: idempotência por chave de negócio (solicitacao_troca_id)
-- ============================================================================
-- Trigger BEFORE INSERT em cotacoes que, quando tipo_entrada='troca_titularidade'
-- e dados_extras->>'solicitacao_troca_id' está presente, garante que NÃO existe
-- outra cotação ativa (status NOT IN ('cancelada','expirada')) para a mesma
-- solicitação. Roda na mesma transação do insert, com pg_advisory_xact_lock
-- por solicitação para serializar dois inserts concorrentes.
--
-- Em caso de duplicata, levanta erro com MESSAGE no formato:
--   COTACAO_TROCA_DUPLICADA:<cotacao_id_existente>:<numero_existente>
-- O front parseia a string para oferecer "abrir cotação existente".

CREATE OR REPLACE FUNCTION public.fn_guard_cotacao_troca_idempotente()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solicitacao_id uuid;
  v_existente record;
BEGIN
  -- Só atua em cotação de troca de titularidade com solicitação vinculada
  IF NEW.tipo_entrada IS DISTINCT FROM 'troca_titularidade' THEN
    RETURN NEW;
  END IF;

  v_solicitacao_id := NULLIF(NEW.dados_extras->>'solicitacao_troca_id', '')::uuid;
  IF v_solicitacao_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serializa duas inserções concorrentes pela mesma solicitação (cliques
  -- simultâneos do botão "Realizar Cotação"). Lock é liberado no fim da
  -- transação automaticamente.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('cotacao_troca:' || v_solicitacao_id::text, 0)
  );

  -- Checagem dentro do mesmo escopo transacional: se já existe ativa, recusa.
  SELECT id, numero
    INTO v_existente
    FROM public.cotacoes
   WHERE tipo_entrada = 'troca_titularidade'
     AND status NOT IN ('cancelada', 'expirada')
     AND (dados_extras->>'solicitacao_troca_id')::uuid = v_solicitacao_id
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'COTACAO_TROCA_DUPLICADA:%:%',
      v_existente.id,
      COALESCE(v_existente.numero, '')
      USING ERRCODE = 'P0001',
            HINT = 'Já existe cotação em andamento para esta solicitação de troca de titularidade.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_cotacao_troca_idempotente ON public.cotacoes;
CREATE TRIGGER trg_guard_cotacao_troca_idempotente
  BEFORE INSERT ON public.cotacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_guard_cotacao_troca_idempotente();

COMMENT ON FUNCTION public.fn_guard_cotacao_troca_idempotente() IS
'Camada 2 da prevenção de cotação duplicada em Troca de Titularidade. Serializa inserts concorrentes da mesma solicitacao_troca_id via advisory_xact_lock e recusa o segundo com SQLSTATE P0001 + MESSAGE no formato COTACAO_TROCA_DUPLICADA:<id>:<numero>. Camada 3 (UNIQUE index) é rede de segurança final, ainda não aplicada (aguarda limpeza de duplicados legados).';
