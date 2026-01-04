
-- =============================================
-- MÓDULO JURÍDICO - TABELAS
-- =============================================

-- ADVOGADOS E ESCRITÓRIOS
CREATE TABLE IF NOT EXISTS advogados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('interno', 'externo', 'escritorio')),
    nome VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(18),
    oab VARCHAR(20),
    oab_estado VARCHAR(2),
    email VARCHAR(255),
    telefone VARCHAR(20),
    whatsapp VARCHAR(20),
    cep VARCHAR(10),
    logradouro VARCHAR(255),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),
    especialidades TEXT[] DEFAULT '{}',
    banco VARCHAR(100),
    agencia VARCHAR(20),
    conta VARCHAR(30),
    pix_chave VARCHAR(255),
    pix_tipo VARCHAR(20),
    tipo_contrato VARCHAR(20) CHECK (tipo_contrato IN ('fixo', 'por_processo', 'hibrido')),
    valor_fixo DECIMAL(10,2),
    percentual_exito DECIMAL(5,2),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PROCESSOS JUDICIAIS
CREATE TABLE IF NOT EXISTS processos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero VARCHAR(30) UNIQUE,
    numero_processo VARCHAR(50),
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
        'civel', 'trabalhista', 'criminal', 'consumidor',
        'transito', 'administrativo', 'tributario', 'outros'
    )),
    natureza VARCHAR(30) NOT NULL CHECK (natureza IN (
        'autor', 'reu', 'terceiro_interessado', 'assistente'
    )),
    rito VARCHAR(30) CHECK (rito IN (
        'ordinario', 'sumario', 'sumarissimo', 'especial', 'juizado'
    )),
    parte_contraria_nome VARCHAR(255) NOT NULL,
    parte_contraria_cpf_cnpj VARCHAR(18),
    parte_contraria_advogado VARCHAR(255),
    parte_contraria_oab VARCHAR(30),
    associado_id UUID REFERENCES associados(id),
    sinistro_id UUID REFERENCES sinistros(id),
    advogado_id UUID REFERENCES advogados(id),
    tribunal VARCHAR(100),
    comarca VARCHAR(100),
    vara VARCHAR(100),
    valor_causa DECIMAL(14,2),
    valor_condenacao DECIMAL(14,2),
    valor_acordo DECIMAL(14,2),
    data_distribuicao DATE,
    data_citacao DATE,
    data_audiencia DATE,
    data_sentenca DATE,
    data_transito_julgado DATE,
    data_encerramento DATE,
    status VARCHAR(30) DEFAULT 'ativo' CHECK (status IN (
        'ativo', 'suspenso', 'arquivado', 'encerrado_procedente',
        'encerrado_improcedente', 'acordo', 'desistencia', 'extinto'
    )),
    fase VARCHAR(30) DEFAULT 'inicial' CHECK (fase IN (
        'inicial', 'citacao', 'contestacao', 'instrucao',
        'alegacoes_finais', 'sentenca', 'recurso', 'execucao',
        'cumprimento_sentenca', 'encerrado'
    )),
    objeto TEXT NOT NULL,
    observacoes TEXT,
    responsavel_id UUID REFERENCES profiles(id),
    criado_por UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ANDAMENTOS PROCESSUAIS
CREATE TABLE IF NOT EXISTS processos_andamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    descricao TEXT NOT NULL,
    tipo VARCHAR(30) CHECK (tipo IN (
        'despacho', 'decisao', 'sentenca', 'acordao',
        'peticao', 'audiencia', 'pericia', 'citacao',
        'intimacao', 'publicacao', 'outros'
    )),
    gera_prazo BOOLEAN DEFAULT false,
    prazo_dias INTEGER,
    prazo_data DATE,
    prazo_descricao VARCHAR(255),
    prazo_cumprido BOOLEAN DEFAULT false,
    prazo_cumprido_em TIMESTAMPTZ,
    registrado_por UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PRAZOS PROCESSUAIS
CREATE TABLE IF NOT EXISTS processos_prazos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
    andamento_id UUID REFERENCES processos_andamentos(id),
    descricao VARCHAR(255) NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    dias_uteis BOOLEAN DEFAULT true,
    prioridade VARCHAR(20) DEFAULT 'normal' CHECK (prioridade IN (
        'baixa', 'normal', 'alta', 'urgente'
    )),
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN (
        'pendente', 'em_andamento', 'cumprido', 'perdido', 'cancelado'
    )),
    cumprido_em TIMESTAMPTZ,
    cumprido_por UUID REFERENCES profiles(id),
    observacao_cumprimento TEXT,
    alerta_enviado_3d BOOLEAN DEFAULT false,
    alerta_enviado_1d BOOLEAN DEFAULT false,
    alerta_enviado_hoje BOOLEAN DEFAULT false,
    responsavel_id UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DOCUMENTOS DO PROCESSO
