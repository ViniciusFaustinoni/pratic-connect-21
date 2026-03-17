INSERT INTO public.configuracoes (chave, valor, tipo, categoria, descricao)
VALUES 
  ('troca_titularidade_prazo_dispensa_vistoria', '0', 'numero', 'operacional', 'Prazo máximo em dias para considerar troca no mesmo dia e dispensar vistoria'),
  ('troca_titularidade_dispensa_vistoria_ativa', 'true', 'booleano', 'operacional', 'Permitir dispensa de vistoria quando a troca ocorre dentro do prazo configurado')
ON CONFLICT (chave) DO NOTHING;