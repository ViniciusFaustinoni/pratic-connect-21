UPDATE whatsapp_meta_templates 
SET botoes = '[{"type": "URL", "text": "Acessar meu App", "url": "https://pratic-connect-21.lovable.app/app/criar-senha?token={{1}}"}]'::jsonb,
    updated_at = now()
WHERE nome = 'ativacao_conta_pratic';