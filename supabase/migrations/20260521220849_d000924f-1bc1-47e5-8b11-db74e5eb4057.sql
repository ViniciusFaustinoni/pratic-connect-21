INSERT INTO public.whatsapp_meta_templates
  (nome, categoria, idioma, status, header_tipo, corpo, rodape, botoes, variaveis_exemplo, disparo_habilitado)
VALUES
  ('notificacao_atualizacao',
   'UTILITY',
   'pt_BR',
   'PENDING',
   'none',
   'Olá {{1}}, há uma atualização no seu atendimento {{2}}: {{3}}. Acompanhe pelo app.',
   'Pratic Car',
   NULL,
   '{"1":"Ana","2":"COT-2026-0001","3":"Troca de titularidade liberada"}'::jsonb,
   true)
ON CONFLICT (nome) DO NOTHING;