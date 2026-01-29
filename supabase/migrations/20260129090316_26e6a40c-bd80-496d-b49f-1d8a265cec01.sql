-- =====================================================
-- MÓDULO RH: Tabelas de Treinamentos e Recrutamento (COMPLETO)
-- =====================================================

-- Dropar tabelas existentes se houver
DROP TABLE IF EXISTS entrevistas CASCADE;
DROP TABLE IF EXISTS candidatos_historico CASCADE;
DROP TABLE IF EXISTS candidatos CASCADE;
DROP TABLE IF EXISTS vagas CASCADE;
DROP TABLE IF EXISTS treinamentos_participantes CASCADE;
DROP TABLE IF EXISTS treinamentos CASCADE;

-- Função para atualizar updated_at (criar antes das tabelas)
CREATE OR REPLACE FUNCTION update_rh_tables_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 1. Tabela de Treinamentos
CREATE TABLE treinamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20),
  nome VARCHAR(255) NOT NULL,
  tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('obrigatorio', 'capacitacao', 'desenvolvimento', 'integracao')),
  modalidade VARCHAR(50) NOT NULL CHECK (modalidade IN ('presencial', 'online', 'hibrido')),
  data_inicio DATE,
  data_fim DATE,
  carga_horaria INTEGER,
  instrutor_nome VARCHAR(255),
  instrutor_tipo VARCHAR(50) CHECK (instrutor_tipo IN ('interno', 'externo')),
  instrutor_id UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  local_treinamento TEXT,
  link_online TEXT,
  conteudo TEXT,
  objetivo TEXT,
  publico_alvo TEXT,
  pre_requisitos TEXT,
  status_treinamento VARCHAR(50) DEFAULT 'planejado' CHECK (status_treinamento IN ('planejado', 'programado', 'em_andamento', 'concluido', 'cancelado')),
  valor_investimento DECIMAL(12,2),
  certificado_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Participantes do Treinamento
CREATE TABLE treinamentos_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treinamento_id UUID REFERENCES treinamentos(id) ON DELETE CASCADE NOT NULL,
  funcionario_id UUID REFERENCES funcionarios(id) ON DELETE CASCADE NOT NULL,
  status_participante VARCHAR(50) DEFAULT 'inscrito' CHECK (status_participante IN ('inscrito', 'confirmado', 'presente', 'ausente', 'aprovado', 'reprovado')),
  nota DECIMAL(5,2),
  presenca_percentual INTEGER,
  certificado_url TEXT,
  certificado_emitido_em TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(treinamento_id, funcionario_id)
);

-- 3. Tabela de Vagas (Recrutamento)
CREATE TABLE vagas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20),
  titulo VARCHAR(255) NOT NULL,
  departamento_id UUID REFERENCES departamentos(id) ON DELETE SET NULL,
  cargo_id UUID REFERENCES cargos(id) ON DELETE SET NULL,
  gestor_id UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  quantidade INTEGER DEFAULT 1,
  tipo_contrato VARCHAR(50) CHECK (tipo_contrato IN ('clt', 'pj', 'estagio', 'temporario', 'aprendiz')),
  jornada VARCHAR(50) CHECK (jornada IN ('integral', 'parcial', 'flexivel', 'remoto', 'hibrido')),
  salario_min DECIMAL(12,2),
  salario_max DECIMAL(12,2),
  salario_publico BOOLEAN DEFAULT false,
  requisitos TEXT,
  requisitos_desejaveis TEXT,
  atividades TEXT,
  beneficios_vaga TEXT,
  local_trabalho TEXT,
  status_vaga VARCHAR(50) DEFAULT 'rascunho' CHECK (status_vaga IN ('rascunho', 'aberta', 'em_andamento', 'pausada', 'encerrada', 'cancelada')),
  urgencia VARCHAR(50) DEFAULT 'normal' CHECK (urgencia IN ('baixa', 'normal', 'alta', 'urgente')),
  publicado_em TIMESTAMP WITH TIME ZONE,
  encerrado_em TIMESTAMP WITH TIME ZONE,
  motivo_encerramento TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Candidatos
