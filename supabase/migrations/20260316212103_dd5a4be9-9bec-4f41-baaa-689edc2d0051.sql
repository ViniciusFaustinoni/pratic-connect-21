INSERT INTO whatsapp_meta_templates (
  nome, categoria, corpo, header_tipo, header_texto, rodape, botoes, variaveis_exemplo, status
) VALUES (
  'assinatura_documento',
  'UTILITY',
  E'Olá {{1}}! 📄\n\nVocê tem um documento pendente de assinatura:\n📋 *{{2}}*\n\nClique no botão abaixo para assinar digitalmente. É rápido e seguro!\n\nEquipe PRATIC 🛡️',
  'none',
  NULL,
  'Associação de Benefícios PraticCar',
  '[{"tipo": "url", "texto": "Assinar Agora ✍️", "url": "https://assina.ae/{{1}}"}]'::jsonb,
  '{"1": "João", "2": "Termo de Afiliação 001"}'::jsonb,
  'DRAFT'
);