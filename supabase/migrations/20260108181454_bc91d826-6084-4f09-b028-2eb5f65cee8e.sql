-- =====================================================
-- MÓDULO OUVIDORIA - ESTRUTURA COMPLETA
-- =====================================================

-- 1. Tabela principal de manifestações
CREATE TABLE ouvidoria_manifestacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    associado_id UUID REFERENCES associados(id),
    protocolo VARCHAR(20) UNIQUE NOT NULL,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN (
        'reclamacao', 'sugestao', 'elogio', 'denuncia', 'duvida'
    )),
    categoria VARCHAR(50) CHECK (categoria IN (
        'atendimento', 'financeiro', 'sinistro', 'assistencia',
        'rastreamento', 'contrato', 'instalacao', 'app', 'outro'
    )),
    assunto VARCHAR(255) NOT NULL,
    descricao TEXT NOT NULL,
    anonimo BOOLEAN DEFAULT false,
    canal VARCHAR(20) NOT NULL CHECK (canal IN (
        'app', 'whatsapp', 'telefone', 'email', 'presencial'
    )),
    prioridade VARCHAR(10) DEFAULT 'normal' CHECK (prioridade IN (
        'baixa', 'normal', 'alta', 'urgente'
    )),
    status VARCHAR(20) DEFAULT 'aberto' CHECK (status IN (
        'aberto', 'em_analise', 'aguardando_resposta', 
        'respondido', 'encerrado', 'reaberto'
    )),
    responsavel_id UUID REFERENCES profiles(id),
    departamento VARCHAR(50),
    data_limite DATE,
    data_primeira_resposta TIMESTAMPTZ,
    data_encerramento TIMESTAMPTZ,
    avaliacao_nota INTEGER CHECK (avaliacao_nota BETWEEN 1 AND 5),
    avaliacao_comentario TEXT,
    vinculo_juridico_id UUID REFERENCES processos(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para manifestações
CREATE INDEX idx_ouvidoria_protocolo ON ouvidoria_manifestacoes(protocolo);
CREATE INDEX idx_ouvidoria_associado ON ouvidoria_manifestacoes(associado_id);
CREATE INDEX idx_ouvidoria_status ON ouvidoria_manifestacoes(status);
CREATE INDEX idx_ouvidoria_tipo ON ouvidoria_manifestacoes(tipo);
CREATE INDEX idx_ouvidoria_responsavel ON ouvidoria_manifestacoes(responsavel_id);
CREATE INDEX idx_ouvidoria_prioridade ON ouvidoria_manifestacoes(prioridade);
CREATE INDEX idx_ouvidoria_created ON ouvidoria_manifestacoes(created_at DESC);

-- 2. Tabela de interações
CREATE TABLE ouvidoria_interacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifestacao_id UUID NOT NULL REFERENCES ouvidoria_manifestacoes(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES profiles(id),
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN (
        'mensagem_associado', 'resposta_interna', 'nota_interna', 
        'encaminhamento', 'anexo', 'status_change', 'resposta_ia'
    )),
    mensagem TEXT NOT NULL,
    visivel_associado BOOLEAN DEFAULT true,
    anexo_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interacoes_manifestacao ON ouvidoria_interacoes(manifestacao_id);
CREATE INDEX idx_interacoes_created ON ouvidoria_interacoes(created_at DESC);

-- 3. Tabela de anexos
CREATE TABLE ouvidoria_anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifestacao_id UUID NOT NULL REFERENCES ouvidoria_manifestacoes(id) ON DELETE CASCADE,
    nome_arquivo VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    tipo_arquivo VARCHAR(50),
    tamanho_bytes INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anexos_manifestacao ON ouvidoria_anexos(manifestacao_id);

-- 4. Tabela de logs da IA
CREATE TABLE ouvidoria_ia_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manifestacao_id UUID NOT NULL REFERENCES ouvidoria_manifestacoes(id) ON DELETE CASCADE,
    tipo_acao VARCHAR(30) NOT NULL CHECK (tipo_acao IN (
        'resposta_inicial', 'follow_up', 'triagem', 
        'analise_sentimento', 'escalacao', 'notificacao'
    )),
    entrada TEXT,
    saida TEXT,
    sentimento VARCHAR(20) CHECK (sentimento IN (
        'muito_negativo', 'negativo', 'neutro', 'positivo', 'muito_positivo'
    )),
    palavras_chave_detectadas TEXT[],
    prioridade_sugerida VARCHAR(10),
    departamento_sugerido VARCHAR(50),
    confianca DECIMAL(3,2),
    tokens_entrada INTEGER,
    tokens_saida INTEGER,
    tempo_resposta_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ia_logs_manifestacao ON ouvidoria_ia_logs(manifestacao_id);
CREATE INDEX idx_ia_logs_tipo ON ouvidoria_ia_logs(tipo_acao);

-- 5. Tabela de configurações
CREATE TABLE ouvidoria_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT NOT NULL,
    descricao VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO ouvidoria_config (chave, valor, descricao) VALUES
('ia_ativa', 'true', 'IA de atendimento ativa'),
('ia_modelo', 'claude-sonnet-4-20250514', 'Modelo Claude a usar'),
('tempo_follow_up_horas', '12', 'Horas para follow-up automático'),
('limite_interacoes_ia', '3', 'Máximo de interações antes de escalar'),
('horario_comercial_inicio', '08:00', 'Início do horário comercial'),
('horario_comercial_fim', '18:00', 'Fim do horário comercial'),
('palavras_urgentes', 'advogado,processo,procon,reclame aqui,justiça', 'Palavras que marcam como urgente'),
('palavras_alta_prioridade', 'insatisfeito,absurdo,descaso,cancelar,vergonha', 'Palavras que marcam como alta prioridade');

-- 6. Função para gerar protocolo automático
CREATE OR REPLACE FUNCTION gerar_protocolo_ouvidoria()
RETURNS TRIGGER AS $$
DECLARE
    ano TEXT;
    sequencia INTEGER;
BEGIN
    ano := EXTRACT(YEAR FROM NOW())::TEXT;
    
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(protocolo FROM 10 FOR 5) AS INTEGER)
    ), 0) + 1
    INTO sequencia
    FROM ouvidoria_manifestacoes
    WHERE protocolo LIKE 'OUV-' || ano || '-%';
    
    NEW.protocolo := 'OUV-' || ano || '-' || LPAD(sequencia::TEXT, 5, '0');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_gerar_protocolo_ouvidoria
    BEFORE INSERT ON ouvidoria_manifestacoes
    FOR EACH ROW
    WHEN (NEW.protocolo IS NULL OR NEW.protocolo = '')
    EXECUTE FUNCTION gerar_protocolo_ouvidoria();

