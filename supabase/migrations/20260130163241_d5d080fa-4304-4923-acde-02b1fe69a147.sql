-- Atualizar função de sincronização servicos → instalacoes para sincronizar profissional e status intermediários
CREATE OR REPLACE FUNCTION public.sync_servico_to_instalacao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    IF NEW.status IN ('em_rota', 'em_andamento') 
       AND OLD.status IS DISTINCT FROM NEW.status THEN
      UPDATE instalacoes
      SET 
        status = NEW.status::status_instalacao,
        updated_at = NOW()
      WHERE id = NEW.instalacao_origem_id;
    END IF;
    
    -- Sincronizar conclusão (lógica existente)
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
$$;

-- Corrigir instalações existentes que não têm instalador_id mas o serviço tem
UPDATE instalacoes i
SET 
  instalador_id = s.profissional_id,
  updated_at = NOW()
FROM servicos s
WHERE s.instalacao_origem_id = i.id
  AND s.profissional_id IS NOT NULL
  AND i.instalador_id IS NULL;