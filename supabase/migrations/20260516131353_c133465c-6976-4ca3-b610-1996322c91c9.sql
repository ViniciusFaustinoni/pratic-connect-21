
UPDATE public.hinova_mapeamentos
SET codigo_hinova = 13,
    ativo = true,
    descricao = 'CONTRATO/TERMO DE FILIAÇÃO — código provisório 13 (aguardando confirmação oficial Hinova)'
WHERE tipo = 'tipo_foto'
  AND codigo_local IN ('contrato_assinado', 'termo_filiacao', 'contrato');

UPDATE public.hinova_mapeamentos
SET codigo_hinova = 14,
    ativo = true,
    descricao = 'NOTA FISCAL DO VEÍCULO — código provisório 14 (aguardando confirmação oficial Hinova)'
WHERE tipo = 'tipo_foto'
  AND codigo_local IN ('nota_fiscal_veiculo', 'nota_fiscal');
