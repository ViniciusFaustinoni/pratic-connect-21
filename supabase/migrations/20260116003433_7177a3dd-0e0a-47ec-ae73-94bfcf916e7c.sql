-- =============================================
-- Tabela de Regiões para precificação
-- =============================================
CREATE TABLE IF NOT EXISTS regioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  nome VARCHAR(150) NOT NULL,
  descricao TEXT,
  cidades TEXT[] DEFAULT '{}',
  multiplicador_preco NUMERIC(5,2) DEFAULT 1.00,
  ativa BOOLEAN DEFAULT TRUE,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_regioes_codigo ON regioes(codigo);
CREATE INDEX idx_regioes_ativa ON regioes(ativa);

-- =============================================
-- Tabela intermediária planos_regioes
-- =============================================
CREATE TABLE IF NOT EXISTS planos_regioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID REFERENCES planos(id) ON DELETE CASCADE NOT NULL,
  regiao_id UUID REFERENCES regioes(id) ON DELETE CASCADE NOT NULL,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plano_id, regiao_id)
);

-- Índices
CREATE INDEX idx_planos_regioes_plano ON planos_regioes(plano_id);
CREATE INDEX idx_planos_regioes_regiao ON planos_regioes(regiao_id);

-- =============================================
-- Tabela de Benefícios Adicionais
-- =============================================
CREATE TABLE IF NOT EXISTS beneficios_adicionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(50) NOT NULL UNIQUE,
  categoria VARCHAR(50) NOT NULL,
  nome VARCHAR(150) NOT NULL,
  descricao TEXT,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  ordem INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_beneficios_adicionais_categoria ON beneficios_adicionais(categoria);
CREATE INDEX idx_beneficios_adicionais_ativo ON beneficios_adicionais(ativo);

-- =============================================
-- Tabela intermediária beneficios_regioes
-- =============================================
CREATE TABLE IF NOT EXISTS beneficios_regioes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficio_id UUID REFERENCES beneficios_adicionais(id) ON DELETE CASCADE NOT NULL,
  regiao_id UUID REFERENCES regioes(id) ON DELETE CASCADE NOT NULL,
  preco_regional NUMERIC(10,2),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(beneficio_id, regiao_id)
);

-- Índices
CREATE INDEX idx_beneficios_regioes_beneficio ON beneficios_regioes(beneficio_id);
CREATE INDEX idx_beneficios_regioes_regiao ON beneficios_regioes(regiao_id);

-- =============================================
-- Função para verificar se usuário é diretor
-- =============================================
CREATE OR REPLACE FUNCTION is_diretor_for_crud(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('diretor', 'desenvolvedor', 'admin_master')
  )
$$;

-- =============================================
-- RLS para regioes
-- =============================================
ALTER TABLE regioes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver regioes"
  ON regioes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Diretores podem inserir regioes"
  ON regioes FOR INSERT
  TO authenticated
  WITH CHECK (is_diretor_for_crud(auth.uid()));

CREATE POLICY "Diretores podem atualizar regioes"
  ON regioes FOR UPDATE
  TO authenticated
  USING (is_diretor_for_crud(auth.uid()))
  WITH CHECK (is_diretor_for_crud(auth.uid()));

CREATE POLICY "Diretores podem deletar regioes"
  ON regioes FOR DELETE
  TO authenticated
  USING (is_diretor_for_crud(auth.uid()));

-- =============================================
-- RLS para planos_regioes
-- =============================================
ALTER TABLE planos_regioes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver planos_regioes"
  ON planos_regioes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Diretores podem inserir planos_regioes"
  ON planos_regioes FOR INSERT
  TO authenticated
  WITH CHECK (is_diretor_for_crud(auth.uid()));

CREATE POLICY "Diretores podem atualizar planos_regioes"
  ON planos_regioes FOR UPDATE
  TO authenticated
  USING (is_diretor_for_crud(auth.uid()))
  WITH CHECK (is_diretor_for_crud(auth.uid()));

CREATE POLICY "Diretores podem deletar planos_regioes"
  ON planos_regioes FOR DELETE
  TO authenticated
  USING (is_diretor_for_crud(auth.uid()));

-- =============================================
-- RLS para beneficios_adicionais
-- =============================================
ALTER TABLE beneficios_adicionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver beneficios_adicionais"
  ON beneficios_adicionais FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Diretores podem inserir beneficios_adicionais"
  ON beneficios_adicionais FOR INSERT
  TO authenticated
  WITH CHECK (is_diretor_for_crud(auth.uid()));

CREATE POLICY "Diretores podem atualizar beneficios_adicionais"
  ON beneficios_adicionais FOR UPDATE
  TO authenticated
  USING (is_diretor_for_crud(auth.uid()))
  WITH CHECK (is_diretor_for_crud(auth.uid()));

CREATE POLICY "Diretores podem deletar beneficios_adicionais"
  ON beneficios_adicionais FOR DELETE
  TO authenticated
  USING (is_diretor_for_crud(auth.uid()));

-- =============================================
-- RLS para beneficios_regioes
-- =============================================
ALTER TABLE beneficios_regioes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos autenticados podem ver beneficios_regioes"
  ON beneficios_regioes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Diretores podem inserir beneficios_regioes"
  ON beneficios_regioes FOR INSERT
  TO authenticated
  WITH CHECK (is_diretor_for_crud(auth.uid()));

