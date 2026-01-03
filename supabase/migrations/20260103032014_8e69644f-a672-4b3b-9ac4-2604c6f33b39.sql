-- Habilitar replica identity para capturar dados completos no realtime
ALTER TABLE notificacoes REPLICA IDENTITY FULL;

-- Adicionar tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;