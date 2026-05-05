-- Cria rascunho do template Meta de cobrança CSV inadimplentes
INSERT INTO public.whatsapp_meta_templates (nome, categoria, idioma, status, corpo, rodape, variaveis_exemplo)
VALUES (
  'cobranca_inadimplencia_pratic',
  'UTILITY',
  'pt_BR',
  'DRAFT',
  E'Olá, {{1}}! 👋\n\nIdentificamos pendência(s) financeira(s) na sua associação Praticcar.\n\n📋 *Boletos em aberto:*\n{{2}}\n\n💳 Para regularizar, copie a linha digitável do(s) boleto(s) acima e pague em qualquer banco/app.\n\nEm caso de dúvidas, responda esta mensagem.',
  'Praticcar — Proteção Veicular',
  '[{"name":"1","example":"João"},{"name":"2","example":"• Placa ABC1234 — venc. 10/04/2024\n  34191.09123 32079.130939 75008.900005 6 96820000018670"}]'::jsonb
)
ON CONFLICT (nome) DO NOTHING;