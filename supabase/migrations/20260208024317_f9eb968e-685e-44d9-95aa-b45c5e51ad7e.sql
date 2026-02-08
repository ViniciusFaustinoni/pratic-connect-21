-- Correção: Função sync_servicos_to_instalacao com valores de enum válidos
-- Problema: A versão anterior usava 'reagendar' (não existe) e 'pendente' (não existe em status_instalacao)

CREATE OR REPLACE FUNCTION sync_servicos_to_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Só sincroniza se tiver instalacao_origem_id definido
  IF NEW.instalacao_origem_id IS NOT NULL THEN
    -- CORREÇÃO: Lista de status válidos para status_instalacao
    -- status_instalacao = {agendada, em_rota, em_andamento, concluida, reagendada, cancelada}
    UPDATE instalacoes
    SET 
      status = CASE 
        WHEN NEW.status::text IN ('agendada', 'em_rota', 'em_andamento', 'concluida', 'reagendada', 'cancelada') 
        THEN (NEW.status::text)::status_instalacao
        ELSE status -- Mantém o status atual se não for mapeável
      END,
      updated_at = NOW()
    WHERE id = NEW.instalacao_origem_id
      AND status::text IS DISTINCT FROM NEW.status::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;