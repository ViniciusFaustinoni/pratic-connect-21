-- Forçar TODA instalação concluída a passar pela aprovação manual do Monitoramento
-- antes de ativar cobertura/SGA. Mantém apenas religamento de cobertura suspensa
-- (caso 48h) que é operação de reativação, não de ativação inicial.

-- 1) Trigger em servicos: remove ativação automática de cobertura_total
CREATE OR REPLACE FUNCTION public.fn_reativar_cobertura_pos_instalacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo = 'instalacao'
     AND NEW.status = 'concluida'
     AND (OLD.status IS DISTINCT FROM 'concluida'::status_servico)
     AND NEW.veiculo_id IS NOT NULL THEN

    -- APENAS religar cobertura previamente SUSPENSA (timeout 48h não-instalação).
    -- Não ativa cobertura nova: isso é responsabilidade exclusiva do monitoramento
    -- via edge function ativar-associado.
    UPDATE public.veiculos
       SET cobertura_suspensa = false,
           cobertura_suspensa_motivo = NULL,
           cobertura_suspensa_em = NULL
     WHERE id = NEW.veiculo_id
       AND cobertura_suspensa = true;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Trigger em instalacoes: idem
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

    -- Caso A: religar cobertura suspensa (timeout 48h). Mantido.
    UPDATE public.veiculos
       SET cobertura_suspensa = false,
           cobertura_suspensa_motivo = NULL,
           cobertura_suspensa_em = NULL
     WHERE id = NEW.veiculo_id
       AND cobertura_suspensa = true;

    -- Caso B (REMOVIDO): ativação automática de cobertura_total/roubo_furto e
    -- promoção de status para 'ativo'. Tudo isso passa a ser feito apenas
    -- na aprovação manual do Monitoramento via edge function ativar-associado.
  END IF;
  RETURN NEW;
END;
$function$;

-- 3) Cron de reconciliação: não ativa cobertura nem promove status sozinho.
-- Apenas reporta divergências para auditoria/manutenção operacional.
CREATE OR REPLACE FUNCTION public.fn_reconciliar_status_pos_instalacao()
RETURNS TABLE(veiculo_id uuid, placa text, acao text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Só corrige veículos que JÁ FORAM aprovados pelo monitoramento
  -- (associado.status='ativo') mas ficaram presos em instalacao_pendente.
  -- Não toca em cobertura_total/roubo_furto nem ativa coberturas.
  RETURN QUERY
  WITH divergentes AS (
    SELECT v.id, v.placa
    FROM public.veiculos v
    JOIN public.associados a ON a.id = v.associado_id
    WHERE v.status = 'instalacao_pendente'
      AND a.status = 'ativo'
      AND (
        EXISTS (SELECT 1 FROM public.instalacoes i WHERE i.veiculo_id = v.id AND i.status = 'concluida')
        OR EXISTS (SELECT 1 FROM public.servicos s WHERE s.veiculo_id = v.id AND s.tipo = 'instalacao' AND s.status = 'concluida')
      )
  ),
  upd AS (
    UPDATE public.veiculos v
       SET status = 'ativo',
           updated_at = now()
      FROM divergentes d
      WHERE v.id = d.id
    RETURNING v.id, v.placa
  )
  SELECT u.id, u.placa, 'promovido_para_ativo_pos_aprovacao'::text FROM upd u;
END;
$function$;