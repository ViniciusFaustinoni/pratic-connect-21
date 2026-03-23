INSERT INTO public.whatsapp_meta_templates (nome, categoria, corpo, header_tipo, rodape, status)
VALUES (
  'prestador_nova_instalacao_v1',
  'UTILITY',
  E'Olá {{1}}! Nova instalação atribuída.\n\nAssociado: {{2}}\nMunicípio: {{3}}\nEndereço: {{4}}\nData prevista: {{5}}\n\nAcesse os detalhes e confirme pelo link:\n{{6}}\n\nESSA MENSAGEM É AUTOMÁTICA. FAVOR NÃO RESPONDER!',
  'none',
  NULL,
  'DRAFT'
)
ON CONFLICT DO NOTHING;