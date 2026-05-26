
-- Estende cascata de cancelamento de associado para incluir:
--   servicos, agendamentos_base, instalacoes e cotacoes vinculados.
-- Motivo: antes, cancelar associado deixava servicos/instalacoes/agendamentos vivos,
-- e a fila Aprovação de Associados continuava listando o cancelado (caso VINICIUS HOA1B39).

CREATE OR REPLACE FUNCTION public.fn_cascata_cancelamento_associado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato RECORD;
  v_veiculo RECORD;
  v_servico RECORD;
  v_agend RECORD;
  v_inst RECORD;
  v_cot RECORD;
  v_motivo text;
  v_contrato_ids uuid[];
  v_veiculo_ids uuid[];
BEGIN
  IF NEW.status = 'cancelado' AND (OLD.status IS DISTINCT FROM 'cancelado') THEN
    v_motivo := COALESCE(NULLIF(TRIM(NEW.motivo_bloqueio),''), 'cancelamento_associado');

    -- Cascata contratos ativos
    FOR v_contrato IN
      SELECT id FROM public.contratos WHERE associado_id = NEW.id AND status = 'ativo'
    LOOP
      UPDATE public.contratos
      SET status = 'cancelado',
          data_cancelamento = COALESCE(data_cancelamento, now()),
          updated_at = now()
      WHERE id = v_contrato.id;

      INSERT INTO public.logs_auditoria (tabela, registro_id, acao, descricao, usuario_nome, modulo)
      VALUES ('contratos', v_contrato.id, 'cancelar',
              '[CASCATA_CANCELAMENTO_ASSOCIADO] Contrato cancelado em cascata pelo cancelamento do associado ' || NEW.nome || ' (motivo: ' || v_motivo || ')',
              'Sistema (cascata)', 'contratos');
    END LOOP;

    -- Cascata veículos ativos
    FOR v_veiculo IN
      SELECT id, placa FROM public.veiculos WHERE associado_id = NEW.id AND status = 'ativo'
    LOOP
      UPDATE public.veiculos
      SET status = 'cancelado',
          cobertura_total = false,
          cobertura_roubo_furto = false,
          updated_at = now()
      WHERE id = v_veiculo.id;

      INSERT INTO public.logs_auditoria (tabela, registro_id, acao, descricao, usuario_nome, modulo)
      VALUES ('veiculos', v_veiculo.id, 'cancelar',
              '[CASCATA_CANCELAMENTO_ASSOCIADO] Veículo ' || v_veiculo.placa || ' cancelado em cascata pelo cancelamento do associado ' || NEW.nome || ' (motivo: ' || v_motivo || '). Coberturas total/R-F desativadas.',
              'Sistema (cascata)', 'veiculos');
    END LOOP;

    -- Coleta universo (após updates acima) para cancelar workflow vinculado
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO v_contrato_ids
      FROM public.contratos WHERE associado_id = NEW.id;
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
      INTO v_veiculo_ids
      FROM public.veiculos WHERE associado_id = NEW.id;

    -- Cancela serviços vivos (filas Cadastro/Monitoramento/Serviços de Campo).
    -- Mantém 'aprovada' e 'reprovada' (terminais já decididos) e 'cancelada' (idempotência).
    FOR v_servico IN
      SELECT id, tipo FROM public.servicos
      WHERE (associado_id = NEW.id
             OR (contrato_id = ANY(v_contrato_ids) AND v_contrato_ids <> ARRAY[]::uuid[])
             OR (veiculo_id  = ANY(v_veiculo_ids)  AND v_veiculo_ids  <> ARRAY[]::uuid[]))
        AND status NOT IN ('cancelada','aprovada','reprovada')
    LOOP
      UPDATE public.servicos
      SET status = 'cancelada', updated_at = now()
      WHERE id = v_servico.id;

      INSERT INTO public.logs_auditoria (tabela, registro_id, acao, descricao, usuario_nome, modulo)
      VALUES ('servicos', v_servico.id, 'cancelar',
              '[CASCATA_CANCELAMENTO_ASSOCIADO] Serviço (' || v_servico.tipo || ') cancelado pelo cancelamento do associado ' || NEW.nome,
              'Sistema (cascata)', 'servicos');
    END LOOP;

    -- Cancela agendamentos_base abertos
    FOR v_agend IN
      SELECT id FROM public.agendamentos_base
      WHERE (associado_id = NEW.id
             OR (contrato_id = ANY(v_contrato_ids) AND v_contrato_ids <> ARRAY[]::uuid[]))
        AND status NOT IN ('cancelado','realizado','nao_compareceu')
    LOOP
      UPDATE public.agendamentos_base
      SET status = 'cancelado', updated_at = now()
      WHERE id = v_agend.id;

      INSERT INTO public.logs_auditoria (tabela, registro_id, acao, descricao, usuario_nome, modulo)
      VALUES ('agendamentos_base', v_agend.id, 'cancelar',
              '[CASCATA_CANCELAMENTO_ASSOCIADO] Agendamento cancelado pelo cancelamento do associado ' || NEW.nome,
              'Sistema (cascata)', 'agendamentos');
    END LOOP;

    -- Cancela instalações em aberto
    FOR v_inst IN
      SELECT id FROM public.instalacoes
      WHERE (contrato_id = ANY(v_contrato_ids) AND v_contrato_ids <> ARRAY[]::uuid[])
        AND status NOT IN ('cancelada','concluida','nao_compareceu')
    LOOP
      UPDATE public.instalacoes
      SET status = 'cancelada', updated_at = now()
      WHERE id = v_inst.id;

      INSERT INTO public.logs_auditoria (tabela, registro_id, acao, descricao, usuario_nome, modulo)
      VALUES ('instalacoes', v_inst.id, 'cancelar',
              '[CASCATA_CANCELAMENTO_ASSOCIADO] Instalação cancelada pelo cancelamento do associado ' || NEW.nome,
              'Sistema (cascata)', 'instalacoes');
    END LOOP;

    -- Cancela cotações em aberto (rascunho/enviada/liberada/aceita)
    FOR v_cot IN
      SELECT id FROM public.cotacoes
      WHERE associado_id = NEW.id
        AND status IN ('rascunho','enviada','liberada','aceita')
    LOOP
      UPDATE public.cotacoes
      SET status = 'cancelada', updated_at = now()
      WHERE id = v_cot.id;

      INSERT INTO public.logs_auditoria (tabela, registro_id, acao, descricao, usuario_nome, modulo)
      VALUES ('cotacoes', v_cot.id, 'cancelar',
              '[CASCATA_CANCELAMENTO_ASSOCIADO] Cotação cancelada pelo cancelamento do associado ' || NEW.nome,
              'Sistema (cascata)', 'cotacoes');
    END LOOP;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro em fn_cascata_cancelamento_associado: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Saneamento VINICIUS DE ANDRADE BARROS SANTOS (HOA1B39):
-- Serviço de instalação concluído ficou vivo após cancelamento e seguia na fila do Monitoramento.
UPDATE public.servicos
SET status = 'cancelada', updated_at = now()
WHERE id = '58089a31-50d0-4d96-a95b-ae3c9d331b0f'
  AND status = 'concluida';

INSERT INTO public.logs_auditoria (tabela, registro_id, acao, descricao, usuario_nome, modulo)
SELECT 'servicos', '58089a31-50d0-4d96-a95b-ae3c9d331b0f'::uuid, 'cancelar',
       '[SANEAMENTO_CASCATA_CANCELAMENTO] Serviço de instalação cancelado retroativamente (associado VINICIUS HOA1B39 estava cancelado mas item seguia na fila Aprovação de Associados).',
       'Sistema (saneamento)', 'servicos'
WHERE EXISTS (SELECT 1 FROM public.servicos WHERE id='58089a31-50d0-4d96-a95b-ae3c9d331b0f' AND status='cancelada');
