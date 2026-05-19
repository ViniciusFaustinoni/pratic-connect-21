
UPDATE public.contratos
   SET cadastro_aprovado = false, aprovado_por = NULL, aprovado_em = NULL
 WHERE id = '226eacc0-1938-4b5e-9ae1-fa9c209875d8';

UPDATE public.veiculos
   SET cobertura_roubo_furto = false
 WHERE id = '7719dcaa-d842-483a-b8d4-b92e30880c70';

UPDATE public.vistorias
   SET status = 'pendente', analisado_em = NULL, analisado_por = NULL
 WHERE id = '9cf4aafa-b870-4b01-99b7-4c1aaafe88b8';

UPDATE public.servicos
   SET status = 'em_analise', concluida_em = NULL,
       analisado_em = NULL, analisado_por = NULL, observacoes_analise = NULL
 WHERE id = 'a003b188-3867-4f8d-9c71-64afe6a9dd43';

UPDATE public.instalacoes
   SET status = 'agendada', concluida_em = NULL
 WHERE id = 'e31076b8-fafd-489b-a015-57c17e4ffbef';

UPDATE public.cotacoes
   SET status_contratacao = 'aguardando_aprovacao_cadastro'
 WHERE id = 'b50180dc-e4f0-420f-8f08-a07175ef0212';

UPDATE public.associados
   SET status = 'em_analise'
 WHERE id = 'd7b2d4c7-bf15-4c94-838f-0c6bb9db1463';

INSERT INTO public.associados_historico
  (associado_id, contrato_id, tipo, descricao, metadata)
VALUES
  ('d7b2d4c7-bf15-4c94-838f-0c6bb9db1463',
   '226eacc0-1938-4b5e-9ae1-fa9c209875d8',
   'status_alterado',
   'Caso devolvido à fila Cadastro › Propostas Pendentes para Aprovação de Roubo/Furto da autovistoria enxuta (regra canônica cadastro-escopo-canonico). Sanitação anterior havia liberado R/F sem decisão do Cadastro. Rewind manual aplicado.',
   jsonb_build_object(
     'placa','KRF8B74',
     'cotacao_id','b50180dc-e4f0-420f-8f08-a07175ef0212',
     'instalacao_id','e31076b8-fafd-489b-a015-57c17e4ffbef',
     'vistoria_id','9cf4aafa-b870-4b01-99b7-4c1aaafe88b8',
     'servico_id','a003b188-3867-4f8d-9c71-64afe6a9dd43',
     'acao','rewind_manual_fila_rf'
   ));

-- Guards
CREATE OR REPLACE FUNCTION public.fn_guard_instalacao_concluida_exige_cadastro_aprovado()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_cadastro_aprovado boolean;
BEGIN
  IF NEW.status = 'concluida'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.contrato_id IS NOT NULL THEN
    SELECT cadastro_aprovado INTO v_cadastro_aprovado
      FROM public.contratos WHERE id = NEW.contrato_id;
    IF COALESCE(v_cadastro_aprovado,false) = false THEN
      RAISE EXCEPTION 'cadastro_nao_aprovado: instalação % não pode ser concluída antes do Cadastro aprovar o contrato %.', NEW.id, NEW.contrato_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_instalacao_concluida_exige_cadastro_aprovado ON public.instalacoes;
CREATE TRIGGER trg_guard_instalacao_concluida_exige_cadastro_aprovado
  BEFORE UPDATE ON public.instalacoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_instalacao_concluida_exige_cadastro_aprovado();

CREATE OR REPLACE FUNCTION public.fn_guard_servico_autovistoria_concluida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_vist_status text;
BEGIN
  IF NEW.status = 'concluida'
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.tipo = 'vistoria_entrada'
     AND NEW.modalidade = 'autovistoria'
     AND NEW.vistoria_origem_id IS NOT NULL THEN
    SELECT status::text INTO v_vist_status
      FROM public.vistorias WHERE id = NEW.vistoria_origem_id;
    IF COALESCE(v_vist_status,'pendente') <> 'aprovada' THEN
      RAISE EXCEPTION 'autovistoria_nao_aprovada: serviço % (vistoria_entrada/autovistoria) não pode ser concluído sem a vistoria % estar aprovada (status: %).', NEW.id, NEW.vistoria_origem_id, v_vist_status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_servico_autovistoria_concluida ON public.servicos;
CREATE TRIGGER trg_guard_servico_autovistoria_concluida
  BEFORE UPDATE ON public.servicos
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_servico_autovistoria_concluida();

CREATE OR REPLACE FUNCTION public.fn_guard_cobertura_rf_exige_decisao_cadastro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_vist_aprovada boolean; v_contrato_aprovado boolean;
BEGIN
  IF COALESCE(OLD.cobertura_roubo_furto,false) = false
     AND COALESCE(NEW.cobertura_roubo_furto,false) = true THEN
    SELECT EXISTS (SELECT 1 FROM public.vistorias WHERE veiculo_id = NEW.id AND status = 'aprovada') INTO v_vist_aprovada;
    SELECT EXISTS (SELECT 1 FROM public.contratos WHERE veiculo_id = NEW.id AND cadastro_aprovado = true) INTO v_contrato_aprovado;
    IF NOT (v_vist_aprovada OR v_contrato_aprovado) THEN
      RAISE EXCEPTION 'rf_sem_decisao_cadastro: veículo % não pode receber cobertura_roubo_furto=true sem vistoria aprovada ou contrato aprovado pelo Cadastro.', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_cobertura_rf_exige_decisao_cadastro ON public.veiculos;
CREATE TRIGGER trg_guard_cobertura_rf_exige_decisao_cadastro
  BEFORE UPDATE ON public.veiculos
  FOR EACH ROW EXECUTE FUNCTION public.fn_guard_cobertura_rf_exige_decisao_cadastro();
