-- =====================================================
-- BACKFILL: Corrigir vistorias existentes que têm instalação
-- com rota, mas a própria vistoria está sem rota_id
-- =====================================================

-- 1. Backfill por contrato_id: instalaçao tem rota -> vistoria herda
UPDATE vistorias v
SET 
  rota_id = i.rota_id,
  vistoriador_id = COALESCE(v.vistoriador_id, i.instalador_responsavel_id)
FROM instalacoes i
WHERE v.contrato_id IS NOT NULL
  AND i.contrato_id = v.contrato_id
  AND i.rota_id IS NOT NULL
  AND v.rota_id IS NULL
  AND v.status IN ('pendente', 'em_analise', 'agendada');

-- 2. Backfill por cotacao_id: instalação tem rota -> vistoria herda
UPDATE vistorias v
SET 
  rota_id = i.rota_id,
  vistoriador_id = COALESCE(v.vistoriador_id, i.instalador_responsavel_id)
FROM instalacoes i
WHERE v.cotacao_id IS NOT NULL
  AND i.cotacao_id = v.cotacao_id
  AND i.rota_id IS NOT NULL
  AND v.rota_id IS NULL
  AND v.status IN ('pendente', 'em_analise', 'agendada');

-- 3. Backfill por instalacao_id direto
UPDATE vistorias v
SET 
  rota_id = i.rota_id,
  vistoriador_id = COALESCE(v.vistoriador_id, i.instalador_responsavel_id)
FROM instalacoes i
WHERE v.instalacao_id IS NOT NULL
  AND i.id = v.instalacao_id
  AND i.rota_id IS NOT NULL
  AND v.rota_id IS NULL
  AND v.status IN ('pendente', 'em_analise', 'agendada');

-- =====================================================
-- TRIGGER: Sincronizar vistorias automaticamente quando
-- instalacoes.rota_id mudar
-- =====================================================

CREATE OR REPLACE FUNCTION sync_vistorias_rota_on_instalacao_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Só executar se rota_id mudou
  IF OLD.rota_id IS DISTINCT FROM NEW.rota_id THEN
    -- Atualizar vistorias vinculadas por instalacao_id
    UPDATE vistorias
    SET 
      rota_id = NEW.rota_id,
      vistoriador_id = CASE 
        WHEN NEW.rota_id IS NOT NULL THEN COALESCE(NEW.instalador_responsavel_id, vistoriador_id)
        ELSE vistoriador_id -- Não limpar vistoriador ao remover da rota
      END
    WHERE instalacao_id = NEW.id
      AND status IN ('pendente', 'em_analise', 'agendada');
    
    -- Atualizar vistorias vinculadas por contrato_id
    IF NEW.contrato_id IS NOT NULL THEN
      UPDATE vistorias
      SET 
        rota_id = NEW.rota_id,
        vistoriador_id = CASE 
          WHEN NEW.rota_id IS NOT NULL THEN COALESCE(NEW.instalador_responsavel_id, vistoriador_id)
          ELSE vistoriador_id
        END
      WHERE contrato_id = NEW.contrato_id
        AND status IN ('pendente', 'em_analise', 'agendada')
        AND (rota_id IS NULL OR rota_id = OLD.rota_id); -- Só atualizar se não tiver rota ou tiver a mesma rota antiga
    END IF;
    
    -- Atualizar vistorias vinculadas por cotacao_id
    IF NEW.cotacao_id IS NOT NULL THEN
      UPDATE vistorias
      SET 
        rota_id = NEW.rota_id,
        vistoriador_id = CASE 
          WHEN NEW.rota_id IS NOT NULL THEN COALESCE(NEW.instalador_responsavel_id, vistoriador_id)
          ELSE vistoriador_id
        END
      WHERE cotacao_id = NEW.cotacao_id
        AND status IN ('pendente', 'em_analise', 'agendada')
        AND (rota_id IS NULL OR rota_id = OLD.rota_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Dropar trigger se existir e criar novamente
DROP TRIGGER IF EXISTS trigger_sync_vistorias_rota ON instalacoes;

CREATE TRIGGER trigger_sync_vistorias_rota
  AFTER UPDATE OF rota_id ON instalacoes
  FOR EACH ROW
  EXECUTE FUNCTION sync_vistorias_rota_on_instalacao_update();