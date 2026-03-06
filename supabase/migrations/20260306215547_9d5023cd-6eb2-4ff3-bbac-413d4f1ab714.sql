INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao) VALUES 
('fipe_limite_autorizacao', '120000', 'moeda', 'atuarial', 'Valor FIPE acima do qual o veículo requer autorização especial da diretoria'),
('perfil_veiculo_idade_limite', '15', 'numero', 'atuarial', 'Idade máxima (anos) do veículo para aceitação sem restrições'),
('perfil_veiculo_fipe_minimo', '15000', 'moeda', 'atuarial', 'Valor FIPE mínimo para elegibilidade de proteção'),
('perfil_veiculo_fipe_maximo', '500000', 'moeda', 'atuarial', 'Valor FIPE máximo antes de análise especial')
ON CONFLICT (chave) DO NOTHING;