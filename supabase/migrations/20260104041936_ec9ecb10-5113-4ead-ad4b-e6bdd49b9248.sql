-- =============================================
-- MÓDULO DIRETORIA + ATUARIAL (CORRIGIDO)
-- =============================================

-- 1. ADICIONAR CAMPOS À TABELA PLANOS
ALTER TABLE planos ADD COLUMN IF NOT EXISTS tipo_veiculo varchar(30) DEFAULT 'carro';
ALTER TABLE planos ADD COLUMN IF NOT EXISTS uso varchar(30) DEFAULT 'particular';
ALTER TABLE planos ADD COLUMN IF NOT EXISTS ano_fabricacao_minimo integer;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS ano_fabricacao_maximo integer;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS destaque boolean DEFAULT false;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS ordem integer DEFAULT 0;

-- 2. ADICIONAR CAMPOS À TABELA TABELAS_PRECO
ALTER TABLE tabelas_preco ADD COLUMN IF NOT EXISTS valor_adesao numeric(10,2);
ALTER TABLE tabelas_preco ADD COLUMN IF NOT EXISTS taxa_aplicativo numeric(10,2) DEFAULT 0;
ALTER TABLE tabelas_preco ADD COLUMN IF NOT EXISTS taxa_comercial numeric(10,2) DEFAULT 0;

-- 3. ADICIONAR CAMPOS À TABELA NOTIFICACOES
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS destino varchar(20) DEFAULT 'usuario';
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS destino_id uuid;
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS modulo varchar(50);
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS link varchar(500);
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS data_expiracao timestamptz;

-- 4. TABELA CONFIGURACOES
CREATE TABLE IF NOT EXISTS configuracoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chave varchar(100) UNIQUE NOT NULL,
    valor text NOT NULL,
    tipo varchar(20) NOT NULL CHECK (tipo IN (
        'texto', 'numero', 'booleano', 'json', 'data', 'percentual', 'moeda'
    )),
    categoria varchar(50) NOT NULL CHECK (categoria IN (
        'empresa', 'financeiro', 'operacional', 'notificacoes', 
        'integracao', 'seguranca', 'atuarial'
    )),
    descricao text,
    editavel boolean DEFAULT true,
    updated_at timestamptz DEFAULT now(),
    updated_by uuid REFERENCES profiles(id)
);

-- 5. TABELA COBERTURAS
CREATE TABLE IF NOT EXISTS coberturas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo varchar(20) UNIQUE NOT NULL,
    nome varchar(100) NOT NULL,
    descricao text,
    tipo varchar(30) NOT NULL CHECK (tipo IN (
        'colisao', 'roubo_furto', 'incendio', 'alagamento',
        'vidros', 'terceiros', 'app', 'assistencia', 'carro_reserva',
        'protecao_financeira', 'rastreamento', 'morte_acidental'
    )),
    percentual_cobertura numeric(5,2) DEFAULT 100,
    valor_limite numeric(12,2),
    franquia_percentual numeric(5,2),
    franquia_valor numeric(10,2),
    carencia_dias integer DEFAULT 0,
    ativo boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 6. TABELA PLANOS_COBERTURAS (vínculo)
CREATE TABLE IF NOT EXISTS planos_coberturas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    plano_id uuid NOT NULL REFERENCES planos(id) ON DELETE CASCADE,
    cobertura_id uuid NOT NULL REFERENCES coberturas(id) ON DELETE CASCADE,
    percentual_cobertura numeric(5,2),
    valor_limite numeric(12,2),
    franquia_percentual numeric(5,2),
    franquia_valor numeric(10,2),
    carencia_dias integer,
    obrigatoria boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE(plano_id, cobertura_id)
);

