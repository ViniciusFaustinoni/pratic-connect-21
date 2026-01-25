-- Trigger para sincronizar status de servicos para instalacoes
CREATE OR REPLACE FUNCTION sync_servico_to_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Só propagar quando status muda para concluida
  IF NEW.tipo = 'instalacao' AND NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE instalacoes
    SET 
      status = 'concluida',
      concluida_em = COALESCE(NEW.concluida_em, NOW()),
      instalador_responsavel_id = COALESCE(NEW.profissional_id, instalador_responsavel_id),
      updated_at = NOW()
    WHERE contrato_id = NEW.contrato_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_sync_servico_to_instalacao ON servicos;
CREATE TRIGGER trigger_sync_servico_to_instalacao
AFTER UPDATE ON servicos
FOR EACH ROW
EXECUTE FUNCTION sync_servico_to_instalacao();

-- Corrigir dados existentes do contrato atual
UPDATE instalacoes 
SET status = 'concluida', 
    concluida_em = '2026-01-25 13:23:48.301+00',
    updated_at = NOW()
WHERE contrato_id = '8a385cf8-4bc5-4990-89a3-35d5ed3a5031';

UPDATE associados 
SET status = 'em_analise',
    updated_at = NOW()
WHERE id = '03dd7fe8-c6ed-49cb-8354-99a7dff90b8e';