-- Habilitar Realtime para a tabela contratos
-- Isso permite que eventos de UPDATE sejam propagados para o frontend
ALTER PUBLICATION supabase_realtime ADD TABLE contratos;