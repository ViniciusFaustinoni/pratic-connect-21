
-- 1) Trigger em instalacoes (espelho do existente em servicos) — fecha a brecha
CREATE OR REPLACE FUNCTION public.fn_reativar_cobertura_pos_instalacao_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'concluida'
     AND (OLD.status IS DISTINCT FROM 'concluida'::status_instalacao)
     AND NEW.veiculo_id IS NOT NULL THEN

    UPDATE public.veiculos
       SET cobertura_suspensa = false,
           cobertura_suspensa_motivo = NULL,
           cobertura_suspensa_em = NULL,
           cobertura_total = true,
           cobertura_roubo_furto = true
     WHERE id = NEW.veiculo_id
       AND cobertura_suspensa = true;

    UPDATE public.veiculos
       SET status = 'ativo',
           updated_at = now()
     WHERE id = NEW.veiculo_id
       AND status IN ('instalacao_pendente', 'em_analise');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_reativar_cobertura_pos_instalacao_inst ON public.instalacoes;
CREATE TRIGGER trg_reativar_cobertura_pos_instalacao_inst
AFTER UPDATE ON public.instalacoes
FOR EACH ROW
EXECUTE FUNCTION public.fn_reativar_cobertura_pos_instalacao_v2();

-- 2) Função de reconciliação (idempotente) — varre divergências e corrige
CREATE OR REPLACE FUNCTION public.fn_reconciliar_status_pos_instalacao()
RETURNS TABLE(veiculo_id uuid, placa text, acao text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH divergentes AS (
    SELECT v.id, v.placa
    FROM public.veiculos v
    WHERE v.status = 'instalacao_pendente'
      AND (
        EXISTS (SELECT 1 FROM public.instalacoes i WHERE i.veiculo_id = v.id AND i.status = 'concluida')
        OR EXISTS (SELECT 1 FROM public.servicos s WHERE s.veiculo_id = v.id AND s.tipo = 'instalacao' AND s.status = 'concluida')
      )
  ),
  upd AS (
    UPDATE public.veiculos v
       SET status = 'ativo',
           cobertura_total = true,
           cobertura_roubo_furto = true,
           cobertura_suspensa = false,
           cobertura_suspensa_motivo = NULL,
           cobertura_suspensa_em = NULL,
           updated_at = now()
      FROM divergentes d
      WHERE v.id = d.id
    RETURNING v.id, v.placa
  )
  SELECT u.id, u.placa, 'promovido_para_ativo'::text FROM upd u;
END;
$function$;

COMMENT ON FUNCTION public.fn_reconciliar_status_pos_instalacao() IS
'Reconcilia veículos que ficaram em instalacao_pendente apesar de terem instalação/serviço concluído. Idempotente. Pode ser executada manualmente ou via cron.';
