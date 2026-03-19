INSERT INTO configuracoes (chave, valor, descricao, tipo, categoria)
VALUES 
  ('substituicao_dispensa_vistoria_0km_ativa', 'true', 'Permitir dispensa de vistoria para veículos 0km com nota fiscal dentro do prazo na substituição de placa', 'booleano', 'regras_venda'),
  ('substituicao_dispensa_vistoria_0km_prazo_nf_dias', '30', 'Prazo máximo em dias da nota fiscal para dispensa de vistoria em substituição (veículo 0km)', 'numero', 'regras_venda')
ON CONFLICT (chave) DO NOTHING;