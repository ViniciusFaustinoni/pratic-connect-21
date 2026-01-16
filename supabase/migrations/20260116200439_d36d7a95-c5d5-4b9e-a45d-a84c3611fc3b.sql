-- =============================================
-- TABELA: CATEGORIAS DE DOCUMENTOS
-- =============================================
CREATE TABLE documento_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  descricao TEXT,
  icone VARCHAR(50) DEFAULT 'FileText',
  cor VARCHAR(20) DEFAULT 'blue',
  ordem INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorias padrão
INSERT INTO documento_categorias (nome, descricao, icone, cor, ordem) VALUES
('Contratos', 'Contratos de adesão e termos', 'FileSignature', 'blue', 1),
('Termos', 'Termos de uso e responsabilidade', 'ScrollText', 'green', 2),
('Declarações', 'Declarações diversas', 'FileCheck', 'purple', 3),
('Fichas', 'Fichas cadastrais e de vistoria', 'ClipboardList', 'orange', 4),
('Comunicados', 'Comunicados e notificações', 'Mail', 'red', 5);

-- =============================================
-- TABELA: TEMPLATES DE DOCUMENTOS
-- =============================================
CREATE TABLE documento_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID REFERENCES documento_categorias(id),
  
  -- Identificação
  nome VARCHAR(200) NOT NULL,
  codigo VARCHAR(50) UNIQUE NOT NULL,
  descricao TEXT,
  versao INTEGER DEFAULT 1,
  
  -- Conteúdo do template
  conteudo TEXT NOT NULL,
  variaveis JSONB DEFAULT '[]',
  
  -- Configurações de layout
  config_layout JSONB DEFAULT '{
    "margemTopo": 50,
    "margemBaixo": 50,
    "margemEsquerda": 50,
    "margemDireita": 50,
    "tamanhoFonte": 12,
    "fontePrincipal": "Helvetica",
    "mostrarCabecalho": true,
    "mostrarRodape": true,
    "mostrarNumeroPagina": true,
    "orientacao": "retrato"
  }',
  
  -- Cabeçalho e rodapé personalizados
  cabecalho_html TEXT,
  rodape_html TEXT,
  
  -- Controle
  ativo BOOLEAN DEFAULT TRUE,
  requer_assinatura BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABELA: VARIÁVEIS DISPONÍVEIS (REFERÊNCIA)
-- =============================================
CREATE TABLE documento_variaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(100) NOT NULL UNIQUE,
  nome_exibicao VARCHAR(200) NOT NULL,
  grupo VARCHAR(50) NOT NULL,
  tipo VARCHAR(20) DEFAULT 'texto',
  origem_tabela VARCHAR(100),
  origem_campo VARCHAR(100),
  formato TEXT,
  exemplo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Variáveis padrão do sistema
