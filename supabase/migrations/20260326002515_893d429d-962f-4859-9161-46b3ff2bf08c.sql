
-- Tabela unificada de regras de elegibilidade para linhas, planos, coberturas e benefícios
CREATE TABLE public.entity_eligibility_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('linha','plano','cobertura','beneficio')),
  entity_id UUID NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('fipe_range','ano_range','categoria_veiculo','categoria_especial','regiao','marca_modelo','tipo_uso','combustivel')),
  rule_mode TEXT NOT NULL DEFAULT 'include' CHECK (rule_mode IN ('include','exclude')),
  rule_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eer_entity ON public.entity_eligibility_rules(entity_type, entity_id);
CREATE INDEX idx_eer_rule_type ON public.entity_eligibility_rules(rule_type);

-- RLS
ALTER TABLE public.entity_eligibility_rules ENABLE ROW LEVEL SECURITY;

-- Leitura para todos autenticados
CREATE POLICY "Authenticated users can read eligibility rules"
  ON public.entity_eligibility_rules FOR SELECT
  TO authenticated
  USING (true);

-- Escrita para diretores
CREATE POLICY "Directors can manage eligibility rules"
  ON public.entity_eligibility_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'diretor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'diretor'
    )
  );

-- Permitir também admins
CREATE POLICY "Admins can manage eligibility rules"
  ON public.entity_eligibility_rules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );
