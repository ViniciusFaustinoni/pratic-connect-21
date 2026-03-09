INSERT INTO whatsapp_meta_templates (nome, categoria, corpo, header_tipo, rodape, botoes, variaveis_exemplo, status, idioma)
VALUES (
  'ativacao_conta_pratic',
  'UTILITY',
  E'Parabéns {{1}}! Seu cadastro na PRATIC foi aprovado!\n\nVeículo Protegido: {{2}}\nCobertura Ativa: {{3}}\n\nAcesse o botão abaixo para criar sua senha e acessar o App PRATIC.',
  'none',
  'PRATIC - Proteção Veicular',
  '[{"type": "URL", "text": "Acessar meu App", "url": "https://pratic-connect-21.lovable.app/app/login/{{1}}"}]'::jsonb,
  '{"1": "Marcus", "2": "LTB4J74 - Toyota Corolla", "3": "Roubo e Furto"}'::jsonb,
  'DRAFT',
  'pt_BR'
)
ON CONFLICT DO NOTHING;