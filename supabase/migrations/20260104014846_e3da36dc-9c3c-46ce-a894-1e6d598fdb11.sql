
-- =============================================
-- MÓDULO RH - TABELAS COMPLETAS
-- =============================================

-- DEPARTAMENTOS
CREATE TABLE IF NOT EXISTS departamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    responsavel_id UUID REFERENCES profiles(id),
    departamento_pai_id UUID REFERENCES departamentos(id),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CARGOS
CREATE TABLE IF NOT EXISTS cargos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    descricao TEXT,
    departamento_id UUID REFERENCES departamentos(id),
    nivel INTEGER DEFAULT 1, -- 1=Junior, 2=Pleno, 3=Senior, 4=Coordenador, 5=Gerente, 6=Diretor
    cbo VARCHAR(10), -- Classificação Brasileira de Ocupações
    salario_base DECIMAL(10,2),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FUNCIONÁRIOS
CREATE TABLE IF NOT EXISTS funcionarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID UNIQUE REFERENCES profiles(id),
    
    -- Dados Pessoais
    nome_completo VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    rg VARCHAR(20),
    rg_orgao VARCHAR(20),
    data_nascimento DATE,
    sexo VARCHAR(1) CHECK (sexo IN ('M', 'F')),
    estado_civil VARCHAR(20) CHECK (estado_civil IN (
        'solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel'
    )),
    nacionalidade VARCHAR(50) DEFAULT 'Brasileira',
    naturalidade VARCHAR(100),
    
    -- Contato
    email_pessoal VARCHAR(255),
    telefone VARCHAR(20),
    celular VARCHAR(20),
    
    -- Endereço
    cep VARCHAR(10),
    logradouro VARCHAR(255),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    
    -- Dados Profissionais
    matricula VARCHAR(20) UNIQUE,
    cargo_id UUID REFERENCES cargos(id),
    departamento_id UUID REFERENCES departamentos(id),
    gestor_id UUID REFERENCES funcionarios(id),
    
    -- Contrato
    tipo_contrato VARCHAR(20) CHECK (tipo_contrato IN (
        'clt', 'pj', 'estagio', 'temporario', 'aprendiz'
    )),
    data_admissao DATE NOT NULL,
    data_demissao DATE,
    motivo_demissao TEXT,
    
    -- Jornada
    carga_horaria_semanal INTEGER DEFAULT 44,
    horario_entrada TIME,
    horario_saida TIME,
    intervalo_minutos INTEGER DEFAULT 60,
    
    -- Remuneração
    salario_atual DECIMAL(10,2),
    
    -- Dados Bancários
    banco VARCHAR(100),
    agencia VARCHAR(20),
    conta VARCHAR(30),
    tipo_conta VARCHAR(20) CHECK (tipo_conta IN ('corrente', 'poupanca')),
    pix_chave VARCHAR(255),
    pix_tipo VARCHAR(20),
    
    -- Documentos
    ctps_numero VARCHAR(20),
    ctps_serie VARCHAR(10),
    ctps_uf VARCHAR(2),
    pis VARCHAR(20),
    titulo_eleitor VARCHAR(20),
    zona_eleitoral VARCHAR(10),
    secao_eleitoral VARCHAR(10),
    certificado_reservista VARCHAR(20),
    cnh VARCHAR(20),
    cnh_categoria VARCHAR(5),
    cnh_validade DATE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN (
        'ativo', 'ferias', 'afastado', 'licenca', 'desligado'
    )),
    
    -- Foto
    foto_url VARCHAR(500),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DEPENDENTES
CREATE TABLE IF NOT EXISTS funcionarios_dependentes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14),
    data_nascimento DATE,
    parentesco VARCHAR(30) CHECK (parentesco IN (
        'conjuge', 'filho', 'filha', 'pai', 'mae', 'outros'
    )),
    inclui_ir BOOLEAN DEFAULT false,
    inclui_plano_saude BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOCUMENTOS DO FUNCIONÁRIO
