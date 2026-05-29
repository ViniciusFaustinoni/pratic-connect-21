UPDATE public.cotacoes SET tipo_entrada = 'substituicao_placa' WHERE tipo_entrada = 'substituicao';
UPDATE public.contratos SET tipo_entrada = 'substituicao_placa' WHERE tipo_entrada = 'substituicao';
UPDATE public.cotacoes
  SET dados_extras = jsonb_set(dados_extras, '{tipo_entrada}', '"substituicao_placa"'::jsonb)
  WHERE dados_extras->>'tipo_entrada' = 'substituicao';