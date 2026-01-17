-- =====================================================
-- FASE 1: SISTEMA DE COTAS CONFORME PDF
-- =====================================================

-- 1.1 Criar tabela de faixas de cotas (33 faixas de R$ 5.000)
CREATE TABLE IF NOT EXISTS faixas_cotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fipe_de NUMERIC(12,2) NOT NULL,
    fipe_ate NUMERIC(12,2) NOT NULL,
    quantidade_cotas INTEGER NOT NULL,
    ajuste_percentual NUMERIC(5,2) DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id),
    CONSTRAINT faixas_cotas_unique UNIQUE(fipe_de, fipe_ate),
    CONSTRAINT faixas_cotas_ajuste_check CHECK (ajuste_percentual >= -100 AND ajuste_percentual <= 100)
);

COMMENT ON TABLE faixas_cotas IS 'Faixas de cotas para rateio de sinistros - 33 faixas de R$ 5.000 (R$ 20k a R$ 180k)';
COMMENT ON COLUMN faixas_cotas.ajuste_percentual IS 'Percentual de desconto (negativo) ou adição (positivo) aplicado na faixa';

ALTER TABLE faixas_cotas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de faixas_cotas"
ON faixas_cotas FOR SELECT USING (true);

CREATE POLICY "Apenas admins podem modificar faixas_cotas"
ON faixas_cotas FOR ALL
USING (is_diretor_for_crud(auth.uid()));

-- 1.2 Inserir as 33 faixas (R$ 20.000 a R$ 180.000, de R$ 5.000 em R$ 5.000)
INSERT INTO faixas_cotas (fipe_de, fipe_ate, quantidade_cotas) VALUES
(20000.00, 24999.99, 4),
(25000.00, 29999.99, 5),
(30000.00, 34999.99, 6),
(35000.00, 39999.99, 7),
(40000.00, 44999.99, 8),
(45000.00, 49999.99, 9),
(50000.00, 54999.99, 10),
(55000.00, 59999.99, 11),
(60000.00, 64999.99, 12),
(65000.00, 69999.99, 13),
(70000.00, 74999.99, 14),
(75000.00, 79999.99, 15),
(80000.00, 84999.99, 16),
(85000.00, 89999.99, 17),
(90000.00, 94999.99, 18),
(95000.00, 99999.99, 19),
(100000.00, 104999.99, 20),
(105000.00, 109999.99, 21),
(110000.00, 114999.99, 22),
(115000.00, 119999.99, 23),
(120000.00, 124999.99, 24),
(125000.00, 129999.99, 25),
(130000.00, 134999.99, 26),
(135000.00, 139999.99, 27),
(140000.00, 144999.99, 28),
(145000.00, 149999.99, 29),
(150000.00, 154999.99, 30),
(155000.00, 159999.99, 31),
(160000.00, 164999.99, 32),
(165000.00, 169999.99, 33),
(170000.00, 174999.99, 34),
(175000.00, 179999.99, 35),
(180000.00, 184999.99, 36)
ON CONFLICT (fipe_de, fipe_ate) DO NOTHING;

-- 1.3 Criar tabela de histórico de ajustes
CREATE TABLE IF NOT EXISTS faixas_cotas_historico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faixa_id UUID REFERENCES faixas_cotas(id) ON DELETE CASCADE,
    ajuste_anterior NUMERIC(5,2),
    ajuste_novo NUMERIC(5,2),
    alterado_por UUID REFERENCES auth.users(id),
    alterado_em TIMESTAMPTZ DEFAULT now(),
    motivo TEXT
);

COMMENT ON TABLE faixas_cotas_historico IS 'Histórico de alterações nos ajustes percentuais das faixas de cotas';

ALTER TABLE faixas_cotas_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de faixas_cotas_historico"
ON faixas_cotas_historico FOR SELECT USING (true);

CREATE POLICY "Apenas admins podem inserir em faixas_cotas_historico"
ON faixas_cotas_historico FOR INSERT
WITH CHECK (is_diretor_for_crud(auth.uid()));

