-- =============================================
-- MÓDULO OFICINA - ENUMS
-- =============================================
CREATE TYPE status_oficina AS ENUM ('ativo', 'inativo', 'suspenso', 'bloqueado');
CREATE TYPE status_ordem_servico AS ENUM (
  'rascunho', 'aguardando_orcamento', 'orcamento_enviado',
  'aguardando_aprovacao', 'aprovado', 'em_execucao',
  'aguardando_peca', 'concluido', 'aguardando_pagamento',
  'pago', 'cancelado'
);
CREATE TYPE tipo_item_os AS ENUM ('peca', 'mao_de_obra', 'servico_terceiro');
CREATE TYPE tipo_foto_os AS ENUM ('entrada', 'execucao', 'conclusao');
CREATE TYPE tipo_pix AS ENUM ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria');
CREATE TYPE status_pagamento_oficina AS ENUM ('pendente', 'processando', 'pago', 'cancelado');
CREATE TYPE forma_pagamento_oficina AS ENUM ('pix', 'transferencia', 'boleto', 'cheque');

-- =============================================
-- OFICINAS CREDENCIADAS
-- =============================================
CREATE TABLE oficinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj VARCHAR(18) UNIQUE NOT NULL,
    inscricao_estadual VARCHAR(20),
    
    -- Contato
    telefone VARCHAR(20),
    whatsapp VARCHAR(20),
    email VARCHAR(255),
    
    -- Endereço
    cep VARCHAR(10),
    logradouro VARCHAR(255),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100) NOT NULL,
    estado VARCHAR(2) NOT NULL,
    
    -- Dados bancários
    banco VARCHAR(100),
    agencia VARCHAR(20),
    conta VARCHAR(30),
    pix_chave VARCHAR(255),
    pix_tipo tipo_pix,
    
    -- Especialidades (array de tipos de serviço)
    especialidades TEXT[] DEFAULT '{}',
    
    -- Avaliação
    nota_media DECIMAL(3,2) DEFAULT 0,
    total_avaliacoes INTEGER DEFAULT 0,
    
    -- Status
    status status_oficina DEFAULT 'ativo',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ORDENS DE SERVIÇO
-- =============================================
CREATE SEQUENCE IF NOT EXISTS os_numero_seq START 1;

CREATE TABLE ordens_servico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero VARCHAR(20) UNIQUE NOT NULL,
    
    -- Relacionamentos
    sinistro_id UUID REFERENCES sinistros(id),
    oficina_id UUID NOT NULL REFERENCES oficinas(id),
    veiculo_id UUID NOT NULL REFERENCES veiculos(id),
    associado_id UUID NOT NULL REFERENCES associados(id),
    
    -- Responsáveis
    criado_por UUID REFERENCES profiles(id),
    aprovado_por UUID REFERENCES profiles(id),
    
    -- Datas
    data_entrada DATE,
    data_previsao DATE,
    data_conclusao DATE,
    
    -- Valores
    valor_orcamento DECIMAL(12,2) DEFAULT 0,
    valor_aprovado DECIMAL(12,2),
    valor_pago DECIMAL(12,2),
    
    -- Status
    status status_ordem_servico DEFAULT 'rascunho',
    
    -- Observações
    observacoes TEXT,
    observacoes_internas TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ITENS DA ORDEM DE SERVIÇO (Orçamento)
-- =============================================
CREATE TABLE ordens_servico_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    
    tipo tipo_item_os NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    
    -- Quantidades e valores
    quantidade DECIMAL(10,2) DEFAULT 1,
    valor_unitario DECIMAL(12,2) NOT NULL,
    valor_total DECIMAL(12,2) NOT NULL,
    
    -- Status do item
    aprovado BOOLEAN DEFAULT false,
    
    -- Para peças
    marca VARCHAR(100),
    numero_peca VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- HISTÓRICO DA OS
-- =============================================
CREATE TABLE ordens_servico_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    
    status_anterior VARCHAR(30),
    status_novo VARCHAR(30) NOT NULL,
    usuario_id UUID REFERENCES profiles(id),
    observacao TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- FOTOS DA OS (antes/depois)
-- =============================================
CREATE TABLE ordens_servico_fotos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ordem_servico_id UUID NOT NULL REFERENCES ordens_servico(id) ON DELETE CASCADE,
    
    tipo tipo_foto_os NOT NULL,
    descricao VARCHAR(255),
    arquivo_url TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PAGAMENTOS PARA OFICINAS
