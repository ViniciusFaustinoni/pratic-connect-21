-- Adicionar campo permite_encaixe nas tabelas de serviços
ALTER TABLE instalacoes ADD COLUMN IF NOT EXISTS permite_encaixe BOOLEAN DEFAULT false;
ALTER TABLE vistorias ADD COLUMN IF NOT EXISTS permite_encaixe BOOLEAN DEFAULT false;

-- Configurações de encaixe
INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES 
  ('operacional_encaixe_raio_km', '10', 'numero', 'operacional', 'Raio máximo em km para exibir encaixes disponíveis ao vistoriador', true),
  ('operacional_encaixe_janela_horas', '2', 'numero', 'operacional', 'Janela de horas sem tarefas para permitir que o vistoriador veja encaixes', true)
ON CONFLICT (chave) DO NOTHING;