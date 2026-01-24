-- =====================================================
-- MIGRATION: Unificação do Sistema de Serviços (Correção)
-- =====================================================

-- PARTE 1: Limpar serviços órfãos (origem excluída)
DELETE FROM servicos 
WHERE (instalacao_origem_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM instalacoes WHERE id = servicos.instalacao_origem_id))
   OR (vistoria_origem_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM vistorias WHERE id = servicos.vistoria_origem_id));

-- PARTE 2: Recriar função de exclusão de serviços ao deletar instalação
CREATE OR REPLACE FUNCTION excluir_servicos_ao_deletar_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM servicos WHERE instalacao_origem_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_cancelar_servicos_instalacao_delete ON instalacoes;
DROP TRIGGER IF EXISTS trigger_excluir_servicos_instalacao_delete ON instalacoes;
CREATE TRIGGER trigger_excluir_servicos_instalacao_delete
BEFORE DELETE ON instalacoes
FOR EACH ROW EXECUTE FUNCTION excluir_servicos_ao_deletar_instalacao();

-- PARTE 3: Recriar função de exclusão de serviços ao deletar vistoria
CREATE OR REPLACE FUNCTION excluir_servicos_ao_deletar_vistoria()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM servicos WHERE vistoria_origem_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_cancelar_servicos_vistoria_delete ON vistorias;
DROP TRIGGER IF EXISTS trigger_excluir_servicos_vistoria_delete ON vistorias;
CREATE TRIGGER trigger_excluir_servicos_vistoria_delete
BEFORE DELETE ON vistorias
FOR EACH ROW EXECUTE FUNCTION excluir_servicos_ao_deletar_vistoria();

-- PARTE 4: Melhorar trigger criar_instalacao_de_cotacao para incluir TODOS os campos
CREATE OR REPLACE FUNCTION criar_instalacao_de_cotacao()
RETURNS TRIGGER AS $$
DECLARE
  v_veiculo_id UUID;
  v_associado_id UUID;
  v_contrato_id UUID;
  v_periodo periodo_instalacao;
BEGIN
  IF NEW.tipo_vistoria = 'agendada' 
     AND NEW.status_contratacao = 'pagamento_ok' 
     AND NEW.vistoria_data_agendada IS NOT NULL 
  THEN
    IF NOT EXISTS (SELECT 1 FROM instalacoes WHERE cotacao_id = NEW.id) THEN
      
      SELECT v.id INTO v_veiculo_id 
      FROM veiculos v WHERE v.placa = NEW.veiculo_placa LIMIT 1;
      
      SELECT c.id, c.associado_id INTO v_contrato_id, v_associado_id
      FROM contratos c WHERE c.cotacao_id = NEW.id LIMIT 1;
      
      IF v_associado_id IS NULL THEN
        SELECT a.id INTO v_associado_id
        FROM associados a
        JOIN veiculos v ON v.associado_id = a.id
        WHERE v.placa = NEW.veiculo_placa LIMIT 1;
      END IF;
      
      v_periodo := CASE 
        WHEN NEW.vistoria_horario_agendado::time < '12:00'::time THEN 'manha'::periodo_instalacao
        WHEN NEW.vistoria_horario_agendado::time < '18:00'::time THEN 'tarde'::periodo_instalacao
        ELSE 'noite'::periodo_instalacao
      END;
      
      INSERT INTO instalacoes (
        cotacao_id, contrato_id, associado_id, veiculo_id,
        data_agendada, hora_agendada, periodo, status,
        logradouro, numero, bairro, cidade, uf, cep,
        endereco_latitude, endereco_longitude,
        permite_encaixe, local_vistoria, instalador_responsavel_id, observacoes
      ) VALUES (
        NEW.id, v_contrato_id, v_associado_id, v_veiculo_id,
        NEW.vistoria_data_agendada, NEW.vistoria_horario_agendado::time, v_periodo, 'agendada'::status_instalacao,
        NEW.vistoria_endereco_logradouro, NEW.vistoria_endereco_numero, NEW.vistoria_endereco_bairro, 
        NEW.vistoria_endereco_cidade, NEW.vistoria_endereco_estado, NEW.vistoria_endereco_cep,
        NEW.vistoria_endereco_latitude, NEW.vistoria_endereco_longitude,
        COALESCE(NEW.vistoria_permite_encaixe, false), 'cliente', NULL, 
        'Instalação criada automaticamente após pagamento'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- PARTE 5: Sincronizar vistorias existentes que NÃO têm serviço E têm data_agendada
INSERT INTO servicos (
  tipo, status, data_agendada, hora_agendada,
  associado_id, veiculo_id, latitude, longitude,
  logradouro, numero, bairro, cidade, uf, cep,
  permite_encaixe, local_vistoria, cotacao_id, contrato_id,
  vistoria_origem_id, profissional_id, origem
)
SELECT 
  CASE 
    WHEN v.tipo::text IN ('completa', 'entrada', 'cautelar') THEN 'vistoria_entrada'::tipo_servico
    WHEN v.tipo::text = 'saida' THEN 'vistoria_saida'::tipo_servico
    WHEN v.tipo::text = 'sinistro' THEN 'vistoria_sinistro'::tipo_servico
    WHEN v.tipo::text = 'periodica' THEN 'vistoria_periodica'::tipo_servico
    WHEN v.tipo::text = 'transferencia' THEN 'vistoria_entrada'::tipo_servico
    ELSE 'vistoria_entrada'::tipo_servico
  END,
  CASE 
    WHEN v.status::text = 'pendente' THEN 'pendente'::status_servico
    WHEN v.status::text = 'agendada' THEN 'agendada'::status_servico
    WHEN v.status::text = 'em_andamento' THEN 'em_andamento'::status_servico
    WHEN v.status::text = 'concluida' THEN 'concluida'::status_servico
    WHEN v.status::text = 'cancelada' THEN 'cancelada'::status_servico
    ELSE 'pendente'::status_servico
  END,
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
  'vistoria'
FROM vistorias v
WHERE NOT EXISTS (SELECT 1 FROM servicos WHERE vistoria_origem_id = v.id)
  AND v.status NOT IN ('cancelada')
  AND v.data_agendada IS NOT NULL;  -- FILTRO: só sincroniza se tiver data

-- PARTE 6: Sincronizar instalações existentes que NÃO têm serviço E têm data_agendada
INSERT INTO servicos (
  tipo, status, data_agendada, hora_agendada,
  associado_id, veiculo_id, latitude, longitude,
  logradouro, numero, bairro, cidade, uf, cep,
  permite_encaixe, local_vistoria, cotacao_id, contrato_id,
  instalacao_origem_id, profissional_id, origem
)
SELECT 
  'instalacao'::tipo_servico,
  CASE 
    WHEN i.status::text = 'pendente' THEN 'pendente'::status_servico
    WHEN i.status::text = 'agendada' THEN 'agendada'::status_servico
    WHEN i.status::text = 'em_rota' THEN 'em_rota'::status_servico
    WHEN i.status::text = 'em_andamento' THEN 'em_andamento'::status_servico
    WHEN i.status::text = 'concluida' THEN 'concluida'::status_servico
    WHEN i.status::text = 'cancelada' THEN 'cancelada'::status_servico
    ELSE 'pendente'::status_servico
  END,
  i.data_agendada,
  i.hora_agendada,
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
  'instalacao'
FROM instalacoes i
WHERE NOT EXISTS (SELECT 1 FROM servicos WHERE instalacao_origem_id = i.id)
  AND i.status NOT IN ('cancelada')
  AND i.data_agendada IS NOT NULL;  -- FILTRO: só sincroniza se tiver data