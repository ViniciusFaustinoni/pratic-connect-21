-- ============================================
-- MIGRATION 3: Tabelas Auxiliares + RLS
-- ============================================

-- TABELA: comissoes_campanhas
CREATE TABLE IF NOT EXISTS comissoes_campanhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INTEGER NOT NULL CHECK (ano >= 2024),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  data_pagamento_1a_fase DATE,
  data_apuracao_boletos DATE,
  data_pagamento_descontos DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'aberta',
  total_vendas_confirmadas INTEGER DEFAULT 0,
  total_comissoes_geradas NUMERIC(12,2) DEFAULT 0,
  fechada_por UUID REFERENCES profiles(id),
  fechada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mes, ano)
);

COMMENT ON COLUMN comissoes_campanhas.status IS 'aberta, em_apuracao, fechada, paga';

-- TABELA: comissoes_ranking_mensal
CREATE TABLE IF NOT EXISTS comissoes_ranking_mensal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id UUID NOT NULL REFERENCES comissoes_campanhas(id),
  vendedor_id UUID NOT NULL REFERENCES profiles(id),
  tipo_consultor VARCHAR(30) NOT NULL,
  categoria_tempo VARCHAR(20) NOT NULL,
  vendas_confirmadas INTEGER NOT NULL DEFAULT 0,
  vendas_canceladas INTEGER NOT NULL DEFAULT 0,
  vendas_liquidas NUMERIC(5,1) NOT NULL DEFAULT 0,
  trocas_titularidade INTEGER NOT NULL DEFAULT 0,
  posicao_ranking INTEGER,
  valor_premio NUMERIC(10,2) DEFAULT 0,
  placas_ativas INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(campanha_id, vendedor_id)
);

COMMENT ON COLUMN comissoes_ranking_mensal.vendas_liquidas IS 'Vendas confirmadas - canceladas + (trocas_titularidade * 0.5)';

-- TABELA: comissoes_recorrentes
CREATE TABLE IF NOT EXISTS comissoes_recorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID NOT NULL REFERENCES profiles(id),
  campanha_id UUID REFERENCES comissoes_campanhas(id),
  mes_referencia INTEGER NOT NULL,
  ano_referencia INTEGER NOT NULL,
  placas_ativas INTEGER NOT NULL DEFAULT 0,
  total_boletos_pagos NUMERIC(12,2) NOT NULL DEFAULT 0,
  percentual_aplicado NUMERIC(5,2) NOT NULL DEFAULT 0,
  valor_recorrente NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'calculada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vendedor_id, mes_referencia, ano_referencia)
);

-- TABELA: comissoes_crescimento_log
CREATE TABLE IF NOT EXISTS comissoes_crescimento_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID NOT NULL REFERENCES profiles(id),
  marco_placas INTEGER NOT NULL,
  data_atingido DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_pago NUMERIC(10,2) NOT NULL,
  percentual_recorrente_garantido NUMERIC(5,2) NOT NULL DEFAULT 0,
  campanha_id UUID REFERENCES comissoes_campanhas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vendedor_id, marco_placas)
);

-- TABELA: comissoes_deducoes
CREATE TABLE IF NOT EXISTS comissoes_deducoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comissao_id UUID REFERENCES comissoes(id),
  vendedor_id UUID NOT NULL REFERENCES profiles(id),
  campanha_id UUID REFERENCES comissoes_campanhas(id),
  tipo VARCHAR(50) NOT NULL,
  descricao TEXT,
  valor NUMERIC(10,2) NOT NULL,
  contrato_id UUID REFERENCES contratos(id),
  associado_id UUID REFERENCES associados(id),
  cobranca_id UUID,
  aplicada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN comissoes_deducoes.tipo IS 'repasse_volante, taxa_cartao, pendencia_associado, cancelamento, inadimplencia_2_boletos, fraude';

-- TABELA: comissoes_parametros
CREATE TABLE IF NOT EXISTS comissoes_parametros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave VARCHAR(100) NOT NULL UNIQUE,
  valor VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo_dado VARCHAR(20) NOT NULL DEFAULT 'numero',
  ativo BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES profiles(id)
);

