
INSERT INTO configuracoes (chave, valor, descricao, tipo, categoria, editavel, updated_at)
VALUES
  ('prazo_link_evento_horas',         '72', 'Validade do link de evento/sinistro (horas)',                 'numero', 'operacional', true, NOW()),
  ('prazo_link_primeiro_acesso_horas','48', 'Validade do token de primeiro acesso ao app (horas)',          'numero', 'operacional', true, NOW()),
  ('prazo_cotacao_fornecedor_horas',  '24', 'Prazo para resposta de cotação de fornecedores (horas)',       'numero', 'operacional', true, NOW()),
  ('prazo_vencimento_adesao_dias',    '3',  'Prazo de vencimento da cobrança de adesão PIX/boleto (dias)', 'numero', 'financeiro',  true, NOW()),
  ('prazo_documento_upload_dias',     '7',  'Prazo para upload de documentos solicitados (dias)',           'numero', 'operacional', true, NOW()),
  ('prazo_rastreador_sem_sinal_horas','4',  'Alerta de rastreador sem comunicação após instalação (horas)','numero', 'operacional', true, NOW()),
  ('prazo_manutencao_rastreador_horas','48','Prazo para manutenção do rastreador (horas)',                  'numero', 'operacional', true, NOW())
ON CONFLICT (chave) DO UPDATE
  SET valor = EXCLUDED.valor,
      descricao = EXCLUDED.descricao,
      updated_at = NOW();