CREATE TABLE IF NOT EXISTS processos_documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
    andamento_id UUID REFERENCES processos_andamentos(id),
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
        'peticao_inicial', 'contestacao', 'replica', 'recurso',
        'contrarrazoes', 'sentenca', 'acordao', 'procuracao',
        'substabelecimento', 'laudo', 'ata_audiencia', 
        'comprovante', 'notificacao', 'outros'
    )),
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    arquivo_url VARCHAR(500),
    arquivo_tamanho INTEGER,
    enviado_por UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIÊNCIAS
CREATE TABLE IF NOT EXISTS processos_audiencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
        'conciliacao', 'instrucao', 'julgamento', 'una', 'especial'
    )),
    data_hora TIMESTAMPTZ NOT NULL,
    local VARCHAR(255),
    link_videoconferencia VARCHAR(500),
    pauta TEXT,
    status VARCHAR(20) DEFAULT 'agendada' CHECK (status IN (
        'agendada', 'realizada', 'adiada', 'cancelada', 'redesignada'
    )),
    resultado TEXT,
    advogado_presente BOOLEAN,
    parte_presente BOOLEAN,
    testemunhas TEXT,
    observacoes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- HONORÁRIOS/CUSTAS
CREATE TABLE IF NOT EXISTS processos_custas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL CHECK (tipo IN (
        'custas_iniciais', 'custas_finais', 'honorarios_advocaticios',
        'honorarios_sucumbencia', 'honorarios_pericia', 'diligencia',
        'taxa_judiciaria', 'deposito_recursal', 'multa', 'outros'
    )),
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    data_vencimento DATE,
    data_pagamento DATE,
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN (
        'pendente', 'pago', 'vencido', 'cancelado'
    )),
    comprovante_url VARCHAR(500),
    pago_por UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONSULTAS JURÍDICAS
