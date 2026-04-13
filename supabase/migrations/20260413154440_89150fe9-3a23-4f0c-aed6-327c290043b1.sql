INSERT INTO public.whatsapp_meta_templates (nome, categoria, idioma, status, corpo, variaveis_exemplo)
VALUES (
  'aprovacao_fipe_diretoria_v1',
  'UTILITY',
  'pt_BR',
  'PENDING',
  'Autorização necessária: Veículo {{1}} {{2}}/{{3}} placa {{4}} - FIPE {{5}} (limite: {{6}}). Associado: {{7}}. Responda APROVAR ou RECUSAR.',
  '["FIAT", "Argo", "2023", "ABC1D23", "R$ 85.000", "R$ 70.000", "João Silva"]'::jsonb
)
ON CONFLICT DO NOTHING;