-- 1) Saneamento VINICIUS — reverter cancelamento equivocado de 26/05 18:50
UPDATE public.associados 
SET status = 'ativo',
    data_cancelamento = NULL,
    motivo_bloqueio = NULL,
    updated_at = now()
WHERE id = '5955e32d-46e8-4fa1-ab15-c2cef4812aa9'
  AND status = 'cancelado';

INSERT INTO public.logs_auditoria (tabela, registro_id, acao, descricao, dados_anteriores, dados_novos, usuario_nome, modulo)
VALUES ('associados','5955e32d-46e8-4fa1-ab15-c2cef4812aa9','editar',
        '[SANEAMENTO] Reverter cancelamento equivocado VINICIUS (HOA1B39): operador "Teste" cancelou associado em 26/05 18:50 sem cascata para contrato/veículo (que seguiam ativos). Restaurado para ativo. Causa-raiz: hook cancelarAssociado não cancelava contrato/veículo. Fix aplicado nesta mesma migration via trigger trg_cascata_cancelamento_associado.',
        jsonb_build_object('status','cancelado','motivo_bloqueio','cancelamento ','data_cancelamento','2026-05-26T18:50:55.180408+00:00'),
        jsonb_build_object('status','ativo','motivo_bloqueio',NULL,'data_cancelamento',NULL),
        'Saneamento Lovable','associados');

-- 2) Saneamento JEICIELI — veículo RJS3F11 ficou ativo após cancelamento de 19/05 (mesma falha)
UPDATE public.veiculos 
SET status = 'cancelado',
    cobertura_total = false,
    cobertura_roubo_furto = false,
    updated_at = now()
WHERE associado_id = '802159a5-9ca1-4270-8940-5cbf57ed5181'
  AND status = 'ativo';

INSERT INTO public.logs_auditoria (tabela, registro_id, acao, descricao, usuario_nome, modulo)
SELECT 'veiculos', v.id, 'editar',
       '[SANEAMENTO_CASCATA_CANCELAMENTO] Veículo ' || v.placa || ' (JEICIELI) cancelado em cascata. Associado e contrato estavam cancelados desde 19/05/2026 mas o veículo permanecia ativo por falha do hook cancelarAssociado (não cascateava). Causa-raiz idêntica ao caso VINICIUS/HOA1B39.',
       'Saneamento Lovable','veiculos'
FROM public.veiculos v
WHERE v.associado_id = '802159a5-9ca1-4270-8940-5cbf57ed5181';

-- 3) Guard DB: trigger AFTER UPDATE em associados que cascateia cancelamento
CREATE OR REPLACE FUNCTION public.fn_cascata_cancelamento_associado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato RECORD;
  v_veiculo RECORD;
  v_motivo text;
BEGIN
  -- Só dispara quando vira cancelado (transição)
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
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Erro em fn_cascata_cancelamento_associado: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascata_cancelamento_associado ON public.associados;
CREATE TRIGGER trg_cascata_cancelamento_associado
AFTER UPDATE OF status ON public.associados
FOR EACH ROW
WHEN (NEW.status = 'cancelado' AND OLD.status IS DISTINCT FROM 'cancelado')
EXECUTE FUNCTION public.fn_cascata_cancelamento_associado();