CREATE TABLE candidatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vaga_id UUID REFERENCES vagas(id) ON DELETE CASCADE NOT NULL,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  telefone VARCHAR(20),
  cpf VARCHAR(14),
  curriculo_url TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  pretensao_salarial DECIMAL(12,2),
  disponibilidade_inicio DATE,
  etapa VARCHAR(50) DEFAULT 'triagem' CHECK (etapa IN ('triagem', 'entrevista_rh', 'teste_tecnico', 'entrevista_gestor', 'proposta', 'contratado', 'desistiu', 'reprovado')),
  origem VARCHAR(50) CHECK (origem IN ('linkedin', 'indeed', 'indicacao', 'site', 'outros')),
  indicado_por VARCHAR(255),
  avaliacao_rh TEXT,
  nota_rh INTEGER CHECK (nota_rh >= 0 AND nota_rh <= 10),
  avaliacao_tecnica TEXT,
  nota_tecnica INTEGER CHECK (nota_tecnica >= 0 AND nota_tecnica <= 10),
  avaliacao_gestor TEXT,
  nota_gestor INTEGER CHECK (nota_gestor >= 0 AND nota_gestor <= 10),
  feedback_final TEXT,
  status_candidato VARCHAR(50) DEFAULT 'ativo' CHECK (status_candidato IN ('ativo', 'em_processo', 'aprovado', 'reprovado', 'desistiu', 'contratado')),
  motivo_reprovacao TEXT,
  data_contratacao DATE,
  funcionario_id UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Histórico de Etapas do Candidato
CREATE TABLE candidatos_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id UUID REFERENCES candidatos(id) ON DELETE CASCADE NOT NULL,
  etapa_anterior VARCHAR(50),
  etapa_nova VARCHAR(50) NOT NULL,
  observacao TEXT,
  responsavel_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Agendamentos de Entrevistas
CREATE TABLE entrevistas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id UUID REFERENCES candidatos(id) ON DELETE CASCADE NOT NULL,
  tipo_entrevista VARCHAR(50) NOT NULL CHECK (tipo_entrevista IN ('rh', 'tecnica', 'gestor', 'final')),
  data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
  duracao_minutos INTEGER DEFAULT 60,
  local_entrevista TEXT,
  link_online TEXT,
  entrevistador_id UUID REFERENCES funcionarios(id) ON DELETE SET NULL,
  entrevistador_nome VARCHAR(255),
  status_entrevista VARCHAR(50) DEFAULT 'agendada' CHECK (status_entrevista IN ('agendada', 'confirmada', 'realizada', 'cancelada', 'remarcada', 'nao_compareceu')),
  avaliacao TEXT,
  nota INTEGER CHECK (nota >= 0 AND nota <= 10),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Função para gerar código do treinamento
CREATE OR REPLACE FUNCTION gerar_codigo_treinamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  seq INTEGER;
  ano_atual TEXT;
