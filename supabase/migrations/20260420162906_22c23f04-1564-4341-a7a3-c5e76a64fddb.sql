
CREATE OR REPLACE FUNCTION public.liberar_tecnico_em_imprevisto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.imprevisto_registrado_em IS NOT NULL
     AND (OLD.imprevisto_registrado_em IS DISTINCT FROM NEW.imprevisto_registrado_em)
     AND NEW.imprevisto_origem = 'instalador' THEN

    NEW.profissional_id := NULL;

    IF NEW.instalacao_origem_id IS NOT NULL THEN
      UPDATE public.instalacoes
         SET instalador_responsavel_id = NULL,
             rota_id = NULL,
             status = CASE
                        WHEN status IN ('em_rota','em_andamento') THEN 'agendada'
                        ELSE status
                      END,
             updated_at = now()
       WHERE id = NEW.instalacao_origem_id;
    END IF;

    IF NEW.vistoria_origem_id IS NOT NULL THEN
      UPDATE public.vistorias
         SET vistoriador_id = NULL,
             rota_id = NULL,
             status = CASE
                        WHEN status IN ('em_rota','em_andamento') THEN 'agendada'
                        ELSE status
                      END,
             updated_at = now()
       WHERE id = NEW.vistoria_origem_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_liberar_tecnico_imprevisto ON public.servicos;
CREATE TRIGGER trg_liberar_tecnico_imprevisto
  BEFORE UPDATE OF imprevisto_registrado_em ON public.servicos
  FOR EACH ROW
  EXECUTE FUNCTION public.liberar_tecnico_em_imprevisto();

-- Backfill: serviços presos em imprevisto_pendente ainda vinculados a técnico
UPDATE public.servicos
   SET profissional_id = NULL,
       updated_at = now()
 WHERE status = 'imprevisto_pendente'
   AND imprevisto_origem = 'instalador'
   AND profissional_id IS NOT NULL;

-- Backfill: instalações presas vinculadas a esses serviços
UPDATE public.instalacoes i
   SET instalador_responsavel_id = NULL,
       rota_id = NULL,
       status = CASE WHEN i.status IN ('em_rota','em_andamento') THEN 'agendada' ELSE i.status END,
       updated_at = now()
  FROM public.servicos s
 WHERE s.instalacao_origem_id = i.id
   AND s.status = 'imprevisto_pendente'
   AND s.imprevisto_origem = 'instalador'
   AND i.instalador_responsavel_id IS NOT NULL;

-- Backfill: vistorias presas vinculadas a esses serviços
UPDATE public.vistorias v
   SET vistoriador_id = NULL,
       rota_id = NULL,
       status = CASE WHEN v.status IN ('em_rota','em_andamento') THEN 'agendada' ELSE v.status END,
       updated_at = now()
  FROM public.servicos s
 WHERE s.vistoria_origem_id = v.id
   AND s.status = 'imprevisto_pendente'
   AND s.imprevisto_origem = 'instalador'
   AND v.vistoriador_id IS NOT NULL;
