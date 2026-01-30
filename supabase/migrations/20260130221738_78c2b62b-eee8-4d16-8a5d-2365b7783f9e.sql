-- Corrigir função de sincronização servicos -> instalacoes
-- PROBLEMA: Cast direto entre enums (status_servico -> status_instalacao) não é permitido
-- SOLUÇÃO: Fazer cast via TEXT intermediário

CREATE OR REPLACE FUNCTION public.sync_servico_to_instalacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Só sincronizar para serviços do tipo instalação
  IF NEW.tipo = 'instalacao' AND NEW.instalacao_origem_id IS NOT NULL THEN
    
    -- Sincronizar profissional quando atribuído
    IF NEW.profissional_id IS DISTINCT FROM OLD.profissional_id THEN
      UPDATE instalacoes
      SET 
        instalador_id = NEW.profissional_id,
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id;
    END IF;
    
    -- Sincronizar status quando muda para em_rota ou em_andamento
    -- CORREÇÃO: Cast através de TEXT para evitar erro de tipo
    IF NEW.status IN ('em_rota', 'em_andamento') 
       AND OLD.status IS DISTINCT FROM NEW.status THEN
      UPDATE instalacoes
      SET 
        status = (NEW.status::text)::status_instalacao,
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