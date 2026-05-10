
UPDATE servicos SET profissional_id='46477310-a69c-4aba-a0ba-d9b9c4cff490', updated_at=now() WHERE id='0edf10a4-e010-48fb-aeed-8a5301863fb6';
UPDATE instalacoes SET instalador_id='46477310-a69c-4aba-a0ba-d9b9c4cff490', updated_at=now() WHERE id='e2dbab22-457a-4529-adc4-b83ec9c529e8';
INSERT INTO servicos_atribuicoes_log (servico_id, profissional_id, tipo_atribuicao, observacoes) VALUES ('0edf10a4-e010-48fb-aeed-8a5301863fb6','46477310-a69c-4aba-a0ba-d9b9c4cff490','manual','Reatribuição manual: de Wallace para [TESTE] VISTORIADOR (correção - técnicos sobrepostos no mapa)');
