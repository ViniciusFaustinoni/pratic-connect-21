INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao)
VALUES ('atribuicao_manual_rotas', 'false', 'booleano', 'operacional', 'Quando ativada, desabilita o motor automático de atribuição por proximidade e habilita a aba de atribuição manual no monitoramento')
ON CONFLICT (chave) DO NOTHING;