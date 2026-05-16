-- Backfill: documentos de contrato
INSERT INTO public.sga_fotos_enviadas (veiculo_id, codigo_veiculo_hinova, origem, origem_id, arquivo_url, codigo_tipo, hinova_response)
SELECT v.id, v.codigo_hinova, 'contratos_documentos', cd.id::text, cd.arquivo_url, 0, jsonb_build_object('backfill', true)
FROM public.contratos_documentos cd
JOIN public.contratos c ON c.id = cd.contrato_id
JOIN public.veiculos v ON v.id = c.veiculo_id
WHERE v.codigo_hinova IS NOT NULL AND v.sincronizado_hinova = true AND cd.arquivo_url IS NOT NULL
ON CONFLICT (veiculo_id, origem, origem_id) DO NOTHING;

-- Backfill: fotos de vistoria
INSERT INTO public.sga_fotos_enviadas (veiculo_id, codigo_veiculo_hinova, origem, origem_id, arquivo_url, codigo_tipo, hinova_response)
SELECT v.id, v.codigo_hinova, 'vistoria_fotos', vf.id::text, vf.arquivo_url, 0, jsonb_build_object('backfill', true)
FROM public.vistoria_fotos vf
JOIN public.vistorias vi ON vi.id = vf.vistoria_id
JOIN public.veiculos v ON v.id = vi.veiculo_id
WHERE v.codigo_hinova IS NOT NULL AND v.sincronizado_hinova = true
  AND vf.arquivo_url IS NOT NULL
  AND vi.status IN ('concluida','aprovada','em_analise')
ON CONFLICT (veiculo_id, origem, origem_id) DO NOTHING;

-- Backfill: termo assinado direto do contrato
INSERT INTO public.sga_fotos_enviadas (veiculo_id, codigo_veiculo_hinova, origem, origem_id, arquivo_url, codigo_tipo, hinova_response)
SELECT v.id, v.codigo_hinova, 'pdf_assinado', c.id::text, c.pdf_assinado_url, 0, jsonb_build_object('backfill', true)
FROM public.contratos c
JOIN public.veiculos v ON v.id = c.veiculo_id
WHERE v.codigo_hinova IS NOT NULL AND v.sincronizado_hinova = true
  AND c.pdf_assinado_url IS NOT NULL
ON CONFLICT (veiculo_id, origem, origem_id) DO NOTHING;

-- Backfill: avatar do associado
INSERT INTO public.sga_fotos_enviadas (veiculo_id, codigo_veiculo_hinova, origem, origem_id, arquivo_url, codigo_tipo, hinova_response)
SELECT v.id, v.codigo_hinova, 'avatar', a.id::text, a.avatar_url, 0, jsonb_build_object('backfill', true)
FROM public.veiculos v
JOIN public.associados a ON a.id = v.associado_id
WHERE v.codigo_hinova IS NOT NULL AND v.sincronizado_hinova = true
  AND a.avatar_url IS NOT NULL
ON CONFLICT (veiculo_id, origem, origem_id) DO NOTHING;