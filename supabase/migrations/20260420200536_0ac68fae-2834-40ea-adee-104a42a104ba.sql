INSERT INTO public.whatsapp_meta_templates
  (nome, categoria, idioma, status, header_tipo, corpo, rodape, botoes, variaveis_exemplo)
VALUES (
  'termo_filiacao_assinatura_v1',
  'UTILITY',
  'pt_BR',
  'DRAFT',
  'none',
  E'Olá {{1}}! 📄\n\nSeu *Termo de Filiação PRATIC* está pronto para assinatura digital.\n\nVeículo: *{{2}}*\nContrato: {{3}}\n\nClique no botão abaixo para ler e assinar com validade jurídica.\nApós a assinatura, sua proteção será ativada.',
  'Equipe PRATIC 🛡️',
  '[{"tipo":"url","texto":"Assinar Termo","url":"https://assina.ae/{{1}}"}]'::jsonb,
  '{"1":"João","2":"HB20 - ABC1234","3":"PRT-2026-001234"}'::jsonb
)
ON CONFLICT (nome) DO NOTHING;