-- 1.4 Adicionar configurações de limites FIPE
INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES 
    ('atuarial_fipe_minimo', '20000', 'moeda', 'atuarial', 'Valor FIPE mínimo para aceitação de veículos', true),
    ('atuarial_fipe_maximo', '180000', 'moeda', 'atuarial', 'Valor FIPE máximo para aceitação de veículos', true)
ON CONFLICT (chave) DO NOTHING;

-- 1.5 Adicionar colunas na tabela de rateios para suportar divisão por cotas
ALTER TABLE rateios 
ADD COLUMN IF NOT EXISTS total_cotas NUMERIC(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_rateio_por_cota NUMERIC(10,4) DEFAULT 0;

COMMENT ON COLUMN rateios.total_cotas IS 'Total de cotas de todos os contratos ativos no momento do rateio';
COMMENT ON COLUMN rateios.valor_rateio_por_cota IS 'Valor do rateio por cota (custo total / total de cotas)';

-- 1.6 Criar função para buscar quantidade de cotas de um valor FIPE
CREATE OR REPLACE FUNCTION fn_get_cotas_por_fipe(p_valor_fipe NUMERIC)
RETURNS INTEGER AS $$
DECLARE
    v_cotas INTEGER;
BEGIN
    SELECT quantidade_cotas INTO v_cotas
    FROM faixas_cotas
    WHERE p_valor_fipe >= fipe_de 
    AND p_valor_fipe <= fipe_ate
    AND ativo = true
    LIMIT 1;
    
    IF v_cotas IS NULL THEN
        v_cotas := CEIL(p_valor_fipe / 5000);
    END IF;
    
    RETURN COALESCE(v_cotas, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- 1.7 Criar função para calcular total de cotas de contratos ativos
CREATE OR REPLACE FUNCTION fn_calcular_total_cotas_ativos()
RETURNS NUMERIC AS $$
DECLARE
    v_total NUMERIC;
BEGIN
    SELECT COALESCE(SUM(fn_get_cotas_por_fipe(COALESCE(c.veiculo_valor_fipe, 0))), 0)
    INTO v_total
    FROM contratos c
    WHERE c.status = 'ativo';
    
    RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE;

-- 1.8 Criar função completa para cálculo de rateio por cotas
CREATE OR REPLACE FUNCTION fn_calcular_rateio_por_cotas(
    p_custo_total NUMERIC,
    p_percentual_fundo NUMERIC DEFAULT 10
)
RETURNS TABLE(
    faixa_id UUID,
    fipe_de NUMERIC,
    fipe_ate NUMERIC,
    quantidade_cotas INTEGER,
    contratos_na_faixa INTEGER,
    total_cotas_faixa NUMERIC,
    ajuste_percentual NUMERIC,
    valor_base_cota NUMERIC,
    valor_final_cota NUMERIC
) AS $$
DECLARE
    v_total_cotas NUMERIC;
    v_custo_com_fundo NUMERIC;
    v_valor_base NUMERIC;
    v_custo_descontos NUMERIC := 0;
BEGIN
    SELECT fn_calcular_total_cotas_ativos() INTO v_total_cotas;
    
    IF v_total_cotas = 0 THEN
        RETURN;
    END IF;
    
    v_custo_com_fundo := p_custo_total * (1 + p_percentual_fundo / 100);
    v_valor_base := v_custo_com_fundo / v_total_cotas;
    
    SELECT COALESCE(SUM(
        CASE WHEN fc.ajuste_percentual < 0 THEN
            ABS(fc.ajuste_percentual / 100) * v_valor_base * (
                SELECT COALESCE(SUM(fn_get_cotas_por_fipe(COALESCE(c.veiculo_valor_fipe, 0))), 0)
                FROM contratos c 
                WHERE c.status = 'ativo' 
                AND c.veiculo_valor_fipe >= fc.fipe_de 
                AND c.veiculo_valor_fipe <= fc.fipe_ate
            )
        ELSE 0 END
    ), 0)
    INTO v_custo_descontos
    FROM faixas_cotas fc WHERE fc.ativo = true;
    
    v_valor_base := (v_custo_com_fundo + v_custo_descontos) / v_total_cotas;
    
    RETURN QUERY
    SELECT 
        fc.id,
        fc.fipe_de,
        fc.fipe_ate,
        fc.quantidade_cotas,
        (SELECT COUNT(*)::integer 
         FROM contratos c 
         WHERE c.status = 'ativo' 
         AND c.veiculo_valor_fipe >= fc.fipe_de 
         AND c.veiculo_valor_fipe <= fc.fipe_ate) AS contratos_na_faixa,
        (SELECT COALESCE(SUM(fn_get_cotas_por_fipe(COALESCE(c.veiculo_valor_fipe, 0))), 0)
         FROM contratos c 
         WHERE c.status = 'ativo' 
         AND c.veiculo_valor_fipe >= fc.fipe_de 
         AND c.veiculo_valor_fipe <= fc.fipe_ate) AS total_cotas_faixa,
        fc.ajuste_percentual,
        ROUND(v_valor_base, 4) AS valor_base_cota,
        ROUND(v_valor_base * (1 + fc.ajuste_percentual / 100), 4) AS valor_final_cota
    FROM faixas_cotas fc
    WHERE fc.ativo = true
    ORDER BY fc.fipe_de;
END;
$$ LANGUAGE plpgsql STABLE;

-- 1.9 Trigger para registrar histórico de alterações
CREATE OR REPLACE FUNCTION fn_registrar_historico_faixa()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.ajuste_percentual IS DISTINCT FROM NEW.ajuste_percentual THEN
        INSERT INTO faixas_cotas_historico (faixa_id, ajuste_anterior, ajuste_novo, alterado_por)
        VALUES (NEW.id, OLD.ajuste_percentual, NEW.ajuste_percentual, auth.uid());
    END IF;
    
    NEW.updated_at := now();
    NEW.updated_by := auth.uid();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_faixas_cotas_historico ON faixas_cotas;
CREATE TRIGGER tr_faixas_cotas_historico
BEFORE UPDATE ON faixas_cotas
FOR EACH ROW
EXECUTE FUNCTION fn_registrar_historico_faixa();

-- 1.10 Criar tabela de faixas de taxa administrativa (9 faixas de R$ 20.000)
CREATE TABLE IF NOT EXISTS faixas_taxa_administrativa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fipe_de NUMERIC(12,2) NOT NULL,
    fipe_ate NUMERIC(12,2) NOT NULL,
    valor_taxa NUMERIC(10,2) NOT NULL DEFAULT 0,
    ajuste_percentual NUMERIC(5,2) DEFAULT 0,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT faixas_taxa_adm_unique UNIQUE(fipe_de, fipe_ate)
);

COMMENT ON TABLE faixas_taxa_administrativa IS 'Faixas de taxa administrativa - 9 faixas de R$ 20.000';

ALTER TABLE faixas_taxa_administrativa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de faixas_taxa_administrativa"
ON faixas_taxa_administrativa FOR SELECT USING (true);

CREATE POLICY "Apenas admins podem modificar faixas_taxa_administrativa"
ON faixas_taxa_administrativa FOR ALL
USING (is_diretor_for_crud(auth.uid()));

INSERT INTO faixas_taxa_administrativa (fipe_de, fipe_ate, valor_taxa) VALUES
(0, 19999.99, 0),
(20000.00, 39999.99, 49.90),
(40000.00, 59999.99, 59.90),
(60000.00, 79999.99, 69.90),
(80000.00, 99999.99, 79.90),
(100000.00, 119999.99, 89.90),
(120000.00, 139999.99, 99.90),
(140000.00, 159999.99, 109.90),
(160000.00, 180000.00, 119.90)
ON CONFLICT (fipe_de, fipe_ate) DO NOTHING;