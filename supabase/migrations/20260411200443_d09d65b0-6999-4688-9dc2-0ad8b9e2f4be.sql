
-- 1. Proposta de Filiação: remove trailing city/date + name/CPF block
UPDATE documento_templates
SET conteudo = regexp_replace(
  conteudo,
  '<p[^>]*>\s*\{\{associado\.cidade\}\},\s*\{\{sistema\.data_extenso\}\}\.\s*</p>\s*(<p[^>]*>\s*(<br\s*/?>)?\s*</p>\s*)*<p[^>]*>\s*<strong>\{\{associado\.nome\}\}\s*-\s*CPF:\s*\{\{associado\.cpf\}\}</strong>\s*</p>\s*(<p[^>]*>\s*(<br\s*/?>)?\s*</p>\s*)*',
  '',
  'gi'
),
updated_at = now()
WHERE id = 'eb09759f-cfbc-4ee8-8f1f-f1cc520e7279';

-- 2. REGULAMENTO: remove Local/Date + underscore + ASSINATURA DO ASSOCIADO + name/CPF block
UPDATE documento_templates
SET conteudo = regexp_replace(
  conteudo,
  '<p[^>]*>\s*(<br\s*/?>)?\s*</p>\s*<p[^>]*>\s*Local:\s*_+.*?</p>\s*<p[^>]*>\s*_+\s*</p>\s*<p[^>]*>\s*<strong>ASSINATURA DO ASSOCIADO</strong>\s*</p>\s*<p[^>]*>\s*<strong>\{\{associado\.nome\}\}</strong>\s*—\s*CPF:\s*<strong>\{\{associado\.cpf\}\}</strong>\s*</p>\s*(<p[^>]*>\s*(<br\s*/?>)?\s*</p>\s*)*',
  '',
  'gi'
),
updated_at = now()
WHERE id = '34e1e572-9dca-4f0e-ba8d-1ce64a8e6803';

-- 3. TERMO DE RESPONSABILIDADE DO RASTREADOR: remove city/date + hr + name + CPF block
UPDATE documento_templates
SET conteudo = regexp_replace(
  conteudo,
  '<hr>\s*<p[^>]*>\s*\{\{empresa\.cidade\}\}\s*-\s*\{\{empresa\.uf\}\},\s*\{\{sistema\.data_extenso\}\}\.\s*</p>\s*(<p[^>]*>\s*(<br\s*/?>)?\s*</p>\s*)*(<hr>\s*)?<p[^>]*>\s*\{\{associado\.nome\}\}\s*</p>\s*<p[^>]*>\s*CPF:\s*\{\{associado\.cpf\}\}\s*</p>\s*',
  '',
  'gi'
),
updated_at = now()
WHERE id = 'a644ab91-e75a-43b0-9254-abe19d3075cc';

-- 4. Remove obsolete config
DELETE FROM configuracoes WHERE chave = 'assinatura_total_paginas';
