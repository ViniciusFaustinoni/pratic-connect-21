INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES ('fipe_menor_ativo', 'true', 'booleano', 'operacional', 
        'Ativa ou desativa a regra de FIPE Menor 1% em todo o sistema. Quando desativada, o bloco de solicitação é ocultado no formulário de cotação e o menu de aprovações é removido.', true)
ON CONFLICT (chave) DO NOTHING;