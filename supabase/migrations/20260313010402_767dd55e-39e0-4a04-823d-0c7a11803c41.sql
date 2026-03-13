
-- =============================================================
-- FIX: Prevent status rollback limbo on imprevisto flow
-- =============================================================

-- 1. Add nao_compareceu to status_instalacao enum
ALTER TYPE status_instalacao ADD VALUE IF NOT EXISTS 'nao_compareceu';

-- 2. Fix sync_servicos_to_instalacao: add nao_compareceu to allowed mappings
-- Also: do NOT update updated_at when status is not mappable (prevents reverse trigger)
CREATE OR REPLACE FUNCTION sync_servicos_to_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.instalacao_origem_id IS NOT NULL THEN
    -- Only update if the new status is mappable to status_instalacao
    IF NEW.status::text IN ('agendada', 'em_rota', 'em_andamento', 'concluida', 'reagendada', 'cancelada', 'em_analise', 'nao_compareceu') THEN
      UPDATE instalacoes
      SET 
        status = (NEW.status::text)::status_instalacao,
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id
        AND status::text IS DISTINCT FROM NEW.status::text;
    END IF;
    -- If status is not mappable (e.g. aprovada, reprovada), do nothing — no updated_at touch
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Fix sync_instalacao_update_to_servicos: only sync when status ACTUALLY changed
-- This prevents the reverse trigger from overwriting servicos.status on unrelated updates
CREATE OR REPLACE FUNCTION sync_instalacao_update_to_servicos()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update servicos if the instalacao status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE servicos
    SET 
      status = (NEW.status::text)::status_servico,
      profissional_id = NEW.instalador_responsavel_id,
      data_agendada = NEW.data_agendada,
      hora_agendada = NEW.hora_agendada,
      periodo = (NEW.periodo::text)::periodo_servico,
      latitude = NEW.endereco_latitude,
      longitude = NEW.endereco_longitude,
      logradouro = NEW.logradouro,
      numero = NEW.numero,
      bairro = NEW.bairro,
      cidade = NEW.cidade,
      uf = NEW.uf,
      cep = NEW.cep,
      permite_encaixe = COALESCE(NEW.permite_encaixe, false),
      local_vistoria = COALESCE(NEW.local_vistoria, 'cliente'),
      rota_id = NEW.rota_id,
      updated_at = NOW()
    WHERE instalacao_origem_id = NEW.id;
  ELSE
    -- Status didn't change, only sync non-status fields (address, profissional, etc.)
    UPDATE servicos
    SET 
      profissional_id = NEW.instalador_responsavel_id,
      data_agendada = NEW.data_agendada,
      hora_agendada = NEW.hora_agendada,
      periodo = (NEW.periodo::text)::periodo_servico,
      latitude = NEW.endereco_latitude,
      longitude = NEW.endereco_longitude,
      logradouro = NEW.logradouro,
      numero = NEW.numero,
      bairro = NEW.bairro,
      cidade = NEW.cidade,
      uf = NEW.uf,
      cep = NEW.cep,
      permite_encaixe = COALESCE(NEW.permite_encaixe, false),
      local_vistoria = COALESCE(NEW.local_vistoria, 'cliente'),
      rota_id = NEW.rota_id,
      updated_at = NOW()
    WHERE instalacao_origem_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger with condition: only fire when something actually changed
DROP TRIGGER IF EXISTS trigger_sync_instalacao_update_to_servicos ON instalacoes;
CREATE TRIGGER trigger_sync_instalacao_update_to_servicos
AFTER UPDATE ON instalacoes
FOR EACH ROW
EXECUTE FUNCTION sync_instalacao_update_to_servicos();
