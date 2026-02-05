-- Adicionar tabela documentos_solicitados à publicação Realtime
-- Isso permitirá que mudanças nesta tabela sejam transmitidas em tempo real para os clientes
ALTER PUBLICATION supabase_realtime ADD TABLE public.documentos_solicitados;