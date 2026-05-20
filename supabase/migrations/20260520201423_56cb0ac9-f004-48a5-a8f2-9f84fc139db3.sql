-- Saneamento: contratos de troca de titularidade que já passaram pelo Cadastro
-- (aprovado_cadastro_em IS NOT NULL na solicitação) devem ter
-- cadastro_aprovado=true para sair da fila Propostas Pendentes.
UPDATE contratos c
SET cadastro_aprovado = true,
    aprovado_em = COALESCE(c.aprovado_em, s.aprovado_cadastro_em)
FROM solicitacoes_troca_titularidade s
WHERE s.cotacao_id = c.cotacao_id
  AND s.aprovado_cadastro_em IS NOT NULL
  AND COALESCE(c.cadastro_aprovado, false) = false
  AND c.tipo_entrada = 'troca_titularidade';