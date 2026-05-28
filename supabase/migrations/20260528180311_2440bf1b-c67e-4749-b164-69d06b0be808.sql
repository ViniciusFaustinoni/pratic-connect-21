DO $$
DECLARE
  v_cotacao_id constant uuid := '45d67b5d-7946-481c-a9f9-9bf7c5f03ce4';
  v_veiculo_id constant uuid := '7bbd9ca1-49ec-4be2-957f-cd7fe5804847';
  v_associado_antigo_id constant uuid := '0c43955a-a63e-45a5-884b-c34f7b2e60ea';
  v_solicitacao_id uuid;
  v_nome text;
  v_telefone text;
BEGIN
  SELECT id INTO v_solicitacao_id FROM public.solicitacoes_troca_titularidade WHERE cotacao_id = v_cotacao_id LIMIT 1;
  IF v_solicitacao_id IS NULL THEN
    SELECT nome_solicitante, telefone1_solicitante INTO v_nome, v_telefone FROM public.cotacoes WHERE id = v_cotacao_id;
    INSERT INTO public.solicitacoes_troca_titularidade (associado_antigo_id, veiculo_id, cotacao_id, status, novo_titular_dados)
    VALUES (v_associado_antigo_id, v_veiculo_id, v_cotacao_id, 'aguardando_termo_cancelamento', jsonb_build_object('nome', v_nome, 'telefone', v_telefone))
    RETURNING id INTO v_solicitacao_id;
  END IF;
  UPDATE public.cotacoes SET dados_extras = COALESCE(dados_extras, '{}'::jsonb) || jsonb_build_object('solicitacao_troca_id', v_solicitacao_id::text), updated_at = now() WHERE id = v_cotacao_id;
  INSERT INTO public.logs_auditoria (acao, descricao, tabela, registro_id, dados_novos)
  VALUES ('criar', '[SANEAMENTO_TROCA] Solicitação faltante criada para cotação órfã COT-20260528-142801654-756 (SRZ2E82, FERNANDO BENTO -> ANDERSON LIMA AGUIAR). Causa raiz: cotação tipo_entrada=troca_titularidade sem solicitacao_troca_id em dados_extras. Mitigação: trigger trg_guard_cotacao_troca_exige_solicitacao.', 'solicitacoes_troca_titularidade', v_solicitacao_id, jsonb_build_object('cotacao_id', v_cotacao_id, 'veiculo_id', v_veiculo_id, 'associado_antigo_id', v_associado_antigo_id));
END $$;

CREATE OR REPLACE FUNCTION public.fn_guard_cotacao_troca_exige_solicitacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_solicitacao_id uuid; v_existe boolean;
BEGIN
  IF NEW.tipo_entrada IS DISTINCT FROM 'troca_titularidade' THEN RETURN NEW; END IF;
  v_solicitacao_id := NULLIF(NEW.dados_extras->>'solicitacao_troca_id', '')::uuid;
  IF v_solicitacao_id IS NULL THEN
    RAISE EXCEPTION 'COTACAO_TROCA_SEM_SOLICITACAO: cotação tipo_entrada=troca_titularidade exige dados_extras.solicitacao_troca_id'
      USING ERRCODE = 'P0001', HINT = 'Crie a solicitação via criar-solicitacao-troca-titularidade antes de gerar a cotação, ou inclua solicitacao_troca_id no payload (CotacaoFormDialog origemTroca).';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.solicitacoes_troca_titularidade WHERE id = v_solicitacao_id) INTO v_existe;
  IF NOT v_existe THEN
    RAISE EXCEPTION 'COTACAO_TROCA_SOLICITACAO_INEXISTENTE: solicitacao_troca_id=% não encontrado', v_solicitacao_id USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_cotacao_troca_exige_solicitacao ON public.cotacoes;
CREATE TRIGGER trg_guard_cotacao_troca_exige_solicitacao
  BEFORE INSERT OR UPDATE OF tipo_entrada, dados_extras ON public.cotacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_cotacao_troca_exige_solicitacao();