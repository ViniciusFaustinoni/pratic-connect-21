-- 1) Estender trigger fn_reativar_cobertura_pos_instalacao para também
--    promover veiculos.status='ativo' quando a instalação conclui.
--    Antes só religava coberturas; agora também finaliza ativação do veículo
--    para o caso de inclusão sem R/F (em que o veículo fica 'instalacao_pendente').

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

    -- Religa coberturas se o veículo estava com cobertura suspensa
    -- por timeout de instalação (preserva escopo da memória existente).
    UPDATE public.veiculos
       SET cobertura_suspensa = false,
           cobertura_suspensa_motivo = NULL,
           cobertura_suspensa_em = NULL,
           cobertura_total = true,
           cobertura_roubo_furto = true
     WHERE id = NEW.veiculo_id
       AND cobertura_suspensa = true;

    -- Promove veículo para 'ativo' caso ainda esteja em pré-ativação
    -- (caso novo: inclusão sem R/F que aguardava instalação física).
    UPDATE public.veiculos
       SET status = 'ativo',
           updated_at = now()
     WHERE id = NEW.veiculo_id
       AND status IN ('instalacao_pendente', 'em_analise');
  END IF;
  RETURN NEW;
END;
$function$;

-- 2) Correção pontual do veículo RKL6I08 do JOAO VICTOR — instalação ainda
--    'agendada' (05/05), sem R/F escolhido na cotação. Voltar para
--    'instalacao_pendente' e desligar coberturas até a instalação concluir.
UPDATE public.veiculos
   SET status = 'instalacao_pendente',
       cobertura_total = false,
       cobertura_roubo_furto = false,
       updated_at = now()
 WHERE id = '1b63e620-43c0-4108-b80d-f46edb1236d0'
   AND status = 'ativo';

-- 3) Log de auditoria
INSERT INTO public.ativacao_status_log (
  associado_id, contrato_id, from_status, to_status, source, payload
) VALUES (
  'e6551c17-9165-4275-a2bd-2a2a1c9b7d66',
  'ae3e0ac3-0506-4998-a4d5-bd270b70eabc',
  'ativo',
  'instalacao_pendente',
  'migration:rollback_veiculo_RKL6I08_pre_instalacao',
  jsonb_build_object(
    'veiculo_id', '1b63e620-43c0-4108-b80d-f46edb1236d0',
    'placa', 'RKL6I08',
    'motivo', 'Veículo novo de inclusão sem cobertura R/F não pode ficar ativo antes da instalação concluir',
    'instalacao_id', '3cbd44ea-4f92-48f5-9e7e-7aa06de8dfc8'
  )
);