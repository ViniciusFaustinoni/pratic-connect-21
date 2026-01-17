-- =====================================================
-- AJUSTE: Usar SOMA DAS COTAS (valor_fipe / valor_por_cota) 
-- em vez de COUNT de associados
-- =====================================================

-- Dropar views existentes para recriar com nova lógica
DROP VIEW IF EXISTS vw_custo_real_beneficios CASCADE;
DROP VIEW IF EXISTS vw_custo_real_benefits CASCADE;
DROP VIEW IF EXISTS vw_custo_real_adicionais CASCADE;

-- =====================================================
-- VIEW: Custo Real de Benefits (coberturas principais)
-- =====================================================
CREATE OR REPLACE VIEW vw_custo_real_benefits AS
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
    WHERE beneficio_tipo = 'benefit'
    AND data_ocorrencia >= CURRENT_DATE - INTERVAL '60 days'
    GROUP BY beneficio_id
),
cotas_por_beneficio AS (
    -- Calcula SOMA DAS COTAS baseado no valor FIPE de cada veículo
    SELECT 
        pb.benefit_id,
        COUNT(DISTINCT c.associado_id) AS total_associados,
        COALESCE(SUM(
            CEIL(COALESCE(c.veiculo_valor_fipe, 0) / NULLIF((SELECT valor_por_cota FROM config), 0))
        ), 0) AS total_cotas
    FROM plan_benefits pb
    INNER JOIN planos p ON p.id = pb.plan_id AND p.ativo = true
    INNER JOIN contratos c ON c.plano_id = p.id AND c.status = 'ativo'
    WHERE pb.benefit_id IS NOT NULL
    GROUP BY pb.benefit_id
)
SELECT 
    b.id AS beneficio_id,
    b.slug AS codigo,
    b.name AS nome,
    b.category AS categoria,
    COALESCE(b.preco_sugerido, 0) AS preco_sugerido,
    COALESCE(g.gasto_total, 0) AS gasto_total_60d,
    COALESCE(g.qtd_utilizacoes, 0)::integer AS qtd_utilizacoes_60d,
    COALESCE(cpb.total_associados, 0)::integer AS total_associados,
    COALESCE(cpb.total_cotas, 0) AS total_cotas,
    CASE 
        WHEN COALESCE(cpb.total_cotas, 0) > 0 
        THEN ROUND(COALESCE(g.gasto_total, 0) / cpb.total_cotas, 2)
        ELSE 0 
    END AS custo_real,
    CASE 
        WHEN COALESCE(cpb.total_cotas, 0) > 0 
        THEN ROUND(COALESCE(b.preco_sugerido, 0) - (COALESCE(g.gasto_total, 0) / cpb.total_cotas), 2)
        ELSE COALESCE(b.preco_sugerido, 0)
    END AS margem,
    CASE 
        WHEN COALESCE(cpb.total_cotas, 0) = 0 THEN 'sem_dados'
        WHEN COALESCE(g.gasto_total, 0) = 0 THEN 'sem_dados'
        WHEN COALESCE(b.preco_sugerido, 0) < (COALESCE(g.gasto_total, 0) / cpb.total_cotas) THEN 'prejuizo'
        WHEN COALESCE(b.preco_sugerido, 0) > (COALESCE(g.gasto_total, 0) / cpb.total_cotas) THEN 'superavit'
        ELSE 'equilibrio'
    END AS indicador,
    'benefit'::text AS tipo_beneficio
FROM benefits b
LEFT JOIN gastos_60d g ON g.beneficio_id = b.id
LEFT JOIN cotas_por_beneficio cpb ON cpb.benefit_id = b.id
WHERE b.is_active = true;

-- =====================================================
-- VIEW: Custo Real de Benefícios Adicionais
-- =====================================================
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
-- Para adicionais, conta associados ativos e suas cotas
cotas_totais AS (
    SELECT 
        COUNT(DISTINCT c.associado_id) AS total_associados,
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
    COALESCE(g.gasto_total, 0) AS gasto_total_60d,
    COALESCE(g.qtd_utilizacoes, 0)::integer AS qtd_utilizacoes_60d,
    COALESCE(ct.total_associados, 0)::integer AS total_associados,
    COALESCE(ct.total_cotas, 0) AS total_cotas,
    CASE 
        WHEN COALESCE(ct.total_cotas, 0) > 0 
        THEN ROUND(COALESCE(g.gasto_total, 0) / ct.total_cotas, 2)
        ELSE 0 
    END AS custo_real,
    CASE 
        WHEN COALESCE(ct.total_cotas, 0) > 0 
        THEN ROUND(ba.preco - (COALESCE(g.gasto_total, 0) / ct.total_cotas), 2)
        ELSE ba.preco
    END AS margem,
    CASE 
        WHEN COALESCE(ct.total_cotas, 0) = 0 THEN 'sem_dados'
        WHEN COALESCE(g.gasto_total, 0) = 0 THEN 'sem_dados'
        WHEN ba.preco < (COALESCE(g.gasto_total, 0) / ct.total_cotas) THEN 'prejuizo'
        WHEN ba.preco > (COALESCE(g.gasto_total, 0) / ct.total_cotas) THEN 'superavit'
        ELSE 'equilibrio'
    END AS indicador,
    'adicional'::text AS tipo_beneficio
FROM beneficios_adicionais ba
LEFT JOIN gastos_60d g ON g.beneficio_id = ba.id
CROSS JOIN cotas_totais ct
WHERE ba.ativo = true;

-- =====================================================
-- VIEW UNIFICADA: Todos os benefícios
-- =====================================================
CREATE OR REPLACE VIEW vw_custo_real_beneficios AS
SELECT * FROM vw_custo_real_benefits
UNION ALL
SELECT * FROM vw_custo_real_adicionais;

-- =====================================================
-- Atualizar função de resumo para incluir novos campos
-- =====================================================
CREATE OR REPLACE FUNCTION fn_resumo_saude_beneficios()
RETURNS TABLE (
    total_beneficios bigint,
    superavit bigint,
    equilibrio bigint,
    prejuizo bigint,
    sem_dados bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::bigint AS total_beneficios,
        COUNT(*) FILTER (WHERE indicador = 'superavit')::bigint AS superavit,
        COUNT(*) FILTER (WHERE indicador = 'equilibrio')::bigint AS equilibrio,
        COUNT(*) FILTER (WHERE indicador = 'prejuizo')::bigint AS prejuizo,
        COUNT(*) FILTER (WHERE indicador = 'sem_dados')::bigint AS sem_dados
    FROM vw_custo_real_beneficios;
END;
$$;