-- 7. Trigger para updated_at
CREATE TRIGGER update_ouvidoria_manifestacoes_updated_at
    BEFORE UPDATE ON ouvidoria_manifestacoes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 8. RLS - Manifestações (usando profiles.tipo = 'funcionario')
ALTER TABLE ouvidoria_manifestacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem ver todas manifestacoes"
    ON ouvidoria_manifestacoes FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.tipo = 'funcionario'
        )
    );

CREATE POLICY "Funcionarios podem criar manifestacoes"
    ON ouvidoria_manifestacoes FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.tipo = 'funcionario'
        )
    );

CREATE POLICY "Funcionarios podem atualizar manifestacoes"
    ON ouvidoria_manifestacoes FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.tipo = 'funcionario'
        )
    );

CREATE POLICY "Funcionarios podem deletar manifestacoes"
    ON ouvidoria_manifestacoes FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.tipo = 'funcionario'
        )
    );

-- 9. RLS - Interações
ALTER TABLE ouvidoria_interacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem gerenciar interacoes"
    ON ouvidoria_interacoes FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.tipo = 'funcionario'
        )
    );

-- 10. RLS - Anexos
ALTER TABLE ouvidoria_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem gerenciar anexos"
    ON ouvidoria_anexos FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.tipo = 'funcionario'
        )
    );

-- 11. RLS - IA Logs
ALTER TABLE ouvidoria_ia_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem ver logs IA"
    ON ouvidoria_ia_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.tipo = 'funcionario'
        )
    );

CREATE POLICY "Sistema pode inserir logs IA"
    ON ouvidoria_ia_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 12. RLS - Config
ALTER TABLE ouvidoria_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Funcionarios podem ver config"
    ON ouvidoria_config FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.tipo = 'funcionario'
        )
    );

CREATE POLICY "Funcionarios podem modificar config"
    ON ouvidoria_config FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.tipo = 'funcionario'
        )
    );