CREATE TABLE IF NOT EXISTS funcionarios_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN (
        'rg', 'cpf', 'ctps', 'pis', 'titulo_eleitor', 'reservista',
        'cnh', 'comprovante_residencia', 'comprovante_escolaridade',
        'certidao_nascimento', 'certidao_casamento', 'exame_admissional',
        'exame_periodico', 'exame_demissional', 'contrato_trabalho',
        'termo_responsabilidade', 'atestado_medico', 'outros'
    )),
    nome VARCHAR(255) NOT NULL,
    arquivo_url VARCHAR(500) NOT NULL,
    data_validade DATE,
    observacoes TEXT,
    enviado_por UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HISTÓRICO DE CARGOS/SALÁRIOS
CREATE TABLE IF NOT EXISTS funcionarios_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
        'admissao', 'promocao', 'merito', 'transferencia', 
        'reajuste', 'demissao', 'retorno_afastamento'
    )),
    cargo_anterior_id UUID REFERENCES cargos(id),
    departamento_anterior_id UUID REFERENCES departamentos(id),
    salario_anterior DECIMAL(10,2),
    cargo_novo_id UUID REFERENCES cargos(id),
    departamento_novo_id UUID REFERENCES departamentos(id),
    salario_novo DECIMAL(10,2),
    data_vigencia DATE NOT NULL,
    motivo TEXT,
    registrado_por UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONTROLE DE PONTO
CREATE TABLE IF NOT EXISTS ponto_registros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id),
    data DATE NOT NULL,
    entrada_1 TIME,
    saida_1 TIME,
    entrada_2 TIME,
    saida_2 TIME,
    entrada_3 TIME,
    saida_3 TIME,
    horas_trabalhadas INTERVAL,
    horas_extras INTERVAL,
    horas_faltantes INTERVAL,
    tipo_dia VARCHAR(20) DEFAULT 'normal' CHECK (tipo_dia IN (
        'normal', 'feriado', 'folga', 'compensacao', 'falta', 
        'atestado', 'ferias', 'licenca'
    )),
    justificativa TEXT,
    documento_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN (
        'pendente', 'aprovado', 'rejeitado', 'ajustado'
    )),
    aprovado_por UUID REFERENCES profiles(id),
    aprovado_em TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(funcionario_id, data)
);

-- FÉRIAS
CREATE TABLE IF NOT EXISTS ferias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id),
    periodo_aquisitivo_inicio DATE NOT NULL,
    periodo_aquisitivo_fim DATE NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    dias_gozados INTEGER NOT NULL,
    dias_abono INTEGER DEFAULT 0,
    valor_abono DECIMAL(10,2),
    adiantamento_13 BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'solicitada' CHECK (status IN (
        'solicitada', 'aprovada', 'em_gozo', 'concluida', 'cancelada'
    )),
    aprovado_por UUID REFERENCES profiles(id),
    aprovado_em TIMESTAMPTZ,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AFASTAMENTOS E LICENÇAS
CREATE TABLE IF NOT EXISTS afastamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id),
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
        'atestado_medico', 'licenca_maternidade', 'licenca_paternidade',
        'licenca_casamento', 'licenca_obito', 'licenca_nao_remunerada',
        'acidente_trabalho', 'auxilio_doenca', 'outros'
    )),
    data_inicio DATE NOT NULL,
    data_fim DATE,
    dias_afastamento INTEGER,
    motivo TEXT NOT NULL,
    cid VARCHAR(10),
    documento_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'ativo' CHECK (status IN (
        'ativo', 'encerrado', 'cancelado'
    )),
    registrado_por UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- BENEFÍCIOS
CREATE TABLE IF NOT EXISTS beneficios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
        'vale_transporte', 'vale_refeicao', 'vale_alimentacao',
        'plano_saude', 'plano_odontologico', 'seguro_vida',
        'auxilio_creche', 'auxilio_educacao', 'gympass', 'outros'
    )),
    fornecedor VARCHAR(100),
    descricao TEXT,
    valor_empresa DECIMAL(10,2) DEFAULT 0,
    valor_funcionario DECIMAL(10,2) DEFAULT 0,
    percentual_desconto DECIMAL(5,2),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FUNCIONÁRIOS BENEFÍCIOS
