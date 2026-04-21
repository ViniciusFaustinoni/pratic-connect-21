
-- Limpar templates rejeitados/duplicados
DELETE FROM public.whatsapp_meta_templates
WHERE nome IN (
  'termo_filiacao_assinatura_v1',
  'aprovacao_fipe_diretoria_v2',
  'aprovacao_fipe_diretoria_v3',
  'autorizacao_fipe_diretoria'
);

-- Inserir novo: termo_filiacao_assinatura_v2 (UTILITY, footer puro, URL dinâmica c/ exemplo)
INSERT INTO public.whatsapp_meta_templates (
  nome, categoria, idioma, status, header_tipo, header_texto,
  corpo, rodape, botoes, variaveis_exemplo
) VALUES (
  'termo_filiacao_assinatura_v2',
  'UTILITY',
  'pt_BR',
  'RASCUNHO',
  'none',
  NULL,
  E'Olá, {{1}}.\n\nSeu Termo de Filiação está disponível para assinatura digital com validade jurídica.\n\nVeículo: {{2}}\nContrato: {{3}}\n\nApós assinar, sua proteção será ativada automaticamente.',
  'PRATIC Proteção Veicular',
  '[{"tipo":"url","texto":"Assinar termo","url":"https://app.praticcar.org/contrato/{{1}}","exemplo":"https://app.praticcar.org/contrato/abc123"}]'::jsonb,
  '{"1":"João Silva","2":"HB20 - ABC1D23","3":"PRT-2026-001234"}'::jsonb
);

-- Inserir novo: autorizacao_fipe_diretoria_v4 (UTILITY com header, 7 variáveis, botão URL dinâmico)
INSERT INTO public.whatsapp_meta_templates (
  nome, categoria, idioma, status, header_tipo, header_texto,
  corpo, rodape, botoes, variaveis_exemplo
) VALUES (
  'autorizacao_fipe_diretoria_v4',
  'UTILITY',
  'pt_BR',
  'RASCUNHO',
  'text',
  'Nova solicitação de autorização',
  E'Olá, {{1}}.\n\nHá uma nova solicitação de autorização de veículo aguardando sua análise como diretor(a).\n\nVeículo: {{2}}\nAno: {{3}}\nPlaca: {{4}}\nValor FIPE: {{5}}\nLimite atual: {{6}}\nAssociado: {{7}}\n\nAcesse o painel administrativo para registrar sua decisão.',
  'PRATIC Proteção Veicular',
  '[{"tipo":"url","texto":"Abrir painel","url":"https://app.praticcar.org/vendas/aprovacoes-fipe/{{1}}","exemplo":"https://app.praticcar.org/vendas/aprovacoes-fipe/sol-2026-001"}]'::jsonb,
  '{"1":"Carlos Diretor","2":"FIAT Argo","3":"2023","4":"ABC1D23","5":"R$ 85.000,00","6":"R$ 70.000,00","7":"João Silva"}'::jsonb
);
