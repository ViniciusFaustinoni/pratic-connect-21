-- =============================================
-- SISTEMA DE CATÁLOGO DE PLANOS E BENEFÍCIOS
-- =============================================

-- 1. Tabela: product_lines (Linhas de produtos)
CREATE TABLE public.product_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  icon VARCHAR(50),
  vehicle_type VARCHAR(20) DEFAULT 'car' CHECK (vehicle_type IN ('car', 'motorcycle')),
  color VARCHAR(20),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para product_lines
CREATE INDEX idx_product_lines_vehicle_type ON public.product_lines(vehicle_type);
CREATE INDEX idx_product_lines_display_order ON public.product_lines(display_order);
CREATE INDEX idx_product_lines_active ON public.product_lines(is_active);

-- Trigger para updated_at
CREATE TRIGGER update_product_lines_updated_at
  BEFORE UPDATE ON public.product_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_regioes_updated_at();

-- RLS para product_lines
ALTER TABLE public.product_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de linhas de produtos"
  ON public.product_lines FOR SELECT
  USING (true);

CREATE POLICY "Apenas diretores podem gerenciar linhas"
  ON public.product_lines FOR ALL
  USING (public.is_diretor_for_crud(auth.uid()));

-- =============================================

-- 2. Tabela: plans (Planos de cada linha)
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_line_id UUID NOT NULL REFERENCES public.product_lines(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  badge_text VARCHAR(50),
  badge_color VARCHAR(20),
  coverage_type VARCHAR(50),
  min_vehicle_year VARCHAR(20),
  cota_passeio_percent DECIMAL(5,2),
  cota_passeio_min DECIMAL(10,2),
  cota_desagio_percent DECIMAL(5,2),
  cota_desagio_min DECIMAL(10,2),
  cota_app_percent DECIMAL(5,2),
  cota_app_min DECIMAL(10,2),
  additional_price DECIMAL(10,2),
  restriction_alert TEXT,
  footer_note TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_line_id, slug)
);

-- Índices para plans
CREATE INDEX idx_plans_product_line ON public.plans(product_line_id);
CREATE INDEX idx_plans_display_order ON public.plans(display_order);
CREATE INDEX idx_plans_active ON public.plans(is_active);

-- Trigger para updated_at
CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_regioes_updated_at();

-- RLS para plans
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de planos"
  ON public.plans FOR SELECT
  USING (true);

CREATE POLICY "Apenas diretores podem gerenciar planos"
  ON public.plans FOR ALL
  USING (public.is_diretor_for_crud(auth.uid()));

-- =============================================

-- 3. Tabela: benefits (Catálogo de benefícios)
CREATE TABLE public.benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(50),
  category VARCHAR(50) CHECK (category IN ('cobertura', 'assistencia', 'extra')),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para benefits
CREATE INDEX idx_benefits_category ON public.benefits(category);
CREATE INDEX idx_benefits_display_order ON public.benefits(display_order);
CREATE INDEX idx_benefits_active ON public.benefits(is_active);

-- RLS para benefits
ALTER TABLE public.benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de benefícios"
  ON public.benefits FOR SELECT
  USING (true);

CREATE POLICY "Apenas diretores podem gerenciar benefícios"
  ON public.benefits FOR ALL
  USING (public.is_diretor_for_crud(auth.uid()));

-- =============================================

-- 4. Tabela: plan_benefits (Relação N:N)
CREATE TABLE public.plan_benefits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  benefit_id UUID NOT NULL REFERENCES public.benefits(id) ON DELETE CASCADE,
  custom_text TEXT,
  custom_value VARCHAR(100),
  additional_info TEXT,
  is_highlighted BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (plan_id, benefit_id)
);

-- Índices para plan_benefits
CREATE INDEX idx_plan_benefits_plan ON public.plan_benefits(plan_id);
CREATE INDEX idx_plan_benefits_benefit ON public.plan_benefits(benefit_id);
CREATE INDEX idx_plan_benefits_highlighted ON public.plan_benefits(is_highlighted);
CREATE INDEX idx_plan_benefits_display_order ON public.plan_benefits(display_order);

-- RLS para plan_benefits
ALTER TABLE public.plan_benefits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de benefícios de planos"
  ON public.plan_benefits FOR SELECT
  USING (true);

CREATE POLICY "Apenas diretores podem gerenciar benefícios de planos"
  ON public.plan_benefits FOR ALL
  USING (public.is_diretor_for_crud(auth.uid()));

-- =============================================

-- 5. Tabela: main_coverages (Coberturas principais)
CREATE TABLE public.main_coverages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  subtitle VARCHAR(150),
  icon VARCHAR(100),
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para main_coverages
CREATE INDEX idx_main_coverages_display_order ON public.main_coverages(display_order);
CREATE INDEX idx_main_coverages_active ON public.main_coverages(is_active);

-- RLS para main_coverages
ALTER TABLE public.main_coverages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública de coberturas principais"
  ON public.main_coverages FOR SELECT
  USING (true);

CREATE POLICY "Apenas diretores podem gerenciar coberturas principais"
  ON public.main_coverages FOR ALL
  USING (public.is_diretor_for_crud(auth.uid()));