-- ============================================
-- MIGRATION 2: Tabelas de configuração de faixas
-- ============================================

-- TABELA: comissoes_faixas_adesao
CREATE TABLE IF NOT EXISTS comissoes_faixas_adesao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_consultor VARCHAR(30) NOT NULL DEFAULT 'interno',
  quantidade_vendas_minima INTEGER NOT NULL,
  percentual_adesao NUMERIC(5,2) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tipo_consultor, quantidade_vendas_minima)
);

-- Dados padrão — Consultor Interno
INSERT INTO comissoes_faixas_adesao (tipo_consultor, quantidade_vendas_minima, percentual_adesao) VALUES
  ('interno', 10, 50.00),
  ('interno', 12, 55.00),
  ('interno', 14, 60.00),
  ('interno', 16, 65.00),
  ('interno', 18, 70.00),
  ('interno', 20, 75.00),
  ('interno', 22, 80.00),
  ('interno', 24, 85.00),
  ('interno', 26, 90.00),
  ('interno', 28, 95.00),
  ('interno', 30, 100.00)
ON CONFLICT DO NOTHING;

-- TABELA: comissoes_faixas_recorrente
CREATE TABLE IF NOT EXISTS comissoes_faixas_recorrente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_consultor VARCHAR(30) NOT NULL,
  placas_minima INTEGER NOT NULL,
  placas_maxima INTEGER,
  percentual_recorrente NUMERIC(5,2) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tipo_consultor, placas_minima)
);

-- Dados padrão — Interno
INSERT INTO comissoes_faixas_recorrente (tipo_consultor, placas_minima, placas_maxima, percentual_recorrente) VALUES
  ('interno', 10, 14, 1.00),
  ('interno', 15, 19, 1.50),
  ('interno', 20, 24, 2.50),
  ('interno', 25, 29, 3.00),
  ('interno', 30, 34, 4.00),
  ('interno', 35, 39, 5.00),
  ('interno', 40, NULL, 6.00)
ON CONFLICT DO NOTHING;

-- Dados padrão — Externo
INSERT INTO comissoes_faixas_recorrente (tipo_consultor, placas_minima, placas_maxima, percentual_recorrente) VALUES
  ('externo', 0, 9, 5.00),
  ('externo', 10, 14, 7.00),
  ('externo', 15, NULL, 10.00)
ON CONFLICT DO NOTHING;

-- TABELA: comissoes_faixas_producao
CREATE TABLE IF NOT EXISTS comissoes_faixas_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_consultor VARCHAR(30) NOT NULL DEFAULT 'externo',
  placas_confirmadas_minima INTEGER NOT NULL,
  valor_remuneracao NUMERIC(10,2) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tipo_consultor, placas_confirmadas_minima)
);

-- Dados padrão — Externo
INSERT INTO comissoes_faixas_producao (tipo_consultor, placas_confirmadas_minima, valor_remuneracao) VALUES
  ('externo', 30, 1000.00),
  ('externo', 40, 2000.00),
  ('externo', 50, 3000.00)
ON CONFLICT DO NOTHING;

-- TABELA: comissoes_faixas_crescimento
CREATE TABLE IF NOT EXISTS comissoes_faixas_crescimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_consultor VARCHAR(30) NOT NULL DEFAULT 'todos',
  placas_confirmadas INTEGER NOT NULL,
  valor_remuneracao NUMERIC(10,2) NOT NULL,
  percentual_minimo_recorrente NUMERIC(5,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tipo_consultor, placas_confirmadas)
);

-- Dados padrão — Interno
INSERT INTO comissoes_faixas_crescimento (tipo_consultor, placas_confirmadas, valor_remuneracao, percentual_minimo_recorrente) VALUES
  ('interno', 100, 1000.00, 1.00),
  ('interno', 200, 2000.00, 2.00),
  ('interno', 300, 3000.00, 3.00),
  ('interno', 400, 4000.00, 4.00),
  ('interno', 500, 5000.00, 5.00),
  ('interno', 600, 6000.00, 6.00),
  ('interno', 700, 7000.00, 7.00),
  ('interno', 800, 8000.00, 8.00),
  ('interno', 900, 9000.00, 9.00),
  ('interno', 1000, 10000.00, 10.00)
ON CONFLICT DO NOTHING;

-- Dados padrão — Externo
INSERT INTO comissoes_faixas_crescimento (tipo_consultor, placas_confirmadas, valor_remuneracao, percentual_minimo_recorrente) VALUES
  ('externo', 100, 1000.00, 0),
  ('externo', 200, 2000.00, 0),
  ('externo', 300, 3000.00, 0),
  ('externo', 400, 4000.00, 0),
  ('externo', 500, 5000.00, 0)
ON CONFLICT DO NOTHING;

-- TABELA: comissoes_faixas_classificacao
CREATE TABLE IF NOT EXISTS comissoes_faixas_classificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_consultor VARCHAR(30) NOT NULL,
  categoria_tempo VARCHAR(20) NOT NULL DEFAULT 'todos',
  posicao_ranking INTEGER NOT NULL,
  faixa_placas_base INTEGER NOT NULL,
  valor_premio NUMERIC(10,2) NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tipo_consultor, categoria_tempo, posicao_ranking, faixa_placas_base)
);

COMMENT ON COLUMN comissoes_faixas_classificacao.categoria_tempo IS 'mais_1_ano, menos_1_ano, todos';
COMMENT ON COLUMN comissoes_faixas_classificacao.faixa_placas_base IS 'Tamanho da base total da campanha: 300, 400, 500';

-- Dados padrão — Interno +1 ano
INSERT INTO comissoes_faixas_classificacao (tipo_consultor, categoria_tempo, posicao_ranking, faixa_placas_base, valor_premio) VALUES
  ('interno', 'mais_1_ano', 1, 300, 1000.00),
  ('interno', 'mais_1_ano', 2, 300, 300.00),
  ('interno', 'mais_1_ano', 3, 300, 200.00),
  ('interno', 'mais_1_ano', 1, 400, 1500.00),
  ('interno', 'mais_1_ano', 2, 400, 400.00),
  ('interno', 'mais_1_ano', 3, 400, 300.00),
  ('interno', 'mais_1_ano', 1, 500, 1800.00),
  ('interno', 'mais_1_ano', 2, 500, 400.00),
  ('interno', 'mais_1_ano', 3, 500, 300.00)
ON CONFLICT DO NOTHING;

-- Dados padrão — Interno -1 ano
INSERT INTO comissoes_faixas_classificacao (tipo_consultor, categoria_tempo, posicao_ranking, faixa_placas_base, valor_premio) VALUES
  ('interno', 'menos_1_ano', 1, 300, 250.00),
  ('interno', 'menos_1_ano', 2, 300, 150.00),
  ('interno', 'menos_1_ano', 3, 300, 100.00),
  ('interno', 'menos_1_ano', 1, 400, 300.00),
  ('interno', 'menos_1_ano', 2, 400, 200.00),
  ('interno', 'menos_1_ano', 3, 400, 100.00),
  ('interno', 'menos_1_ano', 1, 500, 500.00),
  ('interno', 'menos_1_ano', 2, 500, 300.00),
  ('interno', 'menos_1_ano', 3, 500, 200.00)
ON CONFLICT DO NOTHING;

-- Dados padrão — Externo
INSERT INTO comissoes_faixas_classificacao (tipo_consultor, categoria_tempo, posicao_ranking, faixa_placas_base, valor_premio) VALUES
  ('externo', 'todos', 1, 300, 1000.00),
  ('externo', 'todos', 2, 300, 300.00),
  ('externo', 'todos', 3, 300, 200.00),
  ('externo', 'todos', 1, 400, 1500.00),
  ('externo', 'todos', 2, 400, 400.00),
  ('externo', 'todos', 3, 400, 300.00),
  ('externo', 'todos', 1, 500, 1800.00),
  ('externo', 'todos', 2, 500, 400.00),
  ('externo', 'todos', 3, 500, 300.00)
ON CONFLICT DO NOTHING;