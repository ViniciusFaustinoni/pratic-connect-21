UPDATE documento_templates
SET template_html = REPLACE(
  template_html,
  '<p><strong>Categoria:</strong></p></td><td colspan="1" rowspan="1" colwidth="429"><p>{{veiculo.tipo}}</p>',
  '<p><strong>Categoria:</strong></p></td><td colspan="1" rowspan="1" colwidth="429"><p>{{veiculo.categoria}}</p>'
),
conteudo = CASE
  WHEN conteudo IS NOT NULL THEN REPLACE(
    conteudo,
    '<p><strong>Categoria:</strong></p></td><td colspan="1" rowspan="1" colwidth="429"><p>{{veiculo.tipo}}</p>',
    '<p><strong>Categoria:</strong></p></td><td colspan="1" rowspan="1" colwidth="429"><p>{{veiculo.categoria}}</p>'
  )
  ELSE conteudo
END
WHERE id = 'eb09759f-cfbc-4ee8-8f1f-f1cc520e7279';