CREATE POLICY "Diretores podem atualizar beneficios_regioes"
  ON beneficios_regioes FOR UPDATE
  TO authenticated
  USING (is_diretor_for_crud(auth.uid()))
  WITH CHECK (is_diretor_for_crud(auth.uid()));

CREATE POLICY "Diretores podem deletar beneficios_regioes"
  ON beneficios_regioes FOR DELETE
  TO authenticated
  USING (is_diretor_for_crud(auth.uid()));

-- =============================================
-- Trigger para atualizar updated_at
-- =============================================
CREATE OR REPLACE FUNCTION update_regioes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO 'public';

CREATE TRIGGER trigger_regioes_updated_at
  BEFORE UPDATE ON regioes
  FOR EACH ROW
  EXECUTE FUNCTION update_regioes_updated_at();

CREATE TRIGGER trigger_beneficios_adicionais_updated_at
  BEFORE UPDATE ON beneficios_adicionais
  FOR EACH ROW
  EXECUTE FUNCTION update_regioes_updated_at();

-- =============================================
-- Seeds iniciais - Regiões baseadas nos dados estáticos
-- =============================================
INSERT INTO regioes (codigo, nome, descricao, cidades, multiplicador_preco, ordem) VALUES
('RJ', 'Rio de Janeiro - Capital e Metropolitana', 'Região metropolitana do Rio de Janeiro', 
  ARRAY['Rio de Janeiro', 'Niterói', 'São Gonçalo', 'Duque de Caxias', 'Nova Iguaçu', 'Belford Roxo', 'São João de Meriti', 'Magé', 'Itaboraí', 'Mesquita', 'Nilópolis', 'Queimados', 'Japeri', 'Guapimirim', 'Paracambi', 'Seropédica', 'Tanguá', 'Maricá', 'Itaguaí', 'Mangaratiba', 'Petrópolis', 'Teresópolis', 'Nova Friburgo', 'Cachoeiras de Macacu', 'Rio Bonito'], 
  1.00, 1),
('LAGOS', 'Região dos Lagos', 'Região dos Lagos do Rio de Janeiro',
  ARRAY['Araruama', 'Armação dos Búzios', 'Arraial do Cabo', 'Cabo Frio', 'Casimiro de Abreu', 'Iguaba Grande', 'Rio das Ostras', 'São Pedro da Aldeia', 'Saquarema', 'Silva Jardim', 'Macaé', 'Carapebus', 'Quissamã'],
  0.90, 2),
('SP', 'São Paulo - Capital e Metropolitana', 'Região metropolitana de São Paulo',
  ARRAY['São Paulo', 'Guarulhos', 'Campinas', 'São Bernardo do Campo', 'Santo André', 'Osasco', 'São José dos Campos', 'Ribeirão Preto', 'Sorocaba', 'Santos', 'Mauá', 'Diadema', 'Carapicuíba', 'Barueri', 'Taboão da Serra'],
  1.15, 3)
ON CONFLICT (codigo) DO NOTHING;

-- =============================================
-- Seeds iniciais - Benefícios Adicionais
-- =============================================
INSERT INTO beneficios_adicionais (codigo, categoria, nome, descricao, preco, ordem) VALUES
('VIDROS', 'Proteção', 'Proteção de Vidros', 'Cobertura para vidros, retrovisores e faróis', 39.90, 1),
('CARRO_RESERVA_7', 'Conveniência', 'Carro Reserva 7 dias', 'Veículo reserva por até 7 dias em caso de sinistro', 49.90, 2),
('CARRO_RESERVA_15', 'Conveniência', 'Carro Reserva 15 dias', 'Veículo reserva por até 15 dias em caso de sinistro', 79.90, 3),
('CARRO_RESERVA_30', 'Conveniência', 'Carro Reserva 30 dias', 'Veículo reserva por até 30 dias em caso de sinistro', 119.90, 4),
('APP_CONDUTOR', 'Pessoal', 'APP Condutor', 'Acidentes pessoais para o condutor', 29.90, 5),
('APP_PASSAGEIROS', 'Pessoal', 'APP Passageiros', 'Acidentes pessoais para passageiros', 39.90, 6),
('RESPONSABILIDADE_CIVIL', 'Terceiros', 'Responsabilidade Civil', 'Cobertura para danos a terceiros', 59.90, 7),
('ASSISTENCIA_RESIDENCIAL', 'Assistência', 'Assistência Residencial', 'Serviços de assistência para sua residência', 19.90, 8),
('PET', 'Assistência', 'Assistência Pet', 'Cobertura para transporte de pets em caso de acidente', 14.90, 9),
('CHAVEIRO_24H', 'Assistência', 'Chaveiro 24h', 'Serviço de chaveiro automotivo 24 horas', 9.90, 10)
ON CONFLICT (codigo) DO NOTHING;

-- Vincular todos os benefícios a todas as regiões por padrão
INSERT INTO beneficios_regioes (beneficio_id, regiao_id, ativo)
SELECT b.id, r.id, true
FROM beneficios_adicionais b
CROSS JOIN regioes r
ON CONFLICT (beneficio_id, regiao_id) DO NOTHING;

-- Vincular todos os planos ativos a todas as regiões por padrão
INSERT INTO planos_regioes (plano_id, regiao_id, ativo)
SELECT p.id, r.id, true
FROM planos p
CROSS JOIN regioes r
WHERE p.ativo = true
ON CONFLICT (plano_id, regiao_id) DO NOTHING;