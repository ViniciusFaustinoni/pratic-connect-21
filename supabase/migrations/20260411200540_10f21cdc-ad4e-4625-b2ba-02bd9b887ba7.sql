
UPDATE documento_templates
SET conteudo = regexp_replace(
  conteudo,
  '<hr>\s*<p[^>]*>\{\{empresa\.cidade\}\}\s*-\s*\{\{empresa\.uf\}\},\s*\{\{sistema\.data_extenso\}\}\.\s*</p>\s*<p>\s*(<br>\s*)+</p>\s*<hr>\s*<p[^>]*>\{\{associado\.nome\}\}\s*</p>\s*<p[^>]*>CPF:\s*\{\{associado\.cpf\}\}\s*</p>',
  '',
  'gi'
),
updated_at = now()
WHERE id = 'a644ab91-e75a-43b0-9254-abe19d3075cc';
