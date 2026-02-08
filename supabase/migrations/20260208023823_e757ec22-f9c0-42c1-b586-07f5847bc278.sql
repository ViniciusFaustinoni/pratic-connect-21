-- =====================================================
-- CORREÇÃO DE DADOS DESINCRONIZADOS
-- =====================================================

-- 1. Corrigir status do serviço para voltar a aparecer no menu do instalador
UPDATE servicos 
SET status = 'em_andamento', 
    updated_at = NOW()
WHERE id = 'ff578a8f-6640-4e65-b578-54afe90798c7';

-- 2. Excluir a vistoria VIS-2026-56262 (manutenção pendente órfã)
DELETE FROM servicos 
WHERE id = 'c84dc7ed-bc5c-4d21-9513-531021456262';

-- =====================================================
-- CORREÇÃO ESTRUTURAL: Trigger bidirecional servicos → instalacoes
-- =====================================================

-- Função que sincroniza mudanças de status de servicos para instalacoes
CREATE OR REPLACE FUNCTION sync_servicos_to_instalacao()
RETURNS TRIGGER AS $$
BEGIN
  -- Só sincroniza se tiver instalacao_origem_id definido
  IF NEW.instalacao_origem_id IS NOT NULL THEN
    -- Atualiza a instalação correspondente apenas se o status for diferente
    UPDATE instalacoes
    SET 
      status = CASE 
        WHEN NEW.status IN ('pendente', 'agendada', 'em_rota', 'em_andamento', 'concluida', 'cancelada', 'reagendar') 
        THEN (NEW.status::text)::status_instalacao
        ELSE status -- Mantém o status atual se não for um status válido para instalacao
      END,
      updated_at = NOW()
    WHERE id = NEW.instalacao_origem_id
      AND status::text IS DISTINCT FROM NEW.status::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remove trigger anterior se existir
DROP TRIGGER IF EXISTS trigger_sync_servicos_to_instalacao ON servicos;

-- Cria o trigger que dispara quando o status do serviço muda
CREATE TRIGGER trigger_sync_servicos_to_instalacao
AFTER UPDATE ON servicos
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION sync_servicos_to_instalacao();

-- Adiciona comentário explicativo
COMMENT ON FUNCTION sync_servicos_to_instalacao() IS 
  'Sincroniza mudanças de status da tabela servicos para a tabela instalacoes (sentido reverso). Garante paridade bidirecional entre as tabelas.';