-- =============================================
-- SISTEMA DE COMISSIONAMENTO DE VENDEDORES
-- =============================================

-- 1. Tabela de Configuração de Regras de Comissão
CREATE TABLE public.comissoes_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  tipo_vendedor VARCHAR(50) NOT NULL DEFAULT 'todos', -- 'vendedor_clt', 'vendedor_externo', 'todos'
  base_calculo VARCHAR(50) NOT NULL DEFAULT 'valor_adesao', -- 'valor_adesao', 'valor_mensal', 'ambos'
  tipo_calculo VARCHAR(50) NOT NULL DEFAULT 'percentual_fixo', -- 'percentual_fixo', 'escalonado_metas', 'escalonado_valor'
  percentual_base NUMERIC(5,2) NOT NULL DEFAULT 0,
  bonus_meta_atingida NUMERIC(5,2) DEFAULT 0, -- Bônus ao atingir 100% da meta
  bonus_meta_superada NUMERIC(5,2) DEFAULT 0, -- Bônus ao superar 120% da meta
  valor_minimo NUMERIC(10,2) DEFAULT 0, -- Piso de comissão
  valor_maximo NUMERIC(10,2) DEFAULT NULL, -- Teto de comissão (NULL = sem limite)
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Comissões Calculadas
CREATE TABLE public.comissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  config_id UUID REFERENCES public.comissoes_config(id) ON DELETE SET NULL,
  mes_referencia INTEGER NOT NULL CHECK (mes_referencia >= 1 AND mes_referencia <= 12),
  ano_referencia INTEGER NOT NULL CHECK (ano_referencia >= 2020),
  valor_base NUMERIC(12,2) NOT NULL DEFAULT 0,
  percentual_aplicado NUMERIC(5,2) NOT NULL DEFAULT 0,
  valor_comissao NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus_meta NUMERIC(12,2) DEFAULT 0,
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovada', 'paga', 'cancelada')),
  aprovado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  aprovado_em TIMESTAMPTZ,
  pago_em TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT comissoes_contrato_unique UNIQUE (contrato_id)
);

-- 3. Tabela de Histórico de Pagamentos
CREATE TABLE public.comissoes_pagamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendedor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mes_referencia INTEGER NOT NULL CHECK (mes_referencia >= 1 AND mes_referencia <= 12),
  ano_referencia INTEGER NOT NULL CHECK (ano_referencia >= 2020),
  valor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantidade_comissoes INTEGER NOT NULL DEFAULT 0,
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  comprovante_url TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_comissoes_vendedor ON public.comissoes(vendedor_id);
CREATE INDEX idx_comissoes_status ON public.comissoes(status);
CREATE INDEX idx_comissoes_periodo ON public.comissoes(ano_referencia, mes_referencia);
CREATE INDEX idx_comissoes_config_ativo ON public.comissoes_config(ativo) WHERE ativo = true;
CREATE INDEX idx_pagamentos_vendedor ON public.comissoes_pagamentos(vendedor_id);
CREATE INDEX idx_pagamentos_periodo ON public.comissoes_pagamentos(ano_referencia, mes_referencia);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_comissoes_config_updated_at
  BEFORE UPDATE ON public.comissoes_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comissoes_updated_at
  BEFORE UPDATE ON public.comissoes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE public.comissoes_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes_pagamentos ENABLE ROW LEVEL SECURITY;

-- COMISSOES_CONFIG: Apenas diretores/admins podem gerenciar
CREATE POLICY "Admins podem ver configurações de comissão"
  ON public.comissoes_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('diretor', 'admin_master', 'desenvolvedor', 'gerente_comercial', 'supervisor_vendas')
    )
  );

CREATE POLICY "Admins podem inserir configurações de comissão"
  ON public.comissoes_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('diretor', 'admin_master', 'desenvolvedor')
    )
  );

CREATE POLICY "Admins podem atualizar configurações de comissão"
  ON public.comissoes_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('diretor', 'admin_master', 'desenvolvedor')
    )
  );

CREATE POLICY "Admins podem deletar configurações de comissão"
  ON public.comissoes_config FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('diretor', 'admin_master', 'desenvolvedor')
    )
  );

-- COMISSOES: Vendedores veem as próprias, gerência vê todas
CREATE POLICY "Vendedores podem ver próprias comissões"
  ON public.comissoes FOR SELECT
  USING (
    vendedor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('diretor', 'admin_master', 'desenvolvedor', 'gerente_comercial', 'supervisor_vendas')
    )
  );

CREATE POLICY "Sistema pode inserir comissões"
  ON public.comissoes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('diretor', 'admin_master', 'desenvolvedor', 'gerente_comercial', 'supervisor_vendas')
    )
  );

CREATE POLICY "Gerência pode atualizar comissões"
  ON public.comissoes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('diretor', 'admin_master', 'desenvolvedor', 'gerente_comercial')
    )
  );

-- COMISSOES_PAGAMENTOS: Diretores gerenciam
CREATE POLICY "Usuários podem ver pagamentos de comissões"
  ON public.comissoes_pagamentos FOR SELECT
  USING (
    vendedor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('diretor', 'admin_master', 'desenvolvedor', 'gerente_comercial')
    )
  );

CREATE POLICY "Diretoria pode inserir pagamentos"
  ON public.comissoes_pagamentos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('diretor', 'admin_master', 'desenvolvedor')
    )
  );

CREATE POLICY "Diretoria pode atualizar pagamentos"
  ON public.comissoes_pagamentos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role IN ('diretor', 'admin_master', 'desenvolvedor')
    )
  );

-- =============================================
-- FUNÇÃO PARA CALCULAR COMISSÃO
-- =============================================

