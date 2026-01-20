-- Habilitar Realtime para tabelas críticas do App Associado
-- Primeiro verificar quais já estão na publicação e adicionar as faltantes

-- Adicionar tabelas à publicação supabase_realtime
DO $$
BEGIN
  -- Tentar adicionar cada tabela (ignora erro se já existir)
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE associados;
    RAISE NOTICE 'Tabela associados adicionada ao realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Tabela associados já está no realtime';
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE leads;
    RAISE NOTICE 'Tabela leads adicionada ao realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Tabela leads já está no realtime';
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE cobrancas;
    RAISE NOTICE 'Tabela cobrancas adicionada ao realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Tabela cobrancas já está no realtime';
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE documentos;
    RAISE NOTICE 'Tabela documentos adicionada ao realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Tabela documentos já está no realtime';
  END;
END $$;

-- Configurar REPLICA IDENTITY FULL para capturar dados antigos em updates
ALTER TABLE associados REPLICA IDENTITY FULL;
ALTER TABLE cobrancas REPLICA IDENTITY FULL;