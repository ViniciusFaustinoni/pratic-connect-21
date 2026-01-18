-- Recriar a função para criar instalação a partir de cotação com conversão de horário para período
CREATE OR REPLACE FUNCTION criar_instalacao_de_cotacao()
RETURNS TRIGGER AS $$
DECLARE
  v_veiculo_id UUID;
  v_associado_id UUID;
  v_periodo periodo_instalacao;
BEGIN
  -- Só processa se for vistoria agendada com pagamento OK e data definida
  IF NEW.tipo_vistoria = 'agendada' 
     AND NEW.status_contratacao = 'pagamento_ok' 
     AND NEW.vistoria_data_agendada IS NOT NULL 
  THEN
    -- Verificar se já existe instalação para esta cotação
    IF NOT EXISTS (SELECT 1 FROM instalacoes WHERE cotacao_id = NEW.id) THEN
      
      -- Buscar veículo pela placa
      SELECT v.id INTO v_veiculo_id
      FROM veiculos v 
      WHERE v.placa = NEW.veiculo_placa 
      LIMIT 1;
      
      -- Tentar buscar associado existente pelo CPF do cliente
      SELECT a.id INTO v_associado_id
      FROM associados a 
      WHERE a.cpf = NEW.cliente_cpf 
      LIMIT 1;
      
      -- Converter horário para período
      v_periodo := CASE 
        WHEN NEW.vistoria_horario_agendado IS NULL THEN 'manha'::periodo_instalacao
        WHEN NEW.vistoria_horario_agendado IN ('manha', 'tarde', 'noite') THEN NEW.vistoria_horario_agendado::periodo_instalacao
        WHEN NEW.vistoria_horario_agendado < '12:00' THEN 'manha'::periodo_instalacao
        WHEN NEW.vistoria_horario_agendado < '18:00' THEN 'tarde'::periodo_instalacao
        ELSE 'noite'::periodo_instalacao
      END;
      
      -- Criar instalação (associado_id pode ser null)
      INSERT INTO instalacoes (
        cotacao_id,
        associado_id,
        veiculo_id,
        data_agendada,
        periodo,
        status,
        logradouro,
        numero,
        bairro,
        cidade,
        uf,
        cep,
        observacoes
      ) VALUES (
        NEW.id,
        v_associado_id,
        v_veiculo_id,
        NEW.vistoria_data_agendada,
        v_periodo,
        'agendada'::status_instalacao,
        NEW.vistoria_endereco_logradouro,
        NEW.vistoria_endereco_numero,
        NEW.vistoria_endereco_bairro,
        NEW.vistoria_endereco_cidade,
        NEW.vistoria_endereco_estado,
        NEW.vistoria_endereco_cep,
        'Instalação gerada automaticamente a partir da cotação ' || NEW.numero
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dropar e recriar o trigger
DROP TRIGGER IF EXISTS trigger_criar_instalacao_cotacao ON cotacoes;
CREATE TRIGGER trigger_criar_instalacao_cotacao
AFTER INSERT OR UPDATE ON cotacoes
FOR EACH ROW
EXECUTE FUNCTION criar_instalacao_de_cotacao();

-- Processar cotações existentes retroativamente
INSERT INTO instalacoes (
  cotacao_id,
  associado_id,
  veiculo_id,
  data_agendada,
  periodo,
  status,
  logradouro,
  numero,
  bairro,
  cidade,
  uf,
  cep,
  observacoes
)
SELECT 
  cot.id,
  a.id,
  v.id,
  cot.vistoria_data_agendada,
  CASE 
    WHEN cot.vistoria_horario_agendado IS NULL THEN 'manha'::periodo_instalacao
    WHEN cot.vistoria_horario_agendado IN ('manha', 'tarde', 'noite') THEN cot.vistoria_horario_agendado::periodo_instalacao
    WHEN cot.vistoria_horario_agendado < '12:00' THEN 'manha'::periodo_instalacao
    WHEN cot.vistoria_horario_agendado < '18:00' THEN 'tarde'::periodo_instalacao
    ELSE 'noite'::periodo_instalacao
  END,
  'agendada'::status_instalacao,
  cot.vistoria_endereco_logradouro,
  cot.vistoria_endereco_numero,
  cot.vistoria_endereco_bairro,
  cot.vistoria_endereco_cidade,
  cot.vistoria_endereco_estado,
  cot.vistoria_endereco_cep,
  'Instalação gerada automaticamente a partir da cotação ' || cot.numero
FROM cotacoes cot
LEFT JOIN veiculos v ON v.placa = cot.veiculo_placa
LEFT JOIN associados a ON a.cpf = cot.cliente_cpf
WHERE cot.tipo_vistoria = 'agendada'
  AND cot.status_contratacao = 'pagamento_ok'
  AND cot.vistoria_data_agendada IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM instalacoes i WHERE i.cotacao_id = cot.id);