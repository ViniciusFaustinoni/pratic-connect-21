-- =====================================================
-- SEED DATA: LINHAS DE PRODUTOS, BENEFÍCIOS, COBERTURAS E PLANOS
-- =====================================================

-- 1. Inserir linhas de produtos
INSERT INTO public.product_lines (name, slug, icon, vehicle_type, color, display_order, is_active) VALUES
  ('Linha Select', 'select', '⭐', 'car', 'green', 1, true),
  ('Linha Especial', 'especial', '◇', 'car', 'orange', 2, true),
  ('Linha Lançamento', 'lancamento', '⚡', 'car', 'purple', 3, true),
  ('Linha Advanced (Motos)', 'advanced', '🏍', 'motorcycle', 'red', 4, true);

-- 2. Inserir benefícios (catálogo)
INSERT INTO public.benefits (name, slug, category, display_order, is_active) VALUES
  ('Roubo e Furto', 'roubo-furto', 'cobertura', 1, true),
  ('Colisão', 'colisao', 'cobertura', 2, true),
  ('Perda Total', 'perda-total', 'cobertura', 3, true),
  ('Incêndio', 'incendio', 'cobertura', 4, true),
  ('Alagamento', 'alagamento', 'cobertura', 5, true),
  ('Chuva de Granizo', 'chuva-granizo', 'cobertura', 6, true),
  ('Assistência 24h', 'assistencia-24h', 'assistencia', 7, true),
  ('Rastreador/Monitoramento', 'rastreador', 'assistencia', 8, true),
  ('Reboque', 'reboque', 'assistencia', 9, true),
  ('Danos a Terceiros', 'danos-terceiros', 'cobertura', 10, true),
  ('Vidros e Faróis', 'vidros-farois', 'cobertura', 11, true),
  ('Reboque Excedente', 'reboque-excedente', 'assistencia', 12, true),
  ('Kit Gás', 'kit-gas', 'extra', 13, true),
  ('Carro Reserva', 'carro-reserva', 'extra', 14, true),
  ('Clube Gás', 'clube-gas', 'extra', 15, true),
  ('100% FIPE APP', 'fipe-app', 'extra', 16, true);

-- 3. Inserir coberturas principais (exibição visual)
INSERT INTO public.main_coverages (name, subtitle, icon, display_order, is_active) VALUES
  ('Roubo e Furto', 'Indenização 60 dias úteis', '🔒', 1, true),
  ('Colisão', 'Análise 7 dias', '💥', 2, true),
  ('Incêndio', 'Cobertura total', '🔥', 3, true),
  ('Alagamento', 'Danos mecânicos/elétricos', '💧', 4, true),
  ('Chuva de Granizo', 'Reparo de amassados', '🌨️', 5, true),
  ('Perda Total', '>75% = indenização', '⚠️', 6, true),
  ('Danos a Terceiros', 'Até R$100mil', '🚗', 7, true),
  ('Vidros e Faróis', '60% cobertura', '🪟', 8, true),
  ('Assistência 24h', 'Nacional', '🚚', 9, true),
  ('Rastreador', 'Monitoramento 24h', '📍', 10, true);