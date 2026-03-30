UPDATE whatsapp_meta_templates
SET variaveis_exemplo = '{"1": "João", "2": "HB20 - ABC1234", "3": "https://app.praticprotecao.com.br/acompanhar/token123"}'::jsonb
WHERE nome = 'assinatura_instalacao_v1';