
-- Add columns to comissoes table for plan-level commission tracking
ALTER TABLE public.comissoes
  ADD COLUMN IF NOT EXISTS nivel_nome TEXT,
  ADD COLUMN IF NOT EXISTS plano_id UUID REFERENCES public.planos(id),
  ADD COLUMN IF NOT EXISTS parcela_numero INTEGER,
  ADD COLUMN IF NOT EXISTS parcela_total INTEGER;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_comissoes_contrato_nivel
  ON public.comissoes (contrato_id, nivel_nome, tipo_comissao);

-- Function to generate commissions based on comissao_plano_nivel config
CREATE OR REPLACE FUNCTION public.fn_gerar_comissao_plano_nivel(
  p_contrato_id UUID,
  p_cobranca_id UUID,
  p_valor_pago NUMERIC,
  p_tipo TEXT DEFAULT 'recorrente'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano_id UUID;
  v_vendedor_id UUID;
  v_associado_id UUID;
  v_grade_id UUID;
  v_nivel RECORD;
  v_count INTEGER;
  v_valor_comissao NUMERIC;
  v_comissoes_geradas INTEGER := 0;
  v_mes INTEGER;
  v_ano INTEGER;
  v_beneficiario_id UUID;
BEGIN
  SELECT plano_id, vendedor_id, associado_id
  INTO v_plano_id, v_vendedor_id, v_associado_id
  FROM contratos
  WHERE id = p_contrato_id;

  IF v_plano_id IS NULL OR v_vendedor_id IS NULL THEN
    RETURN 0;
  END IF;

  v_mes := EXTRACT(MONTH FROM NOW());
  v_ano := EXTRACT(YEAR FROM NOW());

  SELECT grade_id INTO v_grade_id
  FROM usuario_grade_comissao
  WHERE user_id = v_vendedor_id
  LIMIT 1;

  IF v_grade_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_nivel IN
    SELECT cpn.nivel_nome, cpn.tipo_comissao AS tipo_valor, cpn.valor, cpn.parcelas
    FROM comissao_plano_nivel cpn
    WHERE cpn.plano_id = v_plano_id
      AND cpn.ativo = true
      AND cpn.parcelas > 0
  LOOP
    -- Check this level exists in the seller's grade
    IF NOT EXISTS (
      SELECT 1 FROM grades_comissao_niveis gcn
      WHERE gcn.grade_id = v_grade_id
        AND LOWER(gcn.nome) = LOWER(v_nivel.nivel_nome)
    ) THEN
      CONTINUE;
    END IF;

    -- Determine beneficiary
    IF LOWER(v_nivel.nivel_nome) LIKE '%agencia%' OR LOWER(v_nivel.nivel_nome) LIKE '%agência%' THEN
      SELECT agencia_user_id INTO v_beneficiario_id
      FROM agencia_vendedores
      WHERE vendedor_user_id = v_vendedor_id
      LIMIT 1;
    ELSE
      v_beneficiario_id := v_vendedor_id;
    END IF;

    IF v_beneficiario_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Count existing commissions for this contract+level+tipo
    SELECT COUNT(*) INTO v_count
    FROM comissoes
    WHERE contrato_id = p_contrato_id
      AND nivel_nome = v_nivel.nivel_nome
      AND tipo_comissao = p_tipo;

    IF v_count >= v_nivel.parcelas THEN
      CONTINUE;
    END IF;

    -- Calculate commission value (snapshot)
    IF v_nivel.tipo_valor = 'fixo' THEN
      v_valor_comissao := v_nivel.valor;
    ELSE
      v_valor_comissao := ROUND(p_valor_pago * v_nivel.valor / 100, 2);
    END IF;

    INSERT INTO comissoes (
      vendedor_id, contrato_id, cobranca_id, associado_id,
      mes_referencia, ano_referencia,
      valor_base, percentual_aplicado, valor_comissao, valor_total, valor_bruto,
      status, tipo_comissao, nivel_nome, plano_id, parcela_numero, parcela_total,
      observacoes, created_at, updated_at
    ) VALUES (
      v_beneficiario_id, p_contrato_id, p_cobranca_id, v_associado_id,
      v_mes, v_ano,
      p_valor_pago,
      CASE WHEN v_nivel.tipo_valor = 'percentual' THEN v_nivel.valor ELSE 0 END,
      v_valor_comissao, v_valor_comissao, v_valor_comissao,
      'pendente', p_tipo, v_nivel.nivel_nome, v_plano_id, v_count + 1, v_nivel.parcelas,
      FORMAT('Comissão %s - %s (parcela %s/%s)', p_tipo, v_nivel.nivel_nome, v_count + 1, v_nivel.parcelas),
      NOW(), NOW()
    );

    v_comissoes_geradas := v_comissoes_geradas + 1;
  END LOOP;

  RETURN v_comissoes_geradas;
END;
$$;