-- 7. TABELA TABELAS_PRECO_HISTORICO
CREATE TABLE IF NOT EXISTS tabelas_preco_historico (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tabela_preco_id uuid NOT NULL REFERENCES tabelas_preco(id),
    fipe_de numeric(12,2) NOT NULL,
    fipe_ate numeric(12,2) NOT NULL,
    valor_cota numeric(10,2) NOT NULL,
    valor_adesao numeric(10,2),
    vigencia_inicio date NOT NULL,
    vigencia_fim date NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- 8. TABELA RATEIOS
CREATE TABLE IF NOT EXISTS rateios (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo varchar(20) UNIQUE,
    mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano integer NOT NULL,
    total_associados integer DEFAULT 0,
    total_sinistros integer DEFAULT 0,
    valor_total_sinistros numeric(14,2) DEFAULT 0,
    valor_rateio_por_associado numeric(10,2) DEFAULT 0,
    percentual_fundo_reserva numeric(5,2) DEFAULT 10,
    valor_fundo_reserva numeric(12,2) DEFAULT 0,
    formula_utilizada text,
    status varchar(20) DEFAULT 'calculado' CHECK (status IN (
        'calculado', 'aprovado', 'aplicado', 'cancelado'
    )),
    aprovado_por uuid REFERENCES profiles(id),
    aprovado_em timestamptz,
    aplicado_em timestamptz,
    observacoes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(mes, ano)
);

-- 9. TABELA RATEIOS_DETALHES
CREATE TABLE IF NOT EXISTS rateios_detalhes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rateio_id uuid NOT NULL REFERENCES rateios(id) ON DELETE CASCADE,
    plano_id uuid NOT NULL REFERENCES planos(id),
    total_associados integer DEFAULT 0,
    total_sinistros integer DEFAULT 0,
    valor_sinistros numeric(14,2) DEFAULT 0,
    valor_rateio numeric(10,2) DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    UNIQUE(rateio_id, plano_id)
);

-- 10. TABELA INDICADORES_ATUARIAIS
CREATE TABLE IF NOT EXISTS indicadores_atuariais (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano integer NOT NULL,
    sinistralidade_bruta numeric(5,2),
    sinistralidade_liquida numeric(5,2),
    frequencia_sinistros numeric(5,4),
    ticket_medio_sinistro numeric(12,2),
    ticket_medio_mensalidade numeric(10,2),
    taxa_retencao numeric(5,2),
    taxa_cancelamento numeric(5,2),
    churn_rate numeric(5,2),
    novos_associados integer,
    cancelamentos integer,
    crescimento_liquido integer,
    taxa_crescimento numeric(5,2),
    receita_bruta numeric(14,2),
    receita_liquida numeric(14,2),
    despesas_operacionais numeric(14,2),
    despesas_sinistros numeric(14,2),
    resultado_operacional numeric(14,2),
    margem_operacional numeric(5,2),
    saldo_fundo_reserva numeric(14,2),
    cobertura_sinistros_meses numeric(4,1),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(mes, ano)
);

-- 11. TABELA LOGS_AUDITORIA
CREATE TABLE IF NOT EXISTS logs_auditoria (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id uuid REFERENCES profiles(id),
    usuario_nome varchar(255),
    ip_address varchar(45),
    user_agent text,
    acao varchar(50) NOT NULL CHECK (acao IN (
        'login', 'logout', 'criar', 'editar', 'excluir', 
        'visualizar', 'exportar', 'aprovar', 'rejeitar',
        'alterar_senha', 'alterar_permissao', 'configuracao'
    )),
    modulo varchar(50),
    tabela varchar(100),
    registro_id uuid,
    dados_anteriores jsonb,
    dados_novos jsonb,
    descricao text,
    created_at timestamptz DEFAULT now()
);

-- 12. TABELA NOTIFICACOES_LIDAS
CREATE TABLE IF NOT EXISTS notificacoes_lidas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    notificacao_id uuid NOT NULL REFERENCES notificacoes(id) ON DELETE CASCADE,
    usuario_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    lida_em timestamptz DEFAULT now(),
    UNIQUE(notificacao_id, usuario_id)
);

