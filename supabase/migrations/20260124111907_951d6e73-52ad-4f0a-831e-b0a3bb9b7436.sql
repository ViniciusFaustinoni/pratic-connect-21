-- Correção 1: Voltar serviços órfãos para status 'agendada'
UPDATE servicos 
SET status = 'agendada', updated_at = NOW()
WHERE status IN ('em_rota', 'em_andamento') AND profissional_id IS NULL;

-- Correção 2: Voltar instalações órfãs para status 'agendada'
UPDATE instalacoes 
SET status = 'agendada', updated_at = NOW()
WHERE status IN ('em_rota', 'em_andamento') AND instalador_responsavel_id IS NULL;

-- Trigger para validar integridade de status em servicos
CREATE OR REPLACE FUNCTION validar_status_servico()
RETURNS TRIGGER AS $$
BEGIN
  -- Se status requer profissional, verificar se tem
  IF NEW.status IN ('em_rota', 'em_andamento') AND NEW.profissional_id IS NULL THEN
    RAISE EXCEPTION 'Status "%" requer um profissional atribuído', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_status_servico ON servicos;
CREATE TRIGGER trigger_validar_status_servico
BEFORE INSERT OR UPDATE ON servicos
FOR EACH ROW
EXECUTE FUNCTION validar_status_servico();

-- Trigger para validar integridade de status em instalacoes
CREATE OR REPLACE FUNCTION validar_status_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('em_rota', 'em_andamento') AND NEW.instalador_responsavel_id IS NULL THEN
    RAISE EXCEPTION 'Status "%" requer um instalador atribuído', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_status_instalacao ON instalacoes;
CREATE TRIGGER trigger_validar_status_instalacao
BEFORE INSERT OR UPDATE ON instalacoes
FOR EACH ROW
EXECUTE FUNCTION validar_status_instalacao();

-- Trigger para validar integridade de status em vistorias
CREATE OR REPLACE FUNCTION validar_status_vistoria()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('em_rota', 'em_andamento') AND NEW.vistoriador_id IS NULL THEN
    RAISE EXCEPTION 'Status "%" requer um vistoriador atribuído', NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_status_vistoria ON vistorias;
CREATE TRIGGER trigger_validar_status_vistoria
BEFORE INSERT OR UPDATE ON vistorias
FOR EACH ROW
EXECUTE FUNCTION validar_status_vistoria();