CREATE TABLE IF NOT EXISTS consultas_juridicas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero VARCHAR(30) UNIQUE,
    solicitante_id UUID REFERENCES profiles(id),
    departamento VARCHAR(100),
    assunto VARCHAR(255) NOT NULL,
    descricao TEXT NOT NULL,
    associado_id UUID REFERENCES associados(id),
    sinistro_id UUID REFERENCES sinistros(id),
    processo_id UUID REFERENCES processos(id),
    parecer TEXT,
    respondido_por UUID REFERENCES profiles(id),
    respondido_em TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN (
        'pendente', 'em_analise', 'respondida', 'arquivada'
    )),
    prioridade VARCHAR(20) DEFAULT 'normal' CHECK (prioridade IN (
        'baixa', 'normal', 'alta', 'urgente'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ÍNDICES
CREATE INDEX IF NOT EXISTS idx_processos_numero ON processos(numero);
CREATE INDEX IF NOT EXISTS idx_processos_numero_cnj ON processos(numero_processo);
CREATE INDEX IF NOT EXISTS idx_processos_status ON processos(status);
CREATE INDEX IF NOT EXISTS idx_processos_associado ON processos(associado_id);
CREATE INDEX IF NOT EXISTS idx_processos_sinistro ON processos(sinistro_id);
CREATE INDEX IF NOT EXISTS idx_processos_advogado ON processos(advogado_id);
CREATE INDEX IF NOT EXISTS idx_andamentos_processo ON processos_andamentos(processo_id);
CREATE INDEX IF NOT EXISTS idx_prazos_data ON processos_prazos(data_fim, status);
CREATE INDEX IF NOT EXISTS idx_prazos_responsavel ON processos_prazos(responsavel_id, status);
CREATE INDEX IF NOT EXISTS idx_audiencias_data ON processos_audiencias(data_hora, status);
CREATE INDEX IF NOT EXISTS idx_consultas_status ON consultas_juridicas(status);

-- SEQUÊNCIAS
CREATE SEQUENCE IF NOT EXISTS processo_seq START 1;
CREATE SEQUENCE IF NOT EXISTS consulta_juridica_seq START 1;

-- FUNÇÃO PARA GERAR NÚMERO DO PROCESSO
CREATE OR REPLACE FUNCTION gerar_numero_processo()
RETURNS TRIGGER AS $$
DECLARE
  seq INTEGER;
  periodo VARCHAR(6);
BEGIN
  periodo := TO_CHAR(CURRENT_DATE, 'YYYYMM');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 12 FOR 5) AS INTEGER)), 0) + 1
  INTO seq
  FROM processos
  WHERE numero LIKE 'PRC-' || periodo || '-%';
  
  NEW.numero := 'PRC-' || periodo || '-' || LPAD(seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_gerar_numero_processo ON processos;
CREATE TRIGGER trigger_gerar_numero_processo
  BEFORE INSERT ON processos
  FOR EACH ROW
  WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION gerar_numero_processo();

-- FUNÇÃO PARA GERAR NÚMERO DA CONSULTA
CREATE OR REPLACE FUNCTION gerar_numero_consulta()
RETURNS TRIGGER AS $$
DECLARE
  seq INTEGER;
  periodo VARCHAR(6);
BEGIN
  periodo := TO_CHAR(CURRENT_DATE, 'YYYYMM');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(numero FROM 12 FOR 5) AS INTEGER)), 0) + 1
  INTO seq
  FROM consultas_juridicas
  WHERE numero LIKE 'CON-' || periodo || '-%';
  
  NEW.numero := 'CON-' || periodo || '-' || LPAD(seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_gerar_numero_consulta ON consultas_juridicas;
CREATE TRIGGER trigger_gerar_numero_consulta
  BEFORE INSERT ON consultas_juridicas
  FOR EACH ROW
  WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION gerar_numero_consulta();

-- FUNÇÃO PARA VERIFICAR ACESSO AO JURÍDICO
CREATE OR REPLACE FUNCTION can_manage_juridico(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('diretor', 'gerente_comercial', 'analista_juridico')
  )
$$;

-- RLS POLICIES
ALTER TABLE advogados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "advogados_select_funcionario" ON advogados FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "advogados_all_juridico" ON advogados FOR ALL USING (can_manage_juridico(auth.uid()));

ALTER TABLE processos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "processos_select_funcionario" ON processos FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "processos_all_juridico" ON processos FOR ALL USING (can_manage_juridico(auth.uid()));

ALTER TABLE processos_andamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "andamentos_select_funcionario" ON processos_andamentos FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "andamentos_all_juridico" ON processos_andamentos FOR ALL USING (can_manage_juridico(auth.uid()));

ALTER TABLE processos_prazos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prazos_select_funcionario" ON processos_prazos FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "prazos_all_juridico" ON processos_prazos FOR ALL USING (can_manage_juridico(auth.uid()));

ALTER TABLE processos_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "documentos_processo_select_funcionario" ON processos_documentos FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "documentos_processo_all_juridico" ON processos_documentos FOR ALL USING (can_manage_juridico(auth.uid()));

ALTER TABLE processos_audiencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audiencias_select_funcionario" ON processos_audiencias FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "audiencias_all_juridico" ON processos_audiencias FOR ALL USING (can_manage_juridico(auth.uid()));

ALTER TABLE processos_custas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custas_select_funcionario" ON processos_custas FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "custas_all_juridico" ON processos_custas FOR ALL USING (can_manage_juridico(auth.uid()));

ALTER TABLE consultas_juridicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consultas_insert_funcionario" ON consultas_juridicas FOR INSERT WITH CHECK (is_funcionario(auth.uid()));
CREATE POLICY "consultas_select_funcionario" ON consultas_juridicas FOR SELECT USING (is_funcionario(auth.uid()));
CREATE POLICY "consultas_update_juridico" ON consultas_juridicas FOR UPDATE USING (can_manage_juridico(auth.uid()));

-- VIEW DE PRAZOS PRÓXIMOS (com security_invoker)
DROP VIEW IF EXISTS view_prazos_proximos;
CREATE VIEW view_prazos_proximos WITH (security_invoker = on) AS
SELECT 
    p.id,
    p.descricao,
    p.data_fim,
    p.prioridade,
    p.status,
    p.responsavel_id,
    pr.numero as processo_numero,
    pr.numero_processo as processo_cnj,
    pr.parte_contraria_nome,
    pr.tipo as processo_tipo,
    u.nome as responsavel_nome,
    CASE 
        WHEN p.data_fim < CURRENT_DATE THEN 'vencido'
        WHEN p.data_fim = CURRENT_DATE THEN 'hoje'
        WHEN p.data_fim = CURRENT_DATE + 1 THEN 'amanha'
        WHEN p.data_fim <= CURRENT_DATE + 3 THEN 'proximo'
        ELSE 'futuro'
    END as urgencia
FROM processos_prazos p
INNER JOIN processos pr ON pr.id = p.processo_id
LEFT JOIN profiles u ON u.id = p.responsavel_id
WHERE p.status IN ('pendente', 'em_andamento')
ORDER BY p.data_fim ASC;

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('processos', 'processos', false)
ON CONFLICT (id) DO NOTHING;
