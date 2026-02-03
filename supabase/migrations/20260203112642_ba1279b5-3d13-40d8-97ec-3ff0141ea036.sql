-- ==============================================
-- CORREÇÃO DO SISTEMA DE RATEIO - COTAS E COBERTURAS
-- ==============================================

-- 1. ADICIONAR CAMPOS DE COBERTURA ESPECÍFICA NA TABELA VEÍCULOS
ALTER TABLE veiculos
ADD COLUMN IF NOT EXISTS cobertura_vidros BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cobertura_terceiros BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cobertura_assistencia BOOLEAN DEFAULT true;

-- Atualizar veículos existentes: se tem cobertura_total, ativar vidros e terceiros
UPDATE veiculos
SET 
  cobertura_vidros = COALESCE(cobertura_total, false),
  cobertura_terceiros = COALESCE(cobertura_total, false)
WHERE cobertura_vidros IS NULL OR cobertura_terceiros IS NULL;

-- 2. CRIAR/ATUALIZAR FUNÇÃO PARA ATUALIZAR COTAS AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION fn_atualizar_cotas_veiculo()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_faixa_id UUID;
  v_quantidade_cotas INTEGER;
BEGIN
  -- Buscar faixa correspondente ao valor FIPE
  SELECT id, quantidade_cotas 
  INTO v_faixa_id, v_quantidade_cotas
  FROM faixas_cotas
  WHERE NEW.valor_fipe >= fipe_de 
    AND NEW.valor_fipe <= fipe_ate
    AND ativo = true
  LIMIT 1;
  
  -- Atualizar campos se encontrou faixa
  IF v_faixa_id IS NOT NULL THEN
    NEW.faixa_cota_id := v_faixa_id;
    NEW.quantidade_cotas := v_quantidade_cotas;
  ELSE
    -- Fallback: calcular baseado no valor FIPE (1 cota para cada R$ 5.000)
    NEW.quantidade_cotas := GREATEST(1, CEIL(COALESCE(NEW.valor_fipe, 50000) / 5000));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS tr_veiculos_atualizar_cotas ON veiculos;

-- Criar trigger para atualizar cotas em INSERT e UPDATE de valor_fipe
CREATE TRIGGER tr_veiculos_atualizar_cotas
  BEFORE INSERT OR UPDATE OF valor_fipe ON veiculos
  FOR EACH ROW
  EXECUTE FUNCTION fn_atualizar_cotas_veiculo();

-- 3. POPULAR QUANTIDADE_COTAS NOS VEÍCULOS EXISTENTES
UPDATE veiculos v
SET 
  faixa_cota_id = fc.id,
  quantidade_cotas = fc.quantidade_cotas
FROM faixas_cotas fc
WHERE v.valor_fipe >= fc.fipe_de 
  AND v.valor_fipe <= fc.fipe_ate
  AND fc.ativo = true
  AND (v.quantidade_cotas IS NULL OR v.faixa_cota_id IS NULL);

-- Fallback para veículos sem faixa correspondente
UPDATE veiculos
SET quantidade_cotas = GREATEST(1, CEIL(COALESCE(valor_fipe, 50000) / 5000))
WHERE quantidade_cotas IS NULL;

-- 4. CORRIGIR FUNÇÃO fn_calcular_total_cotas_ativos PARA USAR TABELA VEICULOS
CREATE OR REPLACE FUNCTION fn_calcular_total_cotas_ativos()
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  -- Calcular total de cotas de veículos ativos
  -- Prioriza: 1) quantidade_cotas do veículo, 2) quantidade_cotas da faixa, 3) cálculo manual
  SELECT COALESCE(SUM(
    COALESCE(
      v.quantidade_cotas,
      fc.quantidade_cotas,
      GREATEST(1, CEIL(COALESCE(v.valor_fipe, 50000) / 5000))
    )
  ), 0)
  INTO v_total
  FROM veiculos v
  LEFT JOIN faixas_cotas fc ON v.faixa_cota_id = fc.id
  WHERE v.status = 'ativo';
  
  RETURN v_total;
END;
$$;

-- 5. CRIAR FUNÇÃO AUXILIAR PARA BUSCAR COTAS POR VEÍCULO
CREATE OR REPLACE FUNCTION fn_get_cotas_veiculo(p_veiculo_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cotas INTEGER;
BEGIN
  SELECT COALESCE(
    v.quantidade_cotas,
    fc.quantidade_cotas,
    GREATEST(1, CEIL(COALESCE(v.valor_fipe, 50000) / 5000))
  )
  INTO v_cotas
  FROM veiculos v
  LEFT JOIN faixas_cotas fc ON v.faixa_cota_id = fc.id
  WHERE v.id = p_veiculo_id;
  
  RETURN COALESCE(v_cotas, 1);
END;
$$;

-- 6. CRIAR VIEW PARA FACILITAR CONSULTA DE VEÍCULOS COM COTAS
DROP VIEW IF EXISTS vw_veiculos_com_cotas;
CREATE VIEW vw_veiculos_com_cotas AS
SELECT 
  v.id,
  v.associado_id,
  v.placa,
  v.status,
  v.valor_fipe,
  v.cobertura_total,
  v.cobertura_roubo_furto,
  v.cobertura_vidros,
  v.cobertura_terceiros,
  v.cobertura_assistencia,
  v.faixa_cota_id,
  COALESCE(v.quantidade_cotas, fc.quantidade_cotas, GREATEST(1, CEIL(COALESCE(v.valor_fipe, 50000) / 5000))) as cotas_calculadas,
  fc.fipe_de,
  fc.fipe_ate
FROM veiculos v
LEFT JOIN faixas_cotas fc ON v.faixa_cota_id = fc.id;