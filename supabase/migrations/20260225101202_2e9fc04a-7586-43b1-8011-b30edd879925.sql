UPDATE documento_templates 
SET conteudo = REPLACE(
  REPLACE(conteudo, '<p><strong>Serviços:</strong></p>', ''),
  '<p>{{plano.descricao}}</p>', ''
)
WHERE codigo = 'AF1';