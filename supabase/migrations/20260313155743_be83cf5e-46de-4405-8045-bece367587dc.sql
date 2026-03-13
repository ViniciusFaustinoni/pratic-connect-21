
-- Adicionar 'documentos' ao check constraint de categoria
ALTER TABLE configuracoes DROP CONSTRAINT configuracoes_categoria_check;
ALTER TABLE configuracoes ADD CONSTRAINT configuracoes_categoria_check 
  CHECK (categoria::text = ANY (ARRAY['empresa','financeiro','operacional','notificacoes','integracao','seguranca','atuarial','rateio','documentos']));

-- Inserir configurações de posição de rubrica e assinatura
INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel) VALUES
  ('rubrica_posicao_x', '78.0', 'numero', 'documentos', 'Posição X (%) da rubrica nas páginas do documento', true),
  ('rubrica_posicao_y', '95.0', 'numero', 'documentos', 'Posição Y (%) da rubrica nas páginas do documento', true),
  ('assinatura_posicao_x', '65.0', 'numero', 'documentos', 'Posição X (%) da assinatura na última página', true),
  ('assinatura_posicao_y', '85.0', 'numero', 'documentos', 'Posição Y (%) da assinatura na última página', true),
  ('assinatura_total_paginas', '20', 'numero', 'documentos', 'Número máximo de páginas para posicionamento (páginas excedentes são ignoradas pela API)', true)
ON CONFLICT (chave) DO NOTHING;