BEGIN
  IF NEW.codigo IS NULL THEN
    ano_atual := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 10) AS INTEGER)), 0) + 1
    INTO seq
    FROM treinamentos
    WHERE codigo LIKE 'TRE-' || ano_atual || '-%';
    
    NEW.codigo := 'TRE-' || ano_atual || '-' || LPAD(seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_gerar_codigo_treinamento
  BEFORE INSERT ON treinamentos
  FOR EACH ROW
  EXECUTE FUNCTION gerar_codigo_treinamento();

-- Função para gerar código da vaga
CREATE OR REPLACE FUNCTION gerar_codigo_vaga()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  seq INTEGER;
  ano_atual TEXT;
BEGIN
  IF NEW.codigo IS NULL THEN
    ano_atual := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 10) AS INTEGER)), 0) + 1
    INTO seq
    FROM vagas
    WHERE codigo LIKE 'VAG-' || ano_atual || '-%';
    
    NEW.codigo := 'VAG-' || ano_atual || '-' || LPAD(seq::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_gerar_codigo_vaga
  BEFORE INSERT ON vagas
  FOR EACH ROW
  EXECUTE FUNCTION gerar_codigo_vaga();

-- Função para registrar histórico de candidato
CREATE OR REPLACE FUNCTION fn_candidato_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.etapa IS DISTINCT FROM NEW.etapa THEN
    INSERT INTO candidatos_historico (candidato_id, etapa_anterior, etapa_nova)
    VALUES (NEW.id, OLD.etapa, NEW.etapa);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_candidato_historico
  AFTER UPDATE ON candidatos
  FOR EACH ROW
  EXECUTE FUNCTION fn_candidato_historico();

-- Triggers updated_at
CREATE TRIGGER trigger_treinamentos_updated_at
  BEFORE UPDATE ON treinamentos
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_tables_updated_at();

CREATE TRIGGER trigger_vagas_updated_at
  BEFORE UPDATE ON vagas
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_tables_updated_at();

CREATE TRIGGER trigger_candidatos_updated_at
  BEFORE UPDATE ON candidatos
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_tables_updated_at();

CREATE TRIGGER trigger_entrevistas_updated_at
  BEFORE UPDATE ON entrevistas
  FOR EACH ROW
  EXECUTE FUNCTION update_rh_tables_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE treinamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE treinamentos_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidatos_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE entrevistas ENABLE ROW LEVEL SECURITY;

-- Políticas para treinamentos
CREATE POLICY "Funcionarios podem visualizar treinamentos"
  ON treinamentos FOR SELECT
  TO authenticated
  USING (public.am_i_funcionario());

CREATE POLICY "Gerencia pode gerenciar treinamentos"
  ON treinamentos FOR ALL
  TO authenticated
  USING (public.is_gerencia(auth.uid()) OR public.has_role(auth.uid(), 'diretor'));

-- Políticas para participantes
CREATE POLICY "Funcionarios podem ver participantes"
  ON treinamentos_participantes FOR SELECT
  TO authenticated
  USING (public.am_i_funcionario());

CREATE POLICY "Gerencia pode gerenciar participantes"
  ON treinamentos_participantes FOR ALL
  TO authenticated
  USING (public.is_gerencia(auth.uid()) OR public.has_role(auth.uid(), 'diretor'));

-- Políticas para vagas
CREATE POLICY "Funcionarios podem visualizar vagas"
  ON vagas FOR SELECT
  TO authenticated
  USING (public.am_i_funcionario());

CREATE POLICY "Gerencia pode gerenciar vagas"
  ON vagas FOR ALL
  TO authenticated
  USING (public.is_gerencia(auth.uid()) OR public.has_role(auth.uid(), 'diretor'));

-- Políticas para candidatos
CREATE POLICY "Funcionarios podem visualizar candidatos"
  ON candidatos FOR SELECT
  TO authenticated
  USING (public.am_i_funcionario());

CREATE POLICY "Gerencia pode gerenciar candidatos"
  ON candidatos FOR ALL
  TO authenticated
  USING (public.is_gerencia(auth.uid()) OR public.has_role(auth.uid(), 'diretor'));

-- Políticas para histórico de candidatos
CREATE POLICY "Funcionarios podem ver historico candidatos"
  ON candidatos_historico FOR SELECT
  TO authenticated
  USING (public.am_i_funcionario());

CREATE POLICY "Gerencia pode gerenciar historico candidatos"
  ON candidatos_historico FOR ALL
  TO authenticated
  USING (public.is_gerencia(auth.uid()) OR public.has_role(auth.uid(), 'diretor'));

-- Políticas para entrevistas
CREATE POLICY "Funcionarios podem ver entrevistas"
  ON entrevistas FOR SELECT
  TO authenticated
  USING (public.am_i_funcionario());

CREATE POLICY "Gerencia pode gerenciar entrevistas"
  ON entrevistas FOR ALL
  TO authenticated
  USING (public.is_gerencia(auth.uid()) OR public.has_role(auth.uid(), 'diretor'));

-- =====================================================
-- ÍNDICES
-- =====================================================

CREATE INDEX idx_treinamentos_status ON treinamentos(status_treinamento);
CREATE INDEX idx_treinamentos_tipo ON treinamentos(tipo);
CREATE INDEX idx_treinamentos_data ON treinamentos(data_inicio);
CREATE INDEX idx_treinamentos_participantes_treinamento ON treinamentos_participantes(treinamento_id);
CREATE INDEX idx_treinamentos_participantes_funcionario ON treinamentos_participantes(funcionario_id);

CREATE INDEX idx_vagas_status ON vagas(status_vaga);
CREATE INDEX idx_vagas_departamento ON vagas(departamento_id);
CREATE INDEX idx_candidatos_vaga ON candidatos(vaga_id);
CREATE INDEX idx_candidatos_etapa ON candidatos(etapa);
CREATE INDEX idx_candidatos_status ON candidatos(status_candidato);
CREATE INDEX idx_entrevistas_candidato ON entrevistas(candidato_id);
CREATE INDEX idx_entrevistas_data ON entrevistas(data_hora);