-- Função que atualiza os totais de rotas
CREATE OR REPLACE FUNCTION update_rota_totals()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a instalação foi vinculada a uma rota
  IF NEW.rota_id IS NOT NULL THEN
    UPDATE rotas 
    SET 
      total_servicos = (
        SELECT COUNT(*) 
        FROM instalacoes 
        WHERE rota_id = NEW.rota_id
      ),
      total_concluidos = (
        SELECT COUNT(*) 
        FROM instalacoes 
        WHERE rota_id = NEW.rota_id 
        AND status = 'concluida'
      ),
      updated_at = NOW()
    WHERE id = NEW.rota_id;
  END IF;
  
  -- Se a rota antiga era diferente, atualizar ela também
  IF TG_OP = 'UPDATE' AND OLD.rota_id IS NOT NULL AND OLD.rota_id IS DISTINCT FROM NEW.rota_id THEN
    UPDATE rotas 
    SET 
      total_servicos = (
        SELECT COUNT(*) 
        FROM instalacoes 
        WHERE rota_id = OLD.rota_id
      ),
      total_concluidos = (
        SELECT COUNT(*) 
        FROM instalacoes 
        WHERE rota_id = OLD.rota_id 
        AND status = 'concluida'
      ),
      updated_at = NOW()
    WHERE id = OLD.rota_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo (se existir) e criar novo
DROP TRIGGER IF EXISTS trigger_update_rota_totals ON instalacoes;

CREATE TRIGGER trigger_update_rota_totals
AFTER INSERT OR UPDATE OF rota_id, status ON instalacoes
FOR EACH ROW
EXECUTE FUNCTION update_rota_totals();

-- Atualizar totais existentes
UPDATE rotas r
SET 
  total_servicos = (
    SELECT COUNT(*) 
    FROM instalacoes i 
    WHERE i.rota_id = r.id
  ),
  total_concluidos = (
    SELECT COUNT(*) 
    FROM instalacoes i 
    WHERE i.rota_id = r.id 
    AND i.status = 'concluida'
  );