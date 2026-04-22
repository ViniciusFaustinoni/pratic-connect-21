-- Seed: 4 templates Meta WhatsApp para Troca de Titularidade
INSERT INTO public.whatsapp_meta_templates (nome, categoria, idioma, status, corpo, rodape, botoes, variaveis_exemplo)
VALUES
  (
    'troca_titularidade_solicitada',
    'UTILITY',
    'pt_BR',
    'PENDING',
    'Olá {{1}}! Recebemos sua solicitação de troca de titularidade do veículo {{2}}. Em breve você receberá um termo de cancelamento por email para assinar.',
    'Pratic Car',
    '[]'::jsonb,
    '{"1":"João","2":"HONDA CIVIC ABC1234"}'::jsonb
  ),
  (
    'troca_titularidade_termo_pendente',
    'UTILITY',
    'pt_BR',
    'PENDING',
    'Olá {{1}}, o termo de cancelamento da troca de titularidade do veículo {{2}} foi enviado ao seu email. Por favor, assine para que possamos prosseguir com a transferência.',
    'Pratic Car',
    '[{"type":"URL","text":"Acessar meu painel","url":"https://app.praticcar.org/cotacao/{{1}}"}]'::jsonb,
    '{"1":"João","2":"HONDA CIVIC ABC1234"}'::jsonb
  ),
  (
    'troca_titularidade_aprovada',
    'UTILITY',
    'pt_BR',
    'PENDING',
    'Boa notícia, {{1}}! Sua solicitação de troca de titularidade do veículo {{2}} foi APROVADA. O novo titular já pode prosseguir com a contratação.',
    'Pratic Car',
    '[]'::jsonb,
    '{"1":"João","2":"HONDA CIVIC ABC1234"}'::jsonb
  ),
  (
    'troca_titularidade_reprovada',
    'UTILITY',
    'pt_BR',
    'PENDING',
    'Olá {{1}}, sua solicitação de troca de titularidade do veículo {{2}} foi REPROVADA. Motivo: {{3}}. Entre em contato com nossa equipe para mais informações.',
    'Pratic Car',
    '[]'::jsonb,
    '{"1":"João","2":"HONDA CIVIC ABC1234","3":"Documentação incompleta"}'::jsonb
  )
ON CONFLICT (nome) DO NOTHING;