-- =====================================================
-- MODELO PRATIC DE PRECIFICAÇÃO
-- =====================================================

-- 1. Adicionar campo preco_sugerido na tabela benefits
ALTER TABLE benefits 
ADD COLUMN IF NOT EXISTS preco_sugerido DECIMAL(10,2) DEFAULT 0;

-- Comentário explicativo
COMMENT ON COLUMN benefits.preco_sugerido IS 'Preço sugerido pelo diretor para este benefício (cobertura)';

-- 2. Criar tabela gastos_beneficios para registro de gastos
CREATE TABLE IF NOT EXISTS gastos_beneficios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficio_id UUID NOT NULL,
    beneficio_tipo VARCHAR(20) NOT NULL CHECK (beneficio_tipo IN ('benefit', 'adicional')),
    sinistro_id UUID REFERENCES sinistros(id) ON DELETE SET NULL,
    chamado_id UUID REFERENCES chamados_assistencia(id) ON DELETE SET NULL,
    associado_id UUID NOT NULL REFERENCES associados(id) ON DELETE CASCADE,
    contrato_id UUID REFERENCES contratos(id) ON DELETE SET NULL,
    descricao VARCHAR(255),
    valor_gasto DECIMAL(10,2) NOT NULL CHECK (valor_gasto >= 0),
    data_ocorrencia DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Garantir que pelo menos um dos benefícios seja válido
    CONSTRAINT check_beneficio_referencia CHECK (
        (beneficio_tipo = 'benefit' AND beneficio_id IS NOT NULL) OR
        (beneficio_tipo = 'adicional' AND beneficio_id IS NOT NULL)
    )
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_gastos_beneficio ON gastos_beneficios(beneficio_id, beneficio_tipo);
CREATE INDEX IF NOT EXISTS idx_gastos_data ON gastos_beneficios(data_ocorrencia);
CREATE INDEX IF NOT EXISTS idx_gastos_associado ON gastos_beneficios(associado_id);
CREATE INDEX IF NOT EXISTS idx_gastos_sinistro ON gastos_beneficios(sinistro_id) WHERE sinistro_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gastos_chamado ON gastos_beneficios(chamado_id) WHERE chamado_id IS NOT NULL;

-- Comentários
COMMENT ON TABLE gastos_beneficios IS 'Registro de gastos associados a cada benefício, usado para calcular custo real';
COMMENT ON COLUMN gastos_beneficios.beneficio_tipo IS 'Tipo: benefit (coberturas) ou adicional (assistências)';

-- 3. Habilitar RLS
ALTER TABLE gastos_beneficios ENABLE ROW LEVEL SECURITY;

-- Policies para gastos_beneficios
CREATE POLICY "Diretores podem ver todos os gastos"
ON gastos_beneficios FOR SELECT
TO authenticated
USING (public.is_diretor_for_crud(auth.uid()));

CREATE POLICY "Sistema pode inserir gastos"
ON gastos_beneficios FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Diretores podem atualizar gastos"
ON gastos_beneficios FOR UPDATE
TO authenticated
USING (public.is_diretor_for_crud(auth.uid()));

CREATE POLICY "Diretores podem deletar gastos"
ON gastos_beneficios FOR DELETE
TO authenticated
USING (public.is_diretor_for_crud(auth.uid()));

