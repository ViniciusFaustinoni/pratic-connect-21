-- =============================================================================
-- CORREÇÃO: Função cancelar_servicos_ao_cancelar_cotacao com valores corretos
-- Problema: Usava 'reprovada' e 'perdida' que não existem no enum status_cotacao
-- Solução: Usar 'recusada' e 'expirada' que são valores válidos
-- =============================================================================

CREATE OR REPLACE FUNCTION cancelar_servicos_ao_cancelar_cotacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Usar 'recusada' e 'expirada' que existem no enum status_cotacao
  -- (valores anteriores 'reprovada' e 'perdida' não existiam no enum)
  IF TG_OP = 'UPDATE' AND NEW.status IN ('recusada', 'expirada') AND OLD.status NOT IN ('recusada', 'expirada') THEN
    UPDATE servicos 
    SET status = 'cancelada', 
        updated_at = now(),
        observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelado automaticamente: cotação ' || NEW.status::text
    WHERE cotacao_id = NEW.id 
      AND status NOT IN ('concluida', 'cancelada', 'aprovada', 'reprovada');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;