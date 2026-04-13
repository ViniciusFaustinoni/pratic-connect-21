
INSERT INTO public.whatsapp_meta_templates (nome, categoria, idioma, corpo, botoes, status)
VALUES (
  'autorizacao_fipe_diretoria',
  'UTILITY',
  'pt_BR',
  E'Olá! Temos uma nova solicitação de autorização de veículo que requer sua análise.\n\n*Detalhes do Veículo:*\nFabricante e Modelo: {{1}}\nAno: {{2}}\nPlaca: {{3}}\nValor FIPE: {{4}}\nLimite: {{5}}\nTipo: {{6}}\nAssociado: {{7}}\n\nAcesse o painel para aprovar ou recusar:\n{{8}}\n\nOu responda diretamente com APROVAR ou RECUSAR.',
  '[{"tipo": "url", "texto": "Acessar Painel", "url": "https://app.praticcar.org/vendas/aprovacoes-fipe"}]'::jsonb,
  'PENDING'
);
