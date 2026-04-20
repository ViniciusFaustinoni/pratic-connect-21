-- Liberar instalação do Marcos Vinicius presa ao Kleytonn (imprevisto reportado via caminho antigo sem disparar trigger)
UPDATE public.instalacoes
   SET instalador_responsavel_id = NULL,
       rota_id = NULL,
       updated_at = now()
 WHERE id IN (
   SELECT i.id
   FROM public.instalacoes i
   JOIN public.associados a ON a.id = i.associado_id
   LEFT JOIN public.servicos s ON s.instalacao_origem_id = i.id
   WHERE a.nome ILIKE '%MARCOS VINICIUS DATIVO%'
     AND i.instalador_responsavel_id IS NOT NULL
 );

-- Backfill geral: serviços recusados via registros_recusa_tarefa recentemente mas ainda com instalação/vistoria presa
UPDATE public.instalacoes i
   SET instalador_responsavel_id = NULL,
       rota_id = NULL,
       updated_at = now()
  FROM public.registros_recusa_tarefa r
  JOIN public.servicos s ON s.id = r.servico_id
 WHERE s.instalacao_origem_id = i.id
   AND i.instalador_responsavel_id IS NOT NULL
   AND r.created_at > now() - interval '14 days';

UPDATE public.vistorias v
   SET vistoriador_id = NULL,
       rota_id = NULL,
       updated_at = now()
  FROM public.registros_recusa_tarefa r
  JOIN public.servicos s ON s.id = r.servico_id
 WHERE s.vistoria_origem_id = v.id
   AND v.vistoriador_id IS NOT NULL
   AND r.created_at > now() - interval '14 days';