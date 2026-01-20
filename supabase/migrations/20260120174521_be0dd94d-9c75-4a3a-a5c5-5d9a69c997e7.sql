-- Habilitar realtime para tabelas do fluxo de vendas/contratação
-- Isso permite que mudanças feitas pelo cliente sejam refletidas automaticamente na tela do vendedor

ALTER PUBLICATION supabase_realtime ADD TABLE cotacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE vistorias;
ALTER PUBLICATION supabase_realtime ADD TABLE instalacoes;