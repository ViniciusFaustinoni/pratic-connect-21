
INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao)
VALUES
  ('prazo_devolucao_rastreador_cancelamento', '7', 'numero', 'regras_venda', 'Prazo em dias para devolução do rastreador após cancelamento'),
  ('base_calculo_prorata_cancelamento', 'pos_vencimento', 'texto', 'regras_venda', 'Base de cálculo do pró-rata no cancelamento: pos_vencimento ou inicio_mes')
ON CONFLICT (chave) DO NOTHING;
