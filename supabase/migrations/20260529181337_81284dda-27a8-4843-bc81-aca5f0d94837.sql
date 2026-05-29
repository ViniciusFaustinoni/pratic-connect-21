-- Cascata canônica de negação de veículo
-- Quando veiculos.status passa para 'recusado', cancelar todos os serviços
-- ativos vinculados e registrar em logs_auditoria.

CREATE OR REPLACE FUNCTION public.fn_cascata_negacao_veiculo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelados int := 0;
BEGIN
  IF NEW.status = 'recusado'
     AND (OLD.status IS DISTINCT FROM 'recusado') THEN

    UPDATE public.servicos
       SET status = 'cancelada',
           observacoes = COALESCE(observacoes, '') ||
             CASE WHEN COALESCE(observacoes,'') = '' THEN '' ELSE E'\n' END ||
             '[cancelado por negação do veículo] motivo=' ||
             COALESCE(NEW.motivo_recusa_veiculo, 'sem motivo registrado'),
           updated_at = now()
     WHERE veiculo_id = NEW.id
       AND status IN ('pendente','agendada','em_rota','em_andamento');

    GET DIAGNOSTICS v_cancelados = ROW_COUNT;

    BEGIN
      INSERT INTO public.logs_auditoria (
        usuario_id, acao, tabela, registro_id, descricao,
        dados_anteriores, dados_novos, modulo
      ) VALUES (
        NULL, 'atualizar', 'veiculos', NEW.id,
        '[VEICULO_NEGADO] ' || COALESCE(NEW.motivo_recusa_veiculo, 'sem motivo') ||
          ' — ' || v_cancelados || ' serviço(s) cancelado(s) em cascata',
        jsonb_build_object('status', OLD.status),
        jsonb_build_object('status', NEW.status,
                           'servicos_cancelados', v_cancelados,
                           'motivo', NEW.motivo_recusa_veiculo),
        'monitoramento'
      );
    EXCEPTION WHEN OTHERS THEN
      -- Não deve quebrar a transação por falha de log
      RAISE WARNING '[fn_cascata_negacao_veiculo] log falhou: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascata_negacao_veiculo ON public.veiculos;
CREATE TRIGGER trg_cascata_negacao_veiculo
AFTER UPDATE OF status ON public.veiculos
FOR EACH ROW
WHEN (NEW.status = 'recusado' AND OLD.status IS DISTINCT FROM 'recusado')
EXECUTE FUNCTION public.fn_cascata_negacao_veiculo();