INSERT INTO documento_variaveis (codigo, nome_exibicao, grupo, tipo, origem_tabela, origem_campo, exemplo) VALUES
-- Associado
('associado.nome', 'Nome do Associado', 'associado', 'texto', 'associados', 'nome', 'João da Silva'),
('associado.cpf', 'CPF do Associado', 'associado', 'texto', 'associados', 'cpf', '123.456.789-00'),
('associado.rg', 'RG do Associado', 'associado', 'texto', 'associados', 'rg', '12.345.678-9'),
('associado.email', 'E-mail do Associado', 'associado', 'texto', 'associados', 'email', 'joao@email.com'),
('associado.telefone', 'Telefone do Associado', 'associado', 'texto', 'associados', 'telefone', '(11) 99999-8888'),
('associado.endereco_completo', 'Endereço Completo', 'associado', 'texto', NULL, NULL, 'Rua das Flores, 123 - Centro - São Paulo/SP'),
('associado.data_adesao', 'Data de Adesão', 'associado', 'data', 'associados', 'data_adesao', '15/01/2025'),
-- Veículo
('veiculo.marca', 'Marca do Veículo', 'veiculo', 'texto', 'veiculos', 'marca', 'Volkswagen'),
('veiculo.modelo', 'Modelo do Veículo', 'veiculo', 'texto', 'veiculos', 'modelo', 'Gol'),
('veiculo.ano', 'Ano do Veículo', 'veiculo', 'numero', 'veiculos', 'ano', '2020'),
('veiculo.placa', 'Placa do Veículo', 'veiculo', 'texto', 'veiculos', 'placa', 'ABC-1234'),
('veiculo.chassi', 'Chassi do Veículo', 'veiculo', 'texto', 'veiculos', 'chassi', '9BWAG45U5AP000001'),
('veiculo.renavam', 'Renavam do Veículo', 'veiculo', 'texto', 'veiculos', 'renavam', '00123456789'),
('veiculo.cor', 'Cor do Veículo', 'veiculo', 'texto', 'veiculos', 'cor', 'Prata'),
('veiculo.valor_fipe', 'Valor FIPE', 'veiculo', 'moeda', 'veiculos', 'valor_fipe', 'R$ 45.000,00'),
-- Contrato/Plano
('contrato.numero', 'Número do Contrato', 'contrato', 'texto', 'contratos', 'numero_contrato', 'CTR-2025-00001'),
('contrato.plano', 'Nome do Plano', 'contrato', 'texto', 'planos', 'nome', 'Plano Completo'),
('contrato.valor_adesao', 'Valor de Adesão', 'contrato', 'moeda', 'contratos', 'valor_adesao', 'R$ 450,00'),
('contrato.valor_mensal', 'Valor Mensal', 'contrato', 'moeda', 'contratos', 'valor_mensal', 'R$ 199,90'),
('contrato.dia_vencimento', 'Dia de Vencimento', 'contrato', 'numero', 'associados', 'dia_vencimento', '10'),
-- Sistema/Data
('sistema.data_atual', 'Data Atual', 'sistema', 'data', NULL, NULL, '16/01/2025'),
('sistema.data_extenso', 'Data por Extenso', 'sistema', 'texto', NULL, NULL, '16 de janeiro de 2025'),
('sistema.hora_atual', 'Hora Atual', 'sistema', 'texto', NULL, NULL, '14:30'),
-- Empresa
('empresa.nome', 'Nome da Empresa', 'empresa', 'texto', NULL, NULL, 'PRATICCAR'),
('empresa.razao_social', 'Razão Social', 'empresa', 'texto', NULL, NULL, 'PRATICCAR Associação de Proteção Veicular'),
('empresa.cnpj', 'CNPJ', 'empresa', 'texto', NULL, NULL, '12.345.678/0001-90'),
('empresa.endereco', 'Endereço da Empresa', 'empresa', 'texto', NULL, NULL, 'Av. Principal, 1000 - Centro - Cidade/UF'),
('empresa.telefone', 'Telefone da Empresa', 'empresa', 'texto', NULL, NULL, '(11) 3333-4444');

-- =============================================
-- TABELA: DOCUMENTOS GERADOS (HISTÓRICO)
-- =============================================
CREATE TABLE documento_gerados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES documento_templates(id),
  associado_id UUID REFERENCES associados(id),
  
  -- Identificação
  numero_documento VARCHAR(50),
  
  -- Dados usados na geração (snapshot)
  dados_utilizados JSONB NOT NULL,
  
  -- Arquivo
  arquivo_url TEXT,
  arquivo_nome VARCHAR(255),
  
  -- Controle
  gerado_por UUID REFERENCES profiles(id),
  gerado_em TIMESTAMPTZ DEFAULT NOW(),
  
  -- Assinatura (se aplicável)
  assinado BOOLEAN DEFAULT FALSE,
  assinado_em TIMESTAMPTZ,
  assinatura_ip VARCHAR(50),
  autentique_id VARCHAR(100)
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX idx_templates_categoria ON documento_templates(categoria_id);
CREATE INDEX idx_templates_codigo ON documento_templates(codigo);
CREATE INDEX idx_templates_ativo ON documento_templates(ativo);
CREATE INDEX idx_gerados_associado ON documento_gerados(associado_id);
CREATE INDEX idx_gerados_template ON documento_gerados(template_id);
CREATE INDEX idx_gerados_data ON documento_gerados(gerado_em);

-- =============================================
-- RLS (Row Level Security)
-- =============================================
ALTER TABLE documento_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_variaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_gerados ENABLE ROW LEVEL SECURITY;

-- Políticas básicas
CREATE POLICY "Categorias visíveis para autenticados" ON documento_categorias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Templates visíveis para autenticados" ON documento_templates
  FOR SELECT TO authenticated USING (ativo = true);

CREATE POLICY "Gerenciar templates para autenticados" ON documento_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Variáveis visíveis para autenticados" ON documento_variaveis
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Documentos gerados para autenticados" ON documento_gerados
  FOR ALL TO authenticated USING (true) WITH CHECK (true);