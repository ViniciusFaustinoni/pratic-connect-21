-- Corrigir rastreador que está em manutencao sem serviço ativo
UPDATE rastreadores
SET 
  status = 'instalado',
  updated_at = NOW()
WHERE id = '3f41f3c1-cbe5-47fc-b305-d1291abc407d'
  AND status = 'manutencao';

-- Registrar movimentação (usando tipo válido: retorno_manutencao)
INSERT INTO estoque_movimentacoes (
  tipo, quantidade, status_anterior, status_novo, 
  rastreador_id, observacoes
) VALUES (
  'retorno_manutencao', 1, 'manutencao', 'instalado',
  '3f41f3c1-cbe5-47fc-b305-d1291abc407d',
  'Correção manual: rastreador não foi atualizado quando manutenção foi cancelada'
);