-- Inserir planos APLICATIVO na tabela planos
-- Estes planos serão exibidos apenas quando "Uso do veículo" = "Aplicativo"

-- SELECT EXCLUSIVE APLICATIVO
INSERT INTO planos (
  codigo, nome, descricao, linha, nivel, 
  tipo_uso, tipo_veiculo, categoria,
  cota_participacao, cota_minima, 
  cota_desagio, cota_minima_desagio,
  adicional_mensal, cobertura_fipe,
  ano_minimo, valor_adesao, 
  coberturas, ativo, ordem
) VALUES (
  'select-exclusive-aplicativo',
  'SELECT EXCLUSIVE APLICATIVO',
  'Plano exclusivo para veículos de aplicativo',
  'select',
  'exclusive',
  'aplicativo',
  'carro',
  'aplicativo',
  8, 1200,
  8, 3000,
  60, 100,
  2005, 350,
  ARRAY['Roubo e Furto', 'Colisão', 'Perda Total', 'Incêndio', 'Alagamento', 
        'Chuva de Granizo', 'Assistência 24h 400km', 'Rastreador/Monitoramento',
        '1000km Reboque', 'Danos Terceiros R$40mil', 'Vidros e Faróis', 
        'Reboque Excedente', 'Kit Gás', '100% FIPE + Carro Reserva'],
  true, 13
);

-- SELECT ONE APLICATIVO
INSERT INTO planos (
  codigo, nome, descricao, linha, nivel,
  tipo_uso, tipo_veiculo, categoria,
  cota_participacao, cota_minima,
  cota_desagio, cota_minima_desagio,
  adicional_mensal, cobertura_fipe,
  ano_minimo, valor_adesao,
  coberturas, ativo, ordem
) VALUES (
  'select-one-aplicativo',
  'SELECT ONE APLICATIVO',
  'Plano completo para veículos de aplicativo - Tudo Incluído',
  'select-one',
  'exclusive',
  'aplicativo',
  'carro',
  'aplicativo',
  8, 1200,
  8, 3000,
  0, 100,
  2005, 350,
  ARRAY['Roubo e Furto', 'Colisão', 'Perda Total', 'Incêndio', 'Alagamento',
        'Chuva de Granizo', 'Assistência 24h 400km', 'Rastreador/Monitoramento',
        '1000km Reboque', 'Danos Terceiros R$100mil', 'Vidros e Faróis',
        'Reboque Excedente', 'Kit Gás', 'Clube Gás 10%', '100% FIPE + Carro Reserva'],
  true, 14
);

-- LANÇAMENTO EXCLUSIVE APLICATIVO
INSERT INTO planos (
  codigo, nome, descricao, linha, nivel,
  tipo_uso, tipo_veiculo, categoria,
  cota_participacao, cota_minima,
  cota_desagio, cota_minima_desagio,
  adicional_mensal, cobertura_fipe,
  ano_minimo, valor_adesao,
  coberturas, ativo, ordem
) VALUES (
  'lancamento-exclusive-aplicativo',
  'LANÇAMENTO EXCLUSIVE APLICATIVO',
  'Plano exclusivo para veículos novos de aplicativo',
  'lancamento',
  'exclusive',
  'aplicativo',
  'carro',
  'aplicativo',
  8, 3000,
  8, 3000,
  60, 100,
  2024, 450,
  ARRAY['Roubo e Furto', 'Colisão', 'Perda Total', 'Incêndio', 'Alagamento',
        'Chuva de Granizo', 'Assistência 24h', 'Rastreador', 'Vidros e Faróis'],
  true, 15
);