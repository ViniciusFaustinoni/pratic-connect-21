-- Inserir configuração de FIPE mínimo para exigência de rastreador
INSERT INTO configuracoes (chave, valor, tipo, categoria, descricao, editavel)
VALUES (
  'operacional_fipe_minimo_rastreador',
  '30000',
  'moeda',
  'operacional',
  'Valor FIPE mínimo para exigir instalação de rastreador. Veículos abaixo deste valor dispensam rastreador.',
  true
) ON CONFLICT (chave) DO NOTHING;