INSERT INTO public.whatsapp_templates (codigo, nome, categoria, mensagem, variaveis, ativo)
VALUES (
  'assinatura_instalacao_v1',
  'Assinatura Digital da Instalação',
  'monitoramento',
  E'Olá {{nome}}! A instalação do rastreador no seu veículo {{veiculo}} foi concluída com sucesso. ✅\n\nPara finalizar o processo, acesse o link abaixo e assine digitalmente confirmando a instalação:\n\n{{link}}',
  ARRAY['nome', 'veiculo', 'link'],
  true
)
ON CONFLICT (codigo) DO NOTHING;