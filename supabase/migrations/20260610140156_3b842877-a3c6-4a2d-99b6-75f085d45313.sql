UPDATE public.documento_templates
SET conteudo = REPLACE(conteudo, 'PSM cancelada) {{veiculo.placa}}', 'PSM cancelada) {{substituicao.placa_anterior}}'),
    updated_at = now()
WHERE id = '5802464d-4d6a-40fc-aaf1-04dc4dc464f8'
  AND conteudo LIKE '%PSM cancelada) {{veiculo.placa}}%';