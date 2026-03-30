UPDATE whatsapp_meta_templates
SET 
  botoes = '[{"type": "URL", "text": "Assinar agora", "url": "https://app.praticprotecao.com.br/acompanhar/{{1}}"}]'::jsonb,
  variaveis_exemplo = '{"1": "João", "2": "HB20 - ABC1234"}'::jsonb
WHERE nome = 'assinatura_instalacao_v1';