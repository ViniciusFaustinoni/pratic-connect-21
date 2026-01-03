-- =============================================
-- FUNCTIONS PARA MÓDULO COBRANÇA
-- =============================================

-- Verificar se acordo está quebrado (parcela vencida há mais de X dias)
CREATE OR REPLACE FUNCTION verificar_acordos_quebrados()
RETURNS INTEGER AS $$
DECLARE
  qtd_quebrados INTEGER := 0;
BEGIN
  UPDATE acordos a
  SET 
    status = 'quebrado',
    motivo_quebra = 'Parcela vencida sem pagamento',
    updated_at = NOW()
  WHERE a.status = 'ativo'
  AND EXISTS (
    SELECT 1 FROM acordo_parcelas p
    WHERE p.acordo_id = a.id
    AND p.status = 'pendente'
    AND p.data_vencimento < CURRENT_DATE - INTERVAL '15 days'
  );
  
  GET DIAGNOSTICS qtd_quebrados = ROW_COUNT;
  RETURN qtd_quebrados;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Atualizar parcelas vencidas
CREATE OR REPLACE FUNCTION atualizar_parcelas_vencidas()
RETURNS INTEGER AS $$
DECLARE
  qtd_atualizadas INTEGER;
BEGIN
  UPDATE acordo_parcelas
  SET status = 'vencido'
  WHERE status = 'pendente'
  AND data_vencimento < CURRENT_DATE;
  
  GET DIAGNOSTICS qtd_atualizadas = ROW_COUNT;
  RETURN qtd_atualizadas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Adicionar à fila de cobrança
CREATE OR REPLACE FUNCTION adicionar_fila_cobranca(
  p_associado_id UUID,
  p_cobranca_id UUID,
  p_motivo VARCHAR,
  p_prioridade INTEGER DEFAULT 5
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM cobranca_fila
  WHERE associado_id = p_associado_id
  AND status IN ('pendente', 'em_atendimento');
  
  IF v_id IS NOT NULL THEN
    UPDATE cobranca_fila
    SET prioridade = GREATEST(prioridade, p_prioridade),
        updated_at = NOW()
    WHERE id = v_id;
    RETURN v_id;
  END IF;
  
  INSERT INTO cobranca_fila (
    associado_id, cobranca_id, motivo, prioridade, status, data_agendamento
  ) VALUES (
    p_associado_id, p_cobranca_id, p_motivo, p_prioridade, 'pendente', NOW()
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger function: quando cobrança vence, adiciona à fila
CREATE OR REPLACE FUNCTION on_cobranca_vencida()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'vencido' AND OLD.status != 'vencido' THEN
    PERFORM adicionar_fila_cobranca(
      NEW.associado_id,
      NEW.id,
      'vencido',
      CASE 
        WHEN CURRENT_DATE - NEW.data_vencimento > 60 THEN 9
        WHEN CURRENT_DATE - NEW.data_vencimento > 30 THEN 7
        ELSE 5
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop trigger if exists and create
DROP TRIGGER IF EXISTS trigger_cobranca_vencida ON cobrancas;

CREATE TRIGGER trigger_cobranca_vencida
  AFTER UPDATE ON cobrancas
  FOR EACH ROW
  EXECUTE FUNCTION on_cobranca_vencida();