-- 4. Criar View para custo real dos benefícios (coberturas - benefits)
CREATE OR REPLACE VIEW vw_custo_real_benefits AS
WITH gastos_60d AS (
    SELECT 
        beneficio_id,
        SUM(valor_gasto) AS gasto_total
    FROM gastos_beneficios
    WHERE beneficio_tipo = 'benefit'
    AND data_ocorrencia >= CURRENT_DATE - INTERVAL '60 days'
    GROUP BY beneficio_id
),
cotas_ativas AS (
    SELECT 
        pb.benefit_id,
        COUNT(DISTINCT a.id) AS total_cotas
    FROM plan_benefits pb
    INNER JOIN planos p ON p.id = pb.plan_id AND p.ativo = true
    INNER JOIN contratos c ON c.plano_id = p.id AND c.status = 'ativo'
    INNER JOIN associados a ON a.id = c.associado_id AND a.status = 'ativo'
    GROUP BY pb.benefit_id
)
SELECT 
    b.id AS beneficio_id,
    b.slug AS codigo,
    b.name AS nome,
    b.category AS categoria,
    COALESCE(b.preco_sugerido, 0) AS preco_sugerido,
    COALESCE(g.gasto_total, 0) AS gasto_total_60d,
    COALESCE(c.total_cotas, 0) AS total_cotas,
    CASE 
        WHEN COALESCE(c.total_cotas, 0) > 0 
        THEN ROUND(COALESCE(g.gasto_total, 0) / c.total_cotas, 2)
        ELSE 0 
    END AS custo_real,
    CASE 
        WHEN COALESCE(c.total_cotas, 0) = 0 THEN 'sem_dados'
        WHEN COALESCE(b.preco_sugerido, 0) < (COALESCE(g.gasto_total, 0) / c.total_cotas) THEN 'prejuizo'
        WHEN COALESCE(b.preco_sugerido, 0) > (COALESCE(g.gasto_total, 0) / c.total_cotas) THEN 'superavit'
        ELSE 'equilibrio'
    END AS indicador,
    'benefit' AS tipo_beneficio
FROM benefits b
LEFT JOIN gastos_60d g ON g.beneficio_id = b.id
LEFT JOIN cotas_ativas c ON c.benefit_id = b.id
WHERE b.is_active = true;

-- 5. Criar View para custo real dos benefícios adicionais
CREATE OR REPLACE VIEW vw_custo_real_adicionais AS
WITH gastos_60d AS (
    SELECT 
        beneficio_id,
        SUM(valor_gasto) AS gasto_total
    FROM gastos_beneficios
    WHERE beneficio_tipo = 'adicional'
    AND data_ocorrencia >= CURRENT_DATE - INTERVAL '60 days'
    GROUP BY beneficio_id
),
cotas_ativas AS (
    -- Contar associados ativos que têm este benefício adicional
    -- Por enquanto, conta todos os associados ativos como base
    SELECT 
        ba.id AS beneficio_id,
        COUNT(DISTINCT a.id) AS total_cotas
    FROM beneficios_adicionais ba
    CROSS JOIN associados a
    WHERE a.status = 'ativo'
    GROUP BY ba.id
)
SELECT 
    ba.id AS beneficio_id,
    ba.codigo,
    ba.nome,
    ba.categoria,
    COALESCE(ba.preco, 0) AS preco_sugerido,
    COALESCE(g.gasto_total, 0) AS gasto_total_60d,
    COALESCE(c.total_cotas, 0) AS total_cotas,
    CASE 
        WHEN COALESCE(c.total_cotas, 0) > 0 
        THEN ROUND(COALESCE(g.gasto_total, 0) / c.total_cotas, 2)
        ELSE 0 
    END AS custo_real,
    CASE 
        WHEN COALESCE(c.total_cotas, 0) = 0 THEN 'sem_dados'
        WHEN COALESCE(ba.preco, 0) < (COALESCE(g.gasto_total, 0) / c.total_cotas) THEN 'prejuizo'
        WHEN COALESCE(ba.preco, 0) > (COALESCE(g.gasto_total, 0) / c.total_cotas) THEN 'superavit'
        ELSE 'equilibrio'
    END AS indicador,
    'adicional' AS tipo_beneficio
FROM beneficios_adicionais ba
LEFT JOIN gastos_60d g ON g.beneficio_id = ba.id
LEFT JOIN cotas_ativas c ON c.beneficio_id = ba.id
WHERE ba.ativo = true;