CREATE TABLE IF NOT EXISTS funcionarios_beneficios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id) ON DELETE CASCADE,
    beneficio_id UUID NOT NULL REFERENCES beneficios(id),
    valor_empresa DECIMAL(10,2),
    valor_funcionario DECIMAL(10,2),
    dados_adicionais JSONB,
    data_inicio DATE NOT NULL,
    data_fim DATE,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(funcionario_id, beneficio_id)
);

-- BANCO DE HORAS
CREATE TABLE IF NOT EXISTS banco_horas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id),
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano INTEGER NOT NULL,
    saldo_anterior INTERVAL DEFAULT '00:00:00',
    horas_extras INTERVAL DEFAULT '00:00:00',
    horas_compensadas INTERVAL DEFAULT '00:00:00',
    saldo_atual INTERVAL DEFAULT '00:00:00',
    fechado BOOLEAN DEFAULT false,
    fechado_em TIMESTAMPTZ,
    fechado_por UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(funcionario_id, mes, ano)
);

-- AVALIAÇÕES DE DESEMPENHO
CREATE TABLE IF NOT EXISTS avaliacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id),
    avaliador_id UUID NOT NULL REFERENCES funcionarios(id),
    periodo_inicio DATE NOT NULL,
    periodo_fim DATE NOT NULL,
    tipo VARCHAR(30) CHECK (tipo IN (
        'experiencia', 'anual', 'promocao', 'feedback', 'pdi'
    )),
    nota_competencias DECIMAL(3,2),
    nota_resultados DECIMAL(3,2),
    nota_comportamento DECIMAL(3,2),
    nota_final DECIMAL(3,2),
    pontos_fortes TEXT,
    pontos_melhoria TEXT,
    plano_desenvolvimento TEXT,
    feedback_funcionario TEXT,
    status VARCHAR(20) DEFAULT 'rascunho' CHECK (status IN (
        'rascunho', 'em_avaliacao', 'aguardando_feedback', 
        'concluida', 'cancelada'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- TREINAMENTOS
CREATE TABLE IF NOT EXISTS treinamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    tipo VARCHAR(30) CHECK (tipo IN (
        'obrigatorio', 'tecnico', 'comportamental', 
        'lideranca', 'integracao', 'certificacao'
    )),
    carga_horaria INTEGER,
    modalidade VARCHAR(20) CHECK (modalidade IN (
        'presencial', 'online', 'hibrido'
    )),
    instrutor VARCHAR(255),
    instituicao VARCHAR(255),
    data_inicio DATE,
    data_fim DATE,
    vagas INTEGER,
    custo_por_pessoa DECIMAL(10,2),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FUNCIONÁRIOS TREINAMENTOS
CREATE TABLE IF NOT EXISTS funcionarios_treinamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    funcionario_id UUID NOT NULL REFERENCES funcionarios(id),
    treinamento_id UUID NOT NULL REFERENCES treinamentos(id),
    status VARCHAR(20) DEFAULT 'inscrito' CHECK (status IN (
        'inscrito', 'confirmado', 'em_andamento', 
        'concluido', 'reprovado', 'cancelado'
    )),
    nota DECIMAL(5,2),
    certificado_url VARCHAR(500),
    data_inscricao DATE DEFAULT CURRENT_DATE,
    data_conclusao DATE,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_funcionarios_status ON funcionarios(status);
CREATE INDEX IF NOT EXISTS idx_funcionarios_departamento ON funcionarios(departamento_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_cargo ON funcionarios(cargo_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_gestor ON funcionarios(gestor_id);
CREATE INDEX IF NOT EXISTS idx_ponto_funcionario_data ON ponto_registros(funcionario_id, data);
CREATE INDEX IF NOT EXISTS idx_ferias_funcionario ON ferias(funcionario_id);
CREATE INDEX IF NOT EXISTS idx_afastamentos_funcionario ON afastamentos(funcionario_id, status);
CREATE INDEX IF NOT EXISTS idx_banco_horas_periodo ON banco_horas(funcionario_id, ano, mes);

-- =============================================
-- FUNÇÃO E TRIGGER PARA MATRÍCULA
-- =============================================

CREATE OR REPLACE FUNCTION gerar_matricula_funcionario()
RETURNS TRIGGER AS $$
DECLARE
  seq INTEGER;
  ano VARCHAR(4);
BEGIN
  ano := TO_CHAR(CURRENT_DATE, 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(matricula FROM 6 FOR 4) AS INTEGER)), 0) + 1
  INTO seq
  FROM funcionarios
  WHERE matricula LIKE ano || '-%';
  
  NEW.matricula := ano || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_gerar_matricula ON funcionarios;
CREATE TRIGGER trigger_gerar_matricula
  BEFORE INSERT ON funcionarios
  FOR EACH ROW
  WHEN (NEW.matricula IS NULL)
  EXECUTE FUNCTION gerar_matricula_funcionario();

-- =============================================
-- VIEWS
-- =============================================

CREATE OR REPLACE VIEW view_funcionarios_ativos AS
SELECT 
    f.*,
    c.nome as cargo_nome,
    c.nivel as cargo_nivel,
    d.nome as departamento_nome,
    g.nome_completo as gestor_nome,
    p.email as email_corporativo
FROM funcionarios f
LEFT JOIN cargos c ON c.id = f.cargo_id
LEFT JOIN departamentos d ON d.id = f.departamento_id
LEFT JOIN funcionarios g ON g.id = f.gestor_id
LEFT JOIN profiles p ON p.id = f.usuario_id
WHERE f.status != 'desligado';

CREATE OR REPLACE VIEW view_aniversariantes_mes AS
SELECT 
    f.id,
    f.nome_completo,
    f.data_nascimento,
    f.foto_url,
    c.nome as cargo_nome,
    d.nome as departamento_nome,
    EXTRACT(DAY FROM f.data_nascimento) as dia
FROM funcionarios f
LEFT JOIN cargos c ON c.id = f.cargo_id
LEFT JOIN departamentos d ON d.id = f.departamento_id
WHERE f.status = 'ativo'
  AND EXTRACT(MONTH FROM f.data_nascimento) = EXTRACT(MONTH FROM CURRENT_DATE)
ORDER BY EXTRACT(DAY FROM f.data_nascimento);

-- =============================================
-- RLS POLICIES
-- =============================================

-- DEPARTAMENTOS
ALTER TABLE departamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "departamentos_select_funcionario" ON departamentos
  FOR SELECT USING (is_funcionario(auth.uid()));

CREATE POLICY "departamentos_all_gerencia" ON departamentos
  FOR ALL USING (is_gerencia(auth.uid()));

-- CARGOS
ALTER TABLE cargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cargos_select_funcionario" ON cargos
  FOR SELECT USING (is_funcionario(auth.uid()));

CREATE POLICY "cargos_all_gerencia" ON cargos
  FOR ALL USING (is_gerencia(auth.uid()));

-- FUNCIONARIOS
ALTER TABLE funcionarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funcionarios_select_proprio" ON funcionarios
  FOR SELECT USING (
    usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "funcionarios_all_gerencia" ON funcionarios
  FOR ALL USING (is_gerencia(auth.uid()));

-- FUNCIONARIOS_DEPENDENTES
ALTER TABLE funcionarios_dependentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dependentes_select_proprio" ON funcionarios_dependentes
  FOR SELECT USING (
    funcionario_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "dependentes_all_gerencia" ON funcionarios_dependentes
  FOR ALL USING (is_gerencia(auth.uid()));

-- FUNCIONARIOS_DOCUMENTOS
ALTER TABLE funcionarios_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documentos_func_select_proprio" ON funcionarios_documentos
  FOR SELECT USING (
    funcionario_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "documentos_func_all_gerencia" ON funcionarios_documentos
  FOR ALL USING (is_gerencia(auth.uid()));

-- FUNCIONARIOS_HISTORICO
ALTER TABLE funcionarios_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historico_func_select_proprio" ON funcionarios_historico
  FOR SELECT USING (
    funcionario_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "historico_func_all_gerencia" ON funcionarios_historico
  FOR ALL USING (is_gerencia(auth.uid()));

-- PONTO_REGISTROS
ALTER TABLE ponto_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ponto_select_proprio" ON ponto_registros
  FOR SELECT USING (
    funcionario_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "ponto_insert_proprio" ON ponto_registros
  FOR INSERT WITH CHECK (
    funcionario_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "ponto_all_gerencia" ON ponto_registros
  FOR ALL USING (is_gerencia(auth.uid()));

-- FERIAS
ALTER TABLE ferias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ferias_select_proprio" ON ferias
  FOR SELECT USING (
    funcionario_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "ferias_insert_proprio" ON ferias
  FOR INSERT WITH CHECK (
    funcionario_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "ferias_all_gerencia" ON ferias
  FOR ALL USING (is_gerencia(auth.uid()));

-- AFASTAMENTOS
ALTER TABLE afastamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "afastamentos_select_proprio" ON afastamentos
  FOR SELECT USING (
    funcionario_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "afastamentos_all_gerencia" ON afastamentos
  FOR ALL USING (is_gerencia(auth.uid()));

-- BENEFICIOS
ALTER TABLE beneficios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "beneficios_select_funcionario" ON beneficios
  FOR SELECT USING (is_funcionario(auth.uid()));

CREATE POLICY "beneficios_all_gerencia" ON beneficios
  FOR ALL USING (is_gerencia(auth.uid()));

-- FUNCIONARIOS_BENEFICIOS
ALTER TABLE funcionarios_beneficios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "func_beneficios_select_proprio" ON funcionarios_beneficios
  FOR SELECT USING (
    funcionario_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "func_beneficios_all_gerencia" ON funcionarios_beneficios
  FOR ALL USING (is_gerencia(auth.uid()));

-- BANCO_HORAS
ALTER TABLE banco_horas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "banco_horas_select_proprio" ON banco_horas
  FOR SELECT USING (
    funcionario_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "banco_horas_all_gerencia" ON banco_horas
  FOR ALL USING (is_gerencia(auth.uid()));

-- AVALIACOES
ALTER TABLE avaliacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "avaliacoes_select_proprio" ON avaliacoes
  FOR SELECT USING (
    funcionario_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR avaliador_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "avaliacoes_all_gerencia" ON avaliacoes
  FOR ALL USING (is_gerencia(auth.uid()));

-- TREINAMENTOS
ALTER TABLE treinamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treinamentos_select_funcionario" ON treinamentos
  FOR SELECT USING (is_funcionario(auth.uid()));

CREATE POLICY "treinamentos_all_gerencia" ON treinamentos
  FOR ALL USING (is_gerencia(auth.uid()));

-- FUNCIONARIOS_TREINAMENTOS
ALTER TABLE funcionarios_treinamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "func_treinamentos_select_proprio" ON funcionarios_treinamentos
  FOR SELECT USING (
    funcionario_id IN (SELECT id FROM funcionarios WHERE usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()))
    OR is_funcionario(auth.uid())
  );

CREATE POLICY "func_treinamentos_all_gerencia" ON funcionarios_treinamentos
  FOR ALL USING (is_gerencia(auth.uid()));

-- =============================================
-- STORAGE BUCKET
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('funcionarios', 'funcionarios', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Staff can manage funcionarios files"
ON storage.objects FOR ALL
USING (bucket_id = 'funcionarios' AND is_funcionario(auth.uid()));
