
-- 1. Criar product_line "Linha Elétrico"
INSERT INTO product_lines (name, slug, icon, vehicle_type, color, display_order, is_active, sort_priority, requires_recent_year, gradient_class)
VALUES ('Linha Elétrico', 'eletrico', 'Zap', 'car', '#10B981', 6, true, 60, false, 'from-emerald-500 to-teal-600');

-- 2. Ativar plano e vincular à product_line
UPDATE planos
SET ativo = true,
    product_line_id = (SELECT id FROM product_lines WHERE slug = 'eletrico')
WHERE id = 'ab31c6c6-2d01-4690-9507-3ea535b4a629';

-- 3. Criar mapeamento de preço
INSERT INTO plano_preco_map (plano_id, linha_slug, tipo_uso)
VALUES ('ab31c6c6-2d01-4690-9507-3ea535b4a629', 'eletrico', 'particular');

-- 4. Inserir benefícios vinculados ao plano
INSERT INTO planos_beneficios (plano_id, benefit_id, beneficio, incluso, is_highlighted, display_order)
VALUES
  ('ab31c6c6-2d01-4690-9507-3ea535b4a629', 'a8a8f296-0e75-4eb2-a151-efffeaee1eec', 'Roubo e Furto', true, true, 1),
  ('ab31c6c6-2d01-4690-9507-3ea535b4a629', '05c7d281-d1d4-4b1c-97d9-74e48707973a', 'Colisão', true, true, 2),
  ('ab31c6c6-2d01-4690-9507-3ea535b4a629', '0c2aac0a-5cb9-455a-a564-0c498f0b0248', 'Perda Total', true, true, 3),
  ('ab31c6c6-2d01-4690-9507-3ea535b4a629', 'c032f5a1-de3c-4178-acac-8939bba7093d', 'Incêndio', true, true, 4),
  ('ab31c6c6-2d01-4690-9507-3ea535b4a629', 'f957ef92-c853-4a2c-bfa1-5166e6fafbcf', 'Alagamento', true, false, 5),
  ('ab31c6c6-2d01-4690-9507-3ea535b4a629', '5a9139dd-27b6-47a2-9497-15f2f194c02f', 'Chuva de Granizo', true, false, 6),
  ('ab31c6c6-2d01-4690-9507-3ea535b4a629', 'ce0c5167-991c-4e0a-b5c2-21b23bc91807', 'Assistência 24h 1000km', true, false, 7),
  ('ab31c6c6-2d01-4690-9507-3ea535b4a629', '374ce067-4ab3-409d-8866-c4befd7ed85c', 'Danos a Terceiros R$40mil', true, false, 8),
  ('ab31c6c6-2d01-4690-9507-3ea535b4a629', '4b8c845a-9d80-4226-ace6-ce1df1f9e7c4', 'Carro Reserva 30 dias (somente em colisão)', true, false, 9),
  ('ab31c6c6-2d01-4690-9507-3ea535b4a629', '93256596-4834-4fb0-a792-c57b8aa7d9ea', 'Reboque Excedente (1x a cada 6 meses)', true, false, 10),
  ('ab31c6c6-2d01-4690-9507-3ea535b4a629', '80631f34-4833-4f47-b6b1-ad7770e4dcef', 'Cobertura APP 100%', true, false, 11);
