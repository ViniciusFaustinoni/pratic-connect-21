-- Remove trecho "TABELA FIPE" do template AF1
UPDATE public.documento_templates
SET conteudo = REPLACE(
  REPLACE(
    conteudo,
    '<p><strong>TABELA FIPE</strong></p>',
    ''
  ),
  '<p>Declaro estar ciente e de acordo que, em caso de ressarcimento integral, opto para que o valor seja calculado com base na Tabela FIPE vigente na data do evento: SIM</p>',
  ''
)
WHERE codigo = 'AF1';