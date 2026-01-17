-- Adicionar coluna variacao_por_cota com default TRUE
ALTER TABLE beneficios_adicionais 
ADD COLUMN IF NOT EXISTS variacao_por_cota BOOLEAN NOT NULL DEFAULT true;

-- Comentário para documentação
COMMENT ON COLUMN beneficios_adicionais.variacao_por_cota IS 
'Se TRUE, divide custo por cotas. Se FALSE, divide por número de veículos.';

-- Recriar view com lógica condicional
DROP VIEW IF EXISTS vw_custo_real_adicionais CASCADE;

CREATE OR REPLACE VIEW vw_custo_real_adicionais AS
WITH 
config AS (
    SELECT COALESCE(
        (SELECT valor::numeric FROM configuracoes WHERE chave = 'atuarial_valor_por_cota'),
        5000
    ) AS valor_por_cota
),
gastos_60d AS (
    SELECT 
        beneficio_id,
        SUM(valor_gasto) AS gasto_total,
        COUNT(*) AS qtd_utilizacoes
    FROM gastos_beneficios
    WHERE beneficio_tipo = 'adicional'
    AND data_ocorrencia >= CURRENT_DATE - INTERVAL '60 days'
    GROUP BY beneficio_id
),
base_contratos AS (
    SELECT 
        COUNT(DISTINCT c.associado_id) AS total_associados,
        COUNT(DISTINCT c.id) AS total_veiculos,
        COALESCE(SUM(
            CEIL(COALESCE(c.veiculo_valor_fipe, 0) / NULLIF((SELECT valor_por_cota FROM config), 0))
        ), 0) AS total_cotas
    FROM contratos c
    WHERE c.status = 'ativo'
)
SELECT 
    ba.id AS beneficio_id,
    ba.codigo,
    ba.nome,
    ba.categoria,
    ba.preco AS preco_sugerido,
    ba.variacao_por_cota,
    COALESCE(g.gasto_total, 0) AS gasto_total_60d,
    COALESCE(g.qtd_utilizacoes, 0)::integer AS qtd_utilizacoes_60d,
    COALESCE(bc.total_associados, 0)::integer AS total_associados,
    COALESCE(bc.total_veiculos, 0)::integer AS total_veiculos,
    COALESCE(bc.total_cotas, 0) AS total_cotas,
    
    -- CUSTO REAL: condicional baseado em variacao_por_cota
    CASE 
        WHEN ba.variacao_por_cota = true THEN
            CASE WHEN COALESCE(bc.total_cotas, 0) > 0 
                 THEN ROUND(COALESCE(g.gasto_total, 0) / bc.total_cotas, 2)
                 ELSE 0 END
        ELSE
            CASE WHEN COALESCE(bc.total_veiculos, 0) > 0 
                 THEN ROUND(COALESCE(g.gasto_total, 0) / bc.total_veiculos, 2)
                 ELSE 0 END
    END AS custo_real,
    
    -- MARGEM: também condicional
    CASE 
        WHEN ba.variacao_por_cota = true THEN
            CASE WHEN COALESCE(bc.total_cotas, 0) > 0 
                 THEN ROUND(ba.preco - (COALESCE(g.gasto_total, 0) / bc.total_cotas), 2)
                 ELSE ba.preco END
        ELSE
            CASE WHEN COALESCE(bc.total_veiculos, 0) > 0 
                 THEN ROUND(ba.preco - (COALESCE(g.gasto_total, 0) / bc.total_veiculos), 2)
                 ELSE ba.preco END
    END AS margem,
    
    -- INDICADOR: também condicional
    CASE 
        WHEN ba.variacao_por_cota = true THEN
            CASE 
                WHEN COALESCE(bc.total_cotas, 0) = 0 THEN 'sem_dados'
                WHEN COALESCE(g.gasto_total, 0) = 0 THEN 'sem_dados'
                WHEN ba.preco < (COALESCE(g.gasto_total, 0) / bc.total_cotas) THEN 'prejuizo'
                WHEN ba.preco > (COALESCE(g.gasto_total, 0) / bc.total_cotas) THEN 'superavit'
                ELSE 'equilibrio'
            END
        ELSE
            CASE 
                WHEN COALESCE(bc.total_veiculos, 0) = 0 THEN 'sem_dados'
                WHEN COALESCE(g.gasto_total, 0) = 0 THEN 'sem_dados'
                WHEN ba.preco < (COALESCE(g.gasto_total, 0) / bc.total_veiculos) THEN 'prejuizo'
                WHEN ba.preco > (COALESCE(g.gasto_total, 0) / bc.total_veiculos) THEN 'superavit'
                ELSE 'equilibrio'
            END
    END AS indicador,
    'adicional' AS tipo_beneficio
FROM beneficios_adicionais ba
LEFT JOIN gastos_60d g ON g.beneficio_id = ba.id
CROSS JOIN base_contratos bc
WHERE ba.ativo = true;