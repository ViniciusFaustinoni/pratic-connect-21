-- 1) Função: ao virar 'negado', sincronizar veículo e instalação
CREATE OR REPLACE FUNCTION public.fn_sync_on_servico_negado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.decisao_instalador = 'negado'
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.decisao_instalador, '') <> 'negado') THEN

    -- Veículo: cair para em_analise + suspender cobertura (somente se ainda estiver instalacao_pendente)
    IF NEW.veiculo_id IS NOT NULL THEN
      UPDATE public.veiculos
         SET status = 'em_analise'::status_veiculo,
             cobertura_suspensa = true,
             cobertura_suspensa_motivo = 'Recusa do instalador — aguardando análise do monitoramento',
             cobertura_suspensa_em = COALESCE(cobertura_suspensa_em, now()),
             updated_at = now()
       WHERE id = NEW.veiculo_id
         AND status::text IN ('instalacao_pendente','aprovado');
    END IF;

    -- Instalação ligada ao serviço (via instalacao_origem_id)
    IF NEW.instalacao_origem_id IS NOT NULL THEN
      UPDATE public.instalacoes
         SET status = 'em_analise'::status_instalacao,
             observacoes = COALESCE(observacoes,'') ||
                           E'\n[Negada pelo instalador em ' || to_char(now(),'DD/MM/YYYY HH24:MI') ||
                           ' — aguardando análise do monitoramento] ' ||
                           COALESCE(NEW.ressalvas_instalador,''),
             updated_at = now()
       WHERE id = NEW.instalacao_origem_id
         AND status::text NOT IN ('cancelada','concluida');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_on_servico_negado ON public.servicos;
CREATE TRIGGER trg_sync_on_servico_negado
AFTER INSERT OR UPDATE OF decisao_instalador, status ON public.servicos
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_on_servico_negado();

-- 2) Backfill de registros já órfãos
UPDATE public.veiculos v
   SET status = 'em_analise'::status_veiculo,
       cobertura_suspensa = true,
       cobertura_suspensa_motivo = COALESCE(cobertura_suspensa_motivo, 'Recusa do instalador — aguardando análise do monitoramento'),
       cobertura_suspensa_em = COALESCE(cobertura_suspensa_em, now()),
       updated_at = now()
  FROM public.servicos s
 WHERE s.veiculo_id = v.id
   AND s.decisao_instalador = 'negado'
   AND s.status::text = 'em_analise'
   AND v.status::text = 'instalacao_pendente';

UPDATE public.instalacoes i
   SET status = 'em_analise'::status_instalacao,
       observacoes = COALESCE(i.observacoes,'') ||
                     E'\n[Backfill: negada pelo instalador — aguardando análise do monitoramento]',
       updated_at = now()
  FROM public.servicos s
 WHERE s.instalacao_origem_id = i.id
   AND s.decisao_instalador = 'negado'
   AND i.status::text NOT IN ('cancelada','concluida','em_analise');