-- 13. FUNÇÃO PARA GERAR CÓDIGO DO RATEIO
CREATE OR REPLACE FUNCTION gerar_codigo_rateio()
RETURNS TRIGGER AS $$
BEGIN
  NEW.codigo := 'RAT-' || NEW.ano || LPAD(NEW.mes::TEXT, 2, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trigger_gerar_codigo_rateio ON rateios;
CREATE TRIGGER trigger_gerar_codigo_rateio
  BEFORE INSERT ON rateios
  FOR EACH ROW
  WHEN (NEW.codigo IS NULL)
  EXECUTE FUNCTION gerar_codigo_rateio();

-- 14. FUNÇÃO PARA CALCULAR SINISTRALIDADE
CREATE OR REPLACE FUNCTION calcular_sinistralidade(p_mes integer, p_ano integer)
RETURNS TABLE (
    sinistralidade numeric(5,2),
    frequencia numeric(5,4),
    ticket_medio numeric(12,2)
) AS $$
DECLARE
    v_receita numeric(14,2);
    v_sinistros_valor numeric(14,2);
    v_sinistros_qtd integer;
    v_associados integer;
BEGIN
    SELECT COALESCE(SUM(valor_pago), 0) INTO v_receita
    FROM cobrancas
    WHERE EXTRACT(MONTH FROM data_pagamento) = p_mes
      AND EXTRACT(YEAR FROM data_pagamento) = p_ano
      AND status = 'pago';
    
    SELECT 
        COALESCE(SUM(valor_indenizacao), 0),
        COUNT(*)
    INTO v_sinistros_valor, v_sinistros_qtd
    FROM sinistros
    WHERE EXTRACT(MONTH FROM data_ocorrencia) = p_mes
      AND EXTRACT(YEAR FROM data_ocorrencia) = p_ano
      AND status IN ('aprovado', 'indenizado');
    
    SELECT COUNT(*) INTO v_associados
    FROM associados
    WHERE status = 'ativo';
    
    RETURN QUERY SELECT
        CASE WHEN v_receita > 0 THEN ((v_sinistros_valor / v_receita) * 100)::numeric(5,2) ELSE 0::numeric(5,2) END,
        CASE WHEN v_associados > 0 THEN (v_sinistros_qtd::numeric / v_associados)::numeric(5,4) ELSE 0::numeric(5,4) END,
        CASE WHEN v_sinistros_qtd > 0 THEN (v_sinistros_valor / v_sinistros_qtd)::numeric(12,2) ELSE 0::numeric(12,2) END;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 15. VIEW DASHBOARD DIRETORIA (CORRIGIDA - usando updated_at para instalações)
CREATE OR REPLACE VIEW view_dashboard_diretoria AS
SELECT
    (SELECT COUNT(*) FROM associados WHERE status = 'ativo') as associados_ativos,
    (SELECT COUNT(*) FROM associados WHERE status = 'inadimplente') as associados_inadimplentes,
    (SELECT COUNT(*) FROM leads WHERE created_at >= date_trunc('month', CURRENT_DATE)) as leads_mes,
    (SELECT COUNT(*) FROM leads WHERE etapa = 'ganho' AND updated_at >= date_trunc('month', CURRENT_DATE)) as conversoes_mes,
    (SELECT COALESCE(SUM(valor_pago), 0) FROM cobrancas 
     WHERE status = 'pago' AND data_pagamento >= date_trunc('month', CURRENT_DATE)) as receita_mes,
    (SELECT COALESCE(SUM(valor), 0) FROM contas_pagar 
     WHERE data_vencimento >= date_trunc('month', CURRENT_DATE)
       AND data_vencimento < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month') as despesas_mes,
    (SELECT COUNT(*) FROM sinistros WHERE created_at >= date_trunc('month', CURRENT_DATE)) as sinistros_mes,
    (SELECT COALESCE(SUM(valor_indenizacao), 0) FROM sinistros 
     WHERE status IN ('aprovado', 'indenizado') 
       AND data_ocorrencia >= date_trunc('month', CURRENT_DATE)) as valor_sinistros_mes,
    (SELECT COUNT(*) FROM instalacoes WHERE status = 'concluida' 
     AND updated_at >= date_trunc('month', CURRENT_DATE)) as instalacoes_mes,
    (SELECT COUNT(*) FROM chamados_assistencia WHERE created_at >= date_trunc('month', CURRENT_DATE)) as assistencias_mes;

-- 16. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_configuracoes_categoria ON configuracoes(categoria);
CREATE INDEX IF NOT EXISTS idx_coberturas_tipo ON coberturas(tipo);
CREATE INDEX IF NOT EXISTS idx_coberturas_ativo ON coberturas(ativo);
CREATE INDEX IF NOT EXISTS idx_planos_coberturas_plano ON planos_coberturas(plano_id);
CREATE INDEX IF NOT EXISTS idx_planos_coberturas_cobertura ON planos_coberturas(cobertura_id);
CREATE INDEX IF NOT EXISTS idx_rateios_periodo ON rateios(ano, mes);
CREATE INDEX IF NOT EXISTS idx_rateios_status ON rateios(status);
CREATE INDEX IF NOT EXISTS idx_indicadores_periodo ON indicadores_atuariais(ano, mes);
CREATE INDEX IF NOT EXISTS idx_logs_usuario ON logs_auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_logs_data ON logs_auditoria(created_at);
CREATE INDEX IF NOT EXISTS idx_logs_acao ON logs_auditoria(acao, modulo);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lidas_usuario ON notificacoes_lidas(usuario_id);

-- 17. RLS POLICIES

-- Configurações
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "config_select_funcionario" ON configuracoes;
CREATE POLICY "config_select_funcionario" ON configuracoes FOR SELECT
USING (is_funcionario(auth.uid()));

DROP POLICY IF EXISTS "config_all_gerencia" ON configuracoes;
CREATE POLICY "config_all_gerencia" ON configuracoes FOR ALL
USING (is_gerencia(auth.uid()));

-- Coberturas
ALTER TABLE coberturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coberturas_select_funcionario" ON coberturas;
CREATE POLICY "coberturas_select_funcionario" ON coberturas FOR SELECT
USING (is_funcionario(auth.uid()));

DROP POLICY IF EXISTS "coberturas_all_gerencia" ON coberturas;
CREATE POLICY "coberturas_all_gerencia" ON coberturas FOR ALL
USING (is_gerencia(auth.uid()));

-- Planos Coberturas
ALTER TABLE planos_coberturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "planos_coberturas_select_funcionario" ON planos_coberturas;
CREATE POLICY "planos_coberturas_select_funcionario" ON planos_coberturas FOR SELECT
USING (is_funcionario(auth.uid()));

DROP POLICY IF EXISTS "planos_coberturas_all_gerencia" ON planos_coberturas;
CREATE POLICY "planos_coberturas_all_gerencia" ON planos_coberturas FOR ALL
USING (is_gerencia(auth.uid()));

-- Tabelas Preco Historico
ALTER TABLE tabelas_preco_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tabelas_preco_historico_select" ON tabelas_preco_historico;
CREATE POLICY "tabelas_preco_historico_select" ON tabelas_preco_historico FOR SELECT
USING (is_funcionario(auth.uid()));

DROP POLICY IF EXISTS "tabelas_preco_historico_insert" ON tabelas_preco_historico;
CREATE POLICY "tabelas_preco_historico_insert" ON tabelas_preco_historico FOR INSERT
WITH CHECK (is_gerencia(auth.uid()));

-- Rateios
ALTER TABLE rateios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rateios_all_gerencia" ON rateios;
CREATE POLICY "rateios_all_gerencia" ON rateios FOR ALL
USING (is_gerencia(auth.uid()));

-- Rateios Detalhes
ALTER TABLE rateios_detalhes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rateios_detalhes_all_gerencia" ON rateios_detalhes;
CREATE POLICY "rateios_detalhes_all_gerencia" ON rateios_detalhes FOR ALL
USING (is_gerencia(auth.uid()));

-- Indicadores Atuariais
ALTER TABLE indicadores_atuariais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "indicadores_all_gerencia" ON indicadores_atuariais;
CREATE POLICY "indicadores_all_gerencia" ON indicadores_atuariais FOR ALL
USING (is_gerencia(auth.uid()));

-- Logs Auditoria
ALTER TABLE logs_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_select_gerencia" ON logs_auditoria;
CREATE POLICY "logs_select_gerencia" ON logs_auditoria FOR SELECT
USING (is_gerencia(auth.uid()));

DROP POLICY IF EXISTS "logs_insert_all" ON logs_auditoria;
CREATE POLICY "logs_insert_all" ON logs_auditoria FOR INSERT
WITH CHECK (true);

-- Notificações Lidas
ALTER TABLE notificacoes_lidas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notificacoes_lidas_own" ON notificacoes_lidas;
CREATE POLICY "notificacoes_lidas_own" ON notificacoes_lidas FOR ALL
USING (usuario_id = (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- 18. DADOS INICIAIS - CONFIGURAÇÕES
INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao) VALUES
    ('empresa_nome', 'PRATIC Proteção Veicular', 'texto', 'empresa', 'Nome da associação'),
    ('empresa_cnpj', '00.000.000/0001-00', 'texto', 'empresa', 'CNPJ da associação'),
    ('empresa_telefone', '(00) 0000-0000', 'texto', 'empresa', 'Telefone principal'),
    ('empresa_email', 'contato@pratic.com.br', 'texto', 'empresa', 'E-mail principal'),
    ('empresa_endereco', 'Endereço da sede', 'texto', 'empresa', 'Endereço completo'),
    ('financeiro_dia_vencimento_padrao', '10', 'numero', 'financeiro', 'Dia de vencimento padrão'),
    ('financeiro_dias_tolerancia', '5', 'numero', 'financeiro', 'Dias de tolerância para pagamento'),
    ('financeiro_juros_mora', '2', 'percentual', 'financeiro', 'Juros de mora mensal (%)'),
    ('financeiro_multa_atraso', '2', 'percentual', 'financeiro', 'Multa por atraso (%)'),
    ('operacional_prazo_analise_docs', '48', 'numero', 'operacional', 'Prazo para análise de documentos (horas)'),
    ('operacional_prazo_instalacao', '72', 'numero', 'operacional', 'Prazo para instalação (horas)'),
    ('operacional_prazo_sinistro', '30', 'numero', 'operacional', 'Prazo para análise de sinistro (dias)'),
    ('atuarial_percentual_fundo_reserva', '10', 'percentual', 'atuarial', 'Percentual para fundo de reserva'),
    ('atuarial_sinistralidade_alvo', '65', 'percentual', 'atuarial', 'Meta de sinistralidade (%)'),
    ('atuarial_margem_seguranca', '20', 'percentual', 'atuarial', 'Margem de segurança nos cálculos'),
    ('notificacoes_email_ativo', 'true', 'booleano', 'notificacoes', 'Enviar notificações por e-mail'),
    ('notificacoes_whatsapp_ativo', 'true', 'booleano', 'notificacoes', 'Enviar notificações por WhatsApp'),
    ('notificacoes_push_ativo', 'true', 'booleano', 'notificacoes', 'Enviar notificações push')
ON CONFLICT (chave) DO NOTHING;

-- 19. DADOS INICIAIS - COBERTURAS
INSERT INTO coberturas (codigo, nome, descricao, tipo, percentual_cobertura, carencia_dias) VALUES
    ('COB-COL', 'Colisão', 'Cobertura para danos causados por colisão', 'colisao', 100, 30),
    ('COB-ROU', 'Roubo e Furto', 'Cobertura para roubo e furto do veículo', 'roubo_furto', 100, 30),
    ('COB-INC', 'Incêndio', 'Cobertura para danos causados por incêndio', 'incendio', 100, 0),
    ('COB-ALA', 'Alagamento', 'Cobertura para danos causados por alagamento', 'alagamento', 100, 30),
    ('COB-VID', 'Vidros', 'Cobertura para vidros, retrovisores e faróis', 'vidros', 100, 15),
    ('COB-TER', 'Terceiros', 'Cobertura para danos materiais a terceiros', 'terceiros', 100, 0),
    ('COB-ASS', 'Assistência 24h', 'Assistência 24 horas com guincho', 'assistencia', 100, 0),
    ('COB-RES', 'Carro Reserva', 'Carro reserva em caso de sinistro', 'carro_reserva', 100, 30),
    ('COB-RAS', 'Rastreamento', 'Serviço de rastreamento veicular', 'rastreamento', 100, 0)
ON CONFLICT (codigo) DO NOTHING;