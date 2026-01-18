-- Adicionar coluna cotacao_id na tabela instalacoes (se não existir)
ALTER TABLE instalacoes ADD COLUMN IF NOT EXISTS cotacao_id UUID REFERENCES cotacoes(id);

-- Inserir instalações retroativas para cotações existentes que atendem os critérios
INSERT INTO instalacoes (associado_id, veiculo_id, cotacao_id, data_agendada, periodo, hora_agendada, cep, logradouro, numero, bairro, cidade, uf, status, observacoes)
SELECT 
  c.associado_id,
  v.id as veiculo_id,
  cot.id as cotacao_id,
  cot.vistoria_data_agendada as data_agendada,
  'manha'::periodo_instalacao as periodo,
  cot.vistoria_horario_agendado::time as hora_agendada,
  cot.vistoria_endereco_cep,
  cot.vistoria_endereco_logradouro,
  cot.vistoria_endereco_numero,
  cot.vistoria_endereco_bairro,
  cot.vistoria_endereco_cidade,
  cot.vistoria_endereco_estado,
  'agendada'::status_instalacao,
  'Migrado automaticamente da cotação ' || COALESCE(cot.numero, cot.id::text)
FROM cotacoes cot
LEFT JOIN contratos c ON c.cotacao_id = cot.id
LEFT JOIN veiculos v ON v.placa = cot.veiculo_placa
WHERE cot.tipo_vistoria = 'agendada'
  AND cot.status_contratacao = 'pagamento_ok'
  AND cot.vistoria_data_agendada IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM instalacoes i WHERE i.cotacao_id = cot.id);

-- Criar ou atualizar função que cria instalação a partir da cotação
CREATE OR REPLACE FUNCTION criar_instalacao_de_cotacao()
RETURNS TRIGGER AS $$
DECLARE
  v_associado_id UUID;
  v_veiculo_id UUID;
BEGIN
  -- Só executar se condições forem atendidas
  IF NEW.tipo_vistoria = 'agendada' 
     AND NEW.status_contratacao = 'pagamento_ok' 
     AND NEW.vistoria_data_agendada IS NOT NULL 
  THEN
    -- Buscar associado pelo contrato relacionado
    SELECT c.associado_id INTO v_associado_id
    FROM contratos c WHERE c.cotacao_id = NEW.id LIMIT 1;
    
    -- Buscar veículo pela placa
    SELECT v.id INTO v_veiculo_id
    FROM veiculos v WHERE v.placa = NEW.veiculo_placa LIMIT 1;
    
    -- Verificar se já existe instalação para esta cotação
    IF NOT EXISTS (SELECT 1 FROM instalacoes WHERE cotacao_id = NEW.id) THEN
      INSERT INTO instalacoes (
        associado_id,
        veiculo_id,
        cotacao_id,
        data_agendada,
        periodo,
        hora_agendada,
        cep,
        logradouro,
        numero,
        bairro,
        cidade,
        uf,
        status,
        observacoes
      ) VALUES (
        v_associado_id,
        v_veiculo_id,
        NEW.id,
        NEW.vistoria_data_agendada,
        'manha'::periodo_instalacao,
        NEW.vistoria_horario_agendado::time,
        NEW.vistoria_endereco_cep,
        NEW.vistoria_endereco_logradouro,
        NEW.vistoria_endereco_numero,
        NEW.vistoria_endereco_bairro,
        NEW.vistoria_endereco_cidade,
        NEW.vistoria_endereco_estado,
        'agendada',
        'Criada automaticamente a partir da cotação ' || COALESCE(NEW.numero, NEW.id::text)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para executar após update na cotação
DROP TRIGGER IF EXISTS trigger_criar_instalacao_cotacao ON cotacoes;
CREATE TRIGGER trigger_criar_instalacao_cotacao
AFTER UPDATE ON cotacoes
FOR EACH ROW
EXECUTE FUNCTION criar_instalacao_de_cotacao();