UPDATE whatsapp_meta_templates
SET
  botoes = '[{"tipo": "url", "texto": "Acessar App PRATIC", "url": "https://pratic-connect-21.lovable.app/acompanhar/{{1}}"}]'::jsonb,
  variaveis_exemplo = '{"1": "João", "2": "ABC1234 - Toyota Corolla XEi", "3": "Roubo e Furto", "4": "Instalação do rastreador"}'::jsonb,
  status = 'DRAFT',
  updated_at = now()
WHERE nome = 'boas_vindas_associado';