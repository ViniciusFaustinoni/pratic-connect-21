-- Insert default configs (viagem) with required tipo and categoria
INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao)
VALUES
  ('viagem_valor_diaria', '0', 'moeda', 'operacional', 'Valor da diária de viagem pago ao técnico (R$)'),
  ('viagem_sla_horas', '72', 'numero', 'operacional', 'SLA de instalação em município de viagem (horas úteis)')
ON CONFLICT (chave) DO NOTHING;