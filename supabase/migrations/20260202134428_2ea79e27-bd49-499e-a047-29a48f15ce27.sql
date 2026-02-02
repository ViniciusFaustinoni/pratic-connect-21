-- =====================================================
-- MIGRAÇÃO: Unificação das tabelas 'planos' e 'plans'
-- =====================================================

-- FASE 1: Adicionar colunas comerciais à tabela 'planos'
-- =====================================================

ALTER TABLE planos ADD COLUMN IF NOT EXISTS product_line_id UUID REFERENCES product_lines(id);
ALTER TABLE planos ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
ALTER TABLE planos ADD COLUMN IF NOT EXISTS badge_text VARCHAR(50);
ALTER TABLE planos ADD COLUMN IF NOT EXISTS badge_color VARCHAR(20);
ALTER TABLE planos ADD COLUMN IF NOT EXISTS coverage_type VARCHAR(50);
ALTER TABLE planos ADD COLUMN IF NOT EXISTS restriction_alert TEXT;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS footer_note TEXT;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS cota_app_percent NUMERIC;
ALTER TABLE planos ADD COLUMN IF NOT EXISTS cota_app_min NUMERIC;

-- Criar índice para slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_planos_slug ON planos(slug) WHERE slug IS NOT NULL;

-- FASE 2: Migrar dados comerciais de 'plans' para 'planos'
-- ========================================================

UPDATE planos p
SET 
  product_line_id = pl.product_line_id,
  slug = pl.slug,
  badge_text = pl.badge_text,
  badge_color = pl.badge_color,
  coverage_type = pl.coverage_type,
  restriction_alert = pl.restriction_alert,
  footer_note = pl.footer_note,
  cota_participacao = COALESCE(p.cota_participacao, pl.cota_passeio_percent),
  cota_minima = COALESCE(p.cota_minima, pl.cota_passeio_min),
  cota_desagio = COALESCE(p.cota_desagio, pl.cota_desagio_percent),
  cota_minima_desagio = COALESCE(p.cota_minima_desagio, pl.cota_desagio_min),
  cota_app_percent = pl.cota_app_percent,
  cota_app_min = pl.cota_app_min,
  adicional_mensal = COALESCE(p.adicional_mensal, pl.additional_price, 0)
FROM plans pl
WHERE LOWER(p.codigo) = LOWER(pl.slug);

-- Para planos sem correspondência, gerar slug automaticamente
UPDATE planos
SET slug = LOWER(REPLACE(REPLACE(codigo, ' ', '-'), '_', '-'))
WHERE slug IS NULL;

-- FASE 3: Adicionar coluna benefit_id à planos_beneficios
-- =======================================================

ALTER TABLE planos_beneficios ADD COLUMN IF NOT EXISTS benefit_id UUID REFERENCES benefits(id);
ALTER TABLE planos_beneficios ADD COLUMN IF NOT EXISTS custom_text TEXT;
ALTER TABLE planos_beneficios ADD COLUMN IF NOT EXISTS custom_value VARCHAR(100);
ALTER TABLE planos_beneficios ADD COLUMN IF NOT EXISTS additional_info TEXT;
ALTER TABLE planos_beneficios ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT FALSE;
ALTER TABLE planos_beneficios ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- FASE 4: Migrar dados de plan_benefits para planos_beneficios
-- ============================================================

INSERT INTO planos_beneficios (plano_id, benefit_id, custom_text, custom_value, additional_info, is_highlighted, display_order, beneficio, incluso)
SELECT 
  p.id as plano_id,
  pb.benefit_id,
  pb.custom_text,
  pb.custom_value,
  pb.additional_info,
  COALESCE(pb.is_highlighted, false),
  COALESCE(pb.display_order, 0),
  COALESCE(b.name, 'Benefício'),
  true
FROM plan_benefits pb
JOIN plans pl ON pb.plan_id = pl.id
JOIN planos p ON LOWER(p.codigo) = LOWER(pl.slug)
LEFT JOIN benefits b ON pb.benefit_id = b.id
ON CONFLICT DO NOTHING;

-- FASE 5: Criar VIEW para compatibilidade com código existente
-- ============================================================

CREATE OR REPLACE VIEW vw_plans_compat AS
SELECT 
  p.id,
  p.product_line_id,
  p.nome as name,
  COALESCE(p.slug, LOWER(p.codigo)) as slug,
  p.badge_text,
  p.badge_color,
  p.coverage_type,
  CASE WHEN p.ano_minimo IS NOT NULL 
       THEN p.ano_minimo::text || '+'
       ELSE NULL 
  END as min_vehicle_year,
  p.cota_participacao as cota_passeio_percent,
  p.cota_minima as cota_passeio_min,
  p.cota_desagio as cota_desagio_percent,
  p.cota_minima_desagio as cota_desagio_min,
  p.cota_app_percent,
  p.cota_app_min,
  p.adicional_mensal as additional_price,
  p.restriction_alert,
  p.footer_note,
  COALESCE(p.ordem, p.ordem_exibicao, 0) as display_order,
  p.ativo as is_active,
  p.created_at,
  p.updated_at,
  COALESCE(p.tipo_uso, 'passeio') as tipo_uso
FROM planos p;

-- FASE 6: Aplicar RLS à VIEW (se necessário)
-- ==========================================

-- A VIEW herda as políticas da tabela planos

-- Comentário para marcar tabela plans como deprecated
COMMENT ON TABLE plans IS 'DEPRECATED: Esta tabela foi substituída por "planos". Use a VIEW "vw_plans_compat" para compatibilidade.';