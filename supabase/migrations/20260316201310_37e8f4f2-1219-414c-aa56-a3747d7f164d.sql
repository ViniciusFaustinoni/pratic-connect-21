
-- ADVANCED
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Assistência 24h', 'Monitoramento/Rastreador (acima de R$9mil)', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = '28ef5622-82d3-4532-8a2c-db304233c414';

-- ADVANCED+
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Assistência 24h', 'Monitoramento/Rastreador (acima de R$9mil)', 'Colisão (cota 10%)', 'Danos Terceiros R$10mil (participação R$750)', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = 'aee01ee7-d037-48c3-9625-4ef091649156';

-- ELÉTRICOS
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Colisão Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h', '1000km Reboque', 'Danos Terceiros R$40mil', '30 dias Carro Reserva (somente em colisão)', 'Reboque Excedente (1x a cada 6 meses)', 'Cobertura APP 100%', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = 'ab31c6c6-2d01-4690-9507-3ea535b4a629';

-- ESPECIAL
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Assistência 24h', 'Rastreador/Monitoramento (obrigatório)', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = 'cf35399e-940e-44ee-9613-be70777c5305';

-- ESPECIAL PLUS
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Colisão Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h', 'Rastreador/Monitoramento (acima de R$30mil)', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = '12cdd378-b42b-4389-a28f-1eba1fe7c837';

-- LANÇAMENTO BASIC
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Colisão Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h', 'Rastreador/Monitoramento (acima de R$30mil)', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = 'fec2154e-001c-4b99-afd7-1a30d9e5a8a6';

-- LANÇAMENTO EXCLUSIVE
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Colisão Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h', 'Rastreador/Monitoramento (acima de R$30mil)', '1000km Reboque', 'Danos Terceiros R$40mil', 'Vidros e Faróis (após 120 dias)', 'Reboque Excedente (1x a cada 6 meses)', 'Kit Gás', '100% FIPE', 'APP + Carro Reserva (somente em colisão)', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = 'feeff63c-b2bc-4475-bee0-44c53c8591ff';

-- LANÇAMENTO PREMIUM
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Colisão Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h', 'Rastreador/Monitoramento (acima de R$30mil)', '1000km Reboque', 'Danos Terceiros R$40mil', 'Vidros e Faróis (após 120 dias)', 'Reboque Excedente (1x a cada 6 meses)', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = '74b8abc5-48bd-48a6-84c3-8f27910a22dd';

-- SELECT BASIC
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Colisão Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h', 'Rastreador/Monitoramento (acima de R$30mil)', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = '6f8d28cb-7500-4f5d-85ab-4f771d1e21ab';

-- SELECT EXCLUSIVE
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Colisão Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h', 'Rastreador/Monitoramento (acima de R$30mil)', '1000km Reboque', 'Danos Terceiros R$40mil', 'Vidros e Faróis (após 120 dias)', 'Reboque Excedente (1x a cada 6 meses)', 'Kit Gás', '100% FIPE', 'APP + Carro Reserva (somente em colisão)', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = '43fe1e6a-374e-4b69-a76b-aea3f142b3c1';

-- SELECT ONE
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Colisão Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h', '1000km Reboque', 'Rastreador/Monitoramento (acima de R$30mil)', 'Danos Terceiros R$100mil', 'Vidros e Faróis (após 120 dias)', 'Reboque Excedente (1x a cada 6 meses)', 'Kit Gás', 'Carro Reserva (somente em colisão)', 'Clube Gás (10% desconto)', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = '20c3685f-2909-4ca3-be04-f0f116a7c0cd';

-- SELECT ONE 5% PROMO
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Colisão Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h', '1000km Reboque', 'Rastreador/Monitoramento (acima de R$30mil)', 'Danos Terceiros R$100mil', 'Vidros e Faróis (após 120 dias)', 'Reboque Excedente (1x a cada 6 meses)', 'Kit Gás', 'Carro Reserva (somente em colisão)', 'Clube Gás (10% desconto)', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = 'fff8820e-2484-4f9c-bc04-ba05cc8543b6';

-- SELECT PREMIUM
UPDATE planos SET coberturas = ARRAY['Roubo e Furto', 'Colisão Perda Total', 'Incêndio', 'Alagamento', 'Chuva de Granizo', 'Assistência 24h', 'Rastreador/Monitoramento (acima de R$30mil)', '1000km Reboque', 'Danos Terceiros R$40mil', 'Vidros e Faróis (após 120 dias)', 'Reboque Excedente (1x a cada 6 meses)', '5 acionamentos de reboque/mês (1 por ocorrência)']
WHERE id = 'fe82bc38-d37d-42ed-a31d-09b7926fb376';
