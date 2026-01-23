-- =============================================================================
-- SOLUÇÃO DEFINITIVA: Sincronização automática instalacoes/vistorias -> servicos
-- Mapeamento correto de tipos e colunas
-- =============================================================================

-- Função auxiliar para mapear tipo de vistoria para tipo_servico
CREATE OR REPLACE FUNCTION map_vistoria_tipo_to_servico(p_tipo text)
RETURNS tipo_servico AS $$
BEGIN
  RETURN CASE p_tipo
    WHEN 'saida' THEN 'vistoria_saida'::tipo_servico
    WHEN 'sinistro' THEN 'vistoria_sinistro'::tipo_servico
    WHEN 'periodica' THEN 'vistoria_periodica'::tipo_servico
    WHEN 'manutencao' THEN 'vistoria_manutencao'::tipo_servico
    WHEN 'cancelamento' THEN 'vistoria_saida'::tipo_servico -- cancelamento mapeia para saida
    ELSE 'vistoria_entrada'::tipo_servico -- default para entrada/outros
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- 1. FUNÇÃO: Criar servico quando instalacao é inserida
CREATE OR REPLACE FUNCTION sync_instalacao_to_servicos()
RETURNS TRIGGER AS $$
BEGIN
  -- Só cria se não existir já um servico para esta instalacao
  IF NOT EXISTS (SELECT 1 FROM servicos WHERE instalacao_origem_id = NEW.id) THEN
    INSERT INTO servicos (
      tipo,
      status,
      data_agendada,
      hora_agendada,
      periodo,
      associado_id,
      veiculo_id,
      latitude,
      longitude,
      logradouro,
      numero,
      bairro,
      cidade,
      uf,
      cep,
      permite_encaixe,
      local_vistoria,
      cotacao_id,
      contrato_id,
      instalacao_origem_id,
      origem,
      created_at,
      updated_at
    ) VALUES (
      'instalacao',
      (NEW.status::text)::status_servico,
      NEW.data_agendada,
      NEW.hora_agendada,
      (NEW.periodo::text)::periodo_servico,
      NEW.associado_id,
      NEW.veiculo_id,
      NEW.endereco_latitude,
      NEW.endereco_longitude,
      NEW.logradouro,
      NEW.numero,
      NEW.bairro,
      NEW.cidade,
      NEW.uf,
      NEW.cep,
      COALESCE(NEW.permite_encaixe, false),
      COALESCE(NEW.local_vistoria, 'cliente'),
      NEW.cotacao_id,
      NEW.contrato_id,
      NEW.id,
      'instalacao',
      NOW(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. TRIGGER: Disparar ao inserir instalacao
DROP TRIGGER IF EXISTS trigger_sync_instalacao_to_servicos ON instalacoes;
CREATE TRIGGER trigger_sync_instalacao_to_servicos
AFTER INSERT ON instalacoes
FOR EACH ROW
EXECUTE FUNCTION sync_instalacao_to_servicos();

-- 3. FUNÇÃO: Sincronizar status/profissional quando instalacao é atualizada
CREATE OR REPLACE FUNCTION sync_instalacao_update_to_servicos()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar servico correspondente
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. TRIGGER: Disparar ao atualizar instalacao
DROP TRIGGER IF EXISTS trigger_sync_instalacao_update_to_servicos ON instalacoes;
CREATE TRIGGER trigger_sync_instalacao_update_to_servicos
AFTER UPDATE ON instalacoes
FOR EACH ROW
EXECUTE FUNCTION sync_instalacao_update_to_servicos();

-- 5. FUNÇÃO: Criar servico quando vistoria é inserida
CREATE OR REPLACE FUNCTION sync_vistoria_to_servicos()
RETURNS TRIGGER AS $$
BEGIN
  -- Só cria se não existir já um servico para esta vistoria
  IF NOT EXISTS (SELECT 1 FROM servicos WHERE vistoria_origem_id = NEW.id) THEN
    INSERT INTO servicos (
      tipo,
      status,
      data_agendada,
      hora_agendada,
      associado_id,
      veiculo_id,
      latitude,
      longitude,
      logradouro,
      numero,
      bairro,
      cidade,
      uf,
      cep,
      permite_encaixe,
      local_vistoria,
      cotacao_id,
      contrato_id,
      vistoria_origem_id,
      origem,
      created_at,
      updated_at
    ) VALUES (
      map_vistoria_tipo_to_servico(NEW.tipo::text),
      (NEW.status::text)::status_servico,
      NEW.data_agendada,
      NEW.horario_agendado,
      NEW.associado_id,
      NEW.veiculo_id,
      NEW.endereco_latitude,
      NEW.endereco_longitude,
      NEW.endereco_logradouro,
      NEW.endereco_numero,
      NEW.endereco_bairro,
      NEW.endereco_cidade,
      NEW.endereco_estado,
      NEW.endereco_cep,
      COALESCE(NEW.permite_encaixe, false),
      COALESCE(NEW.local_vistoria, 'cliente'),
      NEW.cotacao_id,
      NEW.contrato_id,
      NEW.id,
      'vistoria',
      NOW(),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. TRIGGER: Disparar ao inserir vistoria
DROP TRIGGER IF EXISTS trigger_sync_vistoria_to_servicos ON vistorias;
CREATE TRIGGER trigger_sync_vistoria_to_servicos
AFTER INSERT ON vistorias
FOR EACH ROW
EXECUTE FUNCTION sync_vistoria_to_servicos();

-- 7. FUNÇÃO: Sincronizar status/profissional quando vistoria é atualizada
CREATE OR REPLACE FUNCTION sync_vistoria_update_to_servicos()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar servico correspondente
  UPDATE servicos
  SET 
    status = (NEW.status::text)::status_servico,
    profissional_id = NEW.vistoriador_id,
    data_agendada = NEW.data_agendada,
    hora_agendada = NEW.horario_agendado,
    latitude = NEW.endereco_latitude,
    longitude = NEW.endereco_longitude,
    logradouro = NEW.endereco_logradouro,
    numero = NEW.endereco_numero,
    bairro = NEW.endereco_bairro,
    cidade = NEW.endereco_cidade,
    uf = NEW.endereco_estado,
    cep = NEW.endereco_cep,
    permite_encaixe = COALESCE(NEW.permite_encaixe, false),
    local_vistoria = COALESCE(NEW.local_vistoria, 'cliente'),
    rota_id = NEW.rota_id,
    updated_at = NOW()
  WHERE vistoria_origem_id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 8. TRIGGER: Disparar ao atualizar vistoria
DROP TRIGGER IF EXISTS trigger_sync_vistoria_update_to_servicos ON vistorias;
CREATE TRIGGER trigger_sync_vistoria_update_to_servicos
AFTER UPDATE ON vistorias
FOR EACH ROW
EXECUTE FUNCTION sync_vistoria_update_to_servicos();

-- =============================================================================
-- 9. MIGRAÇÃO RETROATIVA: Criar servicos para instalações/vistorias existentes
-- =============================================================================

-- 9a. Inserir servicos para instalações que não possuem servico
INSERT INTO servicos (
  tipo, status, data_agendada, hora_agendada, periodo,
  associado_id, veiculo_id, latitude, longitude,
  logradouro, numero, bairro, cidade, uf, cep,
  permite_encaixe, local_vistoria, cotacao_id, contrato_id,
  instalacao_origem_id, profissional_id, rota_id, origem, created_at, updated_at
)
SELECT 
  'instalacao',
  (i.status::text)::status_servico,
  i.data_agendada,
  i.hora_agendada,
  (i.periodo::text)::periodo_servico,
  i.associado_id,
  i.veiculo_id,
  i.endereco_latitude,
  i.endereco_longitude,
  i.logradouro,
  i.numero,
  i.bairro,
  i.cidade,
  i.uf,
  i.cep,
  COALESCE(i.permite_encaixe, false),
  COALESCE(i.local_vistoria, 'cliente'),
  i.cotacao_id,
  i.contrato_id,
  i.id,
  i.instalador_responsavel_id,
  i.rota_id,
  'instalacao',
  i.created_at,
  NOW()
FROM instalacoes i
WHERE i.id NOT IN (
  SELECT instalacao_origem_id FROM servicos WHERE instalacao_origem_id IS NOT NULL
)
AND i.status IN ('agendada', 'em_rota', 'em_andamento', 'reagendada');

-- 9b. Inserir servicos para vistorias que não possuem servico
INSERT INTO servicos (
  tipo, status, data_agendada, hora_agendada,
  associado_id, veiculo_id, latitude, longitude,
  logradouro, numero, bairro, cidade, uf, cep,
  permite_encaixe, local_vistoria, cotacao_id, contrato_id,
  vistoria_origem_id, profissional_id, rota_id, origem, created_at, updated_at
)
SELECT 
  map_vistoria_tipo_to_servico(v.tipo::text),
  (v.status::text)::status_servico,
  v.data_agendada,
  v.horario_agendado,
  v.associado_id,
  v.veiculo_id,
  v.endereco_latitude,
  v.endereco_longitude,
  v.endereco_logradouro,
  v.endereco_numero,
  v.endereco_bairro,
  v.endereco_cidade,
  v.endereco_estado,
  v.endereco_cep,
  COALESCE(v.permite_encaixe, false),
  COALESCE(v.local_vistoria, 'cliente'),
  v.cotacao_id,
  v.contrato_id,
  v.id,
  v.vistoriador_id,
  v.rota_id,
  'vistoria',
  v.created_at,
  NOW()
FROM vistorias v
WHERE v.id NOT IN (
  SELECT vistoria_origem_id FROM servicos WHERE vistoria_origem_id IS NOT NULL
)
AND v.status IN ('pendente', 'agendada', 'em_rota', 'em_andamento');