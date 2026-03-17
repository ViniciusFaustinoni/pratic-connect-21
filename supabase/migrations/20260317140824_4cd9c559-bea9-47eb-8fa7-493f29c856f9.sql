INSERT INTO comissoes_parametros (chave, valor, descricao, tipo_dado, ativo) VALUES
('pontos_migracao_aprovada', '1.0', 'Pontos por migração aprovada', 'numero', true),
('pontos_indicacao_convertida', '1.0', 'Pontos por indicação convertida', 'numero', true),
('pontos_troca_titularidade_parcial', '0', 'Pontos por troca de titularidade com pagamento parcial', 'numero', true),
('pontos_substituicao_placa_parcial', '0', 'Pontos por substituição de placa com pagamento parcial', 'numero', true),
('estorno_cancelamento_antes_1_boleto', 'true', 'Estornar pontuação quando associado cancela antes do 1º boleto', 'booleano', true),
('prazo_reativacao_dias', '120', 'Prazo mínimo de inadimplência para reativação contar como nova adesão', 'numero', true)
ON CONFLICT (chave) DO NOTHING;