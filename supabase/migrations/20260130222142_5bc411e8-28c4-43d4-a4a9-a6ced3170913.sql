-- Corrigir função de sincronização servicos -> instalacoes
-- PROBLEMA 1: Cast direto entre enums causava erro (já corrigido anteriormente)
-- PROBLEMA 2: A trigger validar_status_instalacao exige instalador_responsavel_id para status em_rota
-- SOLUÇÃO: Atualizar instalador_responsavel_id E status no mesmo UPDATE

CREATE OR REPLACE FUNCTION public.sync_servico_to_instalacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Só sincronizar para serviços do tipo instalação
  IF NEW.tipo = 'instalacao' AND NEW.instalacao_origem_id IS NOT NULL THEN
    
    -- Sincronizar profissional E status quando muda para em_rota ou em_andamento
    -- CORREÇÃO: Fazer em um único UPDATE para satisfazer a validação
    IF NEW.status IN ('em_rota', 'em_andamento') 
       AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.profissional_id IS DISTINCT FROM NEW.profissional_id) THEN
      UPDATE instalacoes
      SET 
        instalador_id = NEW.profissional_id,
        instalador_responsavel_id = NEW.profissional_id,  -- CAMPO OBRIGATÓRIO para validação
        status = (NEW.status::text)::status_instalacao,
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id;
    -- Caso apenas o profissional tenha mudado (sem mudar status)
    ELSIF NEW.profissional_id IS DISTINCT FROM OLD.profissional_id THEN
      UPDATE instalacoes
      SET 
        instalador_id = NEW.profissional_id,
        instalador_responsavel_id = COALESCE(NEW.profissional_id, instalador_responsavel_id),
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id;
    END IF;
    
    -- Sincronizar conclusão
    IF NEW.status = 'concluida' AND OLD.status IS DISTINCT FROM NEW.status THEN
      UPDATE instalacoes
      SET 
        status = 'concluida',
        concluida_em = COALESCE(NEW.concluida_em, NOW()),
        instalador_responsavel_id = COALESCE(NEW.profissional_id, instalador_responsavel_id),
        rastreador_id = COALESCE(NEW.rastreador_id, rastreador_id),
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id;
    END IF;
    
  END IF;
  
  RETURN NEW;
END;
$function$;