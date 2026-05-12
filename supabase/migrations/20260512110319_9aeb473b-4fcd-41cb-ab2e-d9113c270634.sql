INSERT INTO public.whatsapp_meta_templates (nome, categoria, idioma, status, corpo, variaveis_exemplo)
VALUES (
  'notificacao_geral_v1',
  'UTILITY',
  'pt_BR',
  'PENDING',
  'Olá {{1}}, {{2}}: {{3}}',
  '{"1": "Cliente", "2": "Atualização", "3": "Sua solicitação foi processada"}'::jsonb
)
ON CONFLICT (nome) DO NOTHING;