-- Função que verifica e conclui a rota automaticamente quando todos os serviços são concluídos
CREATE OR REPLACE FUNCTION public.verificar_conclusao_rota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rota_id UUID;
  v_rota_status TEXT;
  v_total_instalacoes INTEGER;
  v_concluidas_instalacoes INTEGER;
  v_total_vistorias INTEGER;
  v_concluidas_vistorias INTEGER;
BEGIN
  -- Obter rota_id do registro atualizado
  v_rota_id := NEW.rota_id;
  
  -- Se não tem rota vinculada, sair
  IF v_rota_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Verificar status atual da rota
  SELECT status INTO v_rota_status FROM rotas WHERE id = v_rota_id;
  
  -- Só processa se a rota estiver em_andamento
  IF v_rota_status IS NULL OR v_rota_status != 'em_andamento' THEN
    RETURN NEW;
  END IF;
  
  -- Contar instalações da rota
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'concluida')
  INTO v_total_instalacoes, v_concluidas_instalacoes
  FROM instalacoes
  WHERE rota_id = v_rota_id;
  
  -- Contar vistorias da rota
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('aprovada', 'reprovada'))
  INTO v_total_vistorias, v_concluidas_vistorias
  FROM vistorias
  WHERE rota_id = v_rota_id;
  
  -- Atualizar contadores na rota
  UPDATE rotas SET
    total_servicos = v_total_instalacoes + v_total_vistorias,
    total_concluidos = v_concluidas_instalacoes + v_concluidas_vistorias,
    updated_at = NOW()
  WHERE id = v_rota_id;
  
  -- Se todos os serviços estão concluídos, concluir a rota
  IF (v_total_instalacoes + v_total_vistorias) > 0 
     AND (v_concluidas_instalacoes + v_concluidas_vistorias) = (v_total_instalacoes + v_total_vistorias) THEN
    UPDATE rotas SET
      status = 'concluida',
      updated_at = NOW()
    WHERE id = v_rota_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para instalações - dispara quando status muda para concluída
DROP TRIGGER IF EXISTS trigger_verificar_conclusao_rota_instalacao ON instalacoes;
CREATE TRIGGER trigger_verificar_conclusao_rota_instalacao
  AFTER UPDATE OF status ON instalacoes
  FOR EACH ROW
  WHEN (NEW.status = 'concluida' AND NEW.rota_id IS NOT NULL)
  EXECUTE FUNCTION verificar_conclusao_rota();

-- Trigger para vistorias - dispara quando status muda para aprovada ou reprovada
DROP TRIGGER IF EXISTS trigger_verificar_conclusao_rota_vistoria ON vistorias;
CREATE TRIGGER trigger_verificar_conclusao_rota_vistoria
  AFTER UPDATE OF status ON vistorias
  FOR EACH ROW
  WHEN (NEW.status IN ('aprovada', 'reprovada') AND NEW.rota_id IS NOT NULL)
  EXECUTE FUNCTION verificar_conclusao_rota();