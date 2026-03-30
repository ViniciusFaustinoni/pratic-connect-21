INSERT INTO whatsapp_meta_templates (nome, categoria, idioma, corpo, status, botoes, variaveis_exemplo, rodape)
VALUES (
  'assinatura_instalacao_v1',
  'UTILITY',
  'pt_BR',
  E'Olá {{1}}! A instalação do rastreador no seu veículo {{2}} foi concluída com sucesso. ✅\n\nPara finalizar o processo, acesse o link abaixo e assine digitalmente confirmando a instalação.',
  'DRAFT',
  '[{"type": "URL", "text": "Assinar agora", "url": "{{3}}"}]'::jsonb,
  '["João", "HB20 - ABC1234", "https://example.com/acompanhar/token123"]'::jsonb,
  'Pratic Proteção Veicular'
);