INSERT INTO public.whatsapp_meta_templates (nome, categoria, idioma, status, corpo, variaveis_exemplo)
VALUES (
  'suspensao_cobertura_nao_instalacao_v1',
  'UTILITY',
  'pt_BR',
  'RASCUNHO',
  'Olá {{1}}! ⚠️ A cobertura ( Roubo e Furto )  do seu veículo {{2}} foi suspensa temporariamente porque a instalação do rastreador não foi realizada dentro do prazo de {{3}}h após a assinatura do contrato. 🚫 Você está sem cobertura de roubo e furto enquanto a instalação não for concluída.  Assim que a instalação for finalizada, a cobertura volta automaticamente.',
  '[["João","ABC1D23","48"]]'::jsonb
);