-- Parâmetros padrão
INSERT INTO comissoes_parametros (chave, valor, descricao, tipo_dado) VALUES
  ('repasse_volante', '50.00', 'Valor fixo de repasse por venda com atendimento volante (R$)', 'numero'),
  ('bonus_recorde', '2000.00', 'Valor do bônus por quebra de recorde de vendas (R$)', 'numero'),
  ('dias_apuracao_inadimplencia', '60', 'Dias para apurar inadimplência dos 2 primeiros boletos', 'numero'),
  ('dia_pagamento_1a_fase', '20', 'Dia do mês para pagamento da 1ª fase', 'numero'),
  ('dia_apuracao_boletos', '10', 'Dia do mês seguinte para apurar boletos em aberto', 'numero'),
  ('percentual_antecipado_folha', '10', 'Percentual antecipado em folha para interno (2ª fase)', 'numero'),
  ('penalidade_fraude_multiplicador', '2', 'Multiplicador de penalidade por fraude (2x o valor)', 'numero'),
  ('troca_titularidade_peso_ranking', '0.5', 'Peso da troca de titularidade no ranking', 'numero'),
  ('minimo_placas_recorrente_interno', '10', 'Mínimo de placas para habilitar recorrente (interno)', 'numero'),
  ('minimo_placas_producao_externo', '30', 'Mínimo de placas confirmadas para produção (externo)', 'numero')
ON CONFLICT (chave) DO NOTHING;

-- TABELA: comissoes_auditoria
CREATE TABLE IF NOT EXISTS comissoes_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela VARCHAR(100) NOT NULL,
  registro_id UUID NOT NULL,
  acao VARCHAR(20) NOT NULL,
  dados_anteriores JSONB,
  dados_novos JSONB,
  usuario_id UUID REFERENCES profiles(id),
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN comissoes_auditoria.acao IS 'insert, update, delete, recalculo, aprovacao, contestacao';

CREATE INDEX IF NOT EXISTS idx_auditoria_tabela_registro ON comissoes_auditoria(tabela, registro_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON comissoes_auditoria(usuario_id);

-- ============================================
-- RLS POLICIES para todas as novas tabelas
-- ============================================

-- Habilitar RLS
ALTER TABLE comissoes_faixas_adesao ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes_faixas_recorrente ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes_faixas_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes_faixas_crescimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes_faixas_classificacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes_ranking_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes_recorrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes_crescimento_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes_deducoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes_parametros ENABLE ROW LEVEL SECURITY;
ALTER TABLE comissoes_auditoria ENABLE ROW LEVEL SECURITY;

-- Policies de LEITURA (todos autenticados podem ler configurações)
CREATE POLICY "Faixas adesao leitura" ON comissoes_faixas_adesao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Faixas recorrente leitura" ON comissoes_faixas_recorrente FOR SELECT TO authenticated USING (true);
CREATE POLICY "Faixas producao leitura" ON comissoes_faixas_producao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Faixas crescimento leitura" ON comissoes_faixas_crescimento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Faixas classificacao leitura" ON comissoes_faixas_classificacao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Campanhas leitura" ON comissoes_campanhas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Parametros leitura" ON comissoes_parametros FOR SELECT TO authenticated USING (true);

-- Policies de ESCRITA (apenas diretores e gerentes)
CREATE POLICY "Faixas adesao escrita" ON comissoes_faixas_adesao FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('diretor', 'gerente_comercial')));
CREATE POLICY "Faixas recorrente escrita" ON comissoes_faixas_recorrente FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('diretor', 'gerente_comercial')));
CREATE POLICY "Faixas producao escrita" ON comissoes_faixas_producao FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('diretor', 'gerente_comercial')));
CREATE POLICY "Faixas crescimento escrita" ON comissoes_faixas_crescimento FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('diretor', 'gerente_comercial')));
CREATE POLICY "Faixas classificacao escrita" ON comissoes_faixas_classificacao FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('diretor', 'gerente_comercial')));
CREATE POLICY "Campanhas escrita" ON comissoes_campanhas FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('diretor', 'gerente_comercial')));
CREATE POLICY "Parametros escrita" ON comissoes_parametros FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('diretor', 'gerente_comercial')));

-- Ranking: vendedor vê só o seu, diretoria vê todos
CREATE POLICY "Ranking leitura vendedor" ON comissoes_ranking_mensal FOR SELECT TO authenticated 
  USING (
    vendedor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('diretor', 'gerente_comercial', 'supervisor_vendas'))
  );

-- Recorrentes: vendedor vê só o seu
CREATE POLICY "Recorrentes leitura" ON comissoes_recorrentes FOR SELECT TO authenticated 
  USING (
    vendedor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('diretor', 'gerente_comercial', 'supervisor_vendas'))
  );

-- Deduções: vendedor vê só as suas
CREATE POLICY "Deducoes leitura" ON comissoes_deducoes FOR SELECT TO authenticated 
  USING (
    vendedor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('diretor', 'gerente_comercial', 'supervisor_vendas'))
  );

-- Crescimento: vendedor vê só o seu
CREATE POLICY "Crescimento leitura" ON comissoes_crescimento_log FOR SELECT TO authenticated 
  USING (
    vendedor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('diretor', 'gerente_comercial', 'supervisor_vendas'))
  );

-- Auditoria: apenas diretoria
CREATE POLICY "Auditoria leitura" ON comissoes_auditoria FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('diretor', 'gerente_comercial')));