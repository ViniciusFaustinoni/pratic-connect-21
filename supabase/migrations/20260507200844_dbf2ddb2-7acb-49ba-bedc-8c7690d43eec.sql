-- 1) Ajustar trigger: sempre promover cobertura_total ao concluir instalação
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

    -- Caso A: veículo estava com cobertura suspensa (timeout 48h) → religa tudo
    UPDATE public.veiculos
       SET cobertura_suspensa = false,
           cobertura_suspensa_motivo = NULL,
           cobertura_suspensa_em = NULL,
           cobertura_total = true,
           cobertura_roubo_furto = true
     WHERE id = NEW.veiculo_id
       AND cobertura_suspensa = true;

    -- Caso B: instalação concluída normalmente → garante Proteção 360º ativa
    -- (corrige limbo onde veículo ficava só com Roubo/Furto após instalação)
    UPDATE public.veiculos
       SET cobertura_total = true,
           cobertura_roubo_furto = true,
           updated_at = now()
     WHERE id = NEW.veiculo_id
       AND cobertura_suspensa = false
       AND cobertura_total = false;

    -- Promove veículo para 'ativo' caso ainda esteja em pré-ativação
    UPDATE public.veiculos
       SET status = 'ativo',
           updated_at = now()
     WHERE id = NEW.veiculo_id
       AND status IN ('instalacao_pendente', 'em_analise');
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Corrigir veículo do MARCUS AURELIO (LSQ6E05) cuja instalação já está concluída
UPDATE public.veiculos
   SET cobertura_total = true,
       cobertura_roubo_furto = true,
       updated_at = now()
 WHERE id = '6c240d65-764c-45f7-8158-f73008407a64';