-- 6. View unificada de todos os benefícios com custo real
CREATE OR REPLACE VIEW vw_custo_real_beneficios AS
SELECT * FROM vw_custo_real_benefits
UNION ALL
SELECT * FROM vw_custo_real_adicionais;

-- 7. Função RPC para calcular custo de um benefício específico
CREATE OR REPLACE FUNCTION fn_calcular_custo_beneficio(
    p_beneficio_id UUID,
    p_tipo VARCHAR DEFAULT 'benefit'
)
RETURNS TABLE (
    beneficio_id UUID,
    preco_sugerido DECIMAL,
    gasto_total_60d DECIMAL,
    total_cotas BIGINT,
    custo_real DECIMAL,
    indicador TEXT,
    margem DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.beneficio_id,
        v.preco_sugerido,
        v.gasto_total_60d,
        v.total_cotas,
        v.custo_real,
        v.indicador,
        (v.preco_sugerido - v.custo_real) AS margem
    FROM vw_custo_real_beneficios v
    WHERE v.beneficio_id = p_beneficio_id
    AND v.tipo_beneficio = p_tipo;
END;
$$;

-- 8. Função RPC para calcular preço de um plano
CREATE OR REPLACE FUNCTION fn_calcular_preco_plano(p_plano_id UUID)
RETURNS TABLE (
    plano_id UUID,
    soma_beneficios DECIMAL,
    valor_adicional DECIMAL,
    mensalidade DECIMAL,
    valor_adesao DECIMAL,
    qtd_beneficios INTEGER,
    indicador_geral TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_soma DECIMAL := 0;
    v_adicional DECIMAL := 0;
    v_adesao DECIMAL := 0;
    v_qtd INTEGER := 0;
    v_prejuizos INTEGER := 0;
BEGIN
    -- Buscar valores do plano
    SELECT 
        COALESCE(p.adicional_mensal, 0),
        COALESCE(p.valor_adesao, 0)
    INTO v_adicional, v_adesao
    FROM planos p
    WHERE p.id = p_plano_id;
    
    -- Somar preços dos benefícios inclusos
    SELECT 
        COALESCE(SUM(b.preco_sugerido), 0),
        COUNT(*)
    INTO v_soma, v_qtd
    FROM plan_benefits pb
    INNER JOIN benefits b ON b.id = pb.benefit_id
    WHERE pb.plan_id = p_plano_id;
    
    -- Contar benefícios em prejuízo
    SELECT COUNT(*)
    INTO v_prejuizos
    FROM plan_benefits pb
    INNER JOIN vw_custo_real_benefits v ON v.beneficio_id = pb.benefit_id
    WHERE pb.plan_id = p_plano_id
    AND v.indicador = 'prejuizo';
    
    RETURN QUERY
    SELECT 
        p_plano_id,
        v_soma,
        v_adicional,
        (v_soma + v_adicional),
        v_adesao,
        v_qtd,
        CASE 
            WHEN v_prejuizos > 0 THEN 'atencao'
            ELSE 'saudavel'
        END;
END;
$$;

-- 9. Trigger para registrar gastos automaticamente de sinistros
CREATE OR REPLACE FUNCTION fn_registrar_gasto_sinistro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_benefit_id UUID;
    v_benefit_slug VARCHAR;
BEGIN
    -- Só registra se status mudou para 'indenizado' ou 'pago' e tem valor
    IF (NEW.status IN ('indenizado', 'pago') AND OLD.status NOT IN ('indenizado', 'pago') AND COALESCE(NEW.valor_indenizacao, 0) > 0) THEN
        
        -- Mapear tipo de sinistro para slug do benefício
        v_benefit_slug := CASE NEW.tipo
            WHEN 'roubo_furto' THEN 'roubo-furto'
            WHEN 'colisao' THEN 'colisao'
            WHEN 'incendio' THEN 'incendio'
            WHEN 'fenomenos_naturais' THEN 'fenomenos-naturais'
            WHEN 'terceiros' THEN 'terceiros'
            ELSE NULL
        END;
        
        -- Buscar ID do benefício
        IF v_benefit_slug IS NOT NULL THEN
            SELECT id INTO v_benefit_id FROM benefits WHERE slug = v_benefit_slug;
        END IF;
        
        -- Inserir gasto se encontrou o benefício
        IF v_benefit_id IS NOT NULL THEN
            INSERT INTO gastos_beneficios (
                beneficio_id, 
                beneficio_tipo, 
                sinistro_id, 
                associado_id, 
                contrato_id,
                valor_gasto, 
                data_ocorrencia, 
                descricao
            ) VALUES (
                v_benefit_id,
                'benefit',
                NEW.id,
                NEW.associado_id,
                NEW.contrato_id,
                NEW.valor_indenizacao,
                COALESCE(NEW.data_ocorrencia, CURRENT_DATE),
                'Sinistro ' || COALESCE(NEW.protocolo, NEW.id::text)
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger (drop se existir para evitar duplicatas)
DROP TRIGGER IF EXISTS trg_registrar_gasto_sinistro ON sinistros;
CREATE TRIGGER trg_registrar_gasto_sinistro
AFTER UPDATE ON sinistros
FOR EACH ROW
EXECUTE FUNCTION fn_registrar_gasto_sinistro();

-- 10. Trigger para registrar gastos de chamados de assistência
CREATE OR REPLACE FUNCTION fn_registrar_gasto_chamado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_beneficio_id UUID;
    v_valor_gasto DECIMAL;
BEGIN
    -- Só registra se status mudou para 'concluido' 
    IF (NEW.status = 'concluido' AND OLD.status != 'concluido') THEN
        
        -- Buscar benefício adicional correspondente ao tipo de serviço
        SELECT id INTO v_beneficio_id 
        FROM beneficios_adicionais 
        WHERE LOWER(nome) LIKE '%' || LOWER(NEW.tipo_servico) || '%'
        OR codigo LIKE '%' || UPPER(REPLACE(NEW.tipo_servico, ' ', '-')) || '%'
        LIMIT 1;
        
        -- Se não encontrou benefício específico, usar um valor padrão
        -- O valor do gasto viria de uma tabela de custos ou seria estimado
        v_valor_gasto := 150.00; -- Valor padrão, pode ser ajustado
        
        -- Inserir gasto se encontrou o benefício
        IF v_beneficio_id IS NOT NULL THEN
            INSERT INTO gastos_beneficios (
                beneficio_id, 
                beneficio_tipo, 
                chamado_id, 
                associado_id, 
                valor_gasto, 
                data_ocorrencia, 
                descricao
            ) VALUES (
                v_beneficio_id,
                'adicional',
                NEW.id,
                NEW.associado_id,
                v_valor_gasto,
                COALESCE(NEW.data_abertura::date, CURRENT_DATE),
                'Chamado ' || COALESCE(NEW.protocolo, NEW.id::text) || ' - ' || NEW.tipo_servico
            )
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Criar trigger (drop se existir para evitar duplicatas)
DROP TRIGGER IF EXISTS trg_registrar_gasto_chamado ON chamados_assistencia;
CREATE TRIGGER trg_registrar_gasto_chamado
AFTER UPDATE ON chamados_assistencia
FOR EACH ROW
EXECUTE FUNCTION fn_registrar_gasto_chamado();

-- 11. Função para obter resumo de saúde financeira
CREATE OR REPLACE FUNCTION fn_resumo_saude_beneficios()
RETURNS TABLE (
    total_beneficios BIGINT,
    superavit BIGINT,
    equilibrio BIGINT,
    prejuizo BIGINT,
    sem_dados BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE indicador = 'superavit'),
        COUNT(*) FILTER (WHERE indicador = 'equilibrio'),
        COUNT(*) FILTER (WHERE indicador = 'prejuizo'),
        COUNT(*) FILTER (WHERE indicador = 'sem_dados')
    FROM vw_custo_real_beneficios;
END;
$$;