INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao)
VALUES (
  'inclusao_bloquear_debito_outro_veiculo',
  'true',
  'booleano',
  'regras_venda',
  'Quando ativado, impede a inclusão de novos veículos se houver débito pendente em qualquer veículo vinculado ao CPF. Quando desativado, exibe apenas um aviso.'
)
ON CONFLICT (chave) DO NOTHING;