-- =============================================
CREATE TABLE oficinas_pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oficina_id UUID NOT NULL REFERENCES oficinas(id),
    ordem_servico_id UUID REFERENCES ordens_servico(id),
    
    valor DECIMAL(12,2) NOT NULL,
    forma_pagamento forma_pagamento_oficina,
    
    -- Comprovante
    comprovante_url TEXT,
    
    -- Status
    status status_pagamento_oficina DEFAULT 'pendente',
    
    data_pagamento TIMESTAMPTZ,
    pago_por UUID REFERENCES profiles(id),
    
    observacao TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES
-- =============================================
CREATE INDEX idx_ordens_servico_sinistro ON ordens_servico(sinistro_id);
CREATE INDEX idx_ordens_servico_oficina ON ordens_servico(oficina_id);
CREATE INDEX idx_ordens_servico_status ON ordens_servico(status);
CREATE INDEX idx_ordens_servico_associado ON ordens_servico(associado_id);
CREATE INDEX idx_oficinas_cidade ON oficinas(cidade, estado);
CREATE INDEX idx_oficinas_status ON oficinas(status);

-- =============================================
-- FUNÇÃO PARA GERAR NÚMERO DA OS
-- =============================================
CREATE OR REPLACE FUNCTION gerar_numero_os()
RETURNS TRIGGER AS $$
BEGIN
  NEW.numero := 'OS-' || TO_CHAR(NOW(), 'YYYY') || '-' || 
                LPAD(NEXTVAL('os_numero_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trigger_gerar_numero_os
  BEFORE INSERT ON ordens_servico
  FOR EACH ROW
  WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION gerar_numero_os();

-- =============================================
-- TRIGGER PARA HISTÓRICO AUTOMÁTICO DE OS
-- =============================================
CREATE OR REPLACE FUNCTION fn_os_historico()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO ordens_servico_historico (ordem_servico_id, status_anterior, status_novo)
    VALUES (NEW.id, OLD.status::text, NEW.status::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_os_historico
  AFTER UPDATE ON ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION fn_os_historico();

-- =============================================
-- RLS POLICIES - OFICINAS
-- =============================================
ALTER TABLE oficinas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage oficinas"
ON oficinas FOR ALL
USING (is_funcionario(auth.uid()));

CREATE POLICY "Anyone can view active oficinas"
ON oficinas FOR SELECT
USING (status = 'ativo' OR is_funcionario(auth.uid()));

-- =============================================
-- RLS POLICIES - ORDENS DE SERVIÇO
-- =============================================
ALTER TABLE ordens_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage OS"
ON ordens_servico FOR ALL
USING (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own OS"
ON ordens_servico FOR SELECT
USING (associado_id = get_my_associado_id(auth.uid()));

-- =============================================
-- RLS POLICIES - ITENS DA OS
-- =============================================
ALTER TABLE ordens_servico_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage OS items"
ON ordens_servico_itens FOR ALL
USING (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own OS items"
ON ordens_servico_itens FOR SELECT
USING (ordem_servico_id IN (
  SELECT id FROM ordens_servico WHERE associado_id = get_my_associado_id(auth.uid())
));

-- =============================================
-- RLS POLICIES - HISTÓRICO DA OS
-- =============================================
ALTER TABLE ordens_servico_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view OS history"
ON ordens_servico_historico FOR SELECT
USING (is_funcionario(auth.uid()));

CREATE POLICY "System can insert OS history"
ON ordens_servico_historico FOR INSERT
WITH CHECK (true);

CREATE POLICY "Associates can view own OS history"
ON ordens_servico_historico FOR SELECT
USING (ordem_servico_id IN (
  SELECT id FROM ordens_servico WHERE associado_id = get_my_associado_id(auth.uid())
));

-- =============================================
-- RLS POLICIES - FOTOS DA OS
-- =============================================
ALTER TABLE ordens_servico_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage OS photos"
ON ordens_servico_fotos FOR ALL
USING (is_funcionario(auth.uid()));

CREATE POLICY "Associates can view own OS photos"
ON ordens_servico_fotos FOR SELECT
USING (ordem_servico_id IN (
  SELECT id FROM ordens_servico WHERE associado_id = get_my_associado_id(auth.uid())
));

-- =============================================
-- RLS POLICIES - PAGAMENTOS
-- =============================================
ALTER TABLE oficinas_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage oficina payments"
ON oficinas_pagamentos FOR ALL
USING (is_funcionario(auth.uid()));

-- =============================================
-- STORAGE BUCKET
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('ordens-servico', 'ordens-servico', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Staff can upload OS files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ordens-servico' AND is_funcionario(auth.uid()));

CREATE POLICY "Staff can view OS files"
ON storage.objects FOR SELECT
USING (bucket_id = 'ordens-servico' AND is_funcionario(auth.uid()));

CREATE POLICY "Staff can delete OS files"
ON storage.objects FOR DELETE
USING (bucket_id = 'ordens-servico' AND is_funcionario(auth.uid()));