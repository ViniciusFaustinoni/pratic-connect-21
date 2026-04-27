
-- Concluído: placa 0KM com placeholder técnico aparecendo na UI
UPDATE public.error_reports
SET 
  status = 'concluido'::error_report_status,
  tratado_por = COALESCE(tratado_por, '4218616b-44c1-473b-a8cc-d2eb5a8d10dc'),
  tratado_em  = COALESCE(tratado_em, now()),
  concluido_por = '4218616b-44c1-473b-a8cc-d2eb5a8d10dc',
  concluido_em  = now(),
  observacao_diretor = COALESCE(NULLIF(observacao_diretor,''), '') ||
    CASE WHEN COALESCE(observacao_diretor,'') = '' THEN '' ELSE E'\n\n' END ||
    '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY HH24:MI') ||
    '] Correção aplicada: placeholder técnico (0KMxxxxx) substituído por "0KM (sem placa)" no detalhe do veículo e na aba Veículos do associado. Favor validar.',
  updated_at = now()
WHERE id = '7e90b06c-61b7-4a30-a0a9-b376865c9c7e';

-- Em tratamento: relatos analisados que ainda exigem implementação
UPDATE public.error_reports
SET 
  status = 'em_tratamento'::error_report_status,
  tratado_por = COALESCE(tratado_por, '4218616b-44c1-473b-a8cc-d2eb5a8d10dc'),
  tratado_em  = COALESCE(tratado_em, now()),
  updated_at  = now()
WHERE id IN (
  'ccb1a3d4-165a-4107-ba06-cf0ddd7267c9', -- técnico vinculado mas não inicia
  '6a91ae40-dd1d-4f98-8a95-fcfa5a90b554', -- finalizou sem etapa do rastreador
  'de711e7b-ea0b-4507-ac3d-943fcb074063', -- não consigo atribuir (serviço fantasma)
  '293d872f-31a7-4065-b177-6dc1cc523157', -- mesmo caso (KAIKE)
  '3e6d826e-aeeb-4134-8338-24f999bf52b4', -- reativar associado indisponível
  '5ab98352-6df4-4010-a68d-8229545c71b0', -- vínculo Softruck sem dados/login
  '982528c2-1105-4385-973b-a1ab16bbf4cd', -- ativar (instalação por prestador)
  '4d9411ff-e8eb-401c-8c00-995b60300b58'  -- pular instalação já feita
)
AND status = 'aberto'::error_report_status;
