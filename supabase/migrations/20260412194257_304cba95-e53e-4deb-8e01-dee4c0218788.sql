UPDATE public.documento_templates
SET conteudo = REPLACE(
  conteudo,
  '<td><p><strong>Consultor:</strong></p></td>
                                <td><p><br></p></td>',
  '<td><p><strong>Consultor:</strong></p></td>
                                <td><p>{{consultor.nome}}</p></td>'
),
    updated_at = now()
WHERE codigo = 'AF1';