CREATE OR REPLACE FUNCTION public.calcular_comissao_contrato(p_contrato_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contrato RECORD;
  v_vendedor_tipo VARCHAR(50);
  v_config RECORD;
  v_meta RECORD;
  v_valor_base NUMERIC(12,2);
  v_valor_comissao NUMERIC(12,2);
  v_bonus NUMERIC(12,2) := 0;
  v_percentual_meta NUMERIC(5,2);
  v_comissao_id UUID;
BEGIN
  -- Buscar dados do contrato
  SELECT 
    c.id,
    c.vendedor_id,
    c.valor_adesao,
    c.valor_mensal,
    c.data_ativacao
  INTO v_contrato
  FROM contratos c
  WHERE c.id = p_contrato_id AND c.status = 'ativo';

  IF v_contrato IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado ou não está ativo';
  END IF;

  IF v_contrato.vendedor_id IS NULL THEN
    RAISE EXCEPTION 'Contrato sem vendedor associado';
  END IF;

  -- Verificar se já existe comissão para este contrato
  IF EXISTS (SELECT 1 FROM comissoes WHERE contrato_id = p_contrato_id) THEN
    RAISE EXCEPTION 'Comissão já calculada para este contrato';
  END IF;

  -- Buscar tipo do vendedor
  SELECT ur.role INTO v_vendedor_tipo
  FROM user_roles ur
  WHERE ur.user_id = v_contrato.vendedor_id
  AND ur.role IN ('vendedor_clt', 'vendedor_externo')
  LIMIT 1;

  IF v_vendedor_tipo IS NULL THEN
    v_vendedor_tipo := 'todos';
  END IF;

  -- Buscar configuração de comissão aplicável
  SELECT * INTO v_config
  FROM comissoes_config
  WHERE ativo = true
  AND (tipo_vendedor = v_vendedor_tipo OR tipo_vendedor = 'todos')
  ORDER BY 
    CASE WHEN tipo_vendedor = v_vendedor_tipo THEN 0 ELSE 1 END,
    created_at DESC
  LIMIT 1;

  IF v_config IS NULL THEN
    RETURN NULL;
  END IF;

  -- Calcular valor base conforme configuração
  v_valor_base := CASE v_config.base_calculo
    WHEN 'valor_adesao' THEN COALESCE(v_contrato.valor_adesao, 0)
    WHEN 'valor_mensal' THEN COALESCE(v_contrato.valor_mensal, 0)
    WHEN 'ambos' THEN COALESCE(v_contrato.valor_adesao, 0) + COALESCE(v_contrato.valor_mensal, 0)
    ELSE COALESCE(v_contrato.valor_adesao, 0)
  END;

  -- Calcular comissão base
  v_valor_comissao := v_valor_base * (v_config.percentual_base / 100);

  -- Aplicar piso e teto
  IF v_config.valor_minimo IS NOT NULL AND v_valor_comissao < v_config.valor_minimo THEN
    v_valor_comissao := v_config.valor_minimo;
  END IF;

  IF v_config.valor_maximo IS NOT NULL AND v_valor_comissao > v_config.valor_maximo THEN
    v_valor_comissao := v_config.valor_maximo;
  END IF;

  -- Verificar meta para bônus
  IF v_config.bonus_meta_atingida > 0 OR v_config.bonus_meta_superada > 0 THEN
    SELECT * INTO v_meta
    FROM metas_vendas
    WHERE vendedor_id = v_contrato.vendedor_id
    AND mes = EXTRACT(MONTH FROM COALESCE(v_contrato.data_ativacao, now()))
    AND ano = EXTRACT(YEAR FROM COALESCE(v_contrato.data_ativacao, now()));

    IF v_meta IS NOT NULL AND v_meta.meta_contratos > 0 THEN
      v_percentual_meta := (v_meta.realizado_contratos::NUMERIC / v_meta.meta_contratos) * 100;

      IF v_percentual_meta >= 120 AND v_config.bonus_meta_superada > 0 THEN
        v_bonus := v_valor_comissao * (v_config.bonus_meta_superada / 100);
      ELSIF v_percentual_meta >= 100 AND v_config.bonus_meta_atingida > 0 THEN
        v_bonus := v_valor_comissao * (v_config.bonus_meta_atingida / 100);
      END IF;
    END IF;
  END IF;

  -- Inserir comissão
  INSERT INTO comissoes (
    vendedor_id,
    contrato_id,
    config_id,
    mes_referencia,
    ano_referencia,
    valor_base,
    percentual_aplicado,
    valor_comissao,
    bonus_meta,
    valor_total,
    status
  ) VALUES (
    v_contrato.vendedor_id,
    p_contrato_id,
    v_config.id,
    EXTRACT(MONTH FROM COALESCE(v_contrato.data_ativacao, now())),
    EXTRACT(YEAR FROM COALESCE(v_contrato.data_ativacao, now())),
    v_valor_base,
    v_config.percentual_base,
    v_valor_comissao,
    v_bonus,
    v_valor_comissao + v_bonus,
    'pendente'
  )
  RETURNING id INTO v_comissao_id;

  RETURN v_comissao_id;
END;
$$;

-- =============================================
-- TRIGGER PARA CALCULAR COMISSÃO AUTOMATICAMENTE
-- =============================================

CREATE OR REPLACE FUNCTION public.trigger_calcular_comissao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'ativo' AND (OLD.status IS NULL OR OLD.status != 'ativo') THEN
    BEGIN
      PERFORM calcular_comissao_contrato(NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro ao calcular comissão para contrato %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_comissao_ao_ativar
  AFTER UPDATE ON public.contratos
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_calcular_comissao();