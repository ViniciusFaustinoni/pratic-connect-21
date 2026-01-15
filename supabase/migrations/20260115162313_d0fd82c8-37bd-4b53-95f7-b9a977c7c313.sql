-- Sincronizar planos oficiais do PLANOS_RESUMO no banco de dados
-- Adicionar colunas se não existirem
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planos' AND column_name = 'linha') THEN
    ALTER TABLE planos ADD COLUMN linha VARCHAR(30);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planos' AND column_name = 'cobertura_fipe') THEN
    ALTER TABLE planos ADD COLUMN cobertura_fipe INTEGER DEFAULT 100;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planos' AND column_name = 'ano_minimo') THEN
    ALTER TABLE planos ADD COLUMN ano_minimo INTEGER DEFAULT 2005;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planos' AND column_name = 'coberturas') THEN
    ALTER TABLE planos ADD COLUMN coberturas TEXT[];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planos' AND column_name = 'destaque') THEN
    ALTER TABLE planos ADD COLUMN destaque BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'planos' AND column_name = 'ordem') THEN
    ALTER TABLE planos ADD COLUMN ordem INTEGER DEFAULT 100;
  END IF;
END $$;

-- Criar índice único para codigo se não existir
CREATE UNIQUE INDEX IF NOT EXISTS planos_codigo_unique ON planos(codigo) WHERE codigo IS NOT NULL;

-- Inserir/Atualizar planos oficiais (incluindo valor_adesao obrigatório)
INSERT INTO planos (codigo, nome, descricao, coberturas, cobertura_fipe, ano_minimo, destaque, linha, ordem, ativo, valor_adesao)
VALUES
  ('select-basic', 'SELECT BASIC', 'Proteção essencial com as principais coberturas', 
   ARRAY['Roubo e Furto', 'Colisão', 'Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h 400km', 'Rastreador/Monitoramento (acima de R$30mil)'],
   100, 2005, true, 'select', 1, true, 199.90),
  
  ('select-premium', 'SELECT PREMIUM', 'Proteção ampliada com vidros e terceiros', 
   ARRAY['Roubo e Furto', 'Colisão', 'Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h 400km', 'Rastreador/Monitoramento (acima de R$30mil)', '1000km Reboque', 'Danos Terceiros R$40mil', 'Vidros e Faróis (após 120 dias)', 'Reboque Excedente (1x a cada 6 meses)'],
   100, 2005, false, 'select', 2, true, 249.90),
   
  ('select-exclusive', 'SELECT EXCLUSIVE', 'Proteção completa com kit gás e carro reserva', 
   ARRAY['Roubo e Furto', 'Colisão', 'Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h 400km', 'Rastreador/Monitoramento (acima de R$30mil)', '1000km Reboque', 'Danos Terceiros R$40mil', 'Vidros e Faróis (após 120 dias)', 'Reboque Excedente (1x a cada 6 meses)', 'Kit Gás', '100% FIPE APP + Carro Reserva (somente em colisão)'],
   100, 2005, false, 'select', 3, true, 299.90),
   
  ('select-one', 'SELECT ONE', 'Pacote completo tudo incluído', 
   ARRAY['Roubo e Furto', 'Colisão', 'Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h 1000km', 'Rastreador/Monitoramento (acima de R$30mil)', 'Danos Terceiros R$100mil', 'Vidros e Faróis (após 120 dias)', 'Reboque Excedente (1x a cada 6 meses)', 'Kit Gás', 'Carro Reserva (somente em colisão)', 'Clube Gás (10% desconto)'],
   100, 2005, false, 'select-one', 4, true, 349.90),
   
  ('especial', 'ESPECIAL', 'Proteção contra roubo e furto com rastreador', 
   ARRAY['Roubo e Furto', 'Assistência 24h 400km', 'Rastreador/Monitoramento (obrigatório)'],
   80, 2002, false, 'especial', 5, true, 149.90),
   
  ('especial-plus', 'ESPECIAL PLUS', 'Proteção especial com colisão', 
   ARRAY['Roubo e Furto', 'Colisão', 'Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h 400km', 'Rastreador/Monitoramento (acima de R$30mil)'],
   80, 2002, false, 'especial', 6, true, 199.90),
   
  ('lancamento-basic', 'LANÇAMENTO BASIC', 'Para veículos novos - proteção essencial', 
   ARRAY['Roubo e Furto', 'Colisão', 'Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h 400km', 'Rastreador/Monitoramento (acima de R$30mil)'],
   100, 2024, false, 'lancamento', 7, true, 249.90),
   
  ('lancamento-premium', 'LANÇAMENTO PREMIUM', 'Para veículos novos - proteção ampliada', 
   ARRAY['Roubo e Furto', 'Colisão', 'Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h 400km', 'Rastreador/Monitoramento (acima de R$30mil)', '1000km Reboque', 'Danos Terceiros R$40mil', 'Vidros e Faróis (após 120 dias)', 'Reboque Excedente (1x a cada 6 meses)'],
   100, 2024, false, 'lancamento', 8, true, 299.90),
   
  ('lancamento-exclusive', 'LANÇAMENTO EXCLUSIVE', 'Para veículos novos - proteção completa', 
   ARRAY['Roubo e Furto', 'Colisão', 'Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h 400km', 'Rastreador/Monitoramento (acima de R$30mil)', '1000km Reboque', 'Danos Terceiros R$40mil', 'Vidros e Faróis (após 120 dias)', 'Reboque Excedente (1x a cada 6 meses)', 'Kit Gás', '100% FIPE APP + Carro Reserva (somente em colisão)'],
   100, 2024, false, 'lancamento', 9, true, 349.90),
   
  ('advanced', 'ADVANCED', 'Proteção para motos - roubo e furto', 
   ARRAY['Roubo e Furto', 'Assistência 24h 400km', 'Monitoramento/Rastreador (acima de R$9mil)'],
   0, 2005, false, 'advanced', 10, true, 99.90),
   
  ('advanced-plus', 'ADVANCED+', 'Proteção para motos - colisão e terceiros', 
   ARRAY['Roubo e Furto', 'Assistência 24h 600km', 'Monitoramento/Rastreador (acima de R$9mil)', 'Colisão (cota 10%)', 'Danos Terceiros R$10mil (participação R$750)'],
   0, 2005, false, 'advanced', 11, true, 149.90),
   
  ('eletricos', 'ELÉTRICOS', 'Proteção especializada para veículos elétricos e híbridos', 
   ARRAY['Roubo e Furto', 'Colisão', 'Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h 1000km', 'Danos Terceiros R$40mil', '30 dias Carro Reserva (somente em colisão)', 'Reboque Excedente (1x a cada 6 meses)', 'Cobertura APP 100%'],
   100, 2020, false, 'eletricos', 12, true, 299.90)
   
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  coberturas = EXCLUDED.coberturas,
  cobertura_fipe = EXCLUDED.cobertura_fipe,
  ano_minimo = EXCLUDED.ano_minimo,
  destaque = EXCLUDED.destaque,
  linha = EXCLUDED.linha,
  ordem = EXCLUDED.ordem,
  ativo = EXCLUDED.ativo,
  valor_adesao = EXCLUDED.valor_adesao;