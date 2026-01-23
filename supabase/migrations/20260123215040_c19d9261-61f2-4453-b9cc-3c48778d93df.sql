
-- 1. Limpar serviço órfão atual
UPDATE servicos 
SET status = 'cancelada', 
    updated_at = now(),
    observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelado automaticamente: origem excluída'
WHERE id = 'cbd3d504-c721-4a78-b2d1-05f3847d930a';

-- 2. Criar função para cancelar serviços quando instalação for cancelada ou deletada
CREATE OR REPLACE FUNCTION public.cancelar_servicos_ao_cancelar_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a instalação foi cancelada, cancelar serviços relacionados
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelada' AND OLD.status != 'cancelada' THEN
    UPDATE servicos 
    SET status = 'cancelada', 
        updated_at = now(),
        observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelado automaticamente: instalação cancelada'
    WHERE instalacao_origem_id = NEW.id 
      AND status NOT IN ('concluida', 'cancelada', 'aprovada', 'reprovada');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Criar função para cancelar serviços quando instalação for deletada
CREATE OR REPLACE FUNCTION public.cancelar_servicos_ao_deletar_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE servicos 
  SET status = 'cancelada', 
      updated_at = now(),
      observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelado automaticamente: instalação excluída'
  WHERE instalacao_origem_id = OLD.id 
    AND status NOT IN ('concluida', 'cancelada', 'aprovada', 'reprovada');
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Criar função para cancelar serviços quando vistoria for cancelada ou deletada
CREATE OR REPLACE FUNCTION public.cancelar_servicos_ao_cancelar_vistoria()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = 'cancelada' AND OLD.status != 'cancelada' THEN
    UPDATE servicos 
    SET status = 'cancelada', 
        updated_at = now(),
        observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelado automaticamente: vistoria cancelada'
    WHERE vistoria_origem_id = NEW.id 
      AND status NOT IN ('concluida', 'cancelada', 'aprovada', 'reprovada');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.cancelar_servicos_ao_deletar_vistoria()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE servicos 
  SET status = 'cancelada', 
      updated_at = now(),
      observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelado automaticamente: vistoria excluída'
  WHERE vistoria_origem_id = OLD.id 
    AND status NOT IN ('concluida', 'cancelada', 'aprovada', 'reprovada');
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Criar função para cancelar serviços quando cotação for cancelada/reprovada/perdida
CREATE OR REPLACE FUNCTION public.cancelar_servicos_ao_cancelar_cotacao()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IN ('reprovada', 'perdida') AND OLD.status NOT IN ('reprovada', 'perdida') THEN
    UPDATE servicos 
    SET status = 'cancelada', 
        updated_at = now(),
        observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelado automaticamente: cotação ' || NEW.status
    WHERE cotacao_id = NEW.id 
      AND status NOT IN ('concluida', 'cancelada', 'aprovada', 'reprovada');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.cancelar_servicos_ao_deletar_cotacao()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE servicos 
  SET status = 'cancelada', 
      updated_at = now(),
      observacoes = COALESCE(observacoes || ' | ', '') || 'Cancelado automaticamente: cotação excluída'
  WHERE cotacao_id = OLD.id 
    AND status NOT IN ('concluida', 'cancelada', 'aprovada', 'reprovada');
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Criar triggers para instalações
DROP TRIGGER IF EXISTS trigger_cancelar_servicos_instalacao_update ON instalacoes;
CREATE TRIGGER trigger_cancelar_servicos_instalacao_update
  AFTER UPDATE ON instalacoes
  FOR EACH ROW
  EXECUTE FUNCTION cancelar_servicos_ao_cancelar_instalacao();

DROP TRIGGER IF EXISTS trigger_cancelar_servicos_instalacao_delete ON instalacoes;
CREATE TRIGGER trigger_cancelar_servicos_instalacao_delete
  BEFORE DELETE ON instalacoes
  FOR EACH ROW
  EXECUTE FUNCTION cancelar_servicos_ao_deletar_instalacao();

-- 7. Criar triggers para vistorias
DROP TRIGGER IF EXISTS trigger_cancelar_servicos_vistoria_update ON vistorias;
CREATE TRIGGER trigger_cancelar_servicos_vistoria_update
  AFTER UPDATE ON vistorias
  FOR EACH ROW
  EXECUTE FUNCTION cancelar_servicos_ao_cancelar_vistoria();

DROP TRIGGER IF EXISTS trigger_cancelar_servicos_vistoria_delete ON vistorias;
CREATE TRIGGER trigger_cancelar_servicos_vistoria_delete
  BEFORE DELETE ON vistorias
  FOR EACH ROW
  EXECUTE FUNCTION cancelar_servicos_ao_deletar_vistoria();

-- 8. Criar triggers para cotações
DROP TRIGGER IF EXISTS trigger_cancelar_servicos_cotacao_update ON cotacoes;
CREATE TRIGGER trigger_cancelar_servicos_cotacao_update
  AFTER UPDATE ON cotacoes
  FOR EACH ROW
  EXECUTE FUNCTION cancelar_servicos_ao_cancelar_cotacao();

DROP TRIGGER IF EXISTS trigger_cancelar_servicos_cotacao_delete ON cotacoes;
CREATE TRIGGER trigger_cancelar_servicos_cotacao_delete
  BEFORE DELETE ON cotacoes
  FOR EACH ROW
  EXECUTE FUNCTION cancelar_servicos_